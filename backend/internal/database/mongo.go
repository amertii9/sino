package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Database struct {
	Client        *mongo.Client
	DB            *mongo.Database
	Users         *mongo.Collection
	Drivers       *mongo.Collection
	Trucks        *mongo.Collection
	Sites         *mongo.Collection
	Materials     *mongo.Collection
	Routes        *mongo.Collection
	Trips         *mongo.Collection
	FuelRequests  *mongo.Collection
	Expenses      *mongo.Collection
	Maintenance   *mongo.Collection
	AuditLogs     *mongo.Collection
	Notifications *mongo.Collection
	Settings      *mongo.Collection
	OdometerReadings *mongo.Collection
}

func ConnectDB(uri, dbName string) (*Database, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(clientOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to create mongo client: %w", err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to ping mongo server: %w", err)
	}

	db := client.Database(dbName)
	log.Printf("Successfully connected to MongoDB database: %s", dbName)

	d := &Database{
		Client:           client,
		DB:               db,
		Users:            db.Collection("users"),
		Drivers:          db.Collection("drivers"),
		Trucks:           db.Collection("trucks"),
		Sites:            db.Collection("sites"),
		Materials:        db.Collection("materials"),
		Routes:           db.Collection("routes"),
		Trips:            db.Collection("trips"),
		FuelRequests:     db.Collection("fuel_requests"),
		Expenses:         db.Collection("expenses"),
		Maintenance:      db.Collection("maintenance"),
		AuditLogs:        db.Collection("audit_logs"),
		Notifications:    db.Collection("notifications"),
		Settings:         db.Collection("settings"),
		OdometerReadings: db.Collection("odometer_readings"),
	}

	return d, nil
}
