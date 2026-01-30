# NetMon v3

A self-hosted LAN and Internet monitor designed for Raspberry Pi.
Features:
- Active/Passive LAN discovery (MAC, IP, Hostname, Vendor).
- Internet Health Monitoring (Ping, DNS, HTTP).
- Event Logging & Telegram Alerts.
- Clean, responsive Dashboard.

## Architecture
- **Agent**: Go static binary. Runs in host network mode. Scans LAN via ICMP and ARP.
- **Server**: Go REST API + Scheduler. Serves the UI. Connects to Postgres.
- **UI**: React + Vite SPA. Bundled and served by the Go server.
- **Database**: PostgreSQL (Dockerized).

## Quick Start (Reset & Run)

Run this one-liner in your terminal to wipe the previous install (if any), pull changes, and start fresh:

```bash
# Windows (PowerShell)
docker compose down; Remove-Item -Recurse -Force agent, server, ui, deploy 2>$null; git pull; Copy-Item .env.example .env; docker compose up --build -d
```

Manual Steps:
1. Copy `.env.example` to `.env` and edit values if needed.
2. Run `docker compose up --build -d`.
3. Open `http://localhost:8000`.

## Tailscale Exposure
To expose this via Tailscale securely:

```bash
sudo tailscale serve --bg --https=9440 http://127.0.0.1:8000
```
Then access via your Tailscale machine name, e.g., `https://raspberrypi:9440`.

## Development
- **Agent**: `cd agent && go run .`
- **Server**: `cd server && go run .`
- **UI**: `cd ui && npm install && npm run dev`
