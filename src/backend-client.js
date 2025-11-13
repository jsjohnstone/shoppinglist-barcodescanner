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
      
      // Log API error event when backend is unreachable
      logger.error(`Barcode request failed: ${error.message}`);
      await this.logEvent('api_error', 'Backend API unreachable', {
        error: error.message,
        barcode: barcode,
      }).catch(() => {}); // Silent fail on event logging
      
      throw error;
    }
  }

  async logEvent(type, message, metadata = null) {
    try {
      // We need to get the device database ID first
      if (!this.deviceConfig) {
        await this.getConfig();
      }
      
      // Extract device ID from config if available
      // Note: The backend needs to support logging events by device_id instead of database id
      // For now, this is a placeholder that will need backend support
      const api = this.getAxiosInstance();
      await api.post('/api/devices/events', {
        type,
        message,
        metadata,
        device_id: this.deviceId,
      });
      
      logger.debug(`Event logged: ${type} - ${message}`);
    } catch (error) {
      // Silent fail - event logging should never break the scanner
      logger.debug(`Failed to log event: ${error.message}`);
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
