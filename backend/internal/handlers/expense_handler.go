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

type ExpenseHandler struct {
	BaseHandler
}

func NewExpenseHandler(base BaseHandler) *ExpenseHandler {
	return &ExpenseHandler{BaseHandler: base}
}

type CreateExpenseInput struct {
	TruckID       string  `json:"truck_id"`
	TruckPlate    string  `json:"truck_plate"`
	DriverID      string  `json:"driver_id"`
	DriverName    string  `json:"driver_name"`
	ExpenseType   string  `json:"expense_type" binding:"required"`
	Amount        float64 `json:"amount" binding:"required"`
	Date          string  `json:"date"`
	Description   string  `json:"description" binding:"required"`
	ReceiptNumber string  `json:"receipt_number"`
	ReceiptURL    string  `json:"receipt_url"`
}

func (h *ExpenseHandler) CreateExpense(c *gin.Context) {
	var input CreateExpenseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide required expense details: " + err.Error()})
		return
	}

	if input.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Amount must be greater than zero"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	expDate := time.Now()
	if input.Date != "" {
		if t, err := time.Parse("2006-01-02", input.Date); err == nil {
			expDate = t
		}
	}

	if input.TruckID == "" {
		input.TruckID = "fleet"
	}
	if input.TruckPlate == "" {
		input.TruckPlate = "All Fleet / Overhead"
	}

	expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")

	expense := models.Expense{
		ID:            bson.NewObjectID(),
		ExpenseNumber: expNumber,
		TruckID:       input.TruckID,
		TruckPlate:    input.TruckPlate,
		DriverID:      input.DriverID,
		DriverName:    input.DriverName,
		ExpenseType:   input.ExpenseType,
		Amount:        input.Amount,
		Date:          expDate,
		Description:   input.Description,
		ReceiptNumber: input.ReceiptNumber,
		ReceiptURL:    input.ReceiptURL,
		Status:        "active",
		CreatedAt:     time.Now(),
	}

	_, err := h.DB.Expenses.InsertOne(ctx, expense)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create expense"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")

	h.LogAudit(ctx, userIDStr, userName, "Recorded Expense", "Expense", expense.ID.Hex(), "",
		fmt.Sprintf("Expense %s: %.0f ETB (%s - %s)", expNumber, input.Amount, input.ExpenseType, input.Description))

	c.JSON(http.StatusCreated, expense)
}

func (h *ExpenseHandler) GetExpenses(c *gin.Context) {
	filter := bson.M{}

	if expenseType := c.Query("expense_type"); expenseType != "" {
		filter["expense_type"] = expenseType
	}
	if truckID := c.Query("truck_id"); truckID != "" {
		filter["truck_id"] = truckID
	}
	if driverID := c.Query("driver_id"); driverID != "" {
		filter["driver_id"] = driverID
	}
	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Automatically check and execute any due recurring EIC monthly deduction
	_, _ = h.CheckAndExecuteEICDeduction(ctx)

	findOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	cursor, err := h.DB.Expenses.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch expenses"})
		return
	}
	defer cursor.Close(ctx)

	expenses := make([]models.Expense, 0)
	if err := cursor.All(ctx, &expenses); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode expenses"})
		return
	}

	c.JSON(http.StatusOK, expenses)
}

type CancelExpenseInput struct {
	Reason string `json:"reason" binding:"required"`
}

func (h *ExpenseHandler) CancelExpense(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	var input CancelExpenseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reason is required to void expense"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var exp models.Expense
	if err := h.DB.Expenses.FindOne(ctx, bson.M{"_id": objID}).Decode(&exp); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
		return
	}

	if exp.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Expense is already cancelled"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")

	update := bson.M{
		"$set": bson.M{
			"status":        "cancelled",
			"cancel_reason": input.Reason,
			"cancelled_by":  userName,
		},
	}

	_, err = h.DB.Expenses.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel expense"})
		return
	}

	if exp.TripID != "" {
		h.syncTripExpenses(ctx, exp.TripID)
	}

	h.LogAudit(ctx, userIDStr, userName, "Cancelled Expense", "Expense", exp.ID.Hex(),
		exp.Status, fmt.Sprintf("Cancelled: %s", input.Reason))

	c.JSON(http.StatusOK, gin.H{"message": "Expense cancelled and preserved in financial audit trail"})
}

func (h *ExpenseHandler) UpdateExpense(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	var input models.Expense
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.Expense
	if err := h.DB.Expenses.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
		return
	}

	tripID := input.TripID
	if tripID == "" {
		tripID = existing.TripID
	}
	tripNumber := input.TripNumber
	if tripNumber == "" {
		tripNumber = existing.TripNumber
	}

	update := bson.M{
		"$set": bson.M{
			"truck_id":       input.TruckID,
			"truck_plate":    input.TruckPlate,
			"driver_id":      input.DriverID,
			"driver_name":    input.DriverName,
			"expense_type":   input.ExpenseType,
			"amount":         input.Amount,
			"description":    input.Description,
			"receipt_number": input.ReceiptNumber,
			"trip_id":        tripID,
			"trip_number":    tripNumber,
			"status":         input.Status,
		},
	}

	_, err = h.DB.Expenses.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update expense"})
		return
	}

	if tripID != "" {
		h.syncTripExpenses(ctx, tripID)
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Updated Expense", "Expense", id, "",
		fmt.Sprintf("Expense %s updated: %.0f ETB (%s)", existing.ExpenseNumber, input.Amount, input.Description))

	c.JSON(http.StatusOK, gin.H{"message": "Expense updated successfully"})
}

func (h *ExpenseHandler) DeleteExpense(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var exp models.Expense
	if err := h.DB.Expenses.FindOne(ctx, bson.M{"_id": objID}).Decode(&exp); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
		return
	}

	_, err = h.DB.Expenses.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete expense"})
		return
	}

	if exp.TripID != "" {
		h.syncTripExpenses(ctx, exp.TripID)
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Deleted Expense", "Expense", id, exp.ExpenseNumber, "Permanently removed expense record")

	c.JSON(http.StatusOK, gin.H{"message": "Expense permanently deleted"})
}

func (h *ExpenseHandler) syncTripExpenses(ctx context.Context, tripIDStr string) {
	if tripIDStr == "" {
		return
	}
	tripObjID, err := bson.ObjectIDFromHex(tripIDStr)
	if err != nil {
		return
	}

	var trip models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": tripObjID}).Decode(&trip); err != nil {
		return
	}

	cursor, err := h.DB.Expenses.Find(ctx, bson.M{"trip_id": tripIDStr, "status": "active"})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var linkedExpenses []models.Expense
	_ = cursor.All(ctx, &linkedExpenses)

	var totalFees float64
	updatedFees := make([]models.TripFee, 0)
	for _, e := range linkedExpenses {
		totalFees += e.Amount
		updatedFees = append(updatedFees, models.TripFee{
			FeeType:     e.ExpenseType,
			Amount:      e.Amount,
			Description: e.Description,
		})
	}

	gross := trip.GrossRevenue
	if gross <= 0 {
		if trip.IsSplitDrop {
			gross = trip.TransitRevenue + trip.DestinationRevenue
			if gross <= 0 && trip.LumpSum > 0 {
				gross = trip.LumpSum
			}
		} else if trip.PricingMethod == "lump_sum" {
			gross = trip.LumpSum
		} else if trip.Quantity > 0 && trip.UnitPrice > 0 {
			gross = trip.Quantity * trip.UnitPrice
		} else {
			gross = trip.TotalRevenue + trip.TotalAdditionalFees
		}
	}

	netRevenue := gross - totalFees

	_, _ = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": tripObjID}, bson.M{
		"$set": bson.M{
			"gross_revenue":         gross,
			"total_additional_fees": totalFees,
			"total_revenue":         netRevenue,
			"net_revenue":           netRevenue,
			"additional_fees":       updatedFees,
			"updated_at":            time.Now(),
		},
	})
}

// CheckAndExecuteEICDeduction checks if current month's EIC payment is due and executes deduction automatically
func (h *ExpenseHandler) CheckAndExecuteEICDeduction(ctx context.Context) (*models.Expense, error) {
	var settings models.Settings
	err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings)
	if err != nil {
		return nil, err
	}

	if settings.EICRecurring == nil {
		defaultConfig := models.EICRecurringConfig{
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
		}
		settings.EICRecurring = &defaultConfig
		_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": bson.M{"eic_recurring": defaultConfig}})
	}

	eic := settings.EICRecurring
	if !eic.Enabled || eic.Status != "active" {
		return nil, nil
	}

	now := time.Now()
	currentMonthStr := now.Format("2006-01") // e.g. "2026-10"

	// Only deduct if we have reached or passed deduction day of current month
	if now.Day() < eic.DeductionDay {
		return nil, nil
	}

	// Check if already deducted for this month
	if eic.LastDeductedMonth == currentMonthStr {
		return nil, nil
	}

	// Check if already reached total months
	if eic.PaidMonths >= eic.TotalMonths && eic.TotalMonths > 0 {
		_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": bson.M{"eic_recurring.status": "completed"}})
		return nil, nil
	}

	// Check if an expense with receipt number EIC-AUTO-{currentMonthStr} already exists
	count, _ := h.DB.Expenses.CountDocuments(ctx, bson.M{
		"receipt_number": fmt.Sprintf("EIC-AUTO-%s", currentMonthStr),
		"status":         bson.M{"$ne": "cancelled"},
	})
	if count > 0 {
		eic.LastDeductedMonth = currentMonthStr
		_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": bson.M{
			"eic_recurring.last_deducted_month": currentMonthStr,
		}})
		return nil, nil
	}

	// Create and insert the auto-deducted expense
	expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
	deductDate := time.Date(now.Year(), now.Month(), 1, 8, 0, 0, 0, now.Location())
	newPaidMonths := eic.PaidMonths + 1

	expense := models.Expense{
		ID:            bson.NewObjectID(),
		ExpenseNumber: expNumber,
		TruckID:       "fleet",
		TruckPlate:    "All Fleet (Comprehensive Insurance)",
		DriverID:      "eic_corp",
		DriverName:    "Ethiopian Insurance Corporation (EIC)",
		ExpenseType:   "insurance",
		Amount:        eic.MonthlyAmount,
		Date:          deductDate,
		Description:   fmt.Sprintf("EIC Monthly Fleet Insurance Premium - Month %d of %d (Auto-deducted)", newPaidMonths, eic.TotalMonths),
		ReceiptNumber: fmt.Sprintf("EIC-AUTO-%s", currentMonthStr),
		Status:        "active",
		CreatedAt:     now,
	}

	_, err = h.DB.Expenses.InsertOne(ctx, expense)
	if err != nil {
		return nil, err
	}

	// Update settings
	updateFields := bson.M{
		"eic_recurring.paid_months":         newPaidMonths,
		"eic_recurring.last_deducted_month": currentMonthStr,
		"eic_recurring.last_deducted_at":    now,
	}
	if newPaidMonths >= eic.TotalMonths {
		updateFields["eic_recurring.status"] = "completed"
	}

	_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": updateFields})

	// Log audit and notification
	h.LogAudit(ctx, "system", "System Scheduler", "Auto-Deducted Recurring Expense", "Expense", expense.ID.Hex(), "",
		fmt.Sprintf("Auto-deducted EIC Monthly Insurance: %.0f ETB for %s (Month %d/%d)", eic.MonthlyAmount, currentMonthStr, newPaidMonths, eic.TotalMonths))

	notif := models.Notification{
		ID:         bson.NewObjectID(),
		TargetRole: string(models.RoleAdmin),
		Title:      "EIC Insurance Auto-Deducted",
		Message:    fmt.Sprintf("Monthly premium of %.0f ETB has been automatically deducted for %s (Month %d of %d).", eic.MonthlyAmount, currentMonthStr, newPaidMonths, eic.TotalMonths),
		Type:       "expense",
		IsRead:     false,
		CreatedAt:  now,
	}
	_, _ = h.DB.Notifications.InsertOne(ctx, notif)

	return &expense, nil
}

// GetEICRecurring returns the EIC auto-deduction schedule and status
func (h *ExpenseHandler) GetEICRecurring(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Run auto-deduction check first
	_, _ = h.CheckAndExecuteEICDeduction(ctx)

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
		return
	}

	eic := settings.EICRecurring
	if eic == nil {
		eic = &models.EICRecurringConfig{
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
		}
	}

	// Fetch all EIC expenses
	cur, _ := h.DB.Expenses.Find(ctx, bson.M{
		"$or": []bson.M{
			{"expense_type": "insurance"},
			{"receipt_number": bson.M{"$regex": "^EIC-"}},
		},
	}, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}))

	var eicExpenses []models.Expense
	if cur != nil {
		_ = cur.All(ctx, &eicExpenses)
		cur.Close(ctx)
	}

	remainingMonths := eic.TotalMonths - eic.PaidMonths
	if remainingMonths < 0 {
		remainingMonths = 0
	}
	totalContractValue := eic.MonthlyAmount * float64(eic.TotalMonths)
	totalPaid := eic.MonthlyAmount * float64(eic.PaidMonths)
	remainingBalance := totalContractValue - totalPaid

	now := time.Now()
	currentMonthStr := now.Format("2006-01")
	deductedThisMonth := (eic.LastDeductedMonth == currentMonthStr)

	// Next deduction date
	nextMonth := now
	if deductedThisMonth {
		nextMonth = now.AddDate(0, 1, 0)
	}
	nextDeductionDate := fmt.Sprintf("%04d-%02d-%02d", nextMonth.Year(), nextMonth.Month(), eic.DeductionDay)

	c.JSON(http.StatusOK, gin.H{
		"config":               eic,
		"paid_months":          eic.PaidMonths,
		"total_months":         eic.TotalMonths,
		"remaining_months":     remainingMonths,
		"monthly_amount":       eic.MonthlyAmount,
		"total_contract_value": totalContractValue,
		"total_paid_so_far":    totalPaid,
		"remaining_balance":    remainingBalance,
		"deducted_this_month":  deductedThisMonth,
		"next_deduction_date":  nextDeductionDate,
		"history":              eicExpenses,
	})
}

// UpdateEICRecurring updates the EIC configuration
func (h *ExpenseHandler) UpdateEICRecurring(c *gin.Context) {
	var input models.EICRecurringConfig
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid EIC config: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if input.MonthlyAmount <= 0 {
		input.MonthlyAmount = 150000
	}
	if input.TotalMonths <= 0 {
		input.TotalMonths = 24
	}
	if input.DeductionDay <= 0 || input.DeductionDay > 28 {
		input.DeductionDay = 1
	}
	if input.Status == "" {
		input.Status = "active"
	}
	if input.Description == "" {
		input.Description = "EIC (Ethiopian Insurance Corporation) Monthly Fleet Insurance Premium"
	}

	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
		"$set": bson.M{
			"eic_recurring.enabled":        input.Enabled,
			"eic_recurring.monthly_amount": input.MonthlyAmount,
			"eic_recurring.total_months":   input.TotalMonths,
			"eic_recurring.deduction_day":  input.DeductionDay,
			"eic_recurring.start_date":     input.StartDate,
			"eic_recurring.end_date":       input.EndDate,
			"eic_recurring.status":         input.Status,
			"eic_recurring.description":    input.Description,
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update EIC configuration"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "EIC recurring auto-payment configuration updated successfully",
		"config":  input,
	})
}

// ToggleEICRecurring toggles active / paused
func (h *ExpenseHandler) ToggleEICRecurring(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings not found"})
		return
	}

	newStatus := "paused"
	newEnabled := false
	if settings.EICRecurring == nil || settings.EICRecurring.Status != "active" {
		newStatus = "active"
		newEnabled = true
	}

	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{}, bson.M{
		"$set": bson.M{
			"eic_recurring.status":  newStatus,
			"eic_recurring.enabled": newEnabled,
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  newStatus,
		"enabled": newEnabled,
		"message": fmt.Sprintf("EIC auto-payment schedule is now %s", newStatus),
	})
}

// DeductEICNow manually forces or executes the EIC deduction for the current month
func (h *ExpenseHandler) DeductEICNow(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings not found"})
		return
	}

	eic := settings.EICRecurring
	if eic == nil {
		eic = &models.EICRecurringConfig{
			Enabled:       true,
			MonthlyAmount: 150000,
			TotalMonths:   24,
			PaidMonths:    0,
			Status:        "active",
		}
	}

	now := time.Now()
	currentMonthStr := now.Format("2006-01")

	// Create expense
	expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
	newPaidMonths := eic.PaidMonths + 1

	expense := models.Expense{
		ID:            bson.NewObjectID(),
		ExpenseNumber: expNumber,
		TruckID:       "fleet",
		TruckPlate:    "All Fleet (Comprehensive Insurance)",
		DriverID:      "eic_corp",
		DriverName:    "Ethiopian Insurance Corporation (EIC)",
		ExpenseType:   "insurance",
		Amount:        eic.MonthlyAmount,
		Date:          now,
		Description:   fmt.Sprintf("EIC Monthly Fleet Insurance Premium - Month %d of %d (Manual / On-Demand Deduction)", newPaidMonths, eic.TotalMonths),
		ReceiptNumber: fmt.Sprintf("EIC-MANUAL-%s", currentMonthStr),
		Status:        "active",
		CreatedAt:     now,
	}

	_, err := h.DB.Expenses.InsertOne(ctx, expense)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert expense: " + err.Error()})
		return
	}

	updateFields := bson.M{
		"eic_recurring.paid_months":         newPaidMonths,
		"eic_recurring.last_deducted_month": currentMonthStr,
		"eic_recurring.last_deducted_at":    now,
	}
	if newPaidMonths >= eic.TotalMonths {
		updateFields["eic_recurring.status"] = "completed"
	}

	_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": updateFields})

	c.JSON(http.StatusOK, gin.H{
		"message":     fmt.Sprintf("Successfully recorded EIC deduction of %.0f ETB for %s", eic.MonthlyAmount, currentMonthStr),
		"expense":     expense,
		"paid_months": newPaidMonths,
	})
}

