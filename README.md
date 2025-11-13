# Barcode Scanner Application

Raspberry Pi barcode scanner application for the shopping list system with Home Assistant TTS integration.

## Features

- **Auto-registration**: Devices automatically register with the backend on first startup
- **Device approval workflow**: Admin must approve devices before they can operate
- **TTS announcements**: Announces scan results via Home Assistant speakers
- **LED feedback**: Visual feedback for scan success/failure
- **Automatic reconnection**: Handles network and USB disconnections gracefully
- **Test modes**: STDIN and HTTP modes for testing without hardware

## Hardware Requirements

- Raspberry Pi (3/4/5 or Zero 2 W)
- Access-IS LSR116 2D Barcode Scanner (or compatible CDC Serial scanner)
- USB connection

## Setup

### 1. Backend Configuration

First, set up the backend server:

1. Configure Home Assistant integration in Settings > Home Assistant
2. Create an API key in Settings > API Keys
3. Configure TTS phrases in Settings > TTS Phrases (optional)

### 2. Deploy on Raspberry Pi

#### Using Docker (Recommended)

1. Install Docker on your Raspberry Pi:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

2. Clone or copy the `barcode-scanner` directory to your Pi

3. Edit `docker-compose.yml`:
   - Set `BACKEND_URL` to your backend server IP/hostname
   - Set `API_KEY` to the key you created in the backend
   - Adjust `/dev/ttyACM0` if your scanner uses a different device

4. Build and start:
```bash
cd barcode-scanner
docker-compose build
docker-compose up -d
```

5. View logs:
```bash
docker-compose logs -f
```

#### Using Flatcar OS

For Flatcar OS, create a systemd unit file:

```ini
[Unit]
Description=Barcode Scanner
After=docker.service
Requires=docker.service

[Service]
TimeoutStartSec=0
Restart=always
ExecStartPre=-/usr/bin/docker stop %n
ExecStartPre=-/usr/bin/docker rm %n
ExecStart=/usr/bin/docker run --rm \
  --name %n \
  --device=/dev/ttyACM0 \
  -v /opt/scanner/config:/app/config \
  -v /opt/scanner/logs:/app/logs \
  -e BACKEND_URL=http://192.168.1.100:3000 \
  -e API_KEY=your-key-here \
  -e LOG_LEVEL=info \
  --privileged \
  your-registry/barcode-scanner:latest

[Install]
WantedBy=multi-user.target
```

### 3. Approve the Device

1. Open the shopping list web app
2. Go to Settings > Devices
3. You should see a new pending device
4. Click "Approve"
5. Configure:
   - **Friendly Name**: Give it a name (e.g., "Kitchen Scanner")
   - **Home Assistant Speaker**: Select the speaker for TTS announcements
   - **USB Device Path**: Leave as `/dev/ttyACM0` or adjust if needed

6. Click "Approve"

The scanner will now start operating!

## Test Modes

For development and testing without hardware:

### STDIN Mode

Allows entering barcodes via keyboard:

```bash
docker-compose --profile dev up scanner-dev
# Then type barcodes and press Enter
```

Or:
```bash
TEST_MODE=stdin npm start
```

### HTTP Mode

Exposes an HTTP endpoint on port 8080 for testing:

```bash
TEST_MODE=http npm start

# In another terminal:
curl -X POST http://localhost:8080/scan \
  -H "Content-Type: application/json" \
  -d '{"barcode":"5000159484695"}'
```

## Configuration

### Environment Variables

- `BACKEND_URL`: URL of the backend server (default: `http://localhost:3000`)
- `API_KEY`: API key for barcode endpoint authentication (required)
- `LOG_LEVEL`: Log level - `debug`, `info`, `warn`, `error` (default: `info`)
- `TEST_MODE`: Test mode - `false`, `stdin`, `http` (default: `false`)

### Persistent Data

The following directories are persisted:

- `/app/config`: Contains `device.json` with device ID and auth token
- `/app/logs`: Application logs

## Operation

### Normal Flow

1. Scanner waits for barcode input
2. When barcode is scanned:
   - LED starts processing indication
   - Barcode is sent to backend
   - Backend processes barcode (looks up product, adds to list)
   - Backend calls Home Assistant TTS to announce result
   - Scanner LED shows success/warning/error
3. Ready for next scan

### LED Patterns

- **Processing**: Slow pulse during API call
- **Success**: 3 quick flashes (item added successfully)
- **Warning**: 2 flashes (item not found in database)
- **Error**: 3 long flashes (backend/network error)

### Heartbeat

The scanner sends heartbeat every 5 minutes to keep online status updated.

### Configuration Polling

Device configuration is refreshed every 5 minutes to pick up any changes made via the web UI.

## Troubleshooting

### Scanner not detected

Check USB connection:
```bash
ls -la /dev/ttyACM*
ls -la /dev/serial/by-id/
```

### Permission denied

Ensure Docker has USB access (use `privileged: true` or add specific capabilities).

### Backend connection fails

1. Check `BACKEND_URL` is correct
2. Verify network connectivity: `ping backend-server`
3. Check backend logs
4. Verify API key is correct

### TTS not working

1. Verify Home Assistant configuration in Settings
2. Test HA connection in Settings > Home Assistant
3. Check Home Assistant logs
4. Verify speaker entity is correct

### View logs

```bash
# Docker logs
docker-compose logs -f

# Or check log files
tail -f logs/scanner.log
```

## Development

### Local Development

```bash
npm install
npm run dev
```

### Building Docker Image

```bash
docker build -t barcode-scanner:latest .
```

### Running Tests

The scanner supports multiple test modes for development without requiring physical hardware.

## Architecture

```
┌─────────────────┐
│ Scanner Hardware│
│  (USB Serial)   │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Scanner │
    │  App    │
    └────┬────┘
         │ HTTPS
         │ Device Token
    ┌────▼────┐
    │ Backend │
    │  API    │
    └────┬────┘
         │
    ┌────▼────┐
    │   HA    │
    │  (TTS)  │
    └─────────┘
```

## License

MIT
