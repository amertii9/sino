package database

import (
	"context"
	"log"
	"time"

	"truck-fleet-backend/internal/models"

	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
)

func SeedDatabase(db *Database) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Ensure Admin User Exists with admin@sino.com / admin123
	var admin models.User
	err := db.Users.FindOne(ctx, bson.M{"role": models.RoleAdmin}).Decode(&admin)
	adminHash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)

	if err != nil {
		log.Println("Creating initial Admin user (admin@sino.com / admin123)...")
		adminUser := models.User{
			ID:        bson.NewObjectID(),
			Email:     "admin@sino.com",
			Phone:     "+251 911 000 001",
			Password:  string(adminHash),
			FullName:  "Fleet Admin",
			Role:      models.RoleAdmin,
			Status:    "active",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		_, _ = db.Users.InsertOne(ctx, adminUser)
	} else {
		// Admin already exists, ensure active status and valid password
		updateM := bson.M{
			"role":   models.RoleAdmin,
			"status": "active",
		}
		if admin.Password == "" || bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte("admin123")) != nil {
			updateM["password"] = string(adminHash)
		}
		_, _ = db.Users.UpdateOne(ctx, bson.M{"_id": admin.ID}, bson.M{"$set": updateM})
	}

	// 2. Ensure Settings Exist with SINO Company Name and standard suggestions
	defaultMaintSuggestions := []models.MaintenanceIssueSuggestion{
		{ID: "oil_change", Label: "Engine Oil & Filter", Icon: "🛢️"},
		{ID: "tire_replacement", Label: "Tire Repair / Change", Icon: "🛞"},
		{ID: "brake_repair", Label: "Brakes & Air System", Icon: "🛑"},
		{ID: "engine_repair", Label: "Engine / Overheating", Icon: "⚙️"},
		{ID: "electrical_repair", Label: "Battery & Lights", Icon: "⚡"},
		{ID: "general_service", Label: "General Service", Icon: "🔧"},
		{ID: "other", Label: "Other Work / Breakdown", Icon: "🛠️"},
	}

	countSettings, _ := db.Settings.CountDocuments(ctx, bson.M{})
	if countSettings == 0 {
		log.Println("Initializing default company settings...")
		settings := models.Settings{
			ID:           bson.NewObjectID(),
			CompanyName:  "SINO Logistics & Hauling Fleet PLC",
			CompanyLogo:  "",
			Currency:     "ETB",
			DefaultUnit:  "ton",
			CompanyPhone: "+251 911 234 567",
			CompanyEmail: "operations@sino.com",
			DieselPrice:  100,
			FuelLitersPresets: []float64{50, 80, 100, 150, 200, 300},
			MaintenanceSuggestions: defaultMaintSuggestions,
			FeeSuggestions: []models.FeeSuggestion{
				{Name: "Modjo Expressway Toll", Amount: 150, FeeType: "toll"},
				{Name: "Adama Expressway Toll", Amount: 200, FeeType: "toll"},
				{Name: "Weighbridge / Scale", Amount: 100, FeeType: "weighbridge"},
				{Name: "Parking / Staging", Amount: 50, FeeType: "parking"},
				{Name: "Gate / Yard Pass", Amount: 100, FeeType: "gate_fee"},
			},
			EICRecurring: &models.EICRecurringConfig{
				Enabled:           true,
				MonthlyAmount:     150000,
				TotalMonths:       24,
				PaidMonths:        0,
				StartDate:         "2026-10-01",
				EndDate:           "2028-10-01",
				DeductionDay:      1,
				LastDeductedMonth: "",
				Description:       "EIC (Ethiopian Insurance Corporation) Monthly Fleet Insurance Premium",
				Status:            "active",
			},
			UpdatedAt: time.Now(),
		}
		_, _ = db.Settings.InsertOne(ctx, settings)
	} else {
		_, _ = db.Settings.UpdateMany(ctx, bson.M{"eic_recurring": bson.M{"$exists": false}}, bson.M{"$set": bson.M{
			"eic_recurring": models.EICRecurringConfig{
				Enabled:           true,
				MonthlyAmount:     150000,
				TotalMonths:       24,
				PaidMonths:        0,
				StartDate:         "2026-10-01",
				EndDate:           "2028-10-01",
				DeductionDay:      1,
				LastDeductedMonth: "",
				Description:       "EIC (Ethiopian Insurance Corporation) Monthly Fleet Insurance Premium",
				Status:            "active",
			},
		}})
		_, _ = db.Settings.UpdateMany(ctx, bson.M{}, bson.M{"$set": bson.M{
			"company_name": "SINO Logistics & Hauling Fleet PLC",
		}})
	}

	log.Println("Database check completed. Clean operational state active.")
}
