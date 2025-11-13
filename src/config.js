import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '../config/device.json');

class Config {
  constructor() {
    this.config = {
      device_id: null,
      auth_token: null,
      backend_url: process.env.BACKEND_URL || 'http://localhost:3000',
      log_level: process.env.LOG_LEVEL || 'info',
      test_mode: process.env.TEST_MODE || 'false',
      poll_interval: 5 * 60 * 1000, // 5 minutes
      heartbeat_interval: 5 * 60 * 1000, // 5 minutes
      approval_poll_interval: 30 * 1000, // 30 seconds when waiting for approval
    };

    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        this.config = { ...this.config, ...saved };
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  saveConfig() {
    try {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({
        device_id: this.config.device_id,
        auth_token: this.config.auth_token,
      }, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    this.config[key] = value;
    if (key === 'device_id' || key === 'auth_token') {
      this.saveConfig();
    }
  }
}

export const config = new Config();
