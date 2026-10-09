package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"truck-fleet-backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type OdometerHandler struct {
	BaseHandler
}

func NewOdometerHandler(base BaseHandler) *OdometerHandler {
	return &OdometerHandler{BaseHandler: base}
}

// resolveDriverAndTruck gets the driver and truck details for the current context
func (h *OdometerHandler) resolveDriverAndTruck(ctx context.Context, c *gin.Context, targetDriverID string) (driverID, driverName, truckID, truckPlate string, lastReading float64) {
	currentUserID := c.GetString("userID")
	userRole := c.GetString("role")
	fullName := c.GetString("fullName")

	driverID = targetDriverID
	if userRole == string(models.RoleDriver) || driverID == "" {
		driverID = currentUserID
		driverName = fullName
	}

	userObjID, err := bson.ObjectIDFromHex(driverID)
	if err == nil {
		var driver models.Driver
		if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": userObjID}).Decode(&driver); err == nil {
			driverName = driver.FullName
			truckID = driver.AssignedTruckID
			truckPlate = driver.AssignedTruckPlate
		}
	}

	// If truckID is still empty, look up truck assigned to driver
	if truckID == "" {
		var trk models.Truck
		if err := h.DB.Trucks.FindOne(ctx, bson.M{"driver_assigned_id": driverID}).Decode(&trk); err == nil {
			truckID = trk.ID.Hex()
			truckPlate = trk.PlateNumber
		}
	} else {
		// Look up truck plate if missing
		trkObjID, err := bson.ObjectIDFromHex(truckID)
		if err == nil {
			var trk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": trkObjID}).Decode(&trk); err == nil {
				if truckPlate == "" {
					truckPlate = trk.PlateNumber
				}
			}
		}
	}

	// Calculate last reading strictly from verified recorded odometer entries
	lastReading = h.GetTruckLatestOdometer(ctx, truckID, driverID)

	return driverID, driverName, truckID, truckPlate, lastReading
}

// getTodayReadingsSummary finds the earliest and latest readings entered today by driver/truck
func (h *OdometerHandler) getTodayReadingsSummary(ctx context.Context, driverID, truckID string) (firstReadingToday, lastReadingToday float64) {
	now := time.Now()
	todayStr := now.Format("2006-01-02")
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	endOfToday := startOfToday.Add(24 * time.Hour)

	// 1. Check daily_shift reading if recorded today
	var dailyShift models.OdometerReading
	if err := h.DB.OdometerReadings.FindOne(ctx, bson.M{"driver_id": driverID, "date": todayStr, "source": "daily_shift"}).Decode(&dailyShift); err == nil {
		if dailyShift.StartReading > 0 {
			firstReadingToday = dailyShift.StartReading
			lastReadingToday = dailyShift.StartReading
		}
		if dailyShift.EndReading > 0 {
			lastReadingToday = dailyShift.EndReading
		}
	}

	// 2. Check Trips today
	tripTodayFilter := bson.M{
		"odometer_record_deleted": bson.M{"$ne": true},
		"status":                  bson.M{"$ne": "cancelled"},
		"date":                    bson.M{"$gte": startOfToday, "$lt": endOfToday},
	}
	if driverID != "" && truckID != "" {
		tripTodayFilter["$or"] = []bson.M{
			{"driver_id": driverID},
			{"truck_id": truckID},
		}
	} else if driverID != "" {
		tripTodayFilter["driver_id"] = driverID
	} else if truckID != "" {
		tripTodayFilter["truck_id"] = truckID
	}

	tripOpts := options.Find().SetSort(bson.D{{Key: "created_at", Value: 1}})
	if cursor, err := h.DB.Trips.Find(ctx, tripTodayFilter, tripOpts); err == nil {
		var todayTrips []models.Trip
		if err := cursor.All(ctx, &todayTrips); err == nil {
			for _, tr := range todayTrips {
				if (firstReadingToday == 0 || tr.StartOdometer < firstReadingToday) && tr.StartOdometer > 0 {
					firstReadingToday = tr.StartOdometer
				}
				if tr.StartOdometer > lastReadingToday {
					lastReadingToday = tr.StartOdometer
				}
				if tr.EndOdometer > lastReadingToday {
					lastReadingToday = tr.EndOdometer
				}
			}
		}
		cursor.Close(ctx)
	}

	// 3. Check all OdometerReadings recorded today
	odoTodayFilter := bson.M{
		"date": todayStr,
	}
	if driverID != "" && truckID != "" {
		odoTodayFilter["$or"] = []bson.M{
			{"driver_id": driverID},
			{"truck_id": truckID},
		}
	} else if driverID != "" {
		odoTodayFilter["driver_id"] = driverID
	} else if truckID != "" {
		odoTodayFilter["truck_id"] = truckID
	}

	if cursor, err := h.DB.OdometerReadings.Find(ctx, odoTodayFilter); err == nil {
		var todayOdoList []models.OdometerReading
		if err := cursor.All(ctx, &todayOdoList); err == nil {
			for _, o := range todayOdoList {
				if (firstReadingToday == 0 || o.StartReading < firstReadingToday) && o.StartReading > 0 {
					firstReadingToday = o.StartReading
				}
				if o.StartReading > lastReadingToday {
					lastReadingToday = o.StartReading
				}
				if o.EndReading > lastReadingToday {
					lastReadingToday = o.EndReading
				}
			}
		}
		cursor.Close(ctx)
	}

	// 4. Check FuelRequests today
	fuelTodayFilter := bson.M{
		"requested_at": bson.M{"$gte": startOfToday, "$lt": endOfToday},
		"status":       bson.M{"$ne": "rejected"},
	}
	if driverID != "" && truckID != "" {
		fuelTodayFilter["$or"] = []bson.M{
			{"driver_id": driverID},
			{"truck_id": truckID},
		}
	} else if driverID != "" {
		fuelTodayFilter["driver_id"] = driverID
	} else if truckID != "" {
		fuelTodayFilter["truck_id"] = truckID
	}

	if cursor, err := h.DB.FuelRequests.Find(ctx, fuelTodayFilter); err == nil {
		var todayFuels []models.FuelRequest
		if err := cursor.All(ctx, &todayFuels); err == nil {
			for _, f := range todayFuels {
				if (firstReadingToday == 0 || f.OdometerReading < firstReadingToday) && f.OdometerReading > 0 {
					firstReadingToday = f.OdometerReading
				}
				if f.OdometerReading > lastReadingToday {
					lastReadingToday = f.OdometerReading
				}
			}
		}
		cursor.Close(ctx)
	}

	return firstReadingToday, lastReadingToday
}

// GetTodayReading returns today's odometer reading status for the driver
func (h *OdometerHandler) GetTodayReading(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	targetDriverID := c.Query("driver_id")
	driverID, _, truckID, truckPlate, lastReading := h.resolveDriverAndTruck(ctx, c, targetDriverID)
	if latest := h.GetTruckLatestOdometer(ctx, truckID, driverID); latest > lastReading {
		lastReading = latest
	}
	todayStr := time.Now().Format("2006-01-02")

	firstReadingToday, lastReadingToday := h.getTodayReadingsSummary(ctx, driverID, truckID)
	if lastReadingToday == 0 {
		lastReadingToday = lastReading
	}

	var reading models.OdometerReading
	filter := bson.M{
		"date":   todayStr,
		"source": "daily_shift",
	}
	if driverID != "" {
		filter["driver_id"] = driverID
	}

	err := h.DB.OdometerReadings.FindOne(ctx, filter).Decode(&reading)
	hasReading := err == nil
	hasStart := hasReading && reading.StartReading > 0
	hasEnd := hasReading && reading.EndReading > 0

	// If no explicit daily shift start, but driver had first reading today:
	if !hasStart && firstReadingToday > 0 {
		reading.StartReading = firstReadingToday
		hasStart = true
	}

	c.JSON(http.StatusOK, gin.H{
		"reading":             reading,
		"has_reading":         hasReading || firstReadingToday > 0,
		"has_start":           hasStart,
		"has_end":             hasEnd,
		"last_reading":        lastReading,
		"last_reading_today":  lastReadingToday,
		"first_reading_today": firstReadingToday,
		"truck_id":            truckID,
		"truck_plate":         truckPlate,
		"today_date":          todayStr,
	})
}

type StartReadingInput struct {
	StartReading float64 `json:"start_reading" binding:"required"`
	Notes        string  `json:"notes"`
	DriverID     string  `json:"driver_id"`
}

// SaveStartReading records the beginning of the day odometer reading
func (h *OdometerHandler) SaveStartReading(c *gin.Context) {
	var input StartReadingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a valid starting odometer reading: " + err.Error()})
		return
	}

	if input.StartReading <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Starting odometer reading must be greater than zero"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	driverID, driverName, truckID, truckPlate, _ := h.resolveDriverAndTruck(ctx, c, input.DriverID)
	todayStr := time.Now().Format("2006-01-02")
	now := time.Now()

	// Validate odometer reading cannot be less than previous recorded reading
	prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
	if prevOdo > 0 && input.StartReading < prevOdo {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Starting odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) on truck %s. As the vehicle travels, odometer readings must increase.", input.StartReading, prevOdo, truckPlate),
			"min_odometer": prevOdo,
		})
		return
	}

	// Check if already exists for today
	var existing models.OdometerReading
	err := h.DB.OdometerReadings.FindOne(ctx, bson.M{"driver_id": driverID, "date": todayStr, "source": "daily_shift"}).Decode(&existing)

	if err == nil {
		// Update existing start reading
		update := bson.M{
			"$set": bson.M{
				"start_reading": input.StartReading,
				"start_time":    now,
				"start_notes":   input.Notes,
				"updated_at":    now,
			},
		}
		// If end reading already present, recalculate distance
		if existing.EndReading > 0 {
			if existing.EndReading >= input.StartReading {
				update["$set"].(bson.M)["distance_km"] = existing.EndReading - input.StartReading
				update["$set"].(bson.M)["status"] = "completed"
			}
		} else {
			update["$set"].(bson.M)["status"] = "started"
		}

		_, err = h.DB.OdometerReadings.UpdateOne(ctx, bson.M{"_id": existing.ID}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update starting odometer reading"})
			return
		}

		// Re-fetch
		_ = h.DB.OdometerReadings.FindOne(ctx, bson.M{"_id": existing.ID}).Decode(&existing)
		existing.StartReading = input.StartReading
	} else {
		// Insert new
		newReading := models.OdometerReading{
			ID:           bson.NewObjectID(),
			DriverID:     driverID,
			DriverName:   driverName,
			TruckID:      truckID,
			TruckPlate:   truckPlate,
			Date:         todayStr,
			StartReading: input.StartReading,
			StartTime:    &now,
			StartNotes:   input.Notes,
			Source:       "daily_shift",
			Status:       "started",
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		_, err = h.DB.OdometerReadings.InsertOne(ctx, newReading)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save starting odometer reading"})
			return
		}
		existing = newReading
	}

	// Update truck's mileage if greater
	if truckID != "" {
		trkObjID, err := bson.ObjectIDFromHex(truckID)
		if err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
				"$max": bson.M{"mileage": input.StartReading},
				"$set": bson.M{
					"current_odometer": input.StartReading,
					"current_mileage":  input.StartReading,
				},
			})
		}
	}

	h.LogAudit(ctx, driverID, driverName, "Odometer Start", "OdometerReading", existing.ID.Hex(), "",
		fmt.Sprintf("Recorded start odometer reading: %.0f km on truck %s", input.StartReading, truckPlate))

	c.JSON(http.StatusOK, gin.H{
		"message": "Beginning of day odometer reading recorded successfully",
		"reading": existing,
	})
}

type EndReadingInput struct {
	EndReading float64 `json:"end_reading" binding:"required"`
	Notes      string  `json:"notes"`
	DriverID   string  `json:"driver_id"`
}

// SaveEndReading records the end of the day odometer reading
func (h *OdometerHandler) SaveEndReading(c *gin.Context) {
	var input EndReadingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a valid ending odometer reading: " + err.Error()})
		return
	}

	if input.EndReading <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ending odometer reading must be greater than zero"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	driverID, driverName, truckID, truckPlate, _ := h.resolveDriverAndTruck(ctx, c, input.DriverID)
	todayStr := time.Now().Format("2006-01-02")
	now := time.Now()

	var existing models.OdometerReading
	err := h.DB.OdometerReadings.FindOne(ctx, bson.M{"driver_id": driverID, "date": todayStr, "source": "daily_shift"}).Decode(&existing)

	startReading := existing.StartReading
	if err != nil || startReading <= 0 {
		firstReadingToday, _ := h.getTodayReadingsSummary(ctx, driverID, truckID)
		if firstReadingToday > 0 {
			startReading = firstReadingToday
		} else {
			startReading = input.EndReading
		}
	}

	if input.EndReading < startReading {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Closing odometer reading (%.0f km) cannot be less than the starting odometer reading (%.0f km). As the vehicle travels, odometer readings must increase.", input.EndReading, startReading),
			"min_odometer": startReading,
		})
		return
	}

	prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
	if prevOdo > 0 && input.EndReading < prevOdo {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Closing odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) on truck %s. As the vehicle travels, odometer readings must increase.", input.EndReading, prevOdo, truckPlate),
			"min_odometer": prevOdo,
		})
		return
	}

	distanceKm := input.EndReading - startReading
	if existing.ID.IsZero() {
		existing = models.OdometerReading{
			ID:           bson.NewObjectID(),
			DriverID:     driverID,
			DriverName:   driverName,
			TruckID:      truckID,
			TruckPlate:   truckPlate,
			Date:         todayStr,
			StartReading: startReading,
			StartTime:    &now,
			EndReading:   input.EndReading,
			EndTime:      &now,
			EndNotes:     input.Notes,
			DistanceKm:   distanceKm,
			Source:       "daily_shift",
			Status:       "completed",
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		_, err = h.DB.OdometerReadings.InsertOne(ctx, existing)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save end odometer reading: " + err.Error()})
			return
		}
	} else {
		update := bson.M{
			"$set": bson.M{
				"start_reading": startReading,
				"end_reading":   input.EndReading,
				"end_time":      now,
				"end_notes":     input.Notes,
				"distance_km":   distanceKm,
				"status":        "completed",
				"updated_at":    now,
			},
		}
		_, err = h.DB.OdometerReadings.UpdateOne(ctx, bson.M{"_id": existing.ID}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update end odometer reading: " + err.Error()})
			return
		}
	}

	// Update truck's mileage and current_odometer
	if truckID != "" {
		trkObjID, err := bson.ObjectIDFromHex(truckID)
		if err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
				"$max": bson.M{"mileage": input.EndReading},
				"$set": bson.M{
					"current_odometer": input.EndReading,
					"current_mileage":  input.EndReading,
				},
			})
		}
	}

	_ = h.DB.OdometerReadings.FindOne(ctx, bson.M{"_id": existing.ID}).Decode(&existing)

	h.LogAudit(ctx, driverID, driverName, "Odometer End", "OdometerReading", existing.ID.Hex(), "",
		fmt.Sprintf("Recorded end odometer reading: %.0f km (Distance today: %.0f km) on truck %s", input.EndReading, distanceKm, truckPlate))

	c.JSON(http.StatusOK, gin.H{
		"message":     "End of day odometer reading recorded successfully",
		"reading":     existing,
		"distance_km": distanceKm,
	})
}

// GetHistory returns past odometer logs for the driver
func (h *OdometerHandler) GetHistory(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userRole := c.GetString("role")
	currentUserID := c.GetString("userID")
	targetDriverID := c.Query("driver_id")

	filter := bson.M{}
	if userRole == string(models.RoleDriver) || targetDriverID == "" {
		filter["driver_id"] = currentUserID
	} else if targetDriverID != "" {
		filter["driver_id"] = targetDriverID
	}

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}}).SetLimit(30)
	cursor, err := h.DB.OdometerReadings.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch odometer history"})
		return
	}
	defer cursor.Close(ctx)

	readings := make([]models.OdometerReading, 0)
	_ = cursor.All(ctx, &readings)

	c.JSON(http.StatusOK, readings)
}

// GetAll returns all odometer readings for fleet tracking (admin view)
func (h *OdometerHandler) GetAll(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{}
	if truckID := c.Query("truck_id"); truckID != "" {
		filter["truck_id"] = truckID
	}
	if driverID := c.Query("driver_id"); driverID != "" {
		filter["driver_id"] = driverID
	}
	if source := c.Query("source"); source != "" && source != "all" {
		filter["source"] = source
	}
	if status := c.Query("status"); status != "" && status != "all" {
		filter["status"] = status
	}
	if date := c.Query("date"); date != "" {
		filter["date"] = date
	}
	if search := c.Query("search"); search != "" {
		cleanSearch := strings.TrimSpace(search)
		regexPattern := bson.M{"$regex": cleanSearch, "$options": "i"}
		filter["$or"] = []bson.M{
			{"truck_plate": regexPattern},
			{"driver_name": regexPattern},
			{"trip_number": regexPattern},
			{"receipt_number": regexPattern},
			{"start_notes": regexPattern},
			{"end_notes": regexPattern},
		}
	}

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}, {Key: "created_at", Value: -1}}).SetLimit(300)
	cursor, err := h.DB.OdometerReadings.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch odometer records"})
		return
	}
	defer cursor.Close(ctx)

	readings := make([]models.OdometerReading, 0)
	_ = cursor.All(ctx, &readings)

	// Summary statistics for admin header
	now := time.Now()
	todayStr := now.Format("2006-01-02")
	currentMonthStr := now.Format("2006-01")

	var totalDistance float64
	var todayDistance float64
	var monthDistance float64
	activeTrucksToday := make(map[string]bool)

	allCursor, _ := h.DB.OdometerReadings.Find(ctx, bson.M{})
	if allCursor != nil {
		var allList []models.OdometerReading
		_ = allCursor.All(ctx, &allList)
		allCursor.Close(ctx)

		for _, r := range allList {
			dist := r.DistanceKm
			if dist <= 0 && r.EndReading > r.StartReading {
				dist = r.EndReading - r.StartReading
			}
			if dist > 0 {
				totalDistance += dist
				if r.Date == todayStr {
					todayDistance += dist
				}
				if len(r.Date) >= 7 && r.Date[:7] == currentMonthStr {
					monthDistance += dist
				}
			}
			if r.Date == todayStr && r.TruckPlate != "" {
				activeTrucksToday[r.TruckPlate] = true
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"records":             readings,
		"total_count":         len(readings),
		"total_distance_km":   math.Round(totalDistance*10) / 10,
		"today_distance_km":   math.Round(todayDistance*10) / 10,
		"month_distance_km":   math.Round(monthDistance*10) / 10,
		"active_trucks_today": len(activeTrucksToday),
	})
}

type ManualOdometerInput struct {
	TruckID      string  `json:"truck_id" binding:"required"`
	DriverID     string  `json:"driver_id"`
	Date         string  `json:"date"`
	StartReading float64 `json:"start_reading" binding:"required"`
	EndReading   float64 `json:"end_reading"`
	Notes        string  `json:"notes"`
	Source       string  `json:"source"`
}

// CreateManualRecord allows admins to manually register an odometer record
func (h *OdometerHandler) CreateManualRecord(c *gin.Context) {
	var input ManualOdometerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide valid truck and starting odometer: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	adminID := c.GetString("userID")
	adminName := c.GetString("fullName")

	// Resolve truck details
	var trk models.Truck
	trkObjID, err := bson.ObjectIDFromHex(input.TruckID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid truck ID"})
		return
	}
	if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": trkObjID}).Decode(&trk); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Truck not found"})
		return
	}

	driverID := input.DriverID
	driverName := trk.DriverAssignedName
	if driverID != "" {
		drvObjID, err := bson.ObjectIDFromHex(driverID)
		if err == nil {
			var drv models.Driver
			if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": drvObjID}).Decode(&drv); err == nil {
				driverName = drv.FullName
			}
		}
	} else if trk.DriverAssignedID != "" {
		driverID = trk.DriverAssignedID
	}

	recordDate := input.Date
	if recordDate == "" {
		recordDate = time.Now().Format("2006-01-02")
	}

	var dist float64
	status := "started"
	if input.EndReading > input.StartReading {
		dist = input.EndReading - input.StartReading
		status = "completed"
	}

	source := input.Source
	if source == "" {
		source = "manual"
	}

	now := time.Now()
	record := models.OdometerReading{
		ID:           bson.NewObjectID(),
		DriverID:     driverID,
		DriverName:   driverName,
		TruckID:      input.TruckID,
		TruckPlate:   trk.PlateNumber,
		Date:         recordDate,
		StartReading: input.StartReading,
		StartTime:    &now,
		EndReading:   input.EndReading,
		DistanceKm:   dist,
		StartNotes:   input.Notes,
		Source:       source,
		Status:       status,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if input.EndReading > 0 {
		record.EndTime = &now
	}

	_, err = h.DB.OdometerReadings.InsertOne(ctx, record)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create odometer record: " + err.Error()})
		return
	}

	// Update truck mileage
	maxReading := input.StartReading
	if input.EndReading > maxReading {
		maxReading = input.EndReading
	}
	_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
		"$max": bson.M{"mileage": maxReading, "current_odometer": maxReading},
	})

	h.LogAudit(ctx, adminID, adminName, "Created Odometer Record", "OdometerReading", record.ID.Hex(), "",
		fmt.Sprintf("Manually logged odometer record for truck %s (%.0f → %.0f km)", trk.PlateNumber, input.StartReading, input.EndReading))

	c.JSON(http.StatusCreated, record)
}

type UpdateOdometerInput struct {
	TruckID      string  `json:"truck_id"`
	DriverID     string  `json:"driver_id"`
	Date         string  `json:"date"`
	StartReading float64 `json:"start_reading"`
	EndReading   float64 `json:"end_reading"`
	StartNotes   string  `json:"start_notes"`
	EndNotes     string  `json:"end_notes"`
	Status       string  `json:"status"`
}

// UpdateRecord allows admins to correct an existing odometer record
func (h *OdometerHandler) UpdateRecord(c *gin.Context) {
	recordID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(recordID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid record ID"})
		return
	}

	var input UpdateOdometerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide valid update data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	adminID := c.GetString("userID")
	adminName := c.GetString("fullName")

	var existing models.OdometerReading
	if err := h.DB.OdometerReadings.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Odometer record not found"})
		return
	}

	startReading := existing.StartReading
	if input.StartReading > 0 {
		startReading = input.StartReading
	}

	endReading := existing.EndReading
	if input.EndReading >= 0 {
		endReading = input.EndReading
	}

	var dist float64
	if endReading > startReading {
		dist = endReading - startReading
	}

	status := existing.Status
	if input.Status != "" {
		status = input.Status
	} else if endReading > startReading {
		status = "completed"
	}

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"start_reading": startReading,
			"end_reading":   endReading,
			"distance_km":   dist,
			"status":        status,
			"updated_at":    now,
		},
	}

	if input.Date != "" {
		update["$set"].(bson.M)["date"] = input.Date
	}
	if input.StartNotes != "" {
		update["$set"].(bson.M)["start_notes"] = input.StartNotes
	}
	if input.EndNotes != "" {
		update["$set"].(bson.M)["end_notes"] = input.EndNotes
	}

	_, err = h.DB.OdometerReadings.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update odometer record: " + err.Error()})
		return
	}

	// Fetch updated
	var updated models.OdometerReading
	_ = h.DB.OdometerReadings.FindOne(ctx, bson.M{"_id": objID}).Decode(&updated)

	h.LogAudit(ctx, adminID, adminName, "Updated Odometer Record", "OdometerReading", recordID, "",
		fmt.Sprintf("Updated odometer reading for truck %s (Start: %.0f, End: %.0f, Dist: %.0f km)", existing.TruckPlate, startReading, endReading, dist))

	c.JSON(http.StatusOK, updated)
}

// DeleteRecord allows admins to delete an erroneous odometer record
func (h *OdometerHandler) DeleteRecord(c *gin.Context) {
	recordID := strings.TrimSpace(c.Param("id"))
	objID, err := bson.ObjectIDFromHex(recordID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid record ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	adminID := c.GetString("userID")
	adminName := c.GetString("fullName")

	var existing models.OdometerReading
	if err := h.DB.OdometerReadings.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Odometer record not found"})
		return
	}

	_, err = h.DB.OdometerReadings.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete odometer record: " + err.Error()})
		return
	}

	if existing.TripID != "" {
		if tripObjID, err := bson.ObjectIDFromHex(existing.TripID); err == nil {
			_, _ = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": tripObjID}, bson.M{
				"$set": bson.M{"odometer_record_deleted": true},
			})
		}
	}

	// Recalculate remaining latest odometer for this truck
	newLatest := h.GetTruckLatestOdometer(ctx, existing.TruckID, existing.DriverID)
	if existing.TruckID != "" {
		if trkObjID, err := bson.ObjectIDFromHex(existing.TruckID); err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
				"$set": bson.M{
					"current_odometer": newLatest,
					"current_mileage":  newLatest,
				},
			})
		}
	}

	h.LogAudit(ctx, adminID, adminName, "Deleted Odometer Record", "OdometerReading", recordID, "",
		fmt.Sprintf("Deleted odometer record for truck %s on date %s (Start: %.0f, End: %.0f km)", existing.TruckPlate, existing.Date, existing.StartReading, existing.EndReading))

	c.JSON(http.StatusOK, gin.H{"message": "Odometer record deleted successfully"})
}
