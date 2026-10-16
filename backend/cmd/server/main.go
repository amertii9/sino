package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"truck-fleet-backend/internal/config"
	"truck-fleet-backend/internal/database"
	"truck-fleet-backend/internal/handlers"
	"truck-fleet-backend/internal/models"
	"truck-fleet-backend/internal/routes"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func main() {
	log.Println("Starting Truck Hauling & Fleet Management System Backend...")

	cfg := config.LoadConfig()

	// Configure Gin release mode in production
	if cfg.Env == "production" || cfg.Env == "release" {
		gin.SetMode(gin.ReleaseMode)
		log.Println("[INFO] Gin running in RELEASE mode")
	} else {
		log.Printf("[INFO] Gin running in %s mode", cfg.Env)
	}

	// Connect to MongoDB
	db, err := database.ConnectDB(cfg.MongoURI, cfg.DBName)
	if err != nil {
		log.Fatalf("Fatal: Failed to connect to MongoDB: %v\nPlease make sure MongoDB is running on %s", err, cfg.MongoURI)
	}

	// Seed database / check admin & default settings
	database.SeedDatabase(db)

	// Synchronize truck current odometer values with verified recorded entries
	syncCtx, syncCancel := context.WithTimeout(context.Background(), 10*time.Second)
	if cursor, err := db.Trucks.Find(syncCtx, bson.M{}); err == nil {
		var trks []models.Truck
		if err := cursor.All(syncCtx, &trks); err == nil {
			baseH := handlers.BaseHandler{DB: db}
			for _, trk := range trks {
				latest := baseH.GetTruckLatestOdometer(syncCtx, trk.ID.Hex(), "")
				if trk.CurrentOdometer != latest || trk.CurrentMileage != latest {
					_, _ = db.Trucks.UpdateOne(syncCtx, bson.M{"_id": trk.ID}, bson.M{
						"$set": bson.M{
							"current_odometer": latest,
							"current_mileage":  latest,
						},
					})
				}
			}
		}
		cursor.Close(syncCtx)
	}
	syncCancel()

	// Automatic recurring deduction check (EIC insurance & custom monthly expenses)
	expHandler := handlers.NewExpenseHandler(handlers.BaseHandler{DB: db, JWTSecret: cfg.JWTSecret})
	initCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	_, _ = expHandler.CheckAndExecuteAllRecurringDeductions(initCtx)
	cancel()

	// Stop channel for background workers
	stopWorkers := make(chan struct{})

	// Background ticker checking periodically for scheduled deductions
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				_, _ = expHandler.CheckAndExecuteAllRecurringDeductions(ctx)
				cancel()
			case <-stopWorkers:
				log.Println("[INFO] Recurring deduction worker stopped")
				return
			}
		}
	}()

	r := gin.Default()

	// Mitigate IP spoofing & eliminate trusted proxies warning
	if len(cfg.TrustedProxies) > 0 {
		if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
			log.Printf("[WARN] Failed to set trusted proxies: %v", err)
		}
	} else {
		// Do not trust all reverse proxies by default
		_ = r.SetTrustedProxies(nil)
	}

	// Setup all API routes with rate limits, CORS, and security headers
	routes.SetupRoutes(r, db, cfg)

	// Hardened HTTP server configuration with timeouts to mitigate Slowloris attacks
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1 MB
	}

	// Run server in goroutine for graceful shutdown capability
	go func() {
		log.Printf("Server listening on port %s (http://localhost:%s)", cfg.Port, cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Server stopped unexpectedly: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shut down the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server gracefully...")

	close(stopWorkers)

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced shutdown with error: %v", err)
	}

	log.Println("Server exiting. Done.")
}
