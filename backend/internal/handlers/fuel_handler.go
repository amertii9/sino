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

type FuelHandler struct {
	BaseHandler
}

func NewFuelHandler(base BaseHandler) *FuelHandler {
	return &FuelHandler{BaseHandler: base}
}

type FuelRequestInput struct {
	FuelSource          string     `json:"fuel_source"` // "gas_station" or "reserve_fuel"
	ReserveAction       string     `json:"reserve_action"` // "procure" (Step 1) or "draw" (Step 2)
	ReserveProcureReqID string     `json:"reserve_procure_req_id"`
	OdometerReading     float64    `json:"odometer_reading"`
	Liters              float64    `json:"liters"`
	PricePerLiter       float64    `json:"price_per_liter"`
	AmountRequested     float64    `json:"amount_requested"`
	AmountApproved      float64    `json:"amount_approved"`
	Reason              string     `json:"reason"`
	CurrentTripID       string     `json:"current_trip_id"`
	FuelStation         string     `json:"fuel_station"`
	Notes               string     `json:"notes"`
	AdminNote           string     `json:"admin_note"`
	ReceiptURL          string     `json:"receipt_url"`
	TruckID             string     `json:"truck_id"`
	TruckPlate          string     `json:"truck_plate"`
	DriverID            string     `json:"driver_id"`
	DriverName          string     `json:"driver_name"`
	Status              string     `json:"status"`
	RequestedAt         *time.Time `json:"requested_at"`
}

func (h *FuelHandler) RequestFuel(c *gin.Context) {
	var input FuelRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide valid fuel request data"})
		return
	}

	if input.FuelSource == "" {
		input.FuelSource = "gas_station"
	}

	if input.FuelSource == "reserve_fuel" {
		if input.ReserveAction == "" {
			if input.OdometerReading > 0 || input.TruckPlate != "" {
				input.ReserveAction = "draw"
			} else {
				input.ReserveAction = "procure"
			}
		}
	}

	// Fetch current system settings for diesel benchmark & reserve fuel balance check
	var settings models.Settings
	_ = h.DB.Settings.FindOne(c.Request.Context(), bson.M{}).Decode(&settings)

	// Validate Reserve Fuel requests
	if input.FuelSource == "reserve_fuel" {
		if input.ReserveAction == "draw" {
			// Step 2 (Pumping/Drawing from Reserve Tank)
			if input.Liters <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify fuel quantity in liters to pump from the reserve tank"})
				return
			}
			if settings.ReserveFuelBalanceLiters < input.Liters {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": fmt.Sprintf("Insufficient fuel in company yard reserve tank. Available: %.1f Liters, Requested: %.1f Liters. Please submit a Step 1 request to replenish/fill the reserve tank first.", settings.ReserveFuelBalanceLiters, input.Liters),
					"available_liters": settings.ReserveFuelBalanceLiters,
				})
				return
			}
		} else {
			// Step 1 (Procuring/Filling the Reserve Tank)
			if input.Liters <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify fuel quantity in liters to procure for the reserve tank"})
				return
			}
			if input.PricePerLiter <= 0 {
				if settings.DieselPrice > 0 {
					input.PricePerLiter = settings.DieselPrice
				} else {
					input.PricePerLiter = 100.0
				}
			}
		}
	}

	// Auto-calculate amount if liters & price per liter are provided
	if input.AmountRequested <= 0 {
		if input.Liters > 0 && input.PricePerLiter > 0 {
			input.AmountRequested = input.Liters * input.PricePerLiter
		} else if input.FuelSource == "reserve_fuel" && input.Liters > 0 {
			rate := input.PricePerLiter
			if rate <= 0 {
				if settings.DieselPrice > 0 {
					rate = settings.DieselPrice
				} else {
					rate = 100.0
				}
			}
			input.AmountRequested = input.Liters * rate
		}
	}

	if input.AmountRequested <= 0 && input.FuelSource != "reserve_fuel" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Amount requested or fuel liters must be greater than zero"})
		return
	}

	if input.Reason == "" {
		if input.FuelSource == "reserve_fuel" {
			if input.ReserveAction == "draw" {
				input.Reason = fmt.Sprintf("Reserve tank dispense (Step 2 Draw): %.1f L pumped into truck", input.Liters)
			} else {
				input.Reason = fmt.Sprintf("Reserve tank replenishment (Step 1 Procure): %.1f L requested for yard tank", input.Liters)
			}
		} else {
			input.Reason = fmt.Sprintf("Gas station diesel refueling (%.1f L)", input.Liters)
		}
	}

	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")
	fullName := c.GetString("fullName")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var driverID, driverName, truckID, truckPlate string
	var amountApproved float64
	status := "pending"

	if userRole == "admin" {
		driverID = input.DriverID
		driverName = input.DriverName
		truckID = input.TruckID
		truckPlate = input.TruckPlate
		if input.Status != "" {
			status = input.Status
		}
		if input.AmountApproved > 0 {
			amountApproved = input.AmountApproved
		} else if status == "approved" || status == "paid" {
			amountApproved = input.AmountRequested
		}

		if truckID != "" && truckPlate == "" {
			if tID, err := bson.ObjectIDFromHex(truckID); err == nil {
				var trk models.Truck
				if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": tID}).Decode(&trk); err == nil {
					truckPlate = trk.PlateNumber
					if driverName == "" && trk.DriverAssignedName != "" {
						driverName = trk.DriverAssignedName
						driverID = trk.DriverAssignedID
					}
				}
			}
		}
		if driverID != "" && driverName == "" {
			if dID, err := bson.ObjectIDFromHex(driverID); err == nil {
				var drv models.Driver
				if err := h.DB.Drivers.FindOne(ctx, bson.M{"_id": dID}).Decode(&drv); err == nil {
					driverName = drv.FullName
				}
			}
		}
		if driverName == "" {
			driverName = "Admin Advance"
		}
	} else {
		// Driver role
		driverID = userIDStr
		driverName = fullName
		if input.DriverName != "" {
			driverName = input.DriverName
		}

		var driver models.Driver
		userObjID, _ := bson.ObjectIDFromHex(userIDStr)
		email := c.GetString("email")

		lookupOr := []bson.M{
			{"user_id": userObjID},
			{"user_id": userIDStr},
		}
		if email != "" {
			lookupOr = append(lookupOr, bson.M{"email": email})
		}
		if !userObjID.IsZero() {
			lookupOr = append(lookupOr, bson.M{"_id": userObjID})
		}

		if err := h.DB.Drivers.FindOne(ctx, bson.M{"$or": lookupOr}).Decode(&driver); err == nil {
			if driver.FullName != "" {
				driverName = driver.FullName
			}
			truckID = driver.AssignedTruckID
			truckPlate = driver.AssignedTruckPlate
		}

		if truckID == "" && input.TruckID != "" {
			truckID = input.TruckID
			truckPlate = input.TruckPlate
		}
		if truckID == "" {
			var trk models.Truck
			filter := []string{userIDStr}
			if !driver.ID.IsZero() {
				filter = append(filter, driver.ID.Hex())
			}
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"driver_assigned_id": bson.M{"$in": filter}}).Decode(&trk); err == nil {
				truckID = trk.ID.Hex()
				truckPlate = trk.PlateNumber
			}
		}
		if truckPlate == "" && truckID != "" {
			if tID, err := bson.ObjectIDFromHex(truckID); err == nil {
				var trk models.Truck
				if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": tID}).Decode(&trk); err == nil {
					truckPlate = trk.PlateNumber
				}
			}
		}
		if truckPlate == "" && input.TruckPlate != "" {
			truckPlate = input.TruckPlate
		}
	}

	reqNumber := h.GenerateNextNumber(ctx, "fuel_requests", "FR")
	reqTime := time.Now()
	if input.RequestedAt != nil && !input.RequestedAt.IsZero() {
		reqTime = *input.RequestedAt
	}

	// Validate odometer reading cannot be less than previous recorded reading
	if input.OdometerReading > 0 {
		prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
		if prevOdo > 0 && input.OdometerReading < prevOdo {
			targetName := truckPlate
			if targetName == "" {
				targetName = "this vehicle"
			}
			c.JSON(http.StatusBadRequest, gin.H{
				"error":        fmt.Sprintf("Fuel odometer reading (%.0f km) cannot be less than previous recorded reading (%.0f km) for %s. As the vehicle travels, odometer readings must increase.", input.OdometerReading, prevOdo, targetName),
				"min_odometer": prevOdo,
			})
			return
		}
	}

	fuelReq := models.FuelRequest{
		ID:                  bson.NewObjectID(),
		RequestNumber:       reqNumber,
		DriverID:            driverID,
		DriverName:          driverName,
		TruckID:             truckID,
		TruckPlate:          truckPlate,
		FuelSource:          input.FuelSource,
		ReserveAction:       input.ReserveAction,
		ReserveProcureReqID: input.ReserveProcureReqID,
		OdometerReading:     input.OdometerReading,
		Liters:              input.Liters,
		PricePerLiter:       input.PricePerLiter,
		AmountRequested:     input.AmountRequested,
		AmountApproved:      amountApproved,
		Reason:              input.Reason,
		CurrentTripID:       input.CurrentTripID,
		FuelStation:         input.FuelStation,
		ReceiptURL:          input.ReceiptURL,
		Status:              status,
		Notes:               input.Notes,
		AdminNote:           input.AdminNote,
		RequestedAt:         reqTime,
		CreatedAt:           time.Now(),
	}

	// Update truck odometer if a valid reading was supplied
	if input.OdometerReading > 0 && truckID != "" {
		if tObjID, err := bson.ObjectIDFromHex(truckID); err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx,
				bson.M{"_id": tObjID},
				bson.M{"$max": bson.M{
					"current_odometer": input.OdometerReading,
					"current_mileage":  input.OdometerReading,
					"mileage":          input.OdometerReading,
				}},
			)
		}
	}

	// Handle Reserve Fuel inventory update if directly approved or paid
	if (status == "paid" || status == "approved") && input.FuelSource == "reserve_fuel" {
		if input.ReserveAction == "procure" && !fuelReq.InventoryAdded {
			before := settings.ReserveFuelBalanceLiters
			after := before + input.Liters
			_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{"$set": bson.M{"reserve_fuel_balance_liters": after, "updated_at": time.Now()}})
			fuelReq.ReserveBalanceBefore = before
			fuelReq.ReserveBalanceAfter = after
			fuelReq.InventoryAdded = true
		} else if input.ReserveAction == "draw" && !fuelReq.InventoryDeducted {
			before := settings.ReserveFuelBalanceLiters
			after := before - input.Liters
			if after < 0 {
				after = 0
			}
			_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{"$set": bson.M{"reserve_fuel_balance_liters": after, "updated_at": time.Now()}})
			fuelReq.ReserveBalanceBefore = before
			fuelReq.ReserveBalanceAfter = after
			fuelReq.InventoryDeducted = true
		}
	}

	if status == "paid" {
		now := time.Now()
		fuelReq.ApprovedAt = &now
		fuelReq.PaidAt = &now

		// Only disburse cash / record monetary expense if not drawing from internal reserve tank stock
		if input.FuelSource != "reserve_fuel" || input.ReserveAction == "procure" {
			existingExpCount, _ := h.DB.Expenses.CountDocuments(ctx, bson.M{
				"$or": []bson.M{
					{"fuel_request_id": fuelReq.ID.Hex()},
					{"receipt_number": fmt.Sprintf("FUEL-%s", reqNumber)},
				},
				"status": bson.M{"$ne": "cancelled"},
			})
			if existingExpCount == 0 {
				expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
				expense := models.Expense{
					ID:            bson.NewObjectID(),
					ExpenseNumber: expNumber,
					TruckID:       truckID,
					TruckPlate:    truckPlate,
					DriverID:      driverID,
					DriverName:    driverName,
					FuelRequestID: fuelReq.ID.Hex(),
					ExpenseType:   "fuel",
					Amount:        amountApproved,
					Date:          reqTime,
					Description:   fmt.Sprintf("Fuel disbursed for %s (%s)", driverName, input.Reason),
					ReceiptNumber: fmt.Sprintf("FUEL-%s", reqNumber),
					Status:        "active",
					CreatedAt:     time.Now(),
				}
				if _, err := h.DB.Expenses.InsertOne(ctx, expense); err == nil {
					fuelReq.LinkedExpenseID = expense.ID.Hex()
				}
			}
		}
	} else if status == "approved" {
		now := time.Now()
		fuelReq.ApprovedAt = &now
	}

	_, err := h.DB.FuelRequests.InsertOne(ctx, fuelReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit fuel request"})
		return
	}

	h.LogAudit(ctx, userIDStr, fullName, "Logged Fuel Advance", "FuelRequest", fuelReq.ID.Hex(), "",
		fmt.Sprintf("Logged %.0f ETB for truck %s (%s)", input.AmountRequested, truckPlate, input.Reason))

	c.JSON(http.StatusCreated, fuelReq)
}

func (h *FuelHandler) GetFuelRequests(c *gin.Context) {
	userRole := c.GetString("role")
	userIDStr := c.GetString("userID")

	filter := bson.M{}
	if userRole == string(models.RoleDriver) {
		filter["driver_id"] = userIDStr
	} else {
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if driverID := c.Query("driver_id"); driverID != "" {
			filter["driver_id"] = driverID
		}
		if truckID := c.Query("truck_id"); truckID != "" {
			filter["truck_id"] = truckID
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.D{{Key: "requested_at", Value: -1}})
	cursor, err := h.DB.FuelRequests.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch fuel requests"})
		return
	}
	defer cursor.Close(ctx)

	requests := make([]models.FuelRequest, 0)
	if err := cursor.All(ctx, &requests); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode fuel requests"})
		return
	}

	c.JSON(http.StatusOK, requests)
}

type ApproveFuelInput struct {
	AmountApproved float64 `json:"amount_approved"`
	AdminNote      string  `json:"admin_note"`
}

func (h *FuelHandler) ApproveFuelRequest(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	var input ApproveFuelInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide valid approval data"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req models.FuelRequest
	if err := h.DB.FuelRequests.FindOne(ctx, bson.M{"_id": objID}).Decode(&req); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Fuel request not found"})
		return
	}

	var settings models.Settings
	_ = h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings)

	amountApproved := input.AmountApproved
	if amountApproved <= 0 {
		if req.FuelSource == "reserve_fuel" && req.ReserveAction == "draw" {
			amountApproved = 0
		} else {
			amountApproved = req.AmountRequested
		}
	}

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"status":          "approved",
			"amount_approved": amountApproved,
			"admin_note":      input.AdminNote,
			"approved_at":     now,
		},
	}

	// Handle Reserve Fuel Inventory tracking
	if req.FuelSource == "reserve_fuel" {
		if req.ReserveAction == "draw" && !req.InventoryDeducted {
			if settings.ReserveFuelBalanceLiters < req.Liters {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":            fmt.Sprintf("Cannot approve draw request: insufficient fuel in yard tank. Available: %.1f L, Required: %.1f L.", settings.ReserveFuelBalanceLiters, req.Liters),
					"available_liters": settings.ReserveFuelBalanceLiters,
				})
				return
			}
			before := settings.ReserveFuelBalanceLiters
			after := before - req.Liters
			if after < 0 {
				after = 0
			}
			_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
				"$set": bson.M{"reserve_fuel_balance_liters": after, "updated_at": now},
			})
			update["$set"].(bson.M)["reserve_balance_before"] = before
			update["$set"].(bson.M)["reserve_balance_after"] = after
			update["$set"].(bson.M)["inventory_deducted"] = true
		} else if req.ReserveAction == "procure" && !req.InventoryAdded {
			before := settings.ReserveFuelBalanceLiters
			after := before + req.Liters
			_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
				"$set": bson.M{"reserve_fuel_balance_liters": after, "updated_at": now},
			})
			update["$set"].(bson.M)["reserve_balance_before"] = before
			update["$set"].(bson.M)["reserve_balance_after"] = after
			update["$set"].(bson.M)["inventory_added"] = true
		}
	}

	_, err = h.DB.FuelRequests.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve request"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")

	auditDetail := fmt.Sprintf("Approved: %.0f ETB, Note: %s", amountApproved, input.AdminNote)
	if req.FuelSource == "reserve_fuel" {
		if req.ReserveAction == "draw" {
			auditDetail = fmt.Sprintf("Approved draw of %.1f L from yard tank for truck %s", req.Liters, req.TruckPlate)
		} else {
			auditDetail = fmt.Sprintf("Approved procurement of %.1f L for yard tank (%.0f ETB)", req.Liters, amountApproved)
		}
	}

	h.LogAudit(ctx, userIDStr, userName, "Approved Fuel Request", "FuelRequest", req.ID.Hex(),
		fmt.Sprintf("Requested: %.0f ETB (%.1f L)", req.AmountRequested, req.Liters),
		auditDetail)

	h.CreateNotification(ctx, req.DriverID, "driver", fmt.Sprintf("Fuel Request %s Approved", req.RequestNumber),
		auditDetail, "fuel_approved")

	c.JSON(http.StatusOK, gin.H{
		"message": "Fuel request approved successfully",
		"status":  "approved",
	})
}

type RejectFuelInput struct {
	AdminNote string `json:"admin_note" binding:"required"`
}

func (h *FuelHandler) RejectFuelRequest(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	var input RejectFuelInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Rejection note is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var req models.FuelRequest
	if err := h.DB.FuelRequests.FindOne(ctx, bson.M{"_id": objID}).Decode(&req); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Fuel request not found"})
		return
	}

	update := bson.M{
		"$set": bson.M{
			"status":     "rejected",
			"admin_note": input.AdminNote,
		},
	}

	// Rollback inventory changes if this request previously deducted or added fuel
	if req.InventoryDeducted && req.Liters > 0 {
		_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
			"$inc": bson.M{"reserve_fuel_balance_liters": req.Liters},
		})
		update["$set"].(bson.M)["inventory_deducted"] = false
	}
	if req.InventoryAdded && req.Liters > 0 {
		_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
			"$inc": bson.M{"reserve_fuel_balance_liters": -req.Liters},
		})
		update["$set"].(bson.M)["inventory_added"] = false
	}

	_, err = h.DB.FuelRequests.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject request"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")

	h.LogAudit(ctx, userIDStr, userName, "Rejected Fuel Request", "FuelRequest", req.ID.Hex(),
		req.Status, fmt.Sprintf("Rejected: %s", input.AdminNote))

	h.CreateNotification(ctx, req.DriverID, "driver", fmt.Sprintf("Fuel Request %s Rejected", req.RequestNumber),
		fmt.Sprintf("Your fuel request was rejected. Reason: %s", input.AdminNote), "fuel_rejected")

	c.JSON(http.StatusOK, gin.H{"message": "Fuel request rejected"})
}

func (h *FuelHandler) MarkFuelPaid(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var req models.FuelRequest
	if err := h.DB.FuelRequests.FindOne(ctx, bson.M{"_id": objID}).Decode(&req); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Fuel request not found"})
		return
	}

	if req.Status == "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fuel request is already marked as paid"})
		return
	}

	now := time.Now()
	paidAmount := req.AmountApproved
	if paidAmount <= 0 {
		paidAmount = req.AmountRequested
	}

	// 1. Create linked Expense if it's a gas station or Step 1 procurement
	var expNumber string
	var linkedExpenseID string
	// If it's a Step 2 draw request, no cash disbursement is made (fuel pumped from internal stock)
	if req.FuelSource != "reserve_fuel" || req.ReserveAction == "procure" {
		if req.LinkedExpenseID != "" {
			linkedExpenseID = req.LinkedExpenseID
		} else {
			existingExpCount, _ := h.DB.Expenses.CountDocuments(ctx, bson.M{
				"$or": []bson.M{
					{"fuel_request_id": req.ID.Hex()},
					{"receipt_number": fmt.Sprintf("FUEL-%s", req.RequestNumber)},
				},
				"status": bson.M{"$ne": "cancelled"},
			})
			if existingExpCount > 0 {
				var existingExp models.Expense
				_ = h.DB.Expenses.FindOne(ctx, bson.M{
					"$or": []bson.M{
						{"fuel_request_id": req.ID.Hex()},
						{"receipt_number": fmt.Sprintf("FUEL-%s", req.RequestNumber)},
					},
					"status": bson.M{"$ne": "cancelled"},
				}).Decode(&existingExp)
				linkedExpenseID = existingExp.ID.Hex()
			} else {
				expNumber = h.GenerateNextNumber(ctx, "expenses", "EX")
				expense := models.Expense{
					ID:            bson.NewObjectID(),
					ExpenseNumber: expNumber,
					TruckID:       req.TruckID,
					TruckPlate:    req.TruckPlate,
					DriverID:      req.DriverID,
					DriverName:    req.DriverName,
					FuelRequestID: req.ID.Hex(),
					ExpenseType:   "fuel",
					Amount:        paidAmount,
					Date:          now,
					Description:   fmt.Sprintf("Fuel disbursed for %s (%s)", req.DriverName, req.Reason),
					ReceiptNumber: fmt.Sprintf("FUEL-%s", req.RequestNumber),
					ReceiptURL:    req.ReceiptURL,
					Status:        "active",
					CreatedAt:     now,
				}

				if _, err := h.DB.Expenses.InsertOne(ctx, expense); err == nil {
					linkedExpenseID = expense.ID.Hex()
				}
			}
		}
	}

	// 2. Update Fuel Request to paid
	update := bson.M{
		"$set": bson.M{
			"status":            "paid",
			"amount_approved":   paidAmount,
			"paid_at":           now,
			"linked_expense_id": linkedExpenseID,
		},
	}

	// 3. Ensure Reserve Fuel inventory is tracked if not already done during approval
	if req.FuelSource == "reserve_fuel" {
		var settings models.Settings
		_ = h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings)

		if req.ReserveAction == "draw" && !req.InventoryDeducted {
			before := settings.ReserveFuelBalanceLiters
			after := before - req.Liters
			if after < 0 {
				after = 0
			}
			_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
				"$set": bson.M{"reserve_fuel_balance_liters": after, "updated_at": now},
			})
			update["$set"].(bson.M)["reserve_balance_before"] = before
			update["$set"].(bson.M)["reserve_balance_after"] = after
			update["$set"].(bson.M)["inventory_deducted"] = true
		} else if req.ReserveAction == "procure" && !req.InventoryAdded {
			before := settings.ReserveFuelBalanceLiters
			after := before + req.Liters
			_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
				"$set": bson.M{"reserve_fuel_balance_liters": after, "updated_at": now},
			})
			update["$set"].(bson.M)["reserve_balance_before"] = before
			update["$set"].(bson.M)["reserve_balance_after"] = after
			update["$set"].(bson.M)["inventory_added"] = true
		}
	}
	_, _ = h.DB.FuelRequests.UpdateOne(ctx, bson.M{"_id": objID}, update)

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")

	h.LogAudit(ctx, userIDStr, userName, "Marked Fuel Request Paid", "FuelRequest", req.ID.Hex(),
		req.Status, fmt.Sprintf("Paid %.0f ETB, Created Expense %s", paidAmount, expNumber))

	h.CreateNotification(ctx, req.DriverID, "driver", fmt.Sprintf("Fuel Disbursed: %s", req.RequestNumber),
		fmt.Sprintf("Payment of %.0f ETB has been disbursed.", paidAmount), "fuel_approved")

	c.JSON(http.StatusOK, gin.H{
		"message":        "Fuel marked as paid and operational expense recorded",
		"expense_number": expNumber,
		"amount":         paidAmount,
	})
}

func (h *FuelHandler) UpdateFuelRequest(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	var input models.FuelRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid fuel request data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.FuelRequest
	if err := h.DB.FuelRequests.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Fuel request not found"})
		return
	}

	truckID := input.TruckID
	truckPlate := input.TruckPlate
	if truckID != "" && truckPlate == "" {
		if tID, err := bson.ObjectIDFromHex(truckID); err == nil {
			var trk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": tID}).Decode(&trk); err == nil {
				truckPlate = trk.PlateNumber
			}
		}
	} else if truckID == "" {
		truckID = existing.TruckID
		truckPlate = existing.TruckPlate
	}

	driverID := input.DriverID
	driverName := input.DriverName
	if driverID != "" && driverName == "" {
		if dID, err := bson.ObjectIDFromHex(driverID); err == nil {
			var drv models.Driver
			if err := h.DB.Drivers.FindOne(ctx, bson.M{"_id": dID}).Decode(&drv); err == nil {
				driverName = drv.FullName
			}
		}
	} else if driverID == "" {
		driverID = existing.DriverID
		driverName = existing.DriverName
	}

	status := input.Status
	if status == "" {
		status = existing.Status
	}

	amountRequested := input.AmountRequested
	if amountRequested <= 0 {
		amountRequested = existing.AmountRequested
	}

	amountApproved := input.AmountApproved
	if (status == "approved" || status == "paid") && amountApproved <= 0 {
		amountApproved = amountRequested
	}

	reqTime := existing.RequestedAt
	if !input.RequestedAt.IsZero() {
		reqTime = input.RequestedAt
	}

	updateFields := bson.M{
		"amount_requested": amountRequested,
		"amount_approved":  amountApproved,
		"reason":           input.Reason,
		"fuel_station":     input.FuelStation,
		"fuel_source":      input.FuelSource,
		"odometer_reading": input.OdometerReading,
		"liters":          input.Liters,
		"price_per_liter":  input.PricePerLiter,
		"status":           status,
		"notes":            input.Notes,
		"admin_note":       input.AdminNote,
		"truck_id":         truckID,
		"truck_plate":      truckPlate,
		"driver_id":        driverID,
		"driver_name":      driverName,
		"requested_at":     reqTime,
	}

	// If status changed to paid, handle linked expense
	if status == "paid" && existing.LinkedExpenseID == "" {
		expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
		expense := models.Expense{
			ID:            bson.NewObjectID(),
			ExpenseNumber: expNumber,
			TruckID:       truckID,
			TruckPlate:    truckPlate,
			DriverID:      driverID,
			DriverName:    driverName,
			FuelRequestID: existing.ID.Hex(),
			ExpenseType:   "fuel",
			Amount:        amountApproved,
			Date:          reqTime,
			Description:   fmt.Sprintf("Fuel disbursed for %s (%s)", driverName, input.Reason),
			ReceiptNumber: fmt.Sprintf("FUEL-%s", existing.RequestNumber),
			Status:        "active",
			CreatedAt:     time.Now(),
		}
		if _, err := h.DB.Expenses.InsertOne(ctx, expense); err == nil {
			updateFields["linked_expense_id"] = expense.ID.Hex()
			now := time.Now()
			updateFields["paid_at"] = &now
			updateFields["approved_at"] = &now
		}
	} else if existing.LinkedExpenseID != "" {
		if expObjID, err := bson.ObjectIDFromHex(existing.LinkedExpenseID); err == nil {
			_, _ = h.DB.Expenses.UpdateOne(ctx, bson.M{"_id": expObjID}, bson.M{
				"$set": bson.M{
					"amount":      amountApproved,
					"truck_id":    truckID,
					"truck_plate": truckPlate,
					"driver_id":   driverID,
					"driver_name": driverName,
					"date":        reqTime,
				},
			})
		}
	}

	_, err = h.DB.FuelRequests.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update fuel request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Fuel request updated successfully"})
}

func (h *FuelHandler) DeleteFuelRequest(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var req models.FuelRequest
	if err := h.DB.FuelRequests.FindOne(ctx, bson.M{"_id": objID}).Decode(&req); err == nil {
		if req.InventoryDeducted && req.Liters > 0 {
			_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
				"$inc": bson.M{"reserve_fuel_balance_liters": req.Liters},
			})
		}
		if req.InventoryAdded && req.Liters > 0 {
			_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
				"$inc": bson.M{"reserve_fuel_balance_liters": -req.Liters},
			})
		}
	}

	_, err = h.DB.FuelRequests.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete fuel request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Fuel request deleted"})
}

func (h *FuelHandler) GetReserveInventory(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var settings models.Settings
	_ = h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings)

	balance := settings.ReserveFuelBalanceLiters
	capacity := settings.ReserveFuelCapacityLiters
	if capacity <= 0 {
		capacity = 10000.0
	}
	lowThreshold := settings.ReserveFuelLowThreshold
	if lowThreshold <= 0 {
		lowThreshold = 1500.0
	}

	percentage := 0.0
	if capacity > 0 {
		percentage = (balance / capacity) * 100.0
		if percentage > 100.0 {
			percentage = 100.0
		} else if percentage < 0.0 {
			percentage = 0.0
		}
	}

	status := "healthy"
	if balance <= 0 {
		status = "empty"
	} else if balance <= lowThreshold {
		status = "low"
	}

	// Fetch recent Step 1 procurements
	procureOpts := options.Find().SetSort(bson.D{{Key: "requested_at", Value: -1}}).SetLimit(5)
	pCursor, err := h.DB.FuelRequests.Find(ctx, bson.M{
		"fuel_source":    "reserve_fuel",
		"reserve_action": "procure",
	}, procureOpts)
	recentProcures := make([]models.FuelRequest, 0)
	if err == nil {
		_ = pCursor.All(ctx, &recentProcures)
	}

	// Fetch recent Step 2 draws
	drawOpts := options.Find().SetSort(bson.D{{Key: "requested_at", Value: -1}}).SetLimit(5)
	dCursor, err := h.DB.FuelRequests.Find(ctx, bson.M{
		"fuel_source":    "reserve_fuel",
		"reserve_action": "draw",
	}, drawOpts)
	recentDraws := make([]models.FuelRequest, 0)
	if err == nil {
		_ = dCursor.All(ctx, &recentDraws)
	}

	c.JSON(http.StatusOK, gin.H{
		"balance_liters":       balance,
		"capacity_liters":      capacity,
		"low_threshold_liters": lowThreshold,
		"percentage":           percentage,
		"status":               status,
		"recent_procurements":  recentProcures,
		"recent_draws":         recentDraws,
	})
}

