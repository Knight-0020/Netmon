package main

import (
	"log"
	"net/http"
	"os"

	"netmon/server/api"
	"netmon/server/db"
	"netmon/server/monitor"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load config
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		// Fallback for local testing if not in docker
		dsn = "postgres://netmon:netmon@127.0.0.1:5432/netmon?sslmode=disable"
	}
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8000"
	}

	// Init DB
	if err := db.Init(dsn); err != nil {
		log.Fatalf("Database Init Failed: %v", err)
	}

	// Start Background Monitor
	go monitor.Start()

	// Setup Router
	r := gin.Default()

	// Serve Static UI
	// In production (Docker), we expect UI files in /app/ui (or linked location)
	// For now, we serve from ./dist if it exists, or ./ui/dist relative to workdir
	// In Dockerfile we copied server binary to /app. The UI might be mounted.
	// Let's assume a "ui" folder in CWD has the assets.
	r.Use(func(c *gin.Context) {
		// Custom static middleware to fallback to index.html for SPA
		// If path is API, skip
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.Next()
			return
		}
		// Try serving file
		http.FileServer(http.Dir("./ui_dist")).ServeHTTP(c.Writer, c.Request)
		// If 404, we catch it? No, http.FileServer handles it.
		// A better way for SPA:
		// ServeStatic but if 404, send index.html
	})
	// Actually, gin has robust static/SPA support options or we can specific routes.
	// Simpler: api routes first.
	apiGroup := r.Group("/api")
	api.RegisterRoutes(apiGroup)

	// Catch-all for UI (SPA support)
	r.NoRoute(func(c *gin.Context) {
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.JSON(404, gin.H{"error": "not found"})
			return
		}
		c.File("./ui_dist/index.html")
	})

	log.Printf("Server starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}
