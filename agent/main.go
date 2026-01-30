package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"netmon/agent/scanner"
)

func main() {
	serverURL := os.Getenv("SERVER_URL")
	if serverURL == "" {
		serverURL = "http://127.0.0.1:8000"
	}
	lanCIDR := os.Getenv("LAN_CIDR")
	scanIntervalStr := os.Getenv("SCAN_INTERVAL_SEC")
	scanInterval := 20
	if n, err := strconv.Atoi(scanIntervalStr); err == nil {
		scanInterval = n
	}

	log.Printf("Agent starting. Server: %s, LAN: %s, Interval: %ds", serverURL, lanCIDR, scanInterval)

	ticker := time.NewTicker(time.Duration(scanInterval) * time.Second)
	for ; true; <-ticker.C {
		log.Println("Starting scan...")
		devices, err := scanner.Scan(lanCIDR)
		if err != nil {
			log.Printf("Scan failed: %v", err)
			continue
		}
		
		log.Printf("Scan complete. Found %d devices. Sending to server...", len(devices))
		if err := sendResults(serverURL, devices); err != nil {
			log.Printf("Failed to send results: %v", err)
		}
	}
}

type ScanPayload struct {
	Devices   []scanner.Device `json:"devices"`
	ScannedAt time.Time        `json:"scanned_at"`
}

func sendResults(serverURL string, devices []scanner.Device) error {
	payload := ScanPayload{
		Devices:   devices,
		ScannedAt: time.Now(),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(serverURL+"/api/agent/scan", "application/json", bytes.NewBuffer(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("Server returned %s", resp.Status)
	}
	return nil
}
