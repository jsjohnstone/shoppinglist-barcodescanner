import winston from 'winston';
import { config } from './config.js';

const logger = winston.createLogger({
  level: config.get('log_level'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/app/logs/scanner.log', maxsize: 10485760 }),
  ],
});

export default logger;
