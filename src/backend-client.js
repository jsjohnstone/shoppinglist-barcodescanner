import axios from 'axios';
import { config } from './config.js';
import logger from './logger.js';

class BackendClient {
  constructor() {
    this.baseURL = config.get('backend_url');
    this.deviceId = config.get('device_id');
    this.authToken = config.get('auth_token');
    this.deviceConfig = null;
  }

  getAxiosInstance() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return axios.create({
      baseURL: this.baseURL,
      headers,
      timeout: 30000,
    });
  }

  async register(usbDevices = []) {
    try {
      logger.info(`Registering device: ${this.deviceId}`);
      const api = this.getAxiosInstance();
      
      const response = await api.post('/api/devices/register', {
        device_id: this.deviceId,
        usb_devices: usbDevices,
      });

      this.authToken = response.data.auth_token;
      config.set('auth_token', this.authToken);

      logger.info(`Device registered successfully. Status: ${response.data.status}`);
      return response.data;
    } catch (error) {
      logger.error(`Registration failed: ${error.message}`);
      throw error;
    }
  }

  async getConfig() {
    try {
      const api = this.getAxiosInstance();
      const response = await api.get('/api/devices/config');
      
      this.deviceConfig = response.data;
      logger.info(`Device config fetched. Approved: ${response.data.is_approved}`);
      
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch config: ${error.message}`);
      throw error;
    }
  }

  async sendHeartbeat(status = 'online') {
    try {
      const api = this.getAxiosInstance();
      await api.post('/api/devices/heartbeat', { status });
      logger.debug('Heartbeat sent');
    } catch (error) {
      logger.error(`Heartbeat failed: ${error.message}`);
    }
  }

  async sendBarcode(barcode) {
    try {
      logger.info(`Sending barcode: ${barcode}`);
      const api = this.getAxiosInstance();
      
      // Use device authentication (auth token) instead of API key
      const response = await api.post('/api/items/barcode', {
        barcode,
        device_id: this.deviceId,
      });

      logger.info(`Barcode processed: ${response.data.success ? 'success' : 'not found'}`);
      if (response.data.tts_message) {
        logger.info(`TTS message: ${response.data.tts_message}`);
      }
      
      return response.data;
    } catch (error) {
      if (error.response) {
        logger.error(`Barcode processing failed: ${error.response.data.error || error.message}`);
        return {
          success: false,
          error: error.response.data.error || error.message,
          tts_message: error.response.data.tts_message,
        };
      }
      logger.error(`Barcode request failed: ${error.message}`);
      throw error;
    }
  }

  isApproved() {
    return this.deviceConfig?.is_approved === true;
  }

  getUsbDevicePath() {
    return this.deviceConfig?.usb_device_path || '/dev/ttyACM0';
  }
}

export const backendClient = new BackendClient();
