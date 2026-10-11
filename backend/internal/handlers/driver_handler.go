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
	"golang.org/x/crypto/bcrypt"
)

type DriverHandler struct {
	BaseHandler
}

func NewDriverHandler(base BaseHandler) *DriverHandler {
	return &DriverHandler{BaseHandler: base}
}

func (h *DriverHandler) GetDrivers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := h.DB.Drivers.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch drivers"})
		return
	}
	defer cursor.Close(ctx)

	drivers := make([]models.Driver, 0)
	if err := cursor.All(ctx, &drivers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode drivers"})
		return
	}

	for i := range drivers {
		if drivers[i].Email == "" || drivers[i].TempPassword == "" {
			var u models.User
			if err := h.DB.Users.FindOne(ctx, bson.M{"_id": drivers[i].UserID}).Decode(&u); err == nil {
				if drivers[i].Email == "" {
					drivers[i].Email = u.Email
				}
				if drivers[i].TempPassword == "" {
					drivers[i].TempPassword = "driver123"
				}
			} else {
				if drivers[i].TempPassword == "" {
					drivers[i].TempPassword = "driver123"
				}
			}
		}
		if strings.Contains(drivers[i].Email, "@fleet.com") {
			drivers[i].Email = strings.Replace(drivers[i].Email, "@fleet.com", "@sino.com", 1)
		}
	}

	c.JSON(http.StatusOK, drivers)
}

type CreateDriverInput struct {
	FullName           string `json:"full_name" binding:"required"`
	Email              string `json:"email" binding:"required"`
	Password           string `json:"password" binding:"required"`
	Phone              string `json:"phone" binding:"required"`
	LicenseNumber      string `json:"license_number" binding:"required"`
	LicenseExpiry      string `json:"license_expiry"`
	AssignedTruckID    string `json:"assigned_truck_id"`
	AssignedTruckPlate string `json:"assigned_truck_plate"`
	Notes              string `json:"notes"`
}

func (h *DriverHandler) CreateDriver(c *gin.Context) {
	var input CreateDriverInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide all required driver information: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	input.Email = strings.TrimSpace(input.Email)
	if input.Email == "" {
		input.Email = strings.ToLower(strings.ReplaceAll(input.FullName, " ", "")) + "@sino.com"
	} else if !strings.Contains(input.Email, "@") {
		input.Email = strings.ToLower(input.Email) + "@sino.com"
	}
	if input.Password == "" {
		input.Password = "driver123"
	}

	// Check if user already exists
	count, _ := h.DB.Users.CountDocuments(ctx, bson.M{"email": input.Email})
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User with this username/email already exists"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt password"})
		return
	}

	userID := bson.NewObjectID()
	user := models.User{
		ID:        userID,
		Email:     input.Email,
		Phone:     input.Phone,
		Password:  string(hashedPassword),
		FullName:  input.FullName,
		Role:              models.RoleDriver,
		Status:            "active",
		PreferredLanguage: "om",
		CreatedAt:         time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err = h.DB.Users.InsertOne(ctx, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user account"})
		return
	}

	driverNumber := h.GenerateNextNumber(ctx, "drivers", "DRV")
	driver := models.Driver{
		ID:                 bson.NewObjectID(),
		UserID:             userID,
		DriverNumber:       driverNumber,
		FullName:           input.FullName,
		Email:              input.Email,
		TempPassword:       input.Password,
		Phone:              input.Phone,
		LicenseNumber:      input.LicenseNumber,
		LicenseExpiry:      input.LicenseExpiry,
		AssignedTruckID:    input.AssignedTruckID,
		AssignedTruckPlate: input.AssignedTruckPlate,
		Status:             "active",
		Notes:              input.Notes,
		CreatedAt:          time.Now(),
	}

	_, err = h.DB.Drivers.InsertOne(ctx, driver)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create driver profile"})
		return
	}

	// If truck assigned, update truck status and driver name
	if input.AssignedTruckID != "" {
		truckObjID, err := bson.ObjectIDFromHex(input.AssignedTruckID)
		if err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": truckObjID}, bson.M{
				"$set": bson.M{
					"driver_assigned_id":   userID.Hex(),
					"driver_assigned_name": input.FullName,
					"status":               "working",
				},
			})
		}
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Created Driver", "Driver", driver.ID.Hex(), "",
		fmt.Sprintf("Created driver %s (%s, Phone: %s)", input.FullName, driverNumber, input.Phone))

	c.JSON(http.StatusCreated, driver)
}

func (h *DriverHandler) UpdateDriver(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
		return
	}

	var updateData struct {
		FullName           string `json:"full_name"`
		Email              string `json:"email"`
		Password           string `json:"password"`
		TempPassword       string `json:"temp_password"`
		Phone              string `json:"phone"`
		LicenseNumber      string `json:"license_number"`
		LicenseExpiry      string `json:"license_expiry"`
		AssignedTruckID    string `json:"assigned_truck_id"`
		AssignedTruckPlate string `json:"assigned_truck_plate"`
		Status             string `json:"status"`
		Notes              string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingDriver models.Driver
	if err := h.DB.Drivers.FindOne(ctx, bson.M{"_id": objID}).Decode(&existingDriver); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}

	// Format email / username to @sino.com if not formatted
	emailVal := strings.TrimSpace(updateData.Email)
	if emailVal != "" && !strings.Contains(emailVal, "@") {
		emailVal = emailVal + "@sino.com"
	}
	if emailVal == "" {
		emailVal = existingDriver.Email
	}

	// Check password change
	targetPass := strings.TrimSpace(updateData.Password)
	if targetPass == "" {
		targetPass = strings.TrimSpace(updateData.TempPassword)
	}

	// Update driver document
	driverSet := bson.M{
		"full_name":            updateData.FullName,
		"phone":                updateData.Phone,
		"email":                emailVal,
		"license_number":       updateData.LicenseNumber,
		"license_expiry":       updateData.LicenseExpiry,
		"assigned_truck_id":    updateData.AssignedTruckID,
		"assigned_truck_plate": updateData.AssignedTruckPlate,
		"status":               updateData.Status,
		"notes":                updateData.Notes,
	}
	if targetPass != "" {
		driverSet["temp_password"] = targetPass
	}

	update := bson.M{"$set": driverSet}

	_, err = h.DB.Drivers.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update driver: " + err.Error()})
		return
	}

	// Sync User record (name, phone, email, status, and password)
	if !existingDriver.UserID.IsZero() {
		userSet := bson.M{
			"full_name":  updateData.FullName,
			"phone":      updateData.Phone,
			"status":     updateData.Status,
			"updated_at": time.Now(),
		}
		if emailVal != "" {
			userSet["email"] = emailVal
		}
		if targetPass != "" {
			hash, errH := bcrypt.GenerateFromPassword([]byte(targetPass), bcrypt.DefaultCost)
			if errH == nil {
				userSet["password"] = string(hash)
			}
		}
		_, _ = h.DB.Users.UpdateOne(ctx, bson.M{"_id": existingDriver.UserID}, bson.M{"$set": userSet})
	}

	// If assigned truck changed, unassign old truck and assign new truck
	if existingDriver.AssignedTruckID != updateData.AssignedTruckID {
		if existingDriver.AssignedTruckID != "" {
			oldTrkObjID, err := bson.ObjectIDFromHex(existingDriver.AssignedTruckID)
			if err == nil {
				_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": oldTrkObjID}, bson.M{
					"$set": bson.M{"driver_assigned_id": "", "driver_assigned_name": "", "status": "available"},
				})
			}
		}

		if updateData.AssignedTruckID != "" {
			newTrkObjID, err := bson.ObjectIDFromHex(updateData.AssignedTruckID)
			if err == nil {
				_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": newTrkObjID}, bson.M{
					"$set": bson.M{
						"driver_assigned_id":   existingDriver.UserID.Hex(),
						"driver_assigned_name": updateData.FullName,
						"status":               "working",
					},
				})
			}
		}
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Updated Driver", "Driver", id, existingDriver.FullName, updateData.FullName)

	c.JSON(http.StatusOK, gin.H{"message": "Driver updated successfully"})
}

func (h *DriverHandler) DeleteDriver(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var driver models.Driver
	if err := h.DB.Drivers.FindOne(ctx, bson.M{"_id": objID}).Decode(&driver); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}

	// Unassign truck
	if driver.AssignedTruckID != "" {
		trkObjID, err := bson.ObjectIDFromHex(driver.AssignedTruckID)
		if err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
				"$set": bson.M{"driver_assigned_id": "", "driver_assigned_name": "", "status": "available"},
			})
		}
	}

	// Delete driver profile
	_, err = h.DB.Drivers.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete driver: " + err.Error()})
		return
	}

	// Deactivate or delete associated user account
	if !driver.UserID.IsZero() {
		_, _ = h.DB.Users.DeleteOne(ctx, bson.M{"_id": driver.UserID})
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Deleted Driver", "Driver", id, driver.FullName, "Deleted driver account")

	c.JSON(http.StatusOK, gin.H{"message": "Driver deleted successfully"})
}

func (h *DriverHandler) GetDriverSummary(c *gin.Context) {
	userRole := c.GetString("role")
	currentUserID := c.GetString("userID")

	targetUserID := c.Query("driver_id")
	if userRole == string(models.RoleDriver) || targetUserID == "" {
		targetUserID = currentUserID
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfWeek := now.AddDate(0, 0, -int(now.Weekday()))
	startOfWeek = time.Date(startOfWeek.Year(), startOfWeek.Month(), startOfWeek.Day(), 0, 0, 0, 0, startOfWeek.Location())
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	// Fetch all trips for target driver
	cursor, err := h.DB.Trips.Find(ctx, bson.M{"driver_id": targetUserID, "status": "completed"})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch driver trips"})
		return
	}
	defer cursor.Close(ctx)

	var trips []models.Trip
	_ = cursor.All(ctx, &trips)

	var todayRevenue, weekRevenue, monthRevenue float64
	var todayTripsCount int

	for _, t := range trips {
		if !t.Date.Before(startOfDay) {
			todayRevenue += t.TotalRevenue
			todayTripsCount++
		}
		if !t.Date.Before(startOfWeek) {
			weekRevenue += t.TotalRevenue
		}
		if !t.Date.Before(startOfMonth) {
			monthRevenue += t.TotalRevenue
		}
	}

	// Fetch fuel requests
	fuelCursor, err := h.DB.FuelRequests.Find(ctx, bson.M{"driver_id": targetUserID})
	var fuelReqs []models.FuelRequest
	if err == nil {
		_ = fuelCursor.All(ctx, &fuelReqs)
		fuelCursor.Close(ctx)
	}

	var fuelRequested, fuelApproved, fuelPaid float64
	var pendingFuelCount int
	for _, f := range fuelReqs {
		fuelRequested += f.AmountRequested
		if f.Status == "approved" || f.Status == "paid" {
			fuelApproved += f.AmountApproved
		}
		if f.Status == "paid" {
			fuelPaid += f.AmountApproved
		}
		if f.Status == "pending" {
			pendingFuelCount++
		}
	}

	// Net Operational Profit = Month Revenue - Fuel Paid
	netOperationalProfit := monthRevenue - fuelPaid

	c.JSON(http.StatusOK, gin.H{
		"today_revenue":          todayRevenue,
		"today_trips_count":      todayTripsCount,
		"week_revenue":           weekRevenue,
		"month_revenue":          monthRevenue,
		"fuel_requested":         fuelRequested,
		"fuel_approved":          fuelApproved,
		"fuel_paid":              fuelPaid,
		"pending_fuel_count":     pendingFuelCount,
		"net_operational_profit": netOperationalProfit,
	})
}

type ChangeDriverPasswordInput struct {
	NewPassword string `json:"new_password"`
	Password    string `json:"password"`
}

func (h *DriverHandler) ChangeDriverPassword(c *gin.Context) {
	driverID := c.Param("id")
	driverObjID, err := bson.ObjectIDFromHex(driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
		return
	}

	var input ChangeDriverPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	targetPass := input.NewPassword
	if targetPass == "" {
		targetPass = input.Password
	}
	if len(targetPass) < 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be at least 4 characters long"})
		return
	}
	input.NewPassword = targetPass

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var driver models.Driver
	if err := h.DB.Drivers.FindOne(ctx, bson.M{"_id": driverObjID}).Decode(&driver); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt new password"})
		return
	}

	// Update User record password
	_, err = h.DB.Users.UpdateOne(ctx, bson.M{"_id": driver.UserID}, bson.M{
		"$set": bson.M{
			"password":   string(hashedPassword),
			"updated_at": time.Now(),
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user password"})
		return
	}

	// Update Driver temp_password so the admin can always view it
	_, _ = h.DB.Drivers.UpdateOne(ctx, bson.M{"_id": driverObjID}, bson.M{
		"$set": bson.M{
			"temp_password": input.NewPassword,
		},
	})

	adminID := c.GetString("userID")
	adminName := c.GetString("userName")
	h.LogAudit(ctx, adminID, adminName, "Reset Driver Password", "Driver", driverID, "", fmt.Sprintf("Admin reset password for driver %s", driver.FullName))

	c.JSON(http.StatusOK, gin.H{
		"message":       "Driver password updated successfully",
		"driver_id":     driverID,
		"temp_password": input.NewPassword,
	})
}
