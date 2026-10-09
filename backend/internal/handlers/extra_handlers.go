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

type ExtraHandler struct {
	BaseHandler
}

func NewExtraHandler(base BaseHandler) *ExtraHandler {
	return &ExtraHandler{BaseHandler: base}
}

// --- AUDIT LOGS ---
func (h *ExtraHandler) GetAuditLogs(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}}).SetLimit(100)
	cursor, err := h.DB.AuditLogs.Find(ctx, bson.M{}, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}
	defer cursor.Close(ctx)

	logs := make([]models.AuditLog, 0)
	_ = cursor.All(ctx, &logs)
	c.JSON(http.StatusOK, logs)
}

// --- NOTIFICATIONS ---
func (h *ExtraHandler) GetNotifications(c *gin.Context) {
	role := c.GetString("role")
	userIDStr := c.GetString("userID")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"$or": []bson.M{
			{"user_id": userIDStr},
			{"target_role": role},
			{"target_role": "all"},
		},
	}

	findOpts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(50)
	cursor, err := h.DB.Notifications.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}
	defer cursor.Close(ctx)

	notifs := make([]models.Notification, 0)
	_ = cursor.All(ctx, &notifs)
	c.JSON(http.StatusOK, notifs)
}

func (h *ExtraHandler) MarkNotificationRead(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	role := c.GetString("role")
	userIDStr := c.GetString("userID")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"_id": objID,
		"$or": []bson.M{
			{"user_id": userIDStr},
			{"target_role": role},
			{"target_role": "all"},
		},
	}

	_, err = h.DB.Notifications.UpdateOne(ctx, filter, bson.M{"$set": bson.M{"is_read": true}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Marked as read"})
}

// --- SETTINGS ---
func (h *ExtraHandler) GetSettings(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var settings models.Settings
	defaultPresets := []float64{50, 80, 100, 150, 200, 300}
	defaultMaintSuggestions := []models.MaintenanceIssueSuggestion{
		{ID: "oil_change", Label: "Engine Oil & Filter", Icon: "🛢️"},
		{ID: "tire_replacement", Label: "Tire Repair / Change", Icon: "🛞"},
		{ID: "brake_repair", Label: "Brakes & Air System", Icon: "🛑"},
		{ID: "engine_repair", Label: "Engine / Overheating", Icon: "⚙️"},
		{ID: "electrical_repair", Label: "Battery & Lights", Icon: "⚡"},
		{ID: "general_service", Label: "General Service", Icon: "🔧"},
		{ID: "other", Label: "Other Work / Breakdown", Icon: "⚠️"},
	}

	err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings)
	if err != nil {
		// return default if not found
		settings = models.Settings{
			CompanyName: "SINO Logistics & Hauling Fleet PLC",
			Currency:    "ETB",
			DefaultUnit: "ton",
			DieselPrice: 100.0,
			FeeSuggestions: []models.FeeSuggestion{
				{Name: "Modjo Expressway Toll", Amount: 150, FeeType: "toll"},
				{Name: "Adama Expressway Toll", Amount: 200, FeeType: "toll"},
				{Name: "Weighbridge / Scale", Amount: 100, FeeType: "weighbridge"},
				{Name: "Parking / Staging", Amount: 50, FeeType: "parking"},
				{Name: "Gate / Yard Pass", Amount: 100, FeeType: "gate_fee"},
			},
			FuelLitersPresets:      defaultPresets,
			MaintenanceSuggestions: defaultMaintSuggestions,
		}
	} else {
		if settings.DieselPrice <= 0 {
			settings.DieselPrice = 100.0
		}
		if len(settings.FeeSuggestions) == 0 {
			settings.FeeSuggestions = []models.FeeSuggestion{
				{Name: "Modjo Expressway Toll", Amount: 150, FeeType: "toll"},
				{Name: "Adama Expressway Toll", Amount: 200, FeeType: "toll"},
				{Name: "Weighbridge / Scale", Amount: 100, FeeType: "weighbridge"},
				{Name: "Parking / Staging", Amount: 50, FeeType: "parking"},
				{Name: "Gate / Yard Pass", Amount: 100, FeeType: "gate_fee"},
			}
		}
		if len(settings.FuelLitersPresets) == 0 {
			settings.FuelLitersPresets = defaultPresets
		}
		if len(settings.MaintenanceSuggestions) == 0 {
			settings.MaintenanceSuggestions = defaultMaintSuggestions
		}
	}

	c.JSON(http.StatusOK, settings)
}

func (h *ExtraHandler) UpdateSettings(c *gin.Context) {
	var input models.Settings
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid settings data"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	setFields := bson.M{
		"updated_at": now,
	}

	if input.CompanyName != "" {
		setFields["company_name"] = input.CompanyName
	}
	if input.CompanyLogo != "" {
		setFields["company_logo"] = input.CompanyLogo
	}
	if input.Currency != "" {
		setFields["currency"] = input.Currency
	}
	if input.DefaultUnit != "" {
		setFields["default_unit"] = input.DefaultUnit
	}
	if input.CompanyPhone != "" {
		setFields["company_phone"] = input.CompanyPhone
	}
	if input.CompanyEmail != "" {
		setFields["company_email"] = input.CompanyEmail
	}
	if input.DieselPrice > 0 {
		setFields["diesel_price"] = input.DieselPrice
	}
	if input.FeeSuggestions != nil {
		setFields["fee_suggestions"] = input.FeeSuggestions
	}
	if input.FuelLitersPresets != nil {
		setFields["fuel_liters_presets"] = input.FuelLitersPresets
	}
	if input.MaintenanceSuggestions != nil {
		setFields["maintenance_suggestions"] = input.MaintenanceSuggestions
	}

	opts := options.UpdateOne().SetUpsert(true)
	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{"$set": setFields}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Settings updated successfully",
	})
}

func (h *ExtraHandler) UpdateFeeSuggestions(c *gin.Context) {
	var input struct {
		FeeSuggestions []models.FeeSuggestion `json:"fee_suggestions"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid fee suggestions data"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"fee_suggestions": input.FeeSuggestions,
			"updated_at":      now,
		},
	}

	opts := options.UpdateOne().SetUpsert(true)
	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{}, update, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update fee suggestions"})
		return
	}

	h.LogAudit(ctx, c.GetString("userID"), c.GetString("userName"), "Update Fee Suggestions", "Settings", "", "", "Success")

	c.JSON(http.StatusOK, gin.H{
		"message":         "Fee suggestions updated successfully",
		"fee_suggestions": input.FeeSuggestions,
	})
}

func (h *ExtraHandler) UpdateFuelPresets(c *gin.Context) {
	var input struct {
		FuelLitersPresets []float64 `json:"fuel_liters_presets"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid fuel presets data"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"fuel_liters_presets": input.FuelLitersPresets,
			"updated_at":          now,
		},
	}

	opts := options.UpdateOne().SetUpsert(true)
	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{}, update, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update fuel presets"})
		return
	}

	h.LogAudit(ctx, c.GetString("userID"), c.GetString("userName"), "Update Fuel Liter Presets", "Settings", "", "", "Success")

	c.JSON(http.StatusOK, gin.H{
		"message":             "Fuel liter presets updated successfully",
		"fuel_liters_presets": input.FuelLitersPresets,
	})
}

func (h *ExtraHandler) UpdateDieselPrice(c *gin.Context) {
	var input struct {
		DieselPrice float64 `json:"diesel_price" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || input.DieselPrice <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a valid diesel price greater than 0"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"diesel_price": input.DieselPrice,
			"updated_at":   now,
		},
	}

	opts := options.UpdateOne().SetUpsert(true)
	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{}, update, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update diesel price"})
		return
	}

	userIDStr := c.GetString("userID")
	userName := c.GetString("fullName")
	h.LogAudit(ctx, userIDStr, userName, "Updated Diesel Price", "Settings", "diesel_price", "", fmt.Sprintf("Set to %.2f ETB/L", input.DieselPrice))

	c.JSON(http.StatusOK, gin.H{
		"message":      "Diesel price updated successfully",
		"diesel_price": input.DieselPrice,
	})
}

func (h *ExtraHandler) UpdateMaintenanceSuggestions(c *gin.Context) {
	var input struct {
		MaintenanceSuggestions []models.MaintenanceIssueSuggestion `json:"maintenance_suggestions"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid maintenance suggestions data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"maintenance_suggestions": input.MaintenanceSuggestions,
			"updated_at":              now,
		},
	}

	opts := options.UpdateOne().SetUpsert(true)
	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{}, update, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update maintenance suggestions"})
		return
	}

	h.LogAudit(ctx, c.GetString("userID"), c.GetString("userName"), "Update Maintenance Suggestions", "Settings", "", "", "Success")

	c.JSON(http.StatusOK, gin.H{
		"message":                 "Maintenance suggestions updated successfully",
		"maintenance_suggestions": input.MaintenanceSuggestions,
	})
}
