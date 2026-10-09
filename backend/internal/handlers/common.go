package handlers

import (
	"context"
	"fmt"
	"time"

	"truck-fleet-backend/internal/database"
	"truck-fleet-backend/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type BaseHandler struct {
	DB        *database.Database
	JWTSecret string
}

func (h *BaseHandler) GenerateNextNumber(ctx context.Context, collectionName, prefix string) string {
	var count int64
	var err error

	switch collectionName {
	case "trips":
		count, err = h.DB.Trips.CountDocuments(ctx, bson.M{})
	case "fuel_requests":
		count, err = h.DB.FuelRequests.CountDocuments(ctx, bson.M{})
	case "expenses":
		count, err = h.DB.Expenses.CountDocuments(ctx, bson.M{})
	case "maintenance":
		count, err = h.DB.Maintenance.CountDocuments(ctx, bson.M{})
	case "trucks":
		count, err = h.DB.Trucks.CountDocuments(ctx, bson.M{})
	case "drivers":
		count, err = h.DB.Drivers.CountDocuments(ctx, bson.M{})
	default:
		count = 0
	}

	if err != nil {
		count = 0
	}

	return fmt.Sprintf("%s-%06d", prefix, count+1)
}

func (h *BaseHandler) LogAudit(ctx context.Context, userID, userName, action, entity, entityID, oldValue, newValue string) {
	log := models.AuditLog{
		ID:        bson.NewObjectID(),
		UserID:    userID,
		UserName:  userName,
		Action:    action,
		Entity:    entity,
		EntityID:  entityID,
		OldValue:  oldValue,
		NewValue:  newValue,
		Timestamp: time.Now(),
	}
	_, _ = h.DB.AuditLogs.InsertOne(ctx, log)
}

func (h *BaseHandler) CreateNotification(ctx context.Context, userID, targetRole, title, message, notifType string) {
	notif := models.Notification{
		ID:         bson.NewObjectID(),
		UserID:     userID,
		TargetRole: targetRole,
		Title:      title,
		Message:    message,
		Type:       notifType,
		IsRead:     false,
		CreatedAt:  time.Now(),
	}
	_, _ = h.DB.Notifications.InsertOne(ctx, notif)
}

// GetTruckLatestOdometer finds the highest verified odometer reading recorded or entered by the driver
func (h *BaseHandler) GetTruckLatestOdometer(ctx context.Context, truckID, driverID string) float64 {
	var maxOdo float64

	// If truckID is not provided but driverID is, try to resolve truckID from driver
	if truckID == "" && driverID != "" {
		if dObjID, err := bson.ObjectIDFromHex(driverID); err == nil {
			var drv models.Driver
			if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": dObjID}).Decode(&drv); err == nil && drv.AssignedTruckID != "" {
				truckID = drv.AssignedTruckID
			}
		}
	}

	// Build filter for truck and/or driver
	filter := bson.M{}
	if truckID != "" && driverID != "" {
		filter["$or"] = []bson.M{
			{"truck_id": truckID},
			{"driver_id": driverID},
		}
	} else if truckID != "" {
		filter["truck_id"] = truckID
	} else if driverID != "" {
		filter["driver_id"] = driverID
	}

	if len(filter) == 0 {
		return 0
	}

	// 1. Check all non-deleted OdometerReadings (shift or trip logs)
	if cursor, err := h.DB.OdometerReadings.Find(ctx, filter); err == nil {
		defer cursor.Close(ctx)
		var odoRecords []models.OdometerReading
		if err := cursor.All(ctx, &odoRecords); err == nil {
			for _, rec := range odoRecords {
				if rec.EndReading > maxOdo {
					maxOdo = rec.EndReading
				}
				if rec.StartReading > maxOdo {
					maxOdo = rec.StartReading
				}
			}
		}
	}

	// 2. Check Trips (where not deleted and not cancelled)
	tripFilter := bson.M{
		"odometer_record_deleted": bson.M{"$ne": true},
		"status":                  bson.M{"$ne": "cancelled"},
	}
	if truckID != "" && driverID != "" {
		tripFilter["$or"] = []bson.M{
			{"truck_id": truckID},
			{"driver_id": driverID},
		}
	} else if truckID != "" {
		tripFilter["truck_id"] = truckID
	} else if driverID != "" {
		tripFilter["driver_id"] = driverID
	}

	if cursor, err := h.DB.Trips.Find(ctx, tripFilter); err == nil {
		defer cursor.Close(ctx)
		var trips []models.Trip
		if err := cursor.All(ctx, &trips); err == nil {
			for _, tr := range trips {
				if tr.EndOdometer > maxOdo {
					maxOdo = tr.EndOdometer
				}
				if tr.StartOdometer > maxOdo {
					maxOdo = tr.StartOdometer
				}
			}
		}
	}

	// 3. Check FuelRequests (where not rejected)
	fuelFilter := bson.M{
		"status": bson.M{"$ne": "rejected"},
	}
	if truckID != "" && driverID != "" {
		fuelFilter["$or"] = []bson.M{
			{"truck_id": truckID},
			{"driver_id": driverID},
		}
	} else if truckID != "" {
		fuelFilter["truck_id"] = truckID
	} else if driverID != "" {
		fuelFilter["driver_id"] = driverID
	}

	if cursor, err := h.DB.FuelRequests.Find(ctx, fuelFilter); err == nil {
		defer cursor.Close(ctx)
		var fuels []models.FuelRequest
		if err := cursor.All(ctx, &fuels); err == nil {
			for _, fr := range fuels {
				if fr.OdometerReading > maxOdo {
					maxOdo = fr.OdometerReading
				}
			}
		}
	}

	// 4. Check Maintenance (where not cancelled)
	maintFilter := bson.M{
		"status": bson.M{"$ne": "cancelled"},
	}
	if truckID != "" && driverID != "" {
		maintFilter["$or"] = []bson.M{
			{"truck_id": truckID},
			{"driver_id": driverID},
		}
	} else if truckID != "" {
		maintFilter["truck_id"] = truckID
	} else if driverID != "" {
		maintFilter["driver_id"] = driverID
	}

	if cursor, err := h.DB.Maintenance.Find(ctx, maintFilter); err == nil {
		defer cursor.Close(ctx)
		var maints []models.Maintenance
		if err := cursor.All(ctx, &maints); err == nil {
			for _, mt := range maints {
				if mt.Mileage > maxOdo {
					maxOdo = mt.Mileage
				}
			}
		}
	}

	return maxOdo
}

