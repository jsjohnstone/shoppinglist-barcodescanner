FROM node:18-alpine

# Install build dependencies for serialport native module
RUN apk add --no-cache python3 make g++ linux-headers udev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY src/ ./src/

# Create directories for config and logs
RUN mkdir -p /app/config /app/logs

# Set proper permissions
RUN chmod -R 755 /app

# Volumes for persistent data
VOLUME ["/app/config", "/app/logs"]

# Environment variables
ENV NODE_ENV=production \
    BACKEND_URL=http://backend:3000 \
    LOG_LEVEL=info \
    TEST_MODE=false

CMD ["node", "src/index.js"]
