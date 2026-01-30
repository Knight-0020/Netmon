package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func Init(dsn string) error {
	var err error
	// Retry connection loop for Docker startup race conditions
	for i := 0; i < 10; i++ {
		DB, err = sql.Open("postgres", dsn)
		if err == nil {
			err = DB.Ping()
			if err == nil {
				break
			}
		}
		log.Printf("Failed to connect to DB, retrying... (%v)", err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	return migrate()
}

func migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS devices (
		mac TEXT PRIMARY KEY,
		ip TEXT,
		hostname TEXT,
		vendor TEXT,
		user_label TEXT,
		tags JSONB,
		notes TEXT,
		first_seen TIMESTAMP,
		last_seen TIMESTAMP,
		is_online BOOLEAN
	);

	CREATE TABLE IF NOT EXISTS events (
		id SERIAL PRIMARY KEY,
		type TEXT NOT NULL,
		mac TEXT REFERENCES devices(mac),
		details JSONB,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS internet_checks (
		id SERIAL PRIMARY KEY,
		check_type TEXT,
		target TEXT,
		latency_ms INTEGER,
		status TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT
	);
	`
	_, err := DB.Exec(schema)
	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}
	return nil
}

// Helper structs for DB records
type Device struct {
	MAC       string    `json:"mac" db:"mac"`
	IP        string    `json:"ip" db:"ip"`
	Hostname  string    `json:"hostname" db:"hostname"`
	Vendor    string    `json:"vendor" db:"vendor"`
	UserLabel string    `json:"user_label" db:"user_label"`
	Tags      []byte    `json:"tags" db:"tags"` // JSONB
	Notes     string    `json:"notes" db:"notes"`
	FirstSeen time.Time `json:"first_seen" db:"first_seen"`
	LastSeen  time.Time `json:"last_seen" db:"last_seen"`
	IsOnline  bool      `json:"is_online" db:"is_online"`
}

type Event struct {
	ID        int       `json:"id" db:"id"`
	Type      string    `json:"type" db:"type"`
	MAC       string    `json:"mac" db:"mac"` // Can be null/empty if global event
	Details   []byte    `json:"details" db:"details"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Add event helper
func LogEvent(ctx context.Context, evtType, mac string, details []byte) error {
	// If mac is empty, insert NULL if possible or handle gracefully.
	// Our schema says REFERENCES devices(mac).
	// So global events (INTERNET_DOWN) shouldn't reference a MAC.
	// We should Make MAC nullable in schema? 
	// Ah, I defined: mac TEXT REFERENCES devices(mac)
	// If I insert NULL it should be fine.
	query := `INSERT INTO events (type, mac, details, created_at) VALUES ($1, $2, $3, $4)`
	
	// Handle empty MAC for global events
	var macArg interface{} = mac
	if mac == "" {
		macArg = nil
	}

	_, err := DB.ExecContext(ctx, query, evtType, macArg, details, time.Now())
	return err
}
