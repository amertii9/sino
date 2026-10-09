package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"truck-fleet-backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type TripHandler struct {
	BaseHandler
}

func NewTripHandler(base BaseHandler) *TripHandler {
	return &TripHandler{BaseHandler: base}
}

type CreateTripInput struct {
	TruckID             string    `json:"truck_id"`
	TruckPlate          string    `json:"truck_plate"`
	DriverID            string    `json:"driver_id"`
	DriverName          string    `json:"driver_name"`
	LoadingSiteID       string    `json:"loading_site_id" binding:"required"`
	LoadingSiteName     string    `json:"loading_site_name"`
	DumpingSiteID       string    `json:"dumping_site_id" binding:"required"`
	DumpingSiteName     string    `json:"dumping_site_name"`
	HasTransition       bool      `json:"has_transition"`
	TransitionPointIDs  []string  `json:"transition_point_ids"`
	TransitionPointName string    `json:"transition_point_name"`
	MaterialID          string    `json:"material_id" binding:"required"`
	MaterialName        string    `json:"material_name"`
	Quantity            float64   `json:"quantity" binding:"required"`
	Unit                string    `json:"unit" binding:"required"`                     // "kg", "quintal", "ton"
	PricingMethod       string    `json:"pricing_method" binding:"required"`           // "per_kg", "per_quintal", "per_ton", "lump_sum"
	UnitPrice           float64          `json:"unit_price"`
	LumpSum             float64          `json:"lump_sum"`
	AdditionalFees      []models.TripFee `json:"additional_fees"`
	StartOdometer       float64          `json:"start_odometer"`
	EndOdometer         float64          `json:"end_odometer"`
	ReceiptNumber       string           `json:"receipt_number"`
	Status              string           `json:"status"`
	Date                string           `json:"date"`
	Notes               string           `json:"notes"`
}

func (h *TripHandler) CreateTrip(c *gin.Context) {
	var input CreateTripInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please fill all required trip fields: " + err.Error()})
		return
	}

	if input.Quantity <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than zero"})
		return
	}

	if input.PricingMethod != "lump_sum" && input.UnitPrice <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unit price must be greater than zero"})
		return
	}

	if input.PricingMethod == "lump_sum" && input.LumpSum <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lump sum amount must be greater than zero"})
		return
	}

	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")
	fullName := c.GetString("fullName")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	driverID := input.DriverID
	driverName := input.DriverName
	truckID := input.TruckID
	truckPlate := input.TruckPlate

	if userRole == string(models.RoleDriver) || driverID == "" {
		driverID = userIDStr
		driverName = fullName
	}

	// Always ensure truckID and truckPlate are resolved
	if truckID == "" {
		// 1. Try finding truck from driver profile
		var driver models.Driver
		userObjID, err := bson.ObjectIDFromHex(driverID)
		if err == nil {
			if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": userObjID}).Decode(&driver); err == nil {
				truckID = driver.AssignedTruckID
				truckPlate = driver.AssignedTruckPlate
			}
		}

		// 2. Try finding truck assigned to this driver user_id
		if truckID == "" {
			var trk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"driver_assigned_id": driverID}).Decode(&trk); err == nil {
				truckID = trk.ID.Hex()
				truckPlate = trk.PlateNumber
			}
		}

		// 3. Fallback to any active/available truck
		if truckID == "" {
			var fallbackTrk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"status": bson.M{"$in": []string{"working", "available"}}}).Decode(&fallbackTrk); err == nil {
				truckID = fallbackTrk.ID.Hex()
				truckPlate = fallbackTrk.PlateNumber
			}
		}
	}

	if truckPlate == "" && truckID != "" {
		var trk models.Truck
		trkObjID, err := bson.ObjectIDFromHex(truckID)
		if err == nil {
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": trkObjID}).Decode(&trk); err == nil {
				truckPlate = trk.PlateNumber
			}
		}
	}

	if truckID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No truck assigned to this driver. Please assign a truck in the Admin Portal."})
		return
	}

	// Validate odometer reading cannot be less than previous recorded reading
	if input.StartOdometer > 0 {
		prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
		if prevOdo > 0 && input.StartOdometer < prevOdo {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Starting odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) for truck %s. As the vehicle travels, odometer readings must increase.", input.StartOdometer, prevOdo, truckPlate),
				"min_odometer": prevOdo,
			})
			return
		}
	}

	if input.EndOdometer > 0 {
		if input.StartOdometer > 0 && input.EndOdometer < input.StartOdometer {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Ending odometer reading (%.0f km) cannot be less than the starting odometer reading (%.0f km). As the vehicle travels, odometer readings must increase.", input.EndOdometer, input.StartOdometer),
				"min_odometer": input.StartOdometer,
			})
			return
		}
		prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
		if prevOdo > 0 && input.EndOdometer < prevOdo {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Ending odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) for truck %s. As the vehicle travels, odometer readings must increase.", input.EndOdometer, prevOdo, truckPlate),
				"min_odometer": prevOdo,
			})
			return
		}
	}

	// Calculate Quantity in Kg
	var quantityKg float64
	switch strings.ToLower(input.Unit) {
	case "ton", "tons":
		quantityKg = input.Quantity * 1000
	case "quintal", "quintals":
		quantityKg = input.Quantity * 100
	case "kg", "kilogram":
		quantityKg = input.Quantity
	default:
		quantityKg = input.Quantity * 1000 // default assume tons
	}

	// Calculate Gross Revenue
	var grossRevenue float64
	if input.PricingMethod == "lump_sum" {
		grossRevenue = input.LumpSum
	} else {
		grossRevenue = input.Quantity * input.UnitPrice
	}

	// Calculate Additional Fees and Net/Total Revenue
	var totalAdditionalFees float64
	validFees := make([]models.TripFee, 0)
	for _, f := range input.AdditionalFees {
		if f.Amount > 0 {
			feeType := strings.ToLower(strings.TrimSpace(f.FeeType))
			if feeType == "" {
				feeType = "other"
			}
			f.FeeType = feeType
			totalAdditionalFees += f.Amount
			validFees = append(validFees, f)
		}
	}
	totalRevenue := grossRevenue - totalAdditionalFees
	netRevenue := totalRevenue

	// Determine trip date
	tripDate := time.Now()
	if input.Date != "" {
		if t, err := time.Parse("2006-01-02", input.Date); err == nil {
			tripDate = t
		}
	}

	tripNumber := h.GenerateNextNumber(ctx, "trips", "TR")

	trip := models.Trip{
		ID:                  bson.NewObjectID(),
		TripNumber:          tripNumber,
		DriverID:            driverID,
		DriverName:          driverName,
		TruckID:             truckID,
		TruckPlate:          truckPlate,
		LoadingSiteID:       input.LoadingSiteID,
		LoadingSiteName:     input.LoadingSiteName,
		DumpingSiteID:       input.DumpingSiteID,
		DumpingSiteName:     input.DumpingSiteName,
		HasTransition:       input.HasTransition,
		TransitionPointIDs:  input.TransitionPointIDs,
		TransitionPointName: input.TransitionPointName,
		MaterialID:          input.MaterialID,
		MaterialName:        input.MaterialName,
		Quantity:            input.Quantity,
		Unit:                input.Unit,
		QuantityKg:          quantityKg,
		PricingMethod:       input.PricingMethod,
		UnitPrice:           input.UnitPrice,
		LumpSum:             input.LumpSum,
		GrossRevenue:        grossRevenue,
		TotalRevenue:        totalRevenue,
		AdditionalFees:      validFees,
		TotalAdditionalFees: totalAdditionalFees,
		NetRevenue:          netRevenue,
		StartOdometer:       input.StartOdometer,
		EndOdometer:         input.EndOdometer,
		ReceiptNumber:       input.ReceiptNumber,
		Date:                tripDate,
		Status:              "completed",
		PaymentStatus:       "pending",
		PaidAmount:          0,
		Notes:               input.Notes,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}
	if input.Status != "" {
		trip.Status = input.Status
	}

	_, err := h.DB.Trips.InsertOne(ctx, trip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record trip: " + err.Error()})
		return
	}

	// Automatically create synchronized active Expense records for fees incurred
	for _, fee := range validFees {
		expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
		expType := fee.FeeType
		if expType != "toll" && expType != "parking" && expType != "washing" && expType != "maintenance" && expType != "weighbridge" && expType != "gate_fee" {
			expType = "other"
		}
		desc := fee.Description
		if desc == "" {
			desc = fmt.Sprintf("Trip %s: %s fee", tripNumber, strings.Title(fee.FeeType))
		} else {
			desc = fmt.Sprintf("Trip %s [%s]: %s", tripNumber, fee.FeeType, desc)
		}
		expense := models.Expense{
			ID:            bson.NewObjectID(),
			ExpenseNumber: expNumber,
			TruckID:       truckID,
			TruckPlate:    truckPlate,
			DriverID:      driverID,
			DriverName:    driverName,
			TripID:        trip.ID.Hex(),
			TripNumber:    tripNumber,
			ExpenseType:   expType,
			Amount:        fee.Amount,
			Date:          tripDate,
			Description:   desc,
			ReceiptNumber: fmt.Sprintf("TRIP-%s", tripNumber),
			Status:        "active",
			CreatedAt:     time.Now(),
		}
		_, _ = h.DB.Expenses.InsertOne(ctx, expense)
	}

	// Audit Log
	h.LogAudit(ctx, userIDStr, fullName, "Submitted Trip", "Trip", trip.ID.Hex(), "",
		fmt.Sprintf("Trip %s: %.1f %s %s (Revenue: %.0f ETB, Fees: %.0f ETB, Net: %.0f ETB)",
			tripNumber, trip.Quantity, trip.Unit, trip.MaterialName, trip.TotalRevenue, trip.TotalAdditionalFees, trip.NetRevenue))

	// Notification for Admins
	h.CreateNotification(ctx, "", "admin", fmt.Sprintf("New Trip %s Recorded", tripNumber),
		fmt.Sprintf("%s recorded trip with %s (Net: %.0f ETB)", driverName, trip.MaterialName, trip.NetRevenue), "trip_submitted")

	c.JSON(http.StatusCreated, trip)
}

func (h *TripHandler) GetTrips(c *gin.Context) {
	userRole := c.GetString("role")
	userIDStr := c.GetString("userID")

	filter := bson.M{}

	// Enforce strict RBAC: Drivers only see their own trips
	if userRole == string(models.RoleDriver) {
		filter["driver_id"] = userIDStr
	} else {
		// Admin filters
		if driverID := c.Query("driver_id"); driverID != "" {
			filter["driver_id"] = driverID
		}
		if truckID := c.Query("truck_id"); truckID != "" {
			filter["truck_id"] = truckID
		}
		if siteID := c.Query("loading_site_id"); siteID != "" {
			filter["loading_site_id"] = siteID
		}
		if materialID := c.Query("material_id"); materialID != "" {
			filter["material_id"] = materialID
		}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if paymentStatus := c.Query("payment_status"); paymentStatus != "" {
			if paymentStatus == "pending" {
				filter["$or"] = []bson.M{
					{"payment_status": "pending"},
					{"payment_status": ""},
					{"payment_status": bson.M{"$exists": false}},
				}
			} else {
				filter["payment_status"] = paymentStatus
			}
		}
	}

	// Date filters
	period := c.Query("period") // "today", "this_week", "this_month"
	now := time.Now()
	if period == "today" {
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		filter["date"] = bson.M{"$gte": startOfDay}
	} else if period == "this_week" {
		startOfWeek := now.AddDate(0, 0, -int(now.Weekday()))
		startOfWeek = time.Date(startOfWeek.Year(), startOfWeek.Month(), startOfWeek.Day(), 0, 0, 0, 0, startOfWeek.Location())
		filter["date"] = bson.M{"$gte": startOfWeek}
	} else if period == "this_month" {
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		filter["date"] = bson.M{"$gte": startOfMonth}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}, {Key: "created_at", Value: -1}})
	cursor, err := h.DB.Trips.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trips"})
		return
	}
	defer cursor.Close(ctx)

	trips := make([]models.Trip, 0)
	if err := cursor.All(ctx, &trips); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode trips"})
		return
	}

	c.JSON(http.StatusOK, trips)
}

func (h *TripHandler) GetRecentTrip(c *gin.Context) {
	userIDStr := c.GetString("userID")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	findOpts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	var trip models.Trip
	err := h.DB.Trips.FindOne(ctx, bson.M{"driver_id": userIDStr, "status": "completed"}, findOpts).Decode(&trip)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"has_recent": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"has_recent": true,
		"trip":       trip,
	})
}

type StartTripInput struct {
	TruckID             string  `json:"truck_id"`
	TruckPlate          string  `json:"truck_plate"`
	DriverID            string  `json:"driver_id"`
	DriverName          string  `json:"driver_name"`
	StartOdometer       float64 `json:"start_odometer" binding:"required"`
	LoadingSiteID       string  `json:"loading_site_id" binding:"required"`
	LoadingSiteName     string  `json:"loading_site_name"`
	DumpingSiteID       string  `json:"dumping_site_id" binding:"required"`
	DumpingSiteName     string  `json:"dumping_site_name"`
	MaterialID          string  `json:"material_id" binding:"required"`
	MaterialName        string  `json:"material_name"`
	HasTransition       bool    `json:"has_transition"`
	TransitionPointIDs  []string`json:"transition_point_ids"`
	TransitionPointName string  `json:"transition_point_name"`
	Date                string  `json:"date"`
}

func (h *TripHandler) StartTrip(c *gin.Context) {
	var input StartTripInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide required trip start data: " + err.Error()})
		return
	}

	if input.StartOdometer <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please enter a valid starting odometer reading (km)"})
		return
	}

	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")
	fullName := c.GetString("fullName")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	driverID := input.DriverID
	driverName := input.DriverName
	truckID := input.TruckID
	truckPlate := input.TruckPlate

	if userRole == string(models.RoleDriver) || driverID == "" {
		driverID = userIDStr
		driverName = fullName
	}

	if truckID == "" {
		var driver models.Driver
		userObjID, err := bson.ObjectIDFromHex(driverID)
		if err == nil {
			if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": userObjID}).Decode(&driver); err == nil {
				truckID = driver.AssignedTruckID
				truckPlate = driver.AssignedTruckPlate
			}
		}
		if truckID == "" {
			var trk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"driver_assigned_id": driverID}).Decode(&trk); err == nil {
				truckID = trk.ID.Hex()
				truckPlate = trk.PlateNumber
			}
		}
		if truckID == "" {
			var fallbackTrk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"status": bson.M{"$in": []string{"working", "available"}}}).Decode(&fallbackTrk); err == nil {
				truckID = fallbackTrk.ID.Hex()
				truckPlate = fallbackTrk.PlateNumber
			}
		}
	}

	if truckPlate == "" && truckID != "" {
		var trk models.Truck
		trkObjID, err := bson.ObjectIDFromHex(truckID)
		if err == nil {
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": trkObjID}).Decode(&trk); err == nil {
				truckPlate = trk.PlateNumber
			}
		}
	}

	if truckID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No truck assigned to this driver. Please assign a truck in the Admin Portal."})
		return
	}

	// Validate odometer reading cannot be less than previous recorded reading
	prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
	if prevOdo > 0 && input.StartOdometer < prevOdo {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Starting odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) for truck %s. As the vehicle travels, odometer readings must increase.", input.StartOdometer, prevOdo, truckPlate),
			"min_odometer": prevOdo,
		})
		return
	}

	tripDate := time.Now()
	if input.Date != "" {
		if t, err := time.Parse("2006-01-02", input.Date); err == nil {
			tripDate = t
		}
	}

	now := time.Now()
	tripNumber := h.GenerateNextNumber(ctx, "trips", "TR")

	trip := models.Trip{
		ID:                  bson.NewObjectID(),
		TripNumber:          tripNumber,
		DriverID:            driverID,
		DriverName:          driverName,
		TruckID:             truckID,
		TruckPlate:          truckPlate,
		LoadingSiteID:       input.LoadingSiteID,
		LoadingSiteName:     input.LoadingSiteName,
		DumpingSiteID:       input.DumpingSiteID,
		DumpingSiteName:     input.DumpingSiteName,
		HasTransition:       input.HasTransition,
		TransitionPointIDs:  input.TransitionPointIDs,
		TransitionPointName: input.TransitionPointName,
		MaterialID:          input.MaterialID,
		MaterialName:        input.MaterialName,
		StartOdometer:       input.StartOdometer,
		Status:              "in_progress",
		PaymentStatus:       "pending",
		PaidAmount:          0,
		StartedAt:           &now,
		Date:                tripDate,
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	_, err := h.DB.Trips.InsertOne(ctx, trip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start trip: " + err.Error()})
		return
	}

	// Update truck odometer / mileage
	if trkObjID, err := bson.ObjectIDFromHex(truckID); err == nil {
		_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
			"$set": bson.M{
				"current_odometer": input.StartOdometer,
				"current_mileage":  input.StartOdometer,
				"mileage":          input.StartOdometer,
				"status":           "working",
			},
		})
	}

	// Auto-record starting odometer in OdometerReadings for this trip
	todayStr := time.Now().Format("2006-01-02")
	tripOdo := models.OdometerReading{
		ID:           bson.NewObjectID(),
		DriverID:     driverID,
		DriverName:   driverName,
		TruckID:      truckID,
		TruckPlate:   truckPlate,
		TripID:       trip.ID.Hex(),
		TripNumber:   tripNumber,
		Date:         todayStr,
		StartReading: input.StartOdometer,
		StartTime:    &now,
		StartNotes:   fmt.Sprintf("Trip %s: %s → %s (%s)", tripNumber, input.LoadingSiteName, input.DumpingSiteName, input.MaterialName),
		Source:       "trip_start",
		Status:       "started",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	_, _ = h.DB.OdometerReadings.InsertOne(ctx, tripOdo)

	h.CreateNotification(ctx, "", "admin",
		fmt.Sprintf("Trip %s Started (%s)", tripNumber, truckPlate),
		fmt.Sprintf("Driver %s started trip from %s to %s with %s (Start km: %.0f)",
			driverName, input.LoadingSiteName, input.DumpingSiteName, input.MaterialName, input.StartOdometer),
		"trip_submitted")

	h.LogAudit(ctx, driverID, driverName, "Started Hauling Trip", "Trip", trip.ID.Hex(), "",
		fmt.Sprintf("Driver started trip %s (%s → %s, start km: %.0f)", tripNumber, input.LoadingSiteName, input.DumpingSiteName, input.StartOdometer))

	c.JSON(http.StatusCreated, trip)
}

type CompleteTripInput struct {
	TripID              string           `json:"trip_id"`
	ReceiptNumber       string           `json:"receipt_number" binding:"required"`
	Quantity            float64          `json:"quantity" binding:"required"`
	Unit                string           `json:"unit" binding:"required"`
	PricingMethod       string           `json:"pricing_method" binding:"required"`
	UnitPrice           float64          `json:"unit_price"`
	LumpSum             float64          `json:"lump_sum"`
	AdditionalFees      []models.TripFee `json:"additional_fees"`
	Notes               string           `json:"notes"`
	EndOdometer         float64          `json:"end_odometer"`
}

func (h *TripHandler) CompleteTrip(c *gin.Context) {
	tripID := c.Param("id")
	var input CompleteTripInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide required trip completion data: " + err.Error()})
		return
	}

	if tripID == "" {
		tripID = input.TripID
	}

	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existingTrip models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&existingTrip); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")
	if userRole == string(models.RoleDriver) && existingTrip.DriverID != userIDStr {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized: you can only complete trips assigned to your account"})
		return
	}

	if input.Quantity <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than zero"})
		return
	}

	if input.PricingMethod != "lump_sum" && input.UnitPrice <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unit price must be greater than zero"})
		return
	}

	if input.PricingMethod == "lump_sum" && input.LumpSum <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lump sum amount must be greater than zero"})
		return
	}

	var quantityKg float64
	switch strings.ToLower(input.Unit) {
	case "ton", "tons":
		quantityKg = input.Quantity * 1000
	case "quintal", "quintals":
		quantityKg = input.Quantity * 100
	case "kg", "kilogram":
		quantityKg = input.Quantity
	default:
		quantityKg = input.Quantity * 1000
	}

	var grossRevenue float64
	if input.PricingMethod == "lump_sum" {
		grossRevenue = input.LumpSum
	} else {
		grossRevenue = input.Quantity * input.UnitPrice
	}

	var totalAdditionalFees float64
	validFees := make([]models.TripFee, 0)
	for _, f := range input.AdditionalFees {
		if f.Amount > 0 {
			feeType := strings.ToLower(strings.TrimSpace(f.FeeType))
			if feeType == "" {
				feeType = "other"
			}
			f.FeeType = feeType
			totalAdditionalFees += f.Amount
			validFees = append(validFees, f)
		}
	}
	totalRevenue := grossRevenue - totalAdditionalFees
	netRevenue := totalRevenue

	now := time.Now()

	updateFields := bson.M{
		"receipt_number":        input.ReceiptNumber,
		"quantity":              input.Quantity,
		"unit":                  input.Unit,
		"quantity_kg":           quantityKg,
		"pricing_method":        input.PricingMethod,
		"unit_price":            input.UnitPrice,
		"lump_sum":              input.LumpSum,
		"gross_revenue":         grossRevenue,
		"total_revenue":         totalRevenue,
		"additional_fees":       validFees,
		"total_additional_fees": totalAdditionalFees,
		"net_revenue":           netRevenue,
		"status":                "completed",
		"completed_at":          now,
		"updated_at":            now,
	}

	if existingTrip.PaymentStatus != "paid" {
		updateFields["payment_status"] = "pending"
	}

	if input.Notes != "" {
		updateFields["notes"] = input.Notes
	}
	if input.EndOdometer > 0 {
		if existingTrip.StartOdometer > 0 && input.EndOdometer < existingTrip.StartOdometer {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Closing odometer reading (%.0f km) cannot be less than the trip's starting odometer reading (%.0f km). As the vehicle travels, odometer readings must increase.", input.EndOdometer, existingTrip.StartOdometer),
				"min_odometer": existingTrip.StartOdometer,
			})
			return
		}

		prevOdo := h.GetTruckLatestOdometer(ctx, existingTrip.TruckID, existingTrip.DriverID)
		if prevOdo > 0 && input.EndOdometer < prevOdo {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Closing odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) for truck %s. As the vehicle travels, odometer readings must increase.", input.EndOdometer, prevOdo, existingTrip.TruckPlate),
				"min_odometer": prevOdo,
			})
			return
		}

		updateFields["end_odometer"] = input.EndOdometer
	}

	_, err = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete trip: " + err.Error()})
		return
	}

	// Record expenses for each additional fee
	for _, f := range validFees {
		expType := f.FeeType
		if expType != "toll" && expType != "parking" && expType != "washing" && expType != "maintenance" && expType != "weighbridge" && expType != "gate_fee" {
			expType = "other"
		}
		expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
		expense := models.Expense{
			ID:            bson.NewObjectID(),
			ExpenseNumber: expNumber,
			TruckID:       existingTrip.TruckID,
			TruckPlate:    existingTrip.TruckPlate,
			DriverID:      existingTrip.DriverID,
			DriverName:    existingTrip.DriverName,
			ExpenseType:   expType,
			Amount:        f.Amount,
			Date:          time.Now(),
			Description:   fmt.Sprintf("Trip #%s: %s (%s)", existingTrip.TripNumber, f.Description, expType),
			ReceiptNumber: input.ReceiptNumber,
			Status:        "active",
			CreatedAt:     time.Now(),
		}
		_, _ = h.DB.Expenses.InsertOne(ctx, expense)
	}

	// If end odometer is provided, update truck mileage and odometer records
	if input.EndOdometer > 0 && existingTrip.TruckID != "" {
		if trkObjID, err := bson.ObjectIDFromHex(existingTrip.TruckID); err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
				"$max": bson.M{
					"current_odometer": input.EndOdometer,
					"current_mileage":  input.EndOdometer,
					"mileage":          input.EndOdometer,
				},
			})
		}

		// Calculate trip distance
		var tripDist float64
		if existingTrip.StartOdometer > 0 && input.EndOdometer >= existingTrip.StartOdometer {
			tripDist = input.EndOdometer - existingTrip.StartOdometer
		}

		// Update or insert the trip's record in OdometerReadings
		updateTripOdo := bson.M{
			"$set": bson.M{
				"end_reading":    input.EndOdometer,
				"end_time":       &now,
				"receipt_number": input.ReceiptNumber,
				"distance_km":    tripDist,
				"source":         "trip_complete",
				"status":         "completed",
				"updated_at":     now,
				"end_notes":      fmt.Sprintf("Completed trip %s. Receipt #%s. Distance: %.0f km", existingTrip.TripNumber, input.ReceiptNumber, tripDist),
			},
		}
		res, _ := h.DB.OdometerReadings.UpdateOne(ctx, bson.M{"trip_id": existingTrip.ID.Hex()}, updateTripOdo)
		if res.MatchedCount == 0 {
			tripOdo := models.OdometerReading{
				ID:            bson.NewObjectID(),
				DriverID:      existingTrip.DriverID,
				DriverName:    existingTrip.DriverName,
				TruckID:       existingTrip.TruckID,
				TruckPlate:    existingTrip.TruckPlate,
				TripID:        existingTrip.ID.Hex(),
				TripNumber:    existingTrip.TripNumber,
				ReceiptNumber: input.ReceiptNumber,
				Date:          existingTrip.Date.Format("2006-01-02"),
				StartReading:  existingTrip.StartOdometer,
				EndReading:    input.EndOdometer,
				EndTime:       &now,
				DistanceKm:    tripDist,
				Source:        "trip_complete",
				Status:        "completed",
				CreatedAt:     now,
				UpdatedAt:     now,
				EndNotes:      fmt.Sprintf("Completed trip %s. Receipt #%s", existingTrip.TripNumber, input.ReceiptNumber),
			}
			_, _ = h.DB.OdometerReadings.InsertOne(ctx, tripOdo)
		}
	}

	// Fetch updated trip
	var updatedTrip models.Trip
	_ = h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&updatedTrip)

	h.CreateNotification(ctx, "", "admin",
		fmt.Sprintf("Trip %s Completed (%s)", existingTrip.TripNumber, existingTrip.TruckPlate),
		fmt.Sprintf("Trip completed: %s → %s, Receipt: #%s, Revenue: %.0f ETB (Net: %.0f ETB)",
			existingTrip.LoadingSiteName, existingTrip.DumpingSiteName, input.ReceiptNumber, grossRevenue, netRevenue),
		"trip_submitted")

	h.LogAudit(ctx, existingTrip.DriverID, existingTrip.DriverName, "Completed Hauling Trip", "Trip", existingTrip.ID.Hex(), "",
		fmt.Sprintf("Trip %s completed with receipt #%s. Pay: %.0f ETB", existingTrip.TripNumber, input.ReceiptNumber, netRevenue))

	c.JSON(http.StatusOK, updatedTrip)
}

func (h *TripHandler) GetActiveTrip(c *gin.Context) {
	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"status": "in_progress"}
	if userRole == string(models.RoleDriver) {
		filter["driver_id"] = userIDStr
	} else if driverID := c.Query("driver_id"); driverID != "" {
		filter["driver_id"] = driverID
	} else if truckID := c.Query("truck_id"); truckID != "" {
		filter["truck_id"] = truckID
	}

	findOpts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	var trip models.Trip
	err := h.DB.Trips.FindOne(ctx, filter, findOpts).Decode(&trip)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"has_active": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"has_active": true,
		"trip":       trip,
	})
}

func (h *TripHandler) GetSmartRoutePrice(c *gin.Context) {
	loadingSiteID := c.Query("loading_site_id")
	dumpingSiteID := c.Query("dumping_site_id")
	materialID := c.Query("material_id")

	if loadingSiteID == "" || dumpingSiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "loading_site_id and dumping_site_id are required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Check configured routes table
	routeFilter := bson.M{
		"loading_site_id": loadingSiteID,
		"dumping_site_id": dumpingSiteID,
	}
	if materialID != "" {
		routeFilter["material_id"] = materialID
	}

	var route models.Route
	if err := h.DB.Routes.FindOne(ctx, routeFilter).Decode(&route); err == nil && route.DefaultPrice > 0 {
		c.JSON(http.StatusOK, gin.H{
			"source":         "configured_route",
			"price":          route.DefaultPrice,
			"pricing_method": route.PricingMethod,
			"material_id":    route.MaterialID,
			"material_name":  route.MaterialName,
		})
		return
	}

	// 2. Check previous trips
	tripFilter := bson.M{
		"loading_site_id": loadingSiteID,
		"dumping_site_id": dumpingSiteID,
		"status":          "completed",
	}
	if materialID != "" {
		tripFilter["material_id"] = materialID
	}

	findOpts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	var lastTrip models.Trip
	if err := h.DB.Trips.FindOne(ctx, tripFilter, findOpts).Decode(&lastTrip); err == nil {
		price := lastTrip.UnitPrice
		if lastTrip.PricingMethod == "lump_sum" {
			price = lastTrip.LumpSum
		}
		c.JSON(http.StatusOK, gin.H{
			"source":         "previous_trip",
			"price":          price,
			"pricing_method": lastTrip.PricingMethod,
			"material_id":    lastTrip.MaterialID,
			"material_name":  lastTrip.MaterialName,
			"unit":           lastTrip.Unit,
		})
		return
	}

	// 3. Fallback to material default price
	if materialID != "" {
		matObjID, err := bson.ObjectIDFromHex(materialID)
		if err == nil {
			var mat models.Material
			if err := h.DB.Materials.FindOne(ctx, bson.M{"_id": matObjID}).Decode(&mat); err == nil {
				c.JSON(http.StatusOK, gin.H{
					"source":         "material_default",
					"price":          mat.DefaultPrice,
					"pricing_method": "per_ton",
					"material_id":    mat.ID.Hex(),
					"material_name":  mat.Name,
					"unit":           mat.DefaultUnit,
				})
				return
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"source": "none",
		"price":  0,
	})
}

type CancelTripInput struct {
	Reason string `json:"reason" binding:"required"`
}

func (h *TripHandler) CancelTrip(c *gin.Context) {
	tripID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	var input CancelTripInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cancellation reason is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var trip models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&trip); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	if trip.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Trip is already cancelled"})
		return
	}

	now := time.Now()
	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")

	update := bson.M{
		"$set": bson.M{
			"status":        "cancelled",
			"cancel_reason": input.Reason,
			"cancelled_by":  userName,
			"cancelled_at":  now,
			"updated_at":    now,
		},
	}

	_, err = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel trip"})
		return
	}

	// Also mark all linked trip expenses as cancelled
	_, _ = h.DB.Expenses.UpdateMany(ctx,
		bson.M{"trip_id": trip.ID.Hex()},
		bson.M{
			"$set": bson.M{
				"status":        "cancelled",
				"cancel_reason": fmt.Sprintf("Linked Trip %s was cancelled: %s", trip.TripNumber, input.Reason),
				"cancelled_by":  userName,
			},
		},
	)

	h.LogAudit(ctx, userIDStr, userName, "Cancelled Trip", "Trip", trip.ID.Hex(),
		fmt.Sprintf("Status: %s", trip.Status), fmt.Sprintf("Status: cancelled, Reason: %s", input.Reason))

	c.JSON(http.StatusOK, gin.H{"message": "Trip marked as cancelled and preserved for audit trail"})
}

func (h *TripHandler) UpdateTrip(c *gin.Context) {
	tripID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	var input models.Trip
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	// Calculate Quantity in Kg
	var quantityKg float64
	switch strings.ToLower(input.Unit) {
	case "ton", "tons":
		quantityKg = input.Quantity * 1000
	case "quintal", "quintals":
		quantityKg = input.Quantity * 100
	case "kg", "kilogram":
		quantityKg = input.Quantity
	default:
		quantityKg = input.Quantity * 1000
	}

	// Calculate Gross Revenue
	var grossRevenue float64
	if input.PricingMethod == "lump_sum" {
		grossRevenue = input.LumpSum
	} else {
		grossRevenue = input.Quantity * input.UnitPrice
	}

	// Calculate Additional Fees & Total Revenue
	var totalAdditionalFees float64
	validFees := make([]models.TripFee, 0)
	for _, f := range input.AdditionalFees {
		if f.Amount > 0 {
			feeType := strings.ToLower(strings.TrimSpace(f.FeeType))
			if feeType == "" {
				feeType = "other"
			}
			f.FeeType = feeType
			totalAdditionalFees += f.Amount
			validFees = append(validFees, f)
		}
	}
	if len(input.AdditionalFees) == 0 && existing.TotalAdditionalFees > 0 {
		validFees = existing.AdditionalFees
		totalAdditionalFees = existing.TotalAdditionalFees
	}
	totalRevenue := grossRevenue - totalAdditionalFees
	netRevenue := totalRevenue

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"truck_id":              input.TruckID,
			"truck_plate":           input.TruckPlate,
			"driver_id":             input.DriverID,
			"driver_name":           input.DriverName,
			"loading_site_id":       input.LoadingSiteID,
			"loading_site_name":     input.LoadingSiteName,
			"dumping_site_id":       input.DumpingSiteID,
			"dumping_site_name":     input.DumpingSiteName,
			"has_transition":        input.HasTransition,
			"transition_point_ids":  input.TransitionPointIDs,
			"transition_point_name": input.TransitionPointName,
			"material_id":           input.MaterialID,
			"material_name":         input.MaterialName,
			"quantity":              input.Quantity,
			"unit":                  input.Unit,
			"quantity_kg":           quantityKg,
			"pricing_method":        input.PricingMethod,
			"unit_price":            input.UnitPrice,
			"lump_sum":              input.LumpSum,
			"gross_revenue":         grossRevenue,
			"total_revenue":         totalRevenue,
			"additional_fees":       validFees,
			"total_additional_fees": totalAdditionalFees,
			"net_revenue":           netRevenue,
			"status":                input.Status,
			"notes":                 input.Notes,
			"updated_at":            now,
		},
	}

	_, err = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update trip"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Updated Trip", "Trip", tripID,
		fmt.Sprintf("%.1f %s (%s)", existing.Quantity, existing.Unit, existing.MaterialName),
		fmt.Sprintf("%.1f %s (%s) = %.0f ETB", input.Quantity, input.Unit, input.MaterialName, totalRevenue))

	c.JSON(http.StatusOK, gin.H{"message": "Trip updated and recalculated successfully"})
}

func (h *TripHandler) DeleteTrip(c *gin.Context) {
	tripID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var trip models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&trip); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	_, err = h.DB.Trips.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete trip"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Deleted Trip", "Trip", tripID, trip.TripNumber, "Permanently removed by admin")

	c.JSON(http.StatusOK, gin.H{"message": "Trip permanently deleted"})
}

