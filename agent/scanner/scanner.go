package scanner

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"
	"sync"
)

type Device struct {
	MAC      string   `json:"mac"`
	IP       string   `json:"ip"`
	Hostname string   `json:"hostname"`
	Vendor   string   `json:"vendor"`
	Ports    []int    `json:"ports"`
}

func Scan(cidr string) ([]Device, error) {
	// 1. Parse CIDR
	ip, ipnet, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil, fmt.Errorf("invalid CIDR: %w", err)
	}

	// 2. Generate IPs to scan
	var ips []string
	for ip := ip.Mask(ipnet.Mask); ipnet.Contains(ip); inc(ip) {
		ips = append(ips, ip.String())
	}
	// Skip network and broadcast? Usually first and last.
	if len(ips) > 2 {
		ips = ips[1 : len(ips)-1]
	}

	// 3. Active Ping Sweep (Parallel)
	// We use "ping" command again because raw socket requires root and might be complex in Go without extra priveleges setup
	// Actually, we are running as root in docker with 'privileged: true' (or CAP_NET_RAW).
	// But using system ping is easiest implementation.
	// We can limit concurrency.
	
	activeIPs := make(chan string, len(ips))
	sem := make(chan struct{}, 50) // concurrency limit
	var wg sync.WaitGroup

	for _, targetIP := range ips {
		wg.Add(1)
		go func(ip string) {
			defer wg.Done()
			sem <- struct{}{}
			if ping(ip) {
				activeIPs <- ip
			}
			<-sem
		}(targetIP)
	}
	
	go func() {
		wg.Wait()
		close(activeIPs)
	}()

	// Collect active IPs
	alive := make(map[string]bool)
	for ip := range activeIPs {
		alive[ip] = true
	}

	// 4. Read ARP table to find MACs for alive IPs (and others)
	// /proc/net/arp is standard on Linux
	arpTable, err := readARP()
	if err != nil {
		// fallback?
	}



	var results []Device
	for ip, mac := range arpTable {
		// Filter by CIDR?
		// Ensure it's in our scan range if we want strictness, or just report all neighbors.
		// Let's report all neighbors that we found.
		
		dev := Device{
			MAC: mac,
			IP:  ip,
		}
		
		// Try hostname lookup
		names, _ := net.LookupAddr(ip)
		if len(names) > 0 {
			dev.Hostname = names[0]
		}
		
		results = append(results, dev)
	}
	
	return results, nil
}

func inc(ip net.IP) {
	for j := len(ip) - 1; j >= 0; j-- {
		ip[j]++
		if ip[j] > 0 {
			break
		}
	}
}

func ping(ip string) bool {
	// Ping with 1 packet, 1 second timeout
	cmd := exec.Command("ping", "-c", "1", "-W", "1", ip)
	return cmd.Run() == nil
}

func readARP() (map[string]string, error) {
	data, err := os.ReadFile("/proc/net/arp")
	if err != nil {
		return nil, err
	}
	
	table := make(map[string]string)
	lines := strings.Split(string(data), "\n")
	// Skip header
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 6 {
			continue
		}
		ip := fields[0]
		mac := fields[3]
		flags := fields[2]
		
		// Flags 0x2 means complete/valid
		if flags == "0x2" && mac != "00:00:00:00:00:00" {
			table[ip] = mac
		}
	}
	return table, nil
}
