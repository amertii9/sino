package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"truck-fleet-backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type MaintenanceHandler struct {
	BaseHandler
}

func NewMaintenanceHandler(base BaseHandler) *MaintenanceHandler {
	return &MaintenanceHandler{BaseHandler: base}
}

type CreateMaintenanceInput struct {
	TruckID         string  `json:"truck_id" binding:"required"`
	TruckPlate      string  `json:"truck_plate"`
	MaintenanceType string  `json:"maintenance_type" binding:"required"`
	Date            string  `json:"date"`
	Mileage         float64 `json:"mileage"`
	Cost            float64 `json:"cost" binding:"required"`
	NextDate        string  `json:"next_date"`
	NextMileage     float64 `json:"next_mileage"`
	Description     string  `json:"description" binding:"required"`
	ReceiptURL      string  `json:"receipt_url"`
}

func (h *MaintenanceHandler) CreateMaintenance(c *gin.Context) {
	var input CreateMaintenanceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide required maintenance data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	maintDate := time.Now()
	if input.Date != "" {
		if t, err := time.Parse("2006-01-02", input.Date); err == nil {
			maintDate = t
		}
	}

	if input.Mileage > 0 {
		prevOdo := h.GetTruckLatestOdometer(ctx, input.TruckID, "")
		if prevOdo > 0 && input.Mileage < prevOdo {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":        fmt.Sprintf("Odometer reading (%.0f km) cannot be less than previous recorded reading (%.0f km). Truck mileage must increase as the vehicle travels.", input.Mileage, prevOdo),
				"min_odometer": prevOdo,
			})
			return
		}
	}

	maintNumber := h.GenerateNextNumber(ctx, "maintenance", "MT")

	maint := models.Maintenance{
		ID:                bson.NewObjectID(),
		MaintenanceNumber: maintNumber,
		TruckID:           input.TruckID,
		TruckPlate:        input.TruckPlate,
		MaintenanceType:   input.MaintenanceType,
		Priority:          "normal",
		Status:            "completed",
		Date:              maintDate,
		Mileage:           input.Mileage,
		Cost:              input.Cost,
		NextDate:          input.NextDate,
		NextMileage:       input.NextMileage,
		Description:       input.Description,
		ReceiptURL:        input.ReceiptURL,
		CreatedAt:         time.Now(),
	}

	_, err := h.DB.Maintenance.InsertOne(ctx, maint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record maintenance"})
		return
	}

	if input.Mileage > 0 && input.TruckID != "" {
		if trkObjID, err := bson.ObjectIDFromHex(input.TruckID); err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
				"$max": bson.M{
					"current_odometer": input.Mileage,
					"current_mileage":  input.Mileage,
					"mileage":          input.Mileage,
				},
			})
		}
	}

	// Automatically record an expense for this maintenance so truck financial reports are accurate
	expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
	expense := models.Expense{
		ID:            bson.NewObjectID(),
		ExpenseNumber: expNumber,
		TruckID:       input.TruckID,
		TruckPlate:    input.TruckPlate,
		ExpenseType:   "maintenance",
		Amount:        input.Cost,
		Date:          maintDate,
		Description:   fmt.Sprintf("%s: %s (Record #%s)", input.MaintenanceType, input.Description, maintNumber),
		ReceiptNumber: maintNumber,
		ReceiptURL:    input.ReceiptURL,
		Status:        "active",
		CreatedAt:     time.Now(),
	}
	_, _ = h.DB.Expenses.InsertOne(ctx, expense)

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Recorded Truck Maintenance", "Maintenance", maint.ID.Hex(), "",
		fmt.Sprintf("Recorded %s for %s, Cost: %.0f ETB, Expense: %s", maintNumber, input.TruckPlate, input.Cost, expNumber))

	c.JSON(http.StatusCreated, maint)
}

type CreateMaintenanceRequestInput struct {
	TruckID         string  `json:"truck_id"`
	TruckPlate      string  `json:"truck_plate"`
	MaintenanceType string  `json:"maintenance_type"`
	Priority        string  `json:"priority"` // "low", "normal", "high", "urgent"
	Mileage         float64 `json:"mileage"`
	Cost            float64 `json:"cost"`
	Description     string  `json:"description" binding:"required"`
	Date            string  `json:"date"`
}

func (h *MaintenanceHandler) CreateMaintenanceRequest(c *gin.Context) {
	var input CreateMaintenanceRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please describe the maintenance or issue: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userIDStr := c.GetString("userID")
	userName := c.GetString("fullName")

	truckID := input.TruckID
	truckPlate := input.TruckPlate

	// If truck is not specified, resolve driver's assigned truck
	if truckID == "" && userIDStr != "" {
		var trk models.Truck
		if err := h.DB.Trucks.FindOne(ctx, bson.M{"driver_assigned_id": userIDStr}).Decode(&trk); err == nil {
			truckID = trk.ID.Hex()
			truckPlate = trk.PlateNumber
		}
	}

	if input.TruckPlate != "" {
		truckPlate = input.TruckPlate
	}

	maintType := input.MaintenanceType
	if maintType == "" {
		maintType = "general_service"
	}

	priority := input.Priority
	if priority == "" {
		priority = "normal"
	}

	maintDate := time.Now()
	if input.Date != "" {
		if t, err := time.Parse("2006-01-02", input.Date); err == nil {
			maintDate = t
		}
	}

	if input.Mileage > 0 {
		prevOdo := h.GetTruckLatestOdometer(ctx, truckID, userIDStr)
		if prevOdo > 0 && input.Mileage < prevOdo {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":        fmt.Sprintf("Odometer reading (%.0f km) cannot be less than previous recorded reading (%.0f km). Truck mileage must increase as the vehicle travels.", input.Mileage, prevOdo),
				"min_odometer": prevOdo,
			})
			return
		}
	}

	maintNumber := h.GenerateNextNumber(ctx, "maintenance", "MT")

	maint := models.Maintenance{
		ID:                bson.NewObjectID(),
		MaintenanceNumber: maintNumber,
		TruckID:           truckID,
		TruckPlate:        truckPlate,
		DriverID:          userIDStr,
		DriverName:        userName,
		MaintenanceType:   maintType,
		Priority:          priority,
		Status:            "pending",
		Date:              maintDate,
		Mileage:           input.Mileage,
		Cost:              input.Cost,
		Description:       input.Description,
		CreatedAt:         time.Now(),
	}

	_, err := h.DB.Maintenance.InsertOne(ctx, maint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit maintenance request"})
		return
	}

	// Send notification to Admin (Maintenance request is recorded in maintenance section only, pending approval)
	h.CreateNotification(ctx, "", "admin",
		fmt.Sprintf("Maintenance Request: %s (%s)", truckPlate, priority),
		fmt.Sprintf("Driver %s reported %s: %s (Pending Admin Approval)", userName, maintType, input.Description),
		"maintenance_due")

	h.LogAudit(ctx, userIDStr, userName, "Submitted Maintenance Request", "Maintenance", maint.ID.Hex(), "",
		fmt.Sprintf("Driver submitted %s for %s (%s, priority: %s)", maintNumber, truckPlate, maintType, priority))

	c.JSON(http.StatusCreated, maint)
}

func (h *MaintenanceHandler) GetMaintenanceRequests(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userRole := c.GetString("role")
	userIDStr := c.GetString("userID")

	filter := bson.M{}
	if userRole == string(models.RoleDriver) {
		filter["driver_id"] = userIDStr
	} else {
		if truckID := c.Query("truck_id"); truckID != "" {
			filter["truck_id"] = truckID
		}
		if driverID := c.Query("driver_id"); driverID != "" {
			filter["driver_id"] = driverID
		}
	}

	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}

	findOpts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := h.DB.Maintenance.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch maintenance requests"})
		return
	}
	defer cursor.Close(ctx)

	records := make([]models.Maintenance, 0)
	_ = cursor.All(ctx, &records)
	c.JSON(http.StatusOK, records)
}

func (h *MaintenanceHandler) GetMaintenance(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{}
	if truckID := c.Query("truck_id"); truckID != "" {
		filter["truck_id"] = truckID
	}
	if maintType := c.Query("maintenance_type"); maintType != "" {
		filter["maintenance_type"] = maintType
	}
	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}

	findOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	cursor, err := h.DB.Maintenance.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch maintenance records"})
		return
	}
	defer cursor.Close(ctx)

	records := make([]models.Maintenance, 0)
	_ = cursor.All(ctx, &records)
	c.JSON(http.StatusOK, records)
}

func (h *MaintenanceHandler) UpdateMaintenance(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid maintenance ID"})
		return
	}

	var input models.Maintenance
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid maintenance data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	setFields := bson.M{
		"truck_id":         input.TruckID,
		"truck_plate":      input.TruckPlate,
		"maintenance_type": input.MaintenanceType,
		"mileage":          input.Mileage,
		"cost":             input.Cost,
		"next_date":        input.NextDate,
		"next_mileage":     input.NextMileage,
		"description":      input.Description,
	}
	if input.Status != "" {
		setFields["status"] = input.Status
	}
	if input.Priority != "" {
		setFields["priority"] = input.Priority
	}

	update := bson.M{"$set": setFields}

	_, err = h.DB.Maintenance.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update maintenance record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Maintenance record updated successfully"})
}

func (h *MaintenanceHandler) DeleteMaintenance(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid maintenance ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = h.DB.Maintenance.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete maintenance record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Maintenance record deleted"})
}

func (h *MaintenanceHandler) ApproveMaintenanceRequest(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid maintenance ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var maint models.Maintenance
	if err := h.DB.Maintenance.FindOne(ctx, bson.M{"_id": objID}).Decode(&maint); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Maintenance record not found"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"status": "approved",
		},
	}

	_, err = h.DB.Maintenance.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve maintenance request"})
		return
	}

	// Notify driver if driver_id exists
	if maint.DriverID != "" {
		h.CreateNotification(ctx, maint.DriverID, "driver",
			fmt.Sprintf("Maintenance Request Approved: %s", maint.TruckPlate),
			fmt.Sprintf("Admin approved maintenance work #%s for truck %s (%s)", maint.MaintenanceNumber, maint.TruckPlate, maint.MaintenanceType),
			"maintenance_due")
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Approved Maintenance Request", "Maintenance", maint.ID.Hex(), maint.Status, "approved")

	maint.Status = "approved"
	c.JSON(http.StatusOK, gin.H{
		"message":     "Maintenance request approved successfully",
		"maintenance": maint,
	})
}

func (h *MaintenanceHandler) RejectMaintenanceRequest(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid maintenance ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var maint models.Maintenance
	if err := h.DB.Maintenance.FindOne(ctx, bson.M{"_id": objID}).Decode(&maint); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Maintenance record not found"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"status": "rejected",
		},
	}

	_, err = h.DB.Maintenance.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject maintenance request"})
		return
	}

	if maint.DriverID != "" {
		h.CreateNotification(ctx, maint.DriverID, "driver",
			fmt.Sprintf("Maintenance Request Rejected: %s", maint.TruckPlate),
			fmt.Sprintf("Maintenance request #%s for truck %s was reviewed and rejected by admin", maint.MaintenanceNumber, maint.TruckPlate),
			"system")
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Rejected Maintenance Request", "Maintenance", maint.ID.Hex(), maint.Status, "rejected")

	maint.Status = "rejected"
	c.JSON(http.StatusOK, gin.H{
		"message":     "Maintenance request rejected",
		"maintenance": maint,
	})
}

