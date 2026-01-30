package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"netmon/server/db"
	"netmon/server/monitor"
	"time"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup) {
	r.POST("/agent/scan", handleAgentScan)
	r.GET("/devices", getDevices)
	r.PATCH("/devices/:mac", updateDevice)
	r.GET("/events", getEvents)
	r.GET("/internet/status", getInternetStatus)
	r.GET("/internet/samples", getInternetSamples)
	r.POST("/settings/test-telegram", testTelegram)
}

// Data models
type AgentScanRequest struct {
	Devices   []DeviceScan `json:"devices"`
	ScannedAt time.Time    `json:"scanned_at"`
}

type DeviceScan struct {
	MAC      string   `json:"mac"`
	IP       string   `json:"ip"`
	Hostname string   `json:"hostname"`
	Vendor   string   `json:"vendor"`
	Ports    []int    `json:"ports"`
}

func handleAgentScan(c *gin.Context) {
	var req AgentScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}
	defer tx.Rollback()

	// Get all currently online devices to detect who went offline? 
	// Or simplistic approach: We mark all devices as "seen recently".
	// The requirement: "mark devices offline if not seen for OFFLINE_THRESHOLD".
	// We can do that in a background job or right here.
	// Let's just UPSERT the scanned devices for now.

	for _, d := range req.Devices {
		// Check if device exists
		var existing db.Device
		err := tx.QueryRow("SELECT mac, ip, hostname, is_online FROM devices WHERE mac=$1", d.MAC).Scan(
			&existing.MAC, &existing.IP, &existing.Hostname, &existing.IsOnline,
		)

		isNew := false
		if err == sql.ErrNoRows {
			isNew = true
			if err := db.LogEvent(c.Request.Context(), "NEW_DEVICE", d.MAC, nil); err != nil {
				// log error but continue
			}
		} else if err != nil {
			continue // skip on error
		}

		// Update logic
		// If IP changed
		if !isNew && existing.IP != d.IP && d.IP != "" {
			details, _ := json.Marshal(map[string]string{"old": existing.IP, "new": d.IP})
			db.LogEvent(c.Request.Context(), "IP_CHANGE", d.MAC, details)
		}
		// If came online
		if !isNew && !existing.IsOnline {
			db.LogEvent(c.Request.Context(), "ONLINE", d.MAC, nil)
		}

		// Upsert
		_, err = tx.Exec(`
			INSERT INTO devices (mac, ip, hostname, vendor, first_seen, last_seen, is_online)
			VALUES ($1, $2, $3, $4, NOW(), NOW(), true)
			ON CONFLICT (mac) DO UPDATE SET
				ip = EXCLUDED.ip,
				hostname = COALESCE(NULLIF(EXCLUDED.hostname, ''), devices.hostname),
				vendor = COALESCE(NULLIF(EXCLUDED.vendor, ''), devices.vendor),
				last_seen = EXCLUDED.last_seen,
				is_online = true
		`, d.MAC, d.IP, d.Hostname, d.Vendor)
		if err != nil {
			// log error
		}
	}

	tx.Commit()
	c.Status(http.StatusOK)
}

func getDevices(c *gin.Context) {
	status := c.Query("status") // all, online, offline
	search := c.Query("search")
	
	query := `SELECT * FROM devices WHERE 1=1`
	args := []interface{}{}
	argId := 1

	if status == "online" {
		query += ` AND is_online = true`
	} else if status == "offline" {
		query += ` AND is_online = false`
	}

	if search != "" {
		query += ` AND (mac ILIKE $` + string(rune(argId+'0')) + 
			` OR ip ILIKE $` + string(rune(argId+'0')) + 
			` OR hostname ILIKE $` + string(rune(argId+'0')) + 
			` OR vendor ILIKE $` + string(rune(argId+'0')) + 
			` OR user_label ILIKE $` + string(rune(argId+'0')) + `)`
		args = append(args, "%"+search+"%")
		argId++
	}

	query += ` ORDER BY is_online DESC, last_seen DESC`

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	results := []db.Device{}
	for rows.Next() {
		var d db.Device
		if err := rows.Scan(&d.MAC, &d.IP, &d.Hostname, &d.Vendor, &d.UserLabel, &d.Tags, &d.Notes, &d.FirstSeen, &d.LastSeen, &d.IsOnline); err != nil {
			continue
		}
		results = append(results, d)
	}
	c.JSON(http.StatusOK, results)
}

func updateDevice(c *gin.Context) {
	mac := c.Param("mac")
	var req struct {
		UserLabel string `json:"user_label"`
		Notes     string `json:"notes"`
		Tags      []string `json:"tags"` // we receive array, store as jsonb
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tagsJson, _ := json.Marshal(req.Tags)
	_, err := db.DB.Exec(`UPDATE devices SET user_label=$1, notes=$2, tags=$3 WHERE mac=$4`,
		req.UserLabel, req.Notes, tagsJson, mac)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusOK)
}

func getEvents(c *gin.Context) {
	// Simple limit 50
	limit := 50
	rows, err := db.DB.Query(`SELECT id, type, mac, details, created_at FROM events ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	
	// We might want to join device info here or fetch separately.
	// For now just raw events.
	var events []interface{}
	for rows.Next() {
		var e db.Event
		var mac sql.NullString
		if err := rows.Scan(&e.ID, &e.Type, &mac, &e.Details, &e.CreatedAt); err != nil {
			continue
		}
		e.MAC = mac.String
		events = append(events, e)
	}
	c.JSON(http.StatusOK, events)
}

func getInternetStatus(c *gin.Context) {
	// Return latest check results
	// For simplicity, just query last 5 checks of any type
	rows, err := db.DB.Query(`SELECT id, check_type, target, latency_ms, status, created_at FROM internet_checks ORDER BY created_at DESC LIMIT 10`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var checks []map[string]interface{}
	for rows.Next() {
		var id int
		var cType, target, status string
		var lat int
		var ts time.Time
		rows.Scan(&id, &cType, &target, &lat, &status, &ts)
		checks = append(checks, map[string]interface{}{
			"id": id, "type": cType, "target": target, "latency": lat, "status": status, "time": ts,
		})
	}
	c.JSON(http.StatusOK, map[string]interface{}{"recent_checks": checks, "overall": "UP"}) // Todo meaningful overall calc
}

func getInternetSamples(c *gin.Context) {
	// TODO: Time series data
	c.JSON(http.StatusOK, []string{})
}

func testTelegram(c *gin.Context) {
	// Trigger the alert logic in monitor package
	monitor.SendTelegramAlert("Test message from NetMon v3 Settings")
	c.Status(http.StatusOK)
}
