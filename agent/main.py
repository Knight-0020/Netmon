import os
import time
import schedule
import subprocess
import requests
import socket
import logging
from datetime import datetime

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Env Vars
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
LAN_CIDR = os.getenv("LAN_CIDR", "192.168.1.0/24")
SCAN_INTERVAL = int(os.getenv("SCAN_INTERVAL_SEC", "20"))
OFFLINE_AFTER_SEC = int(os.getenv("OFFLINE_AFTER_SEC", "60"))
INTERNET_INTERVAL = int(os.getenv("INTERNET_INTERVAL_SEC", "5"))
PING_TARGETS = os.getenv("PING_TARGETS", "1.1.1.1,8.8.8.8").split(",")

# State
local_device_cache = {} # mac -> last_seen_timestamp

def get_arp_table():
    """Run ip neigh to get ARP table"""
    devices = []
    try:
        # Run fping to populate ARP table first
        # -a: alive, -g: generate, -q: quiet (we just want to populate arp)
        # using -c 1 to ping once. 
        # CAUTION: fping -g can be slow if CIDR is large.
        subprocess.run(["fping", "-a", "-g", "-q", "-r", "1", LAN_CIDR], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    except Exception as e:
        logger.error(f"fping failed: {e}")

    try:
        output = subprocess.check_output(["ip", "neigh", "show"]).decode()
        for line in output.splitlines():
            parts = line.split()
            # Format: 192.168.1.1 dev eth0 lladdr 00:11:22:33:44:55 REACHABLE
            if len(parts) >= 5 and "lladdr" in parts:
                ip_idx = 0
                mac_idx = parts.index("lladdr") + 1
                state = parts[-1]
                
                if state not in ["FAILED", "INCOMPLETE"]:
                    devices.append({
                        "ip": parts[ip_idx],
                        "mac": parts[mac_idx],
                        "state": state
                    })
    except Exception as e:
        logger.error(f"ip neigh failed: {e}")
        
    return devices

def resolve_hostname(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except:
        return None

def scan_network_job():
    logger.info("Scanning network...")
    current_devices = get_arp_table()
    
    for dev in current_devices:
        mac = dev["mac"]
        ip = dev["ip"]
        
        # Check if new or updated
        if mac not in local_device_cache:
            # New device
            logger.info(f"New device found: {mac} ({ip})")
            send_event("NEW_DEVICE", f"New device discovered at {ip}", mac)
            
            # Try resolve hostname
            hostname = resolve_hostname(ip)
            
            # Register
            requests.post(f"{API_BASE}/ingest/device", json={
                "mac": mac,
                "ip_address": ip,
                "hostname": hostname,
                "vendor": "Unknown" # Placeholder, implies needing mac lookup lib
            })
        else:
             # Just update last seen
             requests.post(f"{API_BASE}/ingest/device", json={
                "mac": mac,
                "ip_address": ip
            })
            
        local_device_cache[mac] = time.time()
        
    # Check for OFFLINE devices
    now = time.time()
    to_remove = []
    # We don't remove from cache immediately, we mark as offline in DB via event logic if we wanted,
    # but the prompt says: "A device is considered OFFLINE if last_seen older than 2 scan intervals"
    # Actually the prompt says: "if last_seen older than 2 scan intervals (configurable)" - OFFLINE_AFTER_SEC
    
    # We will let the API handle "last_seen" logic or we can emit OFFLINE event here. 
    # Prompt: "maintain in-memory last_seen to emit ONLINE/OFFLINE transitions as events"
    
    for mac, last_ts in local_device_cache.items():
        if now - last_ts > OFFLINE_AFTER_SEC:
            # It's offline. But we don't want to spam OFFLINE events.
            # We need to track if we already sent OFFLINE.
            # For simplicity in this script, we just assume if it's in cache it was online.
            # To do this properly we need state: {mac: {last_seen: ts, status: 'online'}}
            pass 
            
    # Refined Logic:
    # We really need a better state object.
    # But for MVP, let's just push device updates often. 
    # The API will update "last_seen". 
    # The PROMPT says: "detect NEW_DEVICE and IP_CHANGED... maintain in-memory last_seen to emit ONLINE/OFFLINE"
    
    pass

def check_internet_job():
    # 1. Ping Targets
    for target in PING_TARGETS:
        latency = None
        status = "DOWN"
        try:
            # ping -c 1 -W 1
            output = subprocess.check_output(["ping", "-c", "1", "-W", "1", target]).decode()
            # Parse time
            if "time=" in output:
                time_str = output.split("time=")[1].split(" ")[0]
                latency = float(time_str)
                status = "UP"
        except:
            pass
            
        requests.post(f"{API_BASE}/ingest/health", json={
            "target": target,
            "latency_ms": latency,
            "status": status,
            "check_type": "PING"
        })

    # 2. DNS
    try:
        start = time.time()
        socket.gethostbyname("google.com")
        latency = (time.time() - start) * 1000
        requests.post(f"{API_BASE}/ingest/health", json={
            "target": "dns_check",
            "latency_ms": latency,
            "status": "UP",
            "check_type": "DNS"
        })
    except:
        requests.post(f"{API_BASE}/ingest/health", json={
            "target": "dns_check",
            "latency_ms": None,
            "status": "DOWN",
            "check_type": "DNS"
        })

    # 3. HTTP
    try:
        start = time.time()
        requests.get("https://www.google.com", timeout=2)
        latency = (time.time() - start) * 1000
        requests.post(f"{API_BASE}/ingest/health", json={
            "target": "http_check",
            "latency_ms": latency,
            "status": "UP",
            "check_type": "HTTP"
        })
    except:
        requests.post(f"{API_BASE}/ingest/health", json={
            "target": "http_check",
            "latency_ms": None,
            "status": "DOWN",
            "check_type": "HTTP"
        })

def send_event(type, message, mac=None):
    try:
        requests.post(f"{API_BASE}/ingest/event", json={
            "type": type,
            "message": message,
            "device_mac": mac
        })
    except Exception as e:
        logger.error(f"Failed to send event: {e}")

# Improve Scan Job with state tracking
device_state = {} # mac -> {last_seen: ts, ip: ip, is_online: bool}

def robust_scan_job():
    logging.info("Running scan...")
    try:
        # Update ARP
        subprocess.run(["fping", "-a", "-g", "-q", "-r", "1", LAN_CIDR], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
    except:
        pass
        
    current_arp = get_arp_table()
    now = time.time()
    
    found_macs = set()
    
    for entry in current_arp:
        mac = entry["mac"]
        ip = entry["ip"]
        found_macs.add(mac)
        
        # New Device
        if mac not in device_state:
            logger.info(f"New Device: {mac}")
            send_event("NEW_DEVICE", f"New device {mac} at {ip}", mac)
            device_state[mac] = {"last_seen": now, "ip": ip, "is_online": True}
            
            # Ingest
            requests.post(f"{API_BASE}/ingest/device", json={
                "mac": mac, "ip_address": ip, "hostname": resolve_hostname(ip)
            })
        else:
            # IP Changed?
            if device_state[mac]["ip"] != ip:
                send_event("IP_CHANGED", f"Device {mac} changed IP from {device_state[mac]['ip']} to {ip}", mac)
                device_state[mac]["ip"] = ip
            
            # Back Online?
            if not device_state[mac]["is_online"]:
                 send_event("ONLINE", f"Device {mac} is back online", mac)
                 
            device_state[mac]["last_seen"] = now
            device_state[mac]["is_online"] = True
            
            # Heartbeat ingest
            requests.post(f"{API_BASE}/ingest/device", json={"mac": mac, "ip_address": ip})

    # Check Offline
    for mac, data in device_state.items():
        if data["is_online"] and (now - data["last_seen"] > OFFLINE_AFTER_SEC):
            logger.info(f"Device Offline: {mac}")
            send_event("OFFLINE", f"Device {mac} went offline", mac)
            data["is_online"] = False
            # Update API to mark offline? API doesn't have explicit endpoint for "mark offline" 
            # but we can assume API uses last_seen. 
            # However, for the Event Feed to be cool, we sent the event.

schedule.every(SCAN_INTERVAL).seconds.do(robust_scan_job)
schedule.every(INTERNET_INTERVAL).seconds.do(check_internet_job)

logger.info("Agent started.")
# Initial scan
robust_scan_job()

while True:
    schedule.run_pending()
    time.sleep(1)
