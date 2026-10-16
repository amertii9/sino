package routes

import (
	"net/http"
	"time"

	"truck-fleet-backend/internal/config"
	"truck-fleet-backend/internal/database"
	"truck-fleet-backend/internal/handlers"
	"truck-fleet-backend/internal/middleware"
	"truck-fleet-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine, db *database.Database, cfg *config.Config) {
	isProd := cfg.Env == "production" || cfg.Env == "release"

	// 1. Production security headers
	r.Use(middleware.SecurityHeadersMiddleware(isProd))

	// 2. Request body size limit (10MB max to prevent memory exhaustion DoS)
	r.Use(middleware.BodyLimitMiddleware(10 * 1024 * 1024))

	// 3. Hardened CORS middleware with origin whitelist verification
	r.Use(middleware.HardenedCORSMiddleware(cfg.CORSOrigins))

	// 4. Rate limiters
	apiLimiter := middleware.NewIPRateLimiter(300, time.Minute)       // 300 req/min for standard API traffic
	authLimiter := middleware.NewIPRateLimiter(15, time.Minute)       // 15 attempts/min to prevent brute-force attacks

	base := handlers.BaseHandler{DB: db, JWTSecret: cfg.JWTSecret}

	authH := handlers.NewAuthHandler(base)
	tripH := handlers.NewTripHandler(base)
	fuelH := handlers.NewFuelHandler(base)
	expH := handlers.NewExpenseHandler(base)
	truckH := handlers.NewTruckHandler(base)
	driverH := handlers.NewDriverHandler(base)
	masterH := handlers.NewMasterDataHandler(base)
	maintH := handlers.NewMaintenanceHandler(base)
	reportH := handlers.NewReportHandler(base)
	extraH := handlers.NewExtraHandler(base)
	odometerH := handlers.NewOdometerHandler(base)
	paymentH := handlers.NewPaymentHandler(base)
	noteH := handlers.NewNoteHandler(base)

	// Health check (lightweight, unmetered for load balancers)
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":      "ok",
			"service":     "truck-hauling-fleet-backend",
			"db":          "mongodb-connected",
			"environment": cfg.Env,
		})
	})

	api := r.Group("/api")
	api.Use(middleware.RateLimitMiddleware(apiLimiter))
	{
		// Public Auth with strict rate limiter to defend against brute force
		api.POST("/auth/login", middleware.RateLimitMiddleware(authLimiter), authH.Login)
		api.GET("/public/settings", extraH.GetSettings)

		// Protected endpoints
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// Auth check & profile
			protected.GET("/auth/me", authH.GetMe)
			protected.PUT("/auth/profile", authH.UpdateProfile)

			// Trips
			protected.POST("/trips", tripH.CreateTrip)
			protected.POST("/trips/start", tripH.StartTrip)
			protected.POST("/trips/:id/complete", tripH.CompleteTrip)
			protected.POST("/trips/complete", tripH.CompleteTrip)
			protected.GET("/trips/active", tripH.GetActiveTrip)
			protected.GET("/trips", tripH.GetTrips)
			protected.GET("/trips/recent", tripH.GetRecentTrip)
			protected.GET("/trips/smart-price", tripH.GetSmartRoutePrice)

			// Fuel Requests
			protected.POST("/fuel-requests", fuelH.RequestFuel)
			protected.GET("/fuel-requests", fuelH.GetFuelRequests)
			protected.GET("/fuel-requests/reserve-inventory", fuelH.GetReserveInventory)

			// Maintenance Requests (Drivers & Admins)
			protected.POST("/maintenance-requests", maintH.CreateMaintenanceRequest)
			protected.GET("/maintenance-requests", maintH.GetMaintenanceRequests)

			// Common lookups accessible to both Driver and Admin
			protected.GET("/trucks", truckH.GetTrucks)
			protected.GET("/sites", masterH.GetSites)
			protected.POST("/sites", masterH.CreateSite)
			protected.GET("/materials", masterH.GetMaterials)
			protected.POST("/materials", masterH.CreateMaterial)
			protected.GET("/routes", masterH.GetRoutes)
			protected.GET("/drivers/summary", driverH.GetDriverSummary)
			protected.GET("/notifications", extraH.GetNotifications)
			protected.PATCH("/notifications/:id/read", extraH.MarkNotificationRead)
			protected.GET("/settings", extraH.GetSettings)

			// Odometer Readings (for Drivers and Admins)
			protected.GET("/odometer/today", odometerH.GetTodayReading)
			protected.POST("/odometer/start", odometerH.SaveStartReading)
			protected.POST("/odometer/end", odometerH.SaveEndReading)
			protected.GET("/odometer/history", odometerH.GetHistory)

			// Admin-only routes (strictly isolated via RBAC)
			admin := protected.Group("")
			admin.Use(middleware.RequireRole(models.RoleAdmin))
			{
				// Driver management moved under admin to prevent credential/roster harvesting
				admin.GET("/drivers", driverH.GetDrivers)
				admin.POST("/drivers", driverH.CreateDriver)
				admin.PUT("/drivers/:id", driverH.UpdateDriver)
				admin.PUT("/drivers/:id/password", driverH.ChangeDriverPassword)
				admin.DELETE("/drivers/:id", driverH.DeleteDriver)

				admin.GET("/odometer", odometerH.GetAll)
				admin.POST("/odometer", odometerH.CreateManualRecord)
				admin.PUT("/odometer/:id", odometerH.UpdateRecord)
				admin.DELETE("/odometer/:id", odometerH.DeleteRecord)

				// Trips management (Cancel, Edit/Correct, and Delete)
				admin.PATCH("/trips/:id/cancel", tripH.CancelTrip)
				admin.PUT("/trips/:id", tripH.UpdateTrip)
				admin.DELETE("/trips/:id", tripH.DeleteTrip)

				// Payment Control & Hauling Receivables
				admin.GET("/payments", paymentH.GetPayments)
				admin.GET("/payments/summary", paymentH.GetPaymentSummary)
				admin.PATCH("/payments/:id/approve", paymentH.ApprovePayment)
				admin.PATCH("/payments/:id/revert", paymentH.RevertPayment)
				admin.POST("/payments/batch-approve", paymentH.BatchApprovePayments)

				// Fuel requests approval / mark paid / edit / delete
				admin.PATCH("/fuel-requests/:id/approve", fuelH.ApproveFuelRequest)
				admin.PATCH("/fuel-requests/:id/reject", fuelH.RejectFuelRequest)
				admin.PATCH("/fuel-requests/:id/paid", fuelH.MarkFuelPaid)
				admin.PUT("/fuel-requests/:id", fuelH.UpdateFuelRequest)
				admin.DELETE("/fuel-requests/:id", fuelH.DeleteFuelRequest)

				// Expenses (Create, Get, Edit, Cancel, Delete)
				admin.POST("/expenses", expH.CreateExpense)
				admin.GET("/expenses", expH.GetExpenses)
				admin.PUT("/expenses/:id", expH.UpdateExpense)
				admin.PATCH("/expenses/:id/cancel", expH.CancelExpense)
				admin.DELETE("/expenses/:id", expH.DeleteExpense)

				// Recurring Expenses (Multi-Item Auto Deductions & EIC Controls)
				admin.GET("/expenses/recurring", expH.GetRecurringExpenses)
				admin.POST("/expenses/recurring", expH.CreateRecurringExpense)
				admin.PUT("/expenses/recurring/:id", expH.UpdateRecurringExpense)
				admin.DELETE("/expenses/recurring/:id", expH.DeleteRecurringExpense)
				admin.POST("/expenses/recurring/:id/toggle", expH.ToggleRecurringExpense)
				admin.POST("/expenses/recurring/:id/deduct-now", expH.DeductRecurringExpenseNow)
				admin.GET("/expenses/recurring/eic", expH.GetEICRecurring)
				admin.PUT("/expenses/recurring/eic", expH.UpdateEICRecurring)
				admin.POST("/expenses/recurring/eic/deduct-now", expH.DeductEICNow)
				admin.POST("/expenses/recurring/eic/toggle", expH.ToggleEICRecurring)

				// Operational Notes & Driver Allowances
				admin.GET("/notes", noteH.GetNotes)
				admin.POST("/notes", noteH.CreateNote)
				admin.PUT("/notes/:id", noteH.UpdateNote)
				admin.DELETE("/notes/:id", noteH.DeleteNote)
				admin.POST("/notes/:id/add-to-expense", noteH.AddNoteToExpense)

				// Trucks (Create, Edit, Delete)
				admin.POST("/trucks", truckH.CreateTruck)
				admin.PUT("/trucks/:id", truckH.UpdateTruck)
				admin.DELETE("/trucks/:id", truckH.DeleteTruck)

				// Sites (Edit, Delete)
				admin.PUT("/sites/:id", masterH.UpdateSite)
				admin.DELETE("/sites/:id", masterH.DeleteSite)

				// Materials (Edit, Delete)
				admin.PUT("/materials/:id", masterH.UpdateMaterial)
				admin.DELETE("/materials/:id", masterH.DeleteMaterial)

				// Routes (Create, Edit, Delete)
				admin.POST("/routes", masterH.CreateRoute)
				admin.PUT("/routes/:id", masterH.UpdateRoute)
				admin.DELETE("/routes/:id", masterH.DeleteRoute)

				// Maintenance (Create, Get, Edit, Delete, Approve, Reject)
				admin.POST("/maintenance", maintH.CreateMaintenance)
				admin.GET("/maintenance", maintH.GetMaintenance)
				admin.PUT("/maintenance/:id", maintH.UpdateMaintenance)
				admin.DELETE("/maintenance/:id", maintH.DeleteMaintenance)
				admin.PATCH("/maintenance/:id/approve", maintH.ApproveMaintenanceRequest)
				admin.PATCH("/maintenance/:id/reject", maintH.RejectMaintenanceRequest)

				// Reports
				admin.GET("/reports/dashboard", reportH.GetDashboardStats)
				admin.GET("/reports/trucks", reportH.GetTruckPerformanceReport)
				admin.GET("/reports/drivers", reportH.GetDriverPerformanceReport)
				admin.GET("/reports/materials", reportH.GetMaterialReport)
				admin.GET("/reports/routes", reportH.GetRouteReport)
				admin.GET("/reports/fuel-estimation", reportH.GetFuelEstimationReport)

				// Audit Logs & Settings
				admin.GET("/audit-logs", extraH.GetAuditLogs)
				admin.PUT("/settings", extraH.UpdateSettings)
				admin.PATCH("/settings/diesel-price", extraH.UpdateDieselPrice)
				admin.PATCH("/settings/fee-suggestions", extraH.UpdateFeeSuggestions)
				admin.PUT("/settings/fee-suggestions", extraH.UpdateFeeSuggestions)
				admin.PATCH("/settings/fuel-presets", extraH.UpdateFuelPresets)
				admin.PUT("/settings/fuel-presets", extraH.UpdateFuelPresets)
				admin.PATCH("/settings/maintenance-suggestions", extraH.UpdateMaintenanceSuggestions)
				admin.PUT("/settings/maintenance-suggestions", extraH.UpdateMaintenanceSuggestions)
				admin.PATCH("/settings/reserve-fuel", extraH.UpdateReserveFuelSettings)
			}
		}
	}
}
