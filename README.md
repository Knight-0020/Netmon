# NetMon

NetMon is a powerful, self-hosted homelab monitoring tool for Raspberry Pi 5. It provides device discovery (ARP/Ping), internet health monitoring (Ping/DNS/HTTP), and a clean web dashboard.

## Features
- **Device Discovery**: Scans LAN using `ip neigh` and `fping`. Tracks Online/Offline status and IP history.
- **Internet Health**: Monitors latency and uptime for ping targets, DNS, and HTTP.
- **Event Log**: Tracks when devices join, leave, or change IP.
- **Single Command Deploy**: Runs entirely via Docker Compose.

## Prerequisites
- **Hardware**: Raspberry Pi 5 (recommended) or any Linux host.
- **Software**: Docker & Docker Compose.

## Quick Start

1. **Clone & Setup:**
   ```bash
   # (Assuming you are in the project root)
   cp .env.example .env
   ```

2. **Configure Network:**
   Check your LAN CIDR:
   ```bash
   ip a
   # Look for valid interface (e.g. eth0 or wlan0) with an IP like 192.168.1.x/24
   ```
   Edit `.env` and set `LAN_CIDR` accordingly (e.g., `192.168.1.0/24`).

3. **Run:**
   ```bash
   docker compose up --build -d
   ```

4. **Access:**
   - **Web UI**: [http://localhost:3000](http://localhost:3000)
   - **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

## Troubleshooting

- **Agent sees no devices:**
  - Ensure the host machine is actually on the network configured in `LAN_CIDR`.
  - The agent container runs with `network_mode: host` and `cap_add: [NET_RAW, NET_ADMIN]`. This is required for `fping` and ARP table access.
  - Check logs: `docker compose logs -f agent`

- **UI shows "Loading..." or empty:**
  - Ensure `NEXT_PUBLIC_API_BASE` in `.env` is reachable from your browser.
  - If running on a remote Pi, set `NEXT_PUBLIC_API_BASE=http://<PI_IP>:8000` before building. Note: Next.js builds env vars at build time (except for newer experimental features), but our Dockerfile wraps this. (Ideally, rebuild if you change this).

- **API issues:**
  - Check logs: `docker compose logs -f api`
  - Ensure Postgres is healthy (`docker compose ps db`).

## Recent Updates
- **Agent Fixes**: Corrected `API_BASE` environment variable handling in `agent/main.py`.
- **API Docker**: Updated startup command to correctly locate the FastAPI app (`main:app`).
- **Configuration**: Improved `docker-compose.yml` to better handle `NEXT_PUBLIC_API_BASE` for the UI.
