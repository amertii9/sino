package handlers

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"

	"truck-fleet-backend/internal/middleware"
	"truck-fleet-backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	BaseHandler
}

func NewAuthHandler(base BaseHandler) *AuthHandler {
	return &AuthHandler{BaseHandler: base}
}

func extractDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func buildDigitsRegex(digits string) string {
	var b strings.Builder
	for i, r := range digits {
		if i > 0 {
			b.WriteString(`[\s\-\.]*`)
		}
		b.WriteRune(r)
	}
	return b.String()
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide valid email, username, or phone number and password"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	input := strings.TrimSpace(req.Email)
	orConditions := []bson.M{
		{"email": input},
		{"phone": input},
		{"email": bson.M{"$regex": "^" + regexp.QuoteMeta(input) + "$", "$options": "i"}},
	}

	// Admin shortcut
	if strings.EqualFold(input, "admin") || strings.EqualFold(input, "admin@sino.com") || strings.EqualFold(input, "admin@fleet.com") {
		orConditions = append(orConditions,
			bson.M{"email": "admin@sino.com"},
		)
	}

	// Username shortcut (e.g. "john" or "ahmed") -> matches john@sino.com
	if !strings.Contains(input, "@") && len(input) >= 2 {
		orConditions = append(orConditions,
			bson.M{"email": strings.ToLower(input) + "@sino.com"},
			bson.M{"email": bson.M{"$regex": "^" + regexp.QuoteMeta(input) + "@", "$options": "i"}},
		)
	}

	// Phone matching across variants (e.g. +251 911 555 101, 0911555101, 911555101)
	digits := extractDigits(input)
	corePhoneRegex := ""
	if len(digits) >= 6 {
		coreDigits := digits
		if strings.HasPrefix(coreDigits, "251") && len(coreDigits) >= 11 {
			coreDigits = coreDigits[3:]
		} else if strings.HasPrefix(coreDigits, "0") && len(coreDigits) >= 9 {
			coreDigits = coreDigits[1:]
		} else if len(coreDigits) > 9 {
			coreDigits = coreDigits[len(coreDigits)-9:]
		}

		corePhoneRegex = buildDigitsRegex(coreDigits)
		orConditions = append(orConditions,
			bson.M{"phone": "+" + digits},
			bson.M{"phone": "0" + coreDigits},
			bson.M{"phone": coreDigits},
			bson.M{"phone": bson.M{"$regex": corePhoneRegex, "$options": "i"}},
		)
	}

	filter := bson.M{"$or": orConditions}

	var user models.User
	err := h.DB.Users.FindOne(ctx, filter).Decode(&user)
	if err != nil {
		// If not found in Users, try finding driver by phone and resolving linked User
		driverOrConditions := []bson.M{
			{"phone": input},
		}
		if corePhoneRegex != "" {
			driverOrConditions = append(driverOrConditions,
				bson.M{"phone": bson.M{"$regex": corePhoneRegex, "$options": "i"}},
			)
		}
		var drv models.Driver
		if errDrv := h.DB.Drivers.FindOne(ctx, bson.M{"$or": driverOrConditions}).Decode(&drv); errDrv == nil && !drv.UserID.IsZero() {
			_ = h.DB.Users.FindOne(ctx, bson.M{"_id": drv.UserID}).Decode(&user)
		}
	}

	if user.ID.IsZero() {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email, username, phone number, or password"})
		return
	}

	if user.Status == "inactive" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Account is inactive. Please contact your fleet manager."})
		return
	}

	passErr := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if passErr != nil && user.Role == models.RoleDriver {
		// For drivers with an initial temporary password set by admin
		var d models.Driver
		if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": user.ID}).Decode(&d); err == nil {
			if d.TempPassword != "" && d.TempPassword == req.Password {
				passErr = nil
			}
		}
	}

	if passErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email/username or password"})
		return
	}

	token, err := middleware.GenerateToken(user, h.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	resp := models.LoginResponse{
		Token: token,
		User:  user,
	}

	// If role is driver, fetch driver profile and assigned truck
	if user.Role == models.RoleDriver {
		var driver models.Driver
		if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": user.ID}).Decode(&driver); err == nil {
			resp.Driver = &driver

			if driver.AssignedTruckID != "" {
				var truck models.Truck
				truckObjID, err := bson.ObjectIDFromHex(driver.AssignedTruckID)
				if err == nil {
					if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": truckObjID}).Decode(&truck); err == nil {
						resp.Truck = &truck
					}
				}
			}
		}
	}

	h.LogAudit(ctx, user.ID.Hex(), user.FullName, "User Logged In", "User", user.ID.Hex(), "", "Success")

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) GetMe(c *gin.Context) {
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	userObjID, err := bson.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	if err := h.DB.Users.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	resp := gin.H{
		"user": user,
	}

	if user.Role == models.RoleDriver {
		var driver models.Driver
		if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": user.ID}).Decode(&driver); err == nil {
			resp["driver"] = driver

			if driver.AssignedTruckID != "" {
				var truck models.Truck
				truckObjID, err := bson.ObjectIDFromHex(driver.AssignedTruckID)
				if err == nil {
					if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": truckObjID}).Decode(&truck); err == nil {
						resp["truck"] = truck
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, resp)
}

type UpdateProfileInput struct {
	FullName        string `json:"full_name"`
	Phone           string `json:"phone"`
	Avatar          string `json:"avatar"`
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
	LicenseNumber   string `json:"license_number"`
	Notes           string `json:"notes"`
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userIDStr, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	userObjID, err := bson.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid profile data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	if err := h.DB.Users.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	userUpdate := bson.M{
		"updated_at": time.Now(),
	}

	if input.FullName != "" {
		userUpdate["full_name"] = input.FullName
	}
	if input.Phone != "" {
		userUpdate["phone"] = input.Phone
	}
	if input.Avatar != "" {
		userUpdate["avatar"] = input.Avatar
	}

	// Password update
	if input.NewPassword != "" {
		if len(input.NewPassword) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be at least 6 characters"})
			return
		}
		// If user already has a password, verify current password
		if user.Password != "" {
			if input.CurrentPassword == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is required to set a new password"})
				return
			}
			if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.CurrentPassword)); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Current password does not match"})
				return
			}
		}
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash new password"})
			return
		}
		userUpdate["password"] = string(hashedPassword)
	}

	_, err = h.DB.Users.UpdateOne(ctx, bson.M{"_id": userObjID}, bson.M{"$set": userUpdate})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// If user is driver, update driver collection too
	var updatedDriver *models.Driver
	if user.Role == models.RoleDriver {
		driverUpdate := bson.M{}
		if input.FullName != "" {
			driverUpdate["full_name"] = input.FullName
		}
		if input.Phone != "" {
			driverUpdate["phone"] = input.Phone
		}
		if input.LicenseNumber != "" {
			driverUpdate["license_number"] = input.LicenseNumber
		}
		if input.Notes != "" {
			driverUpdate["notes"] = input.Notes
		}

		if len(driverUpdate) > 0 {
			_, _ = h.DB.Drivers.UpdateOne(ctx, bson.M{"user_id": userObjID}, bson.M{"$set": driverUpdate})
		}

		// Update truck driver name if assigned
		if input.FullName != "" {
			_, _ = h.DB.Trucks.UpdateMany(ctx, bson.M{"driver_assigned_id": userIDStr.(string)}, bson.M{
				"$set": bson.M{"driver_assigned_name": input.FullName},
			})
		}

		var d models.Driver
		if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": userObjID}).Decode(&d); err == nil {
			updatedDriver = &d
		}
	}

	// Fetch updated user
	var updatedUser models.User
	_ = h.DB.Users.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&updatedUser)

	h.LogAudit(ctx, userIDStr.(string), updatedUser.FullName, "Updated Profile", "User", userIDStr.(string), "", "User updated their profile details")

	resp := gin.H{
		"message": "Profile updated successfully",
		"user":    updatedUser,
	}
	if updatedDriver != nil {
		resp["driver"] = updatedDriver
	}

	c.JSON(http.StatusOK, resp)
}

