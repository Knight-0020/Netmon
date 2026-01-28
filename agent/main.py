import os
import time
import schedule
import subprocess
import requests
import socket
import logging
import re
import shutil
import threading
import concurrent.futures

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
OUI_PATH = "/usr/share/ieee-data/oui.txt"
ENABLE_HOSTNAME_RESOLVE = os.getenv("ENABLE_HOSTNAME_RESOLVE", "false").lower() == "true"
RESOLVE_METHODS = [m.strip().lower() for m in os.getenv("RESOLVE_METHODS", "rdns,mdns,netbios,nmap").split(",") if m.strip()]
NAME_CACHE_TTL_SEC = int(os.getenv("NAME_CACHE_TTL_SEC", "43200"))

_name_cache = {}  # mac -> {"name": Optional[str], "ts": float}
_rdns_lock = threading.Lock()


def load_oui_db(path: str):
    db = {}
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if "(hex)" in line:
                    parts = line.split("(hex)")
                elif "(base 16)" in line:
                    parts = line.split("(base 16)")
                else:
                    continue

                if len(parts) < 2:
                    continue

                prefix = parts[0].strip().replace("-", "").replace(":", "").upper()
                vendor = parts[1].strip()
                if len(prefix) >= 6 and vendor:
                    db[prefix[:6]] = vendor
    except Exception as e:
        logger.error(f"Failed to load OUI DB: {e}")
    logger.info(f"Loaded {len(db)} OUI entries")
    return db


OUI_DB = load_oui_db(OUI_PATH)


def mac_vendor(mac: str):
    if not mac:
        return None
    normalized = re.sub(r"[^0-9A-Fa-f]", "", mac).upper()
    if len(normalized) < 6:
        return None
    return OUI_DB.get(normalized[:6])


def _strip_hostname(name: str):
    if not name:
        return None
    name = name.strip()
    if not name:
        return None
    if "." in name:
        name = name.split(".")[0]
    return name or None


def _rdns_lookup(ip: str):
    try:
        name = socket.gethostbyaddr(ip)[0]
        return _strip_hostname(name)
    except Exception:
        return None


def _rdns_with_timeout(ip: str, timeout_sec: float):
    # gethostbyaddr can block; run in a thread with timeout
    with _rdns_lock:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            fut = executor.submit(_rdns_lookup, ip)
            try:
                return fut.result(timeout=timeout_sec)
            except Exception:
                return None


def _mdns_lookup(ip: str):
    if not shutil.which("avahi-resolve"):
        return None
    try:
        out = subprocess.check_output(["avahi-resolve", "-a", ip], timeout=1).decode(errors="ignore")
        # format: "IP\thostname"
        parts = out.strip().split()
        if len(parts) >= 2:
            return _strip_hostname(parts[1])
    except Exception:
        return None
    return None


def _netbios_lookup(ip: str):
    if shutil.which("nmblookup"):
        try:
            out = subprocess.check_output(["nmblookup", "-A", ip], timeout=1).decode(errors="ignore")
            for line in out.splitlines():
                if "<00>" in line and "UNIQUE" in line:
                    name = line.split()[0]
                    if name != "__MSBROWSE__":
                        return _strip_hostname(name)
        except Exception:
            return None
    if shutil.which("nbtscan"):
        try:
            out = subprocess.check_output(["nbtscan", "-r", ip], timeout=1).decode(errors="ignore")
            for line in out.splitlines():
                if ip in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        return _strip_hostname(parts[1])
        except Exception:
            return None
    return None


def _nmap_lookup(ip: str):
    if not shutil.which("nmap"):
        return None
    try:
        out = subprocess.check_output(["nmap", "-sn", ip], timeout=1).decode(errors="ignore")
        for line in out.splitlines():
            if "Nmap scan report for" in line:
                name = line.split("Nmap scan report for", 1)[1].strip()
                if "(" in name:
                    name = name.split("(", 1)[0].strip()
                return _strip_hostname(name)
    except Exception:
        return None
    return None


def resolve_name(ip: str, mac: str):
    if not ENABLE_HOSTNAME_RESOLVE:
        return None
    if not mac:
        return None

    now = time.time()
    cached = _name_cache.get(mac)
    if cached and (now - cached["ts"] < NAME_CACHE_TTL_SEC):
        return cached["name"]

    name = None
    for method in RESOLVE_METHODS:
        if method == "rdns":
            name = _rdns_with_timeout(ip, 1)
        elif method == "mdns":
            name = _mdns_lookup(ip)
        elif method == "netbios":
            name = _netbios_lookup(ip)
        elif method == "nmap":
            name = _nmap_lookup(ip)

        if name:
            break

    _name_cache[mac] = {"name": name, "ts": now}
    return name


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
            if ip.startswith("172.") and mac.lower().startswith("02:42:"):
                continue

            host = resolve_name(ip, mac)
            vend = mac_vendor(mac)

            if mac not in device_state:
                logger.info(f"New Device: {mac}")
                send_event("NEW_DEVICE", f"New device {mac} at {ip}", mac)
                device_state[mac] = {"last_seen": now, "ip": ip, "is_online": True}

                post_json("/ingest/device", {
                    "mac": mac,
                    "ip_address": ip,
                    "hostname": host,
                    "vendor": vend,
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

                post_json("/ingest/device", {
                    "mac": mac,
                    "ip_address": ip,
                    "hostname": host,
                    "vendor": vend
                })

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
