import os
import time
import schedule
import subprocess
import requests
import socket
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000")
LAN_CIDR = os.getenv("LAN_CIDR", "192.168.1.0/24")
SCAN_INTERVAL = int(os.getenv("SCAN_INTERVAL_SEC", "20"))
OFFLINE_AFTER_SEC = int(os.getenv("OFFLINE_AFTER_SEC", "60"))
INTERNET_INTERVAL = int(os.getenv("INTERNET_INTERVAL_SEC", "5"))
PING_TARGETS = os.getenv("PING_TARGETS", "1.1.1.1,8.8.8.8").split(",")
INTERNET_DOWN_THRESHOLD = int(os.getenv("INTERNET_DOWN_THRESHOLD", "3"))

REQ_TIMEOUT = 2


def post_json(path: str, payload: dict):
    try:
        requests.post(f"{API_BASE}{path}", json=payload, timeout=REQ_TIMEOUT)
    except Exception as e:
        logger.error(f"POST {path} failed: {e}")


def get_arp_table():
    devices = []
    try:
        subprocess.run(
            ["fping", "-a", "-g", "-q", "-r", "1", LAN_CIDR],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10
        )
    except Exception as e:
        logger.error(f"fping failed: {e}")

    try:
        output = subprocess.check_output(["ip", "neigh", "show"]).decode()
        for line in output.splitlines():
            parts = line.split()
            if len(parts) >= 5 and "lladdr" in parts:
                mac_idx = parts.index("lladdr") + 1
                state = parts[-1]
                if state not in ["FAILED", "INCOMPLETE"]:
                    devices.append({"ip": parts[0], "mac": parts[mac_idx], "state": state})
    except Exception as e:
        logger.error(f"ip neigh failed: {e}")

    return devices


def resolve_hostname(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except:
        return None


def send_event(ev_type, message, mac=None):
    post_json("/ingest/event", {"type": ev_type, "message": message, "device_mac": mac})


device_state = {}  # mac -> {last_seen: ts, ip: ip, is_online: bool}
internet_down_streak = 0
internet_incident_open = False


def robust_scan_job():
    try:
        logger.info("Running scan...")
        now = time.time()
        current_arp = get_arp_table()

        for entry in current_arp:
            mac = entry["mac"]
            ip = entry["ip"]

            if mac not in device_state:
                logger.info(f"New Device: {mac}")
                send_event("NEW_DEVICE", f"New device {mac} at {ip}", mac)
                device_state[mac] = {"last_seen": now, "ip": ip, "is_online": True}

                post_json("/ingest/device", {
                    "mac": mac,
                    "ip_address": ip,
                    "hostname": resolve_hostname(ip),
                    "vendor": None,
                    "tags": []
                })
            else:
                if device_state[mac]["ip"] != ip:
                    send_event("IP_CHANGED", f"Device {mac} changed IP {device_state[mac]['ip']} -> {ip}", mac)
                    device_state[mac]["ip"] = ip

                if not device_state[mac]["is_online"]:
                    send_event("ONLINE", f"Device {mac} is back online", mac)

                device_state[mac]["last_seen"] = now
                device_state[mac]["is_online"] = True

                post_json("/ingest/device", {"mac": mac, "ip_address": ip})

        for mac, data in device_state.items():
            if data["is_online"] and (now - data["last_seen"] > OFFLINE_AFTER_SEC):
                logger.info(f"Device Offline: {mac}")
                send_event("OFFLINE", f"Device {mac} went offline", mac)
                data["is_online"] = False
    except Exception as e:
        logger.error(f"scan job failed: {e}")


def check_internet_job():
    global internet_down_streak, internet_incident_open
    try:
        statuses = []

        for target in PING_TARGETS:
            latency = None
            status = "DOWN"
            try:
                output = subprocess.check_output(["ping", "-c", "1", "-W", "1", target]).decode()
                if "time=" in output:
                    time_str = output.split("time=")[1].split(" ")[0]
                    latency = float(time_str)
                    status = "UP"
            except:
                pass

            statuses.append(status)
            post_json("/ingest/health", {
                "target": target,
                "latency_ms": latency,
                "status": status,
                "check_type": "PING"
            })

        try:
            start = time.time()
            socket.gethostbyname("google.com")
            latency = (time.time() - start) * 1000
            statuses.append("UP")
            post_json("/ingest/health", {"target": "dns_check", "latency_ms": latency, "status": "UP", "check_type": "DNS"})
        except:
            statuses.append("DOWN")
            post_json("/ingest/health", {"target": "dns_check", "latency_ms": None, "status": "DOWN", "check_type": "DNS"})

        try:
            start = time.time()
            requests.get("https://www.google.com", timeout=REQ_TIMEOUT)
            latency = (time.time() - start) * 1000
            statuses.append("UP")
            post_json("/ingest/health", {"target": "http_check", "latency_ms": latency, "status": "UP", "check_type": "HTTP"})
        except:
            statuses.append("DOWN")
            post_json("/ingest/health", {"target": "http_check", "latency_ms": None, "status": "DOWN", "check_type": "HTTP"})

        all_down = len(statuses) > 0 and all(s == "DOWN" for s in statuses)
        if all_down:
            internet_down_streak += 1
        else:
            internet_down_streak = 0
            if internet_incident_open:
                post_json("/ingest/incident", {"type": "INTERNET", "description": "Internet restored", "status": "RESOLVED"})
                internet_incident_open = False

        if internet_down_streak >= INTERNET_DOWN_THRESHOLD and not internet_incident_open:
            post_json("/ingest/incident", {"type": "INTERNET", "description": "Internet down", "status": "OPEN"})
            internet_incident_open = True
    except Exception as e:
        logger.error(f"internet check failed: {e}")


schedule.every(SCAN_INTERVAL).seconds.do(robust_scan_job)
schedule.every(INTERNET_INTERVAL).seconds.do(check_internet_job)

logger.info("Agent started.")
robust_scan_job()

while True:
    schedule.run_pending()
    time.sleep(1)
