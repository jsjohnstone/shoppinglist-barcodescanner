import { SerialPort } from 'serialport';
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout';
import EventEmitter from 'events';
import logger from './logger.js';
import { config } from './config.js';

class Scanner extends EventEmitter {
  constructor(devicePath) {
    super();
    this.devicePath = devicePath;
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.testMode = config.get('test_mode');
  }

  async connect() {
    if (this.testMode === 'stdin') {
      logger.info('Running in STDIN test mode');
      this.setupStdinMode();
      return;
    }

    if (this.testMode === 'http') {
      logger.info('Running in HTTP test mode on port 8080');
      this.setupHttpMode();
      return;
    }

    try {
      logger.info(`Connecting to scanner at ${this.devicePath}`);
      
      this.port = new SerialPort({
        path: this.devicePath,
        baudRate: 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      });

      // Use InterByteTimeoutParser since scanner doesn't send line endings
      // Emits data after 50ms of silence (no new bytes received)
      this.parser = this.port.pipe(new InterByteTimeoutParser({ interval: 50 }));

      this.port.on('open', () => {
        logger.info('Scanner connected');
        this.isConnected = true;
        this.emit('connected');
      });

      this.port.on('error', (err) => {
        logger.error(`Scanner error: ${err.message}`);
        this.isConnected = false;
        this.emit('error', err);
      });

      this.port.on('close', () => {
        logger.warn('Scanner disconnected');
        this.isConnected = false;
        this.emit('disconnected');
      });

      this.parser.on('data', (data) => {
        const barcode = data.toString().trim();
        // Filter out LED command echoes (AISGDT10. pattern)
        if (barcode && !barcode.includes('AISGDT10')) {
          logger.info(`Barcode scanned: ${barcode}`);
          this.emit('barcode', barcode);
        } else if (barcode) {
          logger.debug(`Ignored LED command echo: ${barcode}`);
        }
      });
    } catch (error) {
      logger.error(`Failed to connect to scanner: ${error.message}`);
      throw error;
    }
  }

  setupStdinMode() {
    logger.info('Setting up STDIN mode for testing');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      const barcode = data.trim();
      if (barcode) {
        logger.info(`Test barcode from stdin: ${barcode}`);
        this.emit('barcode', barcode);
      }
    });
    this.isConnected = true;
    this.emit('connected');
  }

  setupHttpMode() {
    // Simple HTTP server for testing
    import('http').then((http) => {
      const server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/scan') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { barcode } = JSON.parse(body);
              if (barcode) {
                logger.info(`Test barcode from HTTP: ${barcode}`);
                this.emit('barcode', barcode);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } else {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'No barcode provided' }));
              }
            } catch (error) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(8080, () => {
        logger.info('HTTP test server listening on port 8080');
        this.isConnected = true;
        this.emit('connected');
      });
    });
  }

  async disconnect() {
    if (this.port && this.port.isOpen) {
      await new Promise((resolve) => {
        this.port.close(() => {
          logger.info('Scanner disconnected');
          resolve();
        });
      });
    }
    this.isConnected = false;
  }

  async flashLED(pattern = 'success') {
    if (this.testMode !== 'false' || !this.port || !this.port.isOpen) {
      logger.debug(`LED flash (${pattern}) - test mode or no port`);
      return;
    }

    try {
      // Command to flash LED on LSR116 scanner
      // Success: 3 quick flashes
      const command = Buffer.from([0x16, 0x4D, 0x0D]);
      const data = 'AISGDT10.';
      
      this.port.write(command);
      this.port.write(data);
      
      logger.debug(`LED flashed: ${pattern}`);
    } catch (error) {
      logger.error(`LED flash failed: ${error.message}`);
    }
  }
}

export default Scanner;
