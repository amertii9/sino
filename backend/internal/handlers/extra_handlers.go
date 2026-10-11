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

	defaultTransitSuggestions := []models.TransitPointSuggestion{
		{
			ID:                     "kality_hub",
			Name:                   "Kality Weigh Station & Hub",
			Location:               "Kality Axle Scale Checkpoint",
			SuggestedRatePerTon:    280,
			SuggestedRatePerQuintal: 28,
			SuggestedRatePerKg:     0.28,
			SuggestedLumpSum:       3500,
			DefaultPricingMethod:   "per_ton",
			Notes:                  "Primary intermediate weighbridge & cargo staging hub",
		},
		{
			ID:                     "modjo_toll",
			Name:                   "Modjo Expressway Toll Plaza",
			Location:               "Modjo Toll Gate km 0",
			SuggestedRatePerTon:    320,
			SuggestedRatePerQuintal: 32,
			SuggestedRatePerKg:     0.32,
			SuggestedLumpSum:       4000,
			DefaultPricingMethod:   "per_ton",
			Notes:                  "Expressway interchange & commercial offload terminal",
		},
		{
			ID:                     "dukem_scale",
			Name:                   "Dukem Weighbridge Scale",
			Location:               "Dukem Checkpoint",
			SuggestedRatePerTon:    300,
			SuggestedRatePerQuintal: 30,
			SuggestedRatePerKg:     0.30,
			SuggestedLumpSum:       3800,
			DefaultPricingMethod:   "per_ton",
			Notes:                  "Industrial zone intermediate scale and unloading bay",
		},
	}

	defaultDestinationSuggestions := []models.DestinationRateSuggestion{
		{
			ID:                     "bole_lemi",
			Name:                   "Bole Lemi Industrial Park Project",
			Location:               "Bole Lemi Phase 2, Addis Ababa",
			SuggestedRatePerTon:    480,
			SuggestedRatePerQuintal: 48,
			SuggestedRatePerKg:     0.48,
			SuggestedLumpSum:       12000,
			DefaultPricingMethod:   "per_ton",
			Notes:                  "Addis Ababa southern industrial cluster",
		},
		{
			ID:                     "ring_road",
			Name:                   "Addis Ababa Ring Road Corridor",
			Location:               "Gotera to Kality Section",
			SuggestedRatePerTon:    520,
			SuggestedRatePerQuintal: 52,
			SuggestedRatePerKg:     0.52,
			SuggestedLumpSum:       13000,
			DefaultPricingMethod:   "per_ton",
			Notes:                  "Capital ring road infrastructure extension",
		},
		{
			ID:                     "cbe_hq",
			Name:                   "Commercial Bank HQ Site",
			Location:               "Ras Desta Damtew St, Addis Ababa",
			SuggestedRatePerTon:    550,
			SuggestedRatePerQuintal: 55,
			SuggestedRatePerKg:     0.55,
			SuggestedLumpSum:       14000,
			DefaultPricingMethod:   "per_ton",
			Notes:                  "City center heavy building construction site",
		},
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
			FuelLitersPresets:          defaultPresets,
			MaintenanceSuggestions:     defaultMaintSuggestions,
			TransitPointSuggestions:    defaultTransitSuggestions,
			DestinationRateSuggestions: defaultDestinationSuggestions,
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
		if len(settings.TransitPointSuggestions) == 0 {
			settings.TransitPointSuggestions = defaultTransitSuggestions
		} else {
			for i := range settings.TransitPointSuggestions {
				if settings.TransitPointSuggestions[i].SuggestedRatePerQuintal <= 0 && settings.TransitPointSuggestions[i].SuggestedRatePerTon > 0 {
					settings.TransitPointSuggestions[i].SuggestedRatePerQuintal = settings.TransitPointSuggestions[i].SuggestedRatePerTon / 10.0
				}
				if settings.TransitPointSuggestions[i].DefaultPricingMethod == "" {
					settings.TransitPointSuggestions[i].DefaultPricingMethod = "per_ton"
				}
			}
		}
		if len(settings.DestinationRateSuggestions) == 0 {
			settings.DestinationRateSuggestions = defaultDestinationSuggestions
		} else {
			for i := range settings.DestinationRateSuggestions {
				if settings.DestinationRateSuggestions[i].SuggestedRatePerQuintal <= 0 && settings.DestinationRateSuggestions[i].SuggestedRatePerTon > 0 {
					settings.DestinationRateSuggestions[i].SuggestedRatePerQuintal = settings.DestinationRateSuggestions[i].SuggestedRatePerTon / 10.0
				}
				if settings.DestinationRateSuggestions[i].DefaultPricingMethod == "" {
					settings.DestinationRateSuggestions[i].DefaultPricingMethod = "per_ton"
				}
			}
		}

		if settings.ReserveFuelCapacityLiters <= 0 {
			settings.ReserveFuelCapacityLiters = 10000.0
		}
		if settings.ReserveFuelLowThreshold <= 0 {
			settings.ReserveFuelLowThreshold = 1500.0
		}
	}

	defaultWelcomeSuggestions := []string{
		"Drive safely! Inspect your truck, check tire pressures, and confirm cargo documentation before departure.",
		"Welcome to today's shift! Maintain optimal speed, drive cautiously on expressways, and report all transit stops promptly.",
		"Caution on rainy corridors: Ensure your windshield wipers, headlights, and brakes are tested before departing.",
		"Welcome back, captain! Your dedication powers our fleet. Let's make today safe, productive, and profitable!",
	}

	if settings.DriverWelcomeMessage == "" {
		settings.DriverWelcomeMessage = "Drive safely! Inspect your truck, check tire pressures, and confirm cargo documentation before departure."
	}
	if len(settings.WelcomeMessageSuggestions) == 0 {
		settings.WelcomeMessageSuggestions = defaultWelcomeSuggestions
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
	if input.TransitPointSuggestions != nil {
		setFields["transit_point_suggestions"] = input.TransitPointSuggestions

		// Automatically sync transit point suggestions to the Sites collection as transition sites
		for _, ts := range input.TransitPointSuggestions {
			if ts.Name != "" {
				var existingSite models.Site
				err := h.DB.Sites.FindOne(ctx, bson.M{
					"name": ts.Name,
					"type": "transition",
				}).Decode(&existingSite)
				if err != nil {
					// Insert new transition site
					loc := ts.Location
					if loc == "" {
						loc = "Transit Checkpoint"
					}
					newSite := models.Site{
						ID:          bson.NewObjectID(),
						Name:        ts.Name,
						Location:    loc,
						Type:        "transition",
						Description: ts.Notes,
						Status:      "active",
						CreatedAt:   now,
					}
					_, _ = h.DB.Sites.InsertOne(ctx, newSite)
				}
			}
		}
	}
	if input.DestinationRateSuggestions != nil {
		setFields["destination_rate_suggestions"] = input.DestinationRateSuggestions

		// Automatically sync destination rate suggestions to the Sites collection as dumping sites
		for _, ds := range input.DestinationRateSuggestions {
			if ds.Name != "" {
				var existingSite models.Site
				err := h.DB.Sites.FindOne(ctx, bson.M{
					"name": ds.Name,
					"type": "dumping",
				}).Decode(&existingSite)
				if err != nil {
					loc := ds.Location
					if loc == "" {
						loc = "Destination Site"
					}
					newSite := models.Site{
						ID:          bson.NewObjectID(),
						Name:        ds.Name,
						Location:    loc,
						Type:        "dumping",
						Description: ds.Notes,
						Status:      "active",
						CreatedAt:   now,
					}
					_, _ = h.DB.Sites.InsertOne(ctx, newSite)
				}
			}
		}
	}

	if input.ReserveFuelBalanceLiters >= 0 {
		setFields["reserve_fuel_balance_liters"] = input.ReserveFuelBalanceLiters
	}
	if input.ReserveFuelCapacityLiters > 0 {
		setFields["reserve_fuel_capacity_liters"] = input.ReserveFuelCapacityLiters
	}
	if input.ReserveFuelLowThreshold > 0 {
		setFields["reserve_fuel_low_threshold"] = input.ReserveFuelLowThreshold
	}

	if input.DriverWelcomeMessage != "" {
		setFields["driver_welcome_message"] = input.DriverWelcomeMessage
	}
	if input.WelcomeMessageSuggestions != nil {
		setFields["welcome_message_suggestions"] = input.WelcomeMessageSuggestions
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

type UpdateReserveFuelInput struct {
	BalanceLiters  *float64 `json:"balance_liters"`
	CapacityLiters *float64 `json:"capacity_liters"`
	LowThreshold   *float64 `json:"low_threshold"`
	Notes          string   `json:"notes"`
}

func (h *ExtraHandler) UpdateReserveFuelSettings(c *gin.Context) {
	var input UpdateReserveFuelInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid reserve fuel data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := time.Now()
	setFields := bson.M{
		"updated_at": now,
	}

	var details []string
	if input.BalanceLiters != nil && *input.BalanceLiters >= 0 {
		setFields["reserve_fuel_balance_liters"] = *input.BalanceLiters
		details = append(details, fmt.Sprintf("Stock balance set to %.1f L", *input.BalanceLiters))
	}
	if input.CapacityLiters != nil && *input.CapacityLiters > 0 {
		setFields["reserve_fuel_capacity_liters"] = *input.CapacityLiters
		details = append(details, fmt.Sprintf("Capacity set to %.1f L", *input.CapacityLiters))
	}
	if input.LowThreshold != nil && *input.LowThreshold > 0 {
		setFields["reserve_fuel_low_threshold"] = *input.LowThreshold
		details = append(details, fmt.Sprintf("Low threshold set to %.1f L", *input.LowThreshold))
	}

	opts := options.UpdateOne().SetUpsert(true)
	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{"$set": setFields}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update reserve fuel settings"})
		return
	}

	h.LogAudit(ctx, c.GetString("userID"), c.GetString("userName"), "Update Reserve Fuel Inventory", "Settings", "reserve_fuel", "", fmt.Sprintf("%v. Notes: %s", details, input.Notes))

	c.JSON(http.StatusOK, gin.H{
		"message": "Reserve fuel settings updated successfully",
	})
}

