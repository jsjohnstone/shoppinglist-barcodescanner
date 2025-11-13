# Barcode Scanner Repository Deployment Files

This document lists all the files that should be added to the `shoppinglist-barcodescanner` repository for production deployment.

## Files to Add to Repository Root

### 1. GitHub Actions Workflow

**Path**: `.github/workflows/build-and-push.yml`

**Source**: Copy from `barcode-scanner/GITHUB_ACTIONS_WORKFLOW.yml` in this repo

**Purpose**: Builds and pushes multi-architecture Docker images to GitHub Container Registry

### 2. Production Docker Compose

**Path**: `docker-compose.prod.yml`

**Source**: Copy from `barcode-scanner/docker-compose.prod.yml` in this repo

**Purpose**: Production deployment configuration for standalone scanner deployment

### 3. Environment Template

**Path**: `.env.example`

**Source**: Copy from `barcode-scanner/.env.example` in this repo

**Purpose**: Template for environment variables configuration

### 4. Flatcar Configuration

**Path**: `flatcar-config.yaml`

**Source**: Copy from `barcode-scanner/flatcar-config.yaml` in this repo

**Purpose**: Butane configuration for Flatcar Container Linux on Raspberry Pi

**Note**: Users need to customize this file before converting to Ignition format

### 5. Raspberry Pi Deployment Guide

**Path**: `RASPBERRY_PI_DEPLOYMENT.md`

**Source**: Copy from `barcode-scanner/RASPBERRY_PI_DEPLOYMENT.md` in this repo

**Purpose**: Complete guide for deploying scanner to Raspberry Pi with Flatcar OS

### 6. Update README.md

Add deployment section to the barcode scanner README with:
- Links to deployment documentation
- Docker image information
- Quick start guide
- Prerequisites

## Repository Structure

```
shoppinglist-barcodescanner/
├── .github/
│   └── workflows/
│       └── build-and-push.yml          (from GITHUB_ACTIONS_WORKFLOW.yml)
├── src/
│   ├── index.js
│   ├── scanner.js
│   ├── backend-client.js
│   ├── config.js
│   └── logger.js
├── config/
├── Dockerfile
├── package.json
├── docker-compose.yml                   (existing dev version)
├── docker-compose.prod.yml             (NEW - production version)
├── .env.example                        (NEW - environment template)
├── flatcar-config.yaml                 (NEW - Flatcar/Ignition config)
├── RASPBERRY_PI_DEPLOYMENT.md          (NEW - deployment guide)
└── README.md                           (update with deployment info)
```

## Deployment Workflow

1. **Developer pushes to main branch** → GitHub Actions builds and pushes images
2. **On Proxmox/Docker host** → Pull image and run with docker-compose.prod.yml
3. **On Raspberry Pi** → Flash Flatcar OS with Ignition config, auto-deploys container

## Docker Image

**Name**: `ghcr.io/jsjohnstone/shoppinglist-barcodescanner:latest`

**Architectures**: 
- `linux/amd64` (for Proxmox LXC, standard x86_64 servers)
- `linux/arm64` (for Raspberry Pi 4B)

**Automatic Builds**: Triggered on every push to main branch

## Setup Instructions for Repository

1. Copy all files from this repo's `barcode-scanner/` directory to the new repository
2. Rename `GITHUB_ACTIONS_WORKFLOW.yml` to `.github/workflows/build-and-push.yml`
3. Update `README.md` with deployment information
4. Push to GitHub
5. GitHub Actions will automatically build and push the first image

## Testing the Deployment

### Test on Docker Host

```bash
# Login to GitHub Container Registry
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u jsjohnstone --password-stdin

# Pull and run
docker run -d \
  --name barcode-scanner-test \
  --device=/dev/ttyACM0:/dev/ttyACM0 \
  -e BACKEND_URL=http://192.168.1.100:3000 \
  -e LOG_LEVEL=debug \
  ghcr.io/jsjohnstone/shoppinglist-barcodescanner:latest

# View logs
docker logs -f barcode-scanner-test
```

### Test on Raspberry Pi

1. Prepare Flatcar image with customized Ignition config
2. Flash to SD card
3. Boot Raspberry Pi
4. SSH in and verify: `docker ps`
5. Check logs: `journalctl -u barcode-scanner.service -f`

## Notes

- All files in the `barcode-scanner/` directory of this repository are templates
- They should be copied to the `shoppinglist-barcodescanner` repository
- Users will download these files from the separate repository for deployment
- The Flatcar config must be customized before use (SSH keys, backend URL, GitHub PAT)
