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

	// 1. Ensure Admin User Exists with soneschool1@gmail.com / sone@7151
	var admin models.User
	err := db.Users.FindOne(ctx, bson.M{
		"$or": []bson.M{
			{"role": models.RoleAdmin},
			{"email": "soneschool1@gmail.com"},
			{"email": "admin@sino.com"},
			{"email": "admin@fleet.com"},
		},
	}).Decode(&admin)
	adminHash, _ := bcrypt.GenerateFromPassword([]byte("sone@7151"), bcrypt.DefaultCost)

	if err != nil {
		log.Println("Creating initial Admin user (soneschool1@gmail.com / sone@7151)...")
		adminUser := models.User{
			ID:        bson.NewObjectID(),
			Email:     "soneschool1@gmail.com",
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
		// Admin already exists, ensure updated email, active status and valid password
		updateM := bson.M{
			"email":      "soneschool1@gmail.com",
			"role":       models.RoleAdmin,
			"status":     "active",
			"password":   string(adminHash),
			"updated_at": time.Now(),
		}
		_, _ = db.Users.UpdateOne(ctx, bson.M{"_id": admin.ID}, bson.M{"$set": updateM})
		_, _ = db.Users.UpdateMany(ctx, bson.M{"role": models.RoleAdmin}, bson.M{"$set": bson.M{
			"email":    "soneschool1@gmail.com",
			"password": string(adminHash),
		}})
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
			ReserveFuelBalanceLiters:  5000.0,
			ReserveFuelCapacityLiters: 10000.0,
			ReserveFuelLowThreshold:   1500.0,
			UpdatedAt:                 time.Now(),
		}
		_, _ = db.Settings.InsertOne(ctx, settings)
	} else {
		_, _ = db.Settings.UpdateMany(ctx, bson.M{"reserve_fuel_capacity_liters": bson.M{"$exists": false}}, bson.M{"$set": bson.M{
			"reserve_fuel_balance_liters":  5000.0,
			"reserve_fuel_capacity_liters": 10000.0,
			"reserve_fuel_low_threshold":   1500.0,
		}})
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

	// 3. Ensure Default Transit Points Exist
	countTransit, _ := db.Sites.CountDocuments(ctx, bson.M{"type": "transition"})
	if countTransit == 0 {
		transitSites := []interface{}{
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Kality Weigh Station & Hub",
				Location:  "Kality Axle Scale Checkpoint",
				Type:      "transition",
				Status:    "active",
				CreatedAt: time.Now(),
			},
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Modjo Expressway Toll Plaza",
				Location:  "Modjo Toll Gate km 0",
				Type:      "transition",
				Status:    "active",
				CreatedAt: time.Now(),
			},
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Dukem Weighbridge Scale",
				Location:  "Dukem Checkpoint",
				Type:      "transition",
				Status:    "active",
				CreatedAt: time.Now(),
			},
		}
		_, _ = db.Sites.InsertMany(ctx, transitSites)
	}

	// 4. Ensure Default Loading & Dumping Sites Exist
	countLoading, _ := db.Sites.CountDocuments(ctx, bson.M{"type": "loading"})
	if countLoading < 3 {
		loadingSites := []interface{}{
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Quarry A (Awash River Basin)",
				Location:  "Awash Basin Mile 42",
				Type:      "loading",
				Status:    "active",
				CreatedAt: time.Now(),
			},
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Mojo Sand Extraction Pit",
				Location:  "Mojo River Road km 8",
				Type:      "loading",
				Status:    "active",
				CreatedAt: time.Now(),
			},
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Modjo Stone Crushing Plant",
				Location:  "Modjo Industrial Gate 3",
				Type:      "loading",
				Status:    "active",
				CreatedAt: time.Now(),
			},
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Dukem Basalt Quarry",
				Location:  "Dukem Mile 12",
				Type:      "loading",
				Status:    "active",
				CreatedAt: time.Now(),
			},
		}
		_, _ = db.Sites.InsertMany(ctx, loadingSites)
	}

	countDumping, _ := db.Sites.CountDocuments(ctx, bson.M{"type": "dumping"})
	if countDumping < 3 {
		dumpingSites := []interface{}{
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Bole Lemi Industrial Park Project",
				Location:  "Bole Lemi Phase 2, Addis Ababa",
				Type:      "dumping",
				Status:    "active",
				CreatedAt: time.Now(),
			},
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Addis Ababa Ring Road Corridor",
				Location:  "Gotera to Kality Section",
				Type:      "dumping",
				Status:    "active",
				CreatedAt: time.Now(),
			},
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Commercial Bank HQ Site",
				Location:  "Ras Desta Damtew St, Addis Ababa",
				Type:      "dumping",
				Status:    "active",
				CreatedAt: time.Now(),
			},
			models.Site{
				ID:        bson.NewObjectID(),
				Name:      "Adama Expressway Project",
				Location:  "Adama Outer Ring",
				Type:      "dumping",
				Status:    "active",
				CreatedAt: time.Now(),
			},
		}
		_, _ = db.Sites.InsertMany(ctx, dumpingSites)
	}

	// 5. Ensure Default Cargo Materials Exist
	countMaterials, _ := db.Materials.CountDocuments(ctx, bson.M{})
	if countMaterials == 0 {
		defaultMaterials := []interface{}{
			models.Material{
				ID:           bson.NewObjectID(),
				Name:         "River Sand",
				DefaultUnit:  "ton",
				DefaultPrice: 450,
				Description:  "Clean washed river sand for construction",
				Status:       "active",
				CreatedAt:    time.Now(),
			},
			models.Material{
				ID:           bson.NewObjectID(),
				Name:         "Crushed Aggregate (02)",
				DefaultUnit:  "ton",
				DefaultPrice: 580,
				Description:  "Graded concrete aggregate 02",
				Status:       "active",
				CreatedAt:    time.Now(),
			},
			models.Material{
				ID:           bson.NewObjectID(),
				Name:         "Selected Sub-base Soil",
				DefaultUnit:  "ton",
				DefaultPrice: 380,
				Description:  "Compacted road sub-base fill material",
				Status:       "active",
				CreatedAt:    time.Now(),
			},
			models.Material{
				ID:           bson.NewObjectID(),
				Name:         "Round Gravel",
				DefaultUnit:  "ton",
				DefaultPrice: 520,
				Description:  "Natural round gravel aggregate",
				Status:       "active",
				CreatedAt:    time.Now(),
			},
			models.Material{
				ID:           bson.NewObjectID(),
				Name:         "Cement Bags (PPC 42.5)",
				DefaultUnit:  "quintal",
				DefaultPrice: 1100,
				Description:  "Standard 50kg cement bags",
				Status:       "active",
				CreatedAt:    time.Now(),
			},
			models.Material{
				ID:           bson.NewObjectID(),
				Name:         "Basalt Stone",
				DefaultUnit:  "ton",
				DefaultPrice: 480,
				Description:  "Hard basalt foundation stone",
				Status:       "active",
				CreatedAt:    time.Now(),
			},
			models.Material{
				ID:           bson.NewObjectID(),
				Name:         "Red Ash / Scoria",
				DefaultUnit:  "ton",
				DefaultPrice: 350,
				Description:  "Volcanic red ash / lightweight fill",
				Status:       "active",
				CreatedAt:    time.Now(),
			},
		}
		_, _ = db.Materials.InsertMany(ctx, defaultMaterials)
		log.Println("Seeded default cargo materials.")
	}

	// 6. Ensure all Driver accounts have Afaan Oromoo ('om') as default language
	_, _ = db.Users.UpdateMany(ctx, bson.M{
		"role": models.RoleDriver,
		"$or": []bson.M{
			{"preferred_language": bson.M{"$exists": false}},
			{"preferred_language": ""},
		},
	}, bson.M{"$set": bson.M{"preferred_language": "om"}})

	log.Println("Database check completed. Clean operational state active.")
}
