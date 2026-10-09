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

type TruckHandler struct {
	BaseHandler
}

func NewTruckHandler(base BaseHandler) *TruckHandler {
	return &TruckHandler{BaseHandler: base}
}

func (h *TruckHandler) GetTrucks(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{}
	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}

	findOpts := options.Find().SetSort(bson.D{{Key: "truck_number", Value: 1}})
	cursor, err := h.DB.Trucks.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trucks"})
		return
	}
	defer cursor.Close(ctx)

	trucks := make([]models.Truck, 0)
	if err := cursor.All(ctx, &trucks); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode trucks"})
		return
	}

	c.JSON(http.StatusOK, trucks)
}

func (h *TruckHandler) CreateTruck(c *gin.Context) {
	var truck models.Truck
	if err := c.ShouldBindJSON(&truck); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid truck data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if truck.PlateNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plate number is required"})
		return
	}

	if truck.TruckNumber == "" {
		truck.TruckNumber = h.GenerateNextNumber(ctx, "trucks", "TRK")
	}

	if truck.Status == "" {
		truck.Status = "available"
	}

	truck.ID = bson.NewObjectID()
	truck.CreatedAt = time.Now()

	_, err := h.DB.Trucks.InsertOne(ctx, truck)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create truck: " + err.Error()})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Created Truck", "Truck", truck.ID.Hex(), "",
		fmt.Sprintf("Added Truck %s (%s, %s)", truck.TruckNumber, truck.PlateNumber, truck.Model))

	c.JSON(http.StatusCreated, truck)
}

func (h *TruckHandler) UpdateTruck(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid truck ID"})
		return
	}

	var updateData models.Truck
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid update data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"plate_number":         updateData.PlateNumber,
			"type":                 updateData.Type,
			"model":                updateData.Model,
			"capacity":             updateData.Capacity,
			"driver_assigned_id":   updateData.DriverAssignedID,
			"driver_assigned_name": updateData.DriverAssignedName,
			"status":               updateData.Status,
			"registration_expiry":  updateData.RegistrationExpiry,
			"insurance_expiry":     updateData.InsuranceExpiry,
			"inspection_expiry":    updateData.InspectionExpiry,
			"notes":                updateData.Notes,
		},
	}

	_, err = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update truck"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Updated Truck", "Truck", id, "",
		fmt.Sprintf("Updated truck %s (Status: %s, Assigned: %s)", updateData.PlateNumber, updateData.Status, updateData.DriverAssignedName))

	c.JSON(http.StatusOK, gin.H{"message": "Truck updated successfully"})
}

func (h *TruckHandler) DeleteTruck(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid truck ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var truck models.Truck
	if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": objID}).Decode(&truck); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Truck not found"})
		return
	}

	// Unassign driver if any
	_, _ = h.DB.Drivers.UpdateMany(ctx, bson.M{"assigned_truck_id": id}, bson.M{
		"$set": bson.M{"assigned_truck_id": "", "assigned_truck_plate": ""},
	})

	_, err = h.DB.Trucks.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete truck: " + err.Error()})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Deleted Truck", "Truck", id, truck.PlateNumber, "Deleted from fleet")

	c.JSON(http.StatusOK, gin.H{"message": "Truck deleted successfully"})
}
