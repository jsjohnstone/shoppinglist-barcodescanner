import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import logger from './logger.js';
import { backendClient } from './backend-client.js';
import Scanner from './scanner.js';
import fs from 'fs';

let scanner = null;
let heartbeatInterval = null;
let configPollInterval = null;
let isProcessing = false;

// Detect USB devices (for registration)
function detectUSBDevices() {
  try {
    if (fs.existsSync('/dev')) {
      const devices = fs.readdirSync('/dev')
        .filter(file => file.startsWith('ttyACM') || file.startsWith('ttyUSB'))
        .map(file => `/dev/${file}`);
      return devices;
    }
  } catch (error) {
    logger.warn(`Could not detect USB devices: ${error.message}`);
  }
  return [];
}

// Initialize device ID
function initializeDeviceId() {
  let deviceId = config.get('device_id');
  
  if (!deviceId) {
    deviceId = uuidv4();
    config.set('device_id', deviceId);
    logger.info(`Generated new device ID: ${deviceId}`);
  } else {
    logger.info(`Using existing device ID: ${deviceId}`);
  }
  
  backendClient.deviceId = deviceId;
  return deviceId;
}

// Wait for device approval
async function waitForApproval() {
  logger.info('Waiting for device approval...');
  
  return new Promise((resolve) => {
    const checkApproval = async () => {
      try {
        const deviceConfig = await backendClient.getConfig();
        
        if (deviceConfig.is_approved) {
          logger.info('Device approved!');
          resolve(deviceConfig);
        } else {
          logger.debug('Still waiting for approval...');
          setTimeout(checkApproval, config.get('approval_poll_interval'));
        }
      } catch (error) {
        logger.error(`Error checking approval: ${error.message}`);
        setTimeout(checkApproval, config.get('approval_poll_interval'));
      }
    };
    
    checkApproval();
  });
}

// Handle barcode scan
async function handleBarcode(barcode) {
  if (isProcessing) {
    logger.warn('Already processing a barcode, ignoring...');
    return;
  }

  isProcessing = true;
  
  try {
    // Flash processing indicator
    if (scanner) {
      await scanner.flashLED('processing');
    }

    // Send barcode to backend
    const result = await backendClient.sendBarcode(barcode);
    
    // Flash result indicator
    if (scanner) {
      if (result.success) {
        await scanner.flashLED('success');
      } else if (result.error?.includes('not found')) {
        await scanner.flashLED('warning');
      } else {
        await scanner.flashLED('error');
      }
    }

    logger.info(`Barcode processed: ${result.success ? 'success' : 'failed'}`);
  } catch (error) {
    logger.error(`Error processing barcode: ${error.message}`);
    if (scanner) {
      await scanner.flashLED('error');
    }
  } finally {
    isProcessing = false;
  }
}

// Start scanner
async function startScanner(devicePath) {
  logger.info(`Starting scanner on ${devicePath}`);
  
  scanner = new Scanner(devicePath);
  
  scanner.on('connected', () => {
    logger.info('Scanner ready');
  });
  
  scanner.on('barcode', handleBarcode);
  
  scanner.on('disconnected', () => {
    logger.warn('Scanner disconnected, attempting to reconnect...');
    setTimeout(() => {
      scanner.connect().catch(err => {
        logger.error(`Reconnection failed: ${err.message}`);
      });
    }, 10000);
  });
  
  scanner.on('error', (error) => {
    logger.error(`Scanner error: ${error.message}`);
  });
  
  await scanner.connect();
}

// Start background tasks
function startBackgroundTasks() {
  // Heartbeat
  heartbeatInterval = setInterval(async () => {
    try {
      await backendClient.sendHeartbeat('online');
    } catch (error) {
      logger.error(`Heartbeat error: ${error.message}`);
    }
  }, config.get('heartbeat_interval'));
  
  // Config polling
  configPollInterval = setInterval(async () => {
    try {
      await backendClient.getConfig();
    } catch (error) {
      logger.debug(`Config poll error: ${error.message}`);
    }
  }, config.get('poll_interval'));
  
  logger.info('Background tasks started');
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (configPollInterval) clearInterval(configPollInterval);
  
  if (scanner) {
    await scanner.disconnect();
  }
  
  await backendClient.sendHeartbeat('offline');
  
  logger.info('Shutdown complete');
  process.exit(0);
}

// Main function
async function main() {
  try {
    logger.info('=== Barcode Scanner Starting ===');
    logger.info(`Backend URL: ${config.get('backend_url')}`);
    logger.info(`Test Mode: ${config.get('test_mode')}`);
    
    // Initialize device ID
    const deviceId = initializeDeviceId();
    
    // Detect USB devices
    const usbDevices = detectUSBDevices();
    logger.info(`Detected USB devices: ${usbDevices.join(', ') || 'none'}`);
    
    // Register or load existing registration
    let authToken = config.get('auth_token');
    
    if (!authToken) {
      logger.info('No auth token found, registering device...');
      await backendClient.register(usbDevices);
    } else {
      logger.info('Using existing auth token');
      backendClient.authToken = authToken;
    }
    
    // Check if approved
    let deviceConfig = await backendClient.getConfig();
    
    if (!deviceConfig.is_approved) {
      logger.info('Device not yet approved');
      deviceConfig = await waitForApproval();
    }
    
    // Get scanner device path from config or default
    const devicePath = backendClient.getUsbDevicePath();
    logger.info(`Using scanner device path: ${devicePath}`);
    
    // Start scanner
    await startScanner(devicePath);
    
    // Start background tasks
    startBackgroundTasks();
    
    logger.info('=== Scanner ready ===');
    
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Handle signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
main();
