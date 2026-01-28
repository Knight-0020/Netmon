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
   - **Web UI**: http://localhost:3000
   - **API Docs**: http://localhost:8000/docs

## Tailscale Serve

Expose the UI and API over Tailscale Serve:
```bash
tailscale serve --bg 9440 http://localhost:3000
tailscale serve --bg 9441 http://localhost:8000
tailscale serve status
```

When served this way, the UI uses internal proxy routes so it can call the API at port 9441 without hardcoding localhost.

## Troubleshooting

- **Agent sees no devices:**
  - Ensure the host machine is actually on the network configured in `LAN_CIDR`.
  - The agent container runs with `network_mode: host` and `cap_add: [NET_RAW, NET_ADMIN]`. This is required for `fping` and ARP table access.
  - Check logs: `docker compose logs -f agent`

- **UI shows "Loading..." or empty:**
  - Ensure the API container is up and reachable on port 8000 locally.
  - If you need a fixed API base URL, set `API_BASE` (runtime) or `NEXT_PUBLIC_API_BASE` (build-time) and rebuild the UI.

- **API issues:**
  - Check logs: `docker compose logs -f api`
  - Ensure Postgres is healthy (`docker compose ps db`).

## Recent Updates
- **Agent Fixes**: Corrected `API_BASE` environment variable handling in `agent/main.py`.
- **API Docker**: Updated startup command to correctly locate the FastAPI app (`main:app`).
- **Configuration**: Improved `docker-compose.yml` to better handle `NEXT_PUBLIC_API_BASE` for the UI.
