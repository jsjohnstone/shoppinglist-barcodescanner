# Raspberry Pi Deployment Guide - Flatcar Container Linux

This guide covers deploying the Barcode Scanner to a Raspberry Pi 4B running Flatcar Container Linux.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Flatcar OS Installation](#flatcar-os-installation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Overview

**Target Hardware:**
- Raspberry Pi 4B (4GB RAM recommended)
- SD Card (16GB minimum, 32GB recommended)
- Access-IS LSR116 USB Barcode Scanner
- WiFi or Ethernet connection

**Software Stack:**
- Flatcar Container Linux (ARM64)
- Docker (included in Flatcar)
- Barcode Scanner Container

## Prerequisites

1. **Raspberry Pi 4B** with power supply
2. **SD Card** (16GB minimum, Class 10 or better)
3. **USB Barcode Scanner** (Access-IS LSR116 or compatible)
4. **Network Access** (WiFi or Ethernet)
5. **Computer** for preparing the SD card
6. **GitHub Personal Access Token** with `read:packages` scope
7. **SSH Key Pair** for remote access

### Generate SSH Key (if needed)

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Display public key
cat ~/.ssh/id_rsa.pub
```

### Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scope: `read:packages`
4. Copy the token (you'll need it in the configuration)

## Flatcar OS Installation

### 1. Download Flatcar Container Linux

```bash
# Download the latest ARM64 image for Raspberry Pi
wget https://stable.release.flatcar-linux.net/arm64-usr/current/flatcar_production_image.bin.bz2

# Decompress
bunzip2 flatcar_production_image.bin.bz2
```

**Alternative:** Download from [Flatcar Releases](https://www.flatcar.org/releases)

### 2. Prepare Configuration Files

#### Edit flatcar-config.yaml

Download the template from the repository and customize:

```bash
# Clone or download the config file
curl -o flatcar-config.yaml https://raw.githubusercontent.com/jsjohnstone/shoppinglist-barcodescanner/main/flatcar-config.yaml
```

Edit `flatcar-config.yaml` and replace:
- `YOUR_SSH_PUBLIC_KEY_HERE` with your SSH public key
- `BACKEND_URL_HERE` with your Shopping List server IP (e.g., `192.168.1.100`)
- `YOUR_GITHUB_PAT_HERE` with your GitHub Personal Access Token

#### Convert to Ignition Format

Install Butane:
```bash
# macOS
brew install butane

# Linux
wget https://github.com/coreos/butane/releases/download/v0.19.0/butane-x86_64-unknown-linux-gnu
chmod +x butane-x86_64-unknown-linux-gnu
sudo mv butane-x86_64-unknown-linux-gnu /usr/local/bin/butane
```

Convert the config:
```bash
butane --pretty --strict flatcar-config.yaml > ignition.json
```

### 3. Flash SD Card with Flatcar

**Method 1: Using dd (Linux/macOS)**

```bash
# Find SD card device
lsblk  # or diskutil list on macOS

# Unmount if mounted
sudo umount /dev/sdX*  # Replace X with your device letter

# Flash the image
sudo dd if=flatcar_production_image.bin of=/dev/sdX bs=4M status=progress

# Sync
sync
```

**Method 2: Using Balena Etcher (All platforms)**

1. Download [Balena Etcher](https://www.balena.io/etcher/)
2. Select `flatcar_production_image.bin`
3. Select your SD card
4. Flash!

### 4. Configure OEM Partition

After flashing, mount the OEM partition and add the Ignition config:

**On Linux:**
```bash
# Mount OEM partition
sudo mount /dev/sdX6 /mnt  # Adjust device as needed

# Copy Ignition config
sudo mkdir -p /mnt/ignition
sudo cp ignition.json /mnt/ignition/config.ign

# Unmount
sudo umount /mnt
```

**On macOS:**
```bash
# The OEM partition should auto-mount as "OEM"
cp ignition.json /Volumes/OEM/ignition/config.ign

# Eject
diskutil eject /dev/diskX
```

## Configuration

### Network Configuration

**For WiFi:** Edit `flatcar-config.yaml` before converting to add WiFi configuration:

```yaml
storage:
  files:
    - path: /etc/systemd/network/25-wireless.network
      mode: 0644
      contents:
        inline: |
          [Match]
          Name=wlan0
          
          [Network]
          DHCP=yes
          
    - path: /var/lib/iwd/YOUR_SSID.psk
      mode: 0600
      contents:
        inline: |
          [Security]
          Passphrase=YOUR_WIFI_PASSWORD

systemd:
  units:
    - name: systemd-networkd.service
      enabled: true
    - name: iwd.service
      enabled: true
```

Then regenerate the Ignition file.

### Environment Variables

The Ignition config creates `/opt/barcode-scanner/.env` with these variables:
- `BACKEND_URL`: Your Shopping List server URL
- `LOG_LEVEL`: Logging verbosity (info, debug, warn, error)
- `TEST_MODE`: Set to true for testing without hardware
- `NODE_ENV`: Always production

## Deployment

### 1. Boot Raspberry Pi

1. Insert the prepared SD card into Raspberry Pi
2. Connect USB barcode scanner
3. Connect power
4. Wait 2-3 minutes for first boot (system will download container image)

### 2. Find Raspberry Pi IP

**Method 1: Check your router's DHCP leases**

**Method 2: Network scan**
```bash
nmap -sn 192.168.1.0/24 | grep -B 2 "Raspberry Pi"
```

**Method 3: Check Flatcar hostname**
```bash
# If you set a hostname in the config
ping raspberrypi.local
```

### 3. SSH Access

```bash
ssh core@<raspberry-pi-ip>
```

### 4. Verify Services

```bash
# Check Docker is running
docker ps

# Check barcode scanner service
systemctl status barcode-scanner.service

# View logs
journalctl -u barcode-scanner.service -f

# Check device
ls -l /dev/ttyACM0
```

## Verification

### Check Scanner Container

```bash
# SSH into Raspberry Pi
ssh core@<raspberry-pi-ip>

# Check running containers
docker ps

# Should see output like:
# CONTAINER ID   IMAGE                                                      STATUS
# abc123def456   ghcr.io/jsjohnstone/shoppinglist-barcodescanner:latest   Up 2 minutes

# View container logs
docker logs barcode-scanner -f
```

### Register Device

On first run, the scanner will output a registration URL:

```bash
# View logs to find registration URL
docker logs barcode-scanner

# Look for output like:
# ========================================
# DEVICE REGISTRATION REQUIRED
# ========================================
# Please visit this URL to register the device:
# http://192.168.1.100:3000/devices/register?token=abc123...
```

1. Copy the full registration URL
2. Open it in your web browser
3. Enter a name for the device (e.g., "Kitchen Scanner")
4. Submit the form
5. Scanner will automatically connect and start working

### Test Scanning

1. Scan a barcode
2. Check the Shopping List web interface
3. Item should appear in the list

## Maintenance

### Update Container

The system automatically updates weekly, but you can manually update:

```bash
# SSH into Pi
ssh core@<raspberry-pi-ip>

# Pull latest image and restart
sudo systemctl restart barcode-scanner.service

# Or manually
docker pull ghcr.io/jsjohnstone/shoppinglist-barcodescanner:latest
docker restart barcode-scanner
```

### View Logs

```bash
# System logs
journalctl -u barcode-scanner.service -f

# Container logs
docker logs barcode-scanner -f

# Application logs (from volume)
sudo cat /opt/barcode-scanner/logs/scanner.log
```

### Restart Scanner

```bash
sudo systemctl restart barcode-scanner.service
```

### Access Configuration

```bash
# View current config
sudo cat /opt/barcode-scanner/.env

# View device registration
sudo cat /opt/barcode-scanner/config/device.json
```

## Troubleshooting

### Scanner Not Detected

```bash
# Check USB device
lsusb

# Should see something like:
# Bus 001 Device 002: ID 04d8:f658 Microchip Technology Inc.

# Check device file
ls -l /dev/ttyACM*

# Check permissions
# Should be: crw-rw---- 1 root dialout 166, 0
```

**Fix:**
```bash
# Restart the Pi
sudo reboot
```

### Container Not Starting

```bash
# Check service status
systemctl status barcode-scanner.service

# View detailed logs
journalctl -u barcode-scanner.service -n 100

# Check Docker service
systemctl status docker.service
```

### Cannot Connect to Backend

```bash
# Test connectivity
curl http://192.168.1.100:3000/api/health

# Check environment
sudo cat /opt/barcode-scanner/.env

# Verify BACKEND_URL is correct
```

**Fix:** Update the environment file:
```bash
# Edit environment
sudo nano /opt/barcode-scanner/.env

# Update BACKEND_URL
BACKEND_URL=http://correct-ip:3000

# Restart service
sudo systemctl restart barcode-scanner.service
```

### High CPU/Memory Usage

```bash
# Check resource usage
docker stats barcode-scanner

# View container processes
docker top barcode-scanner
```

### WiFi Not Connecting

```bash
# Check network status
networkctl status

# Check WiFi interface
iwctl device list

# Manual WiFi config
iwctl station wlan0 connect "YOUR_SSID"
```

### Need to Re-register Device

```bash
# Remove existing device config
sudo rm /opt/barcode-scanner/config/device.json

# Restart scanner
sudo systemctl restart barcode-scanner.service

# View logs for new registration URL
docker logs barcode-scanner -f
```

### SD Card Full

```bash
# Check disk space
df -h

# Clean Docker
docker system prune -a

# Clean old logs
sudo truncate -s 0 /opt/barcode-scanner/logs/*.log
```

### Update Not Working

```bash
# Check timer status
systemctl status scanner-update.timer

# Manually trigger update
sudo systemctl start scanner-update.service

# Check for errors
journalctl -u scanner-update.service
```

## Advanced Configuration

### Change Backend URL

```bash
# Edit config
sudo nano /opt/barcode-scanner/.env

# Change BACKEND_URL
BACKEND_URL=http://new-ip:3000

# Restart
sudo systemctl restart barcode-scanner.service
```

### Enable Debug Logging

```bash
# Edit config
sudo nano /opt/barcode-scanner/.env

# Change LOG_LEVEL
LOG_LEVEL=debug

# Restart
sudo systemctl restart barcode-scanner.service
```

### Static IP Configuration

Edit `/etc/systemd/network/eth0.network` (if using Ethernet):

```bash
sudo nano /etc/systemd/network/eth0.network
```

```ini
[Match]
Name=eth0

[Network]
Address=192.168.1.50/24
Gateway=192.168.1.1
DNS=192.168.1.1
```

Restart networking:
```bash
sudo systemctl restart systemd-networkd
```

## Security Recommendations

1. **Change SSH Keys Regularly**: Update the authorized_keys in the Ignition config
2. **Firewall**: Raspberry Pi doesn't need any incoming connections
3. **Updates**: Flatcar auto-updates the OS, container updates weekly
4. **Physical Security**: The Raspberry Pi should be in a secure location
5. **Network Isolation**: Consider placing on a separate VLAN if possible

## Performance Optimization

For better performance on Raspberry Pi 4B:

1. **Use Fast SD Card**: Class 10 or UHS-I recommended
2. **Enable Swap** (if experiencing memory issues):
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

3. **Monitor Temperature**:
```bash
vcgencmd measure_temp
```

## Backup and Recovery

### Backup Configuration

```bash
# Backup device config
scp core@<pi-ip>:/opt/barcode-scanner/config/device.json ./backup/

# Backup environment
scp core@<pi-ip>:/opt/barcode-scanner/.env ./backup/
```

### Restore Configuration

```bash
# Copy back
scp ./backup/device.json core@<pi-ip>:/opt/barcode-scanner/config/
scp ./backup/.env core@<pi-ip>:/opt/barcode-scanner/

# Restart
ssh core@<pi-ip> sudo systemctl restart barcode-scanner.service
```

### Full SD Card Backup

```bash
# Create backup image (run on host computer)
sudo dd if=/dev/sdX of=raspberry-pi-backup.img bs=4M status=progress

# Compress
gzip raspberry-pi-backup.img
```

## Next Steps

- Monitor scanner operation for a few days
- Set up alerts for scanner offline status
- Document your specific barcode scanner model and settings
- Consider setting up multiple scanners in different locations
- Integrate with Home Assistant or other automation platforms
