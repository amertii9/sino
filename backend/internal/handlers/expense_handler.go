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

	// Automatically check and execute any due recurring monthly deductions (EIC & other recurring expenses)
	_, _ = h.CheckAndExecuteAllRecurringDeductions(ctx)

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

// ensureRecurringExpenses guarantees that settings.RecurringExpenses is populated, migrating EIC config if needed
func (h *ExpenseHandler) ensureRecurringExpenses(ctx context.Context, settings *models.Settings) []models.RecurringExpense {
	if len(settings.RecurringExpenses) > 0 {
		return settings.RecurringExpenses
	}

	subDesc := "Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports."
	monthlyAmount := 150000.0
	totalMonths := 24
	paidMonths := 0
	deductionDay := 1
	status := "active"
	enabled := true
	startDate := "2026-10-01"
	endDate := "2028-10-01"
	lastDeductedMonth := ""
	var lastDeductedAt *time.Time

	if settings.EICRecurring != nil {
		if settings.EICRecurring.MonthlyAmount > 0 {
			monthlyAmount = settings.EICRecurring.MonthlyAmount
		}
		if settings.EICRecurring.TotalMonths > 0 {
			totalMonths = settings.EICRecurring.TotalMonths
		}
		paidMonths = settings.EICRecurring.PaidMonths
		if settings.EICRecurring.DeductionDay > 0 {
			deductionDay = settings.EICRecurring.DeductionDay
		}
		if settings.EICRecurring.Status != "" {
			status = settings.EICRecurring.Status
		}
		enabled = settings.EICRecurring.Enabled
		if settings.EICRecurring.StartDate != "" {
			startDate = settings.EICRecurring.StartDate
		}
		if settings.EICRecurring.EndDate != "" {
			endDate = settings.EICRecurring.EndDate
		}
		lastDeductedMonth = settings.EICRecurring.LastDeductedMonth
		lastDeductedAt = settings.EICRecurring.LastDeductedAt
	}

	eicItem := models.RecurringExpense{
		ID:                "eic_insurance",
		Title:             "Ethiopian Insurance Corporation (EIC)",
		Category:          "insurance",
		SubDescription:    subDesc,
		Enabled:           enabled,
		MonthlyAmount:     monthlyAmount,
		TotalMonths:       totalMonths,
		PaidMonths:        paidMonths,
		StartDate:         startDate,
		EndDate:           endDate,
		DeductionDay:      deductionDay,
		LastDeductedMonth: lastDeductedMonth,
		LastDeductedAt:    lastDeductedAt,
		Status:            status,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	settings.RecurringExpenses = []models.RecurringExpense{eicItem}
	_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": bson.M{"recurring_expenses": settings.RecurringExpenses}})
	return settings.RecurringExpenses
}

// CheckAndExecuteAllRecurringDeductions checks if any recurring monthly deduction is due and executes it
func (h *ExpenseHandler) CheckAndExecuteAllRecurringDeductions(ctx context.Context) ([]models.Expense, error) {
	var settings models.Settings
	err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings)
	if err != nil {
		return nil, err
	}

	items := h.ensureRecurringExpenses(ctx, &settings)
	now := time.Now()
	currentMonthStr := now.Format("2006-01") // e.g. "2026-10"

	var executedExpenses []models.Expense
	modified := false

	for i := range items {
		item := &items[i]
		if !item.Enabled || item.Status != "active" {
			continue
		}

		if item.TotalMonths > 0 && item.PaidMonths >= item.TotalMonths {
			item.Status = "completed"
			modified = true
			continue
		}

		if now.Day() < item.DeductionDay {
			continue
		}

		if item.LastDeductedMonth == currentMonthStr {
			continue
		}

		// Check if an expense with receipt number REC-AUTO-{item.ID}-{currentMonthStr} or EIC-AUTO-{currentMonthStr} already exists
		var receiptFilter bson.M
		if item.ID == "eic_insurance" {
			receiptFilter = bson.M{
				"$or": []bson.M{
					{"receipt_number": fmt.Sprintf("EIC-AUTO-%s", currentMonthStr)},
					{"receipt_number": fmt.Sprintf("REC-AUTO-%s-%s", item.ID, currentMonthStr)},
				},
				"status": bson.M{"$ne": "cancelled"},
			}
		} else {
			receiptFilter = bson.M{
				"receipt_number": fmt.Sprintf("REC-AUTO-%s-%s", item.ID, currentMonthStr),
				"status":         bson.M{"$ne": "cancelled"},
			}
		}

		count, _ := h.DB.Expenses.CountDocuments(ctx, receiptFilter)
		if count > 0 {
			item.LastDeductedMonth = currentMonthStr
			modified = true
			continue
		}

		// Create auto-deducted expense
		expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
		deductDate := time.Date(now.Year(), now.Month(), item.DeductionDay, 8, 0, 0, 0, now.Location())
		newPaidMonths := item.PaidMonths + 1

		receiptNum := fmt.Sprintf("REC-AUTO-%s-%s", item.ID, currentMonthStr)
		if item.ID == "eic_insurance" {
			receiptNum = fmt.Sprintf("EIC-AUTO-%s", currentMonthStr)
		}

		desc := fmt.Sprintf("%s - Monthly Auto-Deduction (%s)", item.Title, currentMonthStr)
		if item.TotalMonths > 0 {
			desc = fmt.Sprintf("%s - Month %d of %d (Auto-deducted)", item.Title, newPaidMonths, item.TotalMonths)
		}

		expenseType := item.Category
		if expenseType == "" {
			expenseType = "other"
		}

		driverName := item.Title
		truckPlate := "All Fleet / Recurring Overhead"
		if item.ID == "eic_insurance" {
			truckPlate = "All Fleet (Comprehensive Insurance)"
			driverName = "Ethiopian Insurance Corporation (EIC)"
		}

		expense := models.Expense{
			ID:            bson.NewObjectID(),
			ExpenseNumber: expNumber,
			TruckID:       "fleet",
			TruckPlate:    truckPlate,
			DriverID:      "overhead",
			DriverName:    driverName,
			ExpenseType:   expenseType,
			Amount:        item.MonthlyAmount,
			Date:          deductDate,
			Description:   desc,
			ReceiptNumber: receiptNum,
			Status:        "active",
			CreatedAt:     now,
		}

		_, err = h.DB.Expenses.InsertOne(ctx, expense)
		if err != nil {
			continue
		}

		item.PaidMonths = newPaidMonths
		item.LastDeductedMonth = currentMonthStr
		item.LastDeductedAt = &now
		item.UpdatedAt = now
		if item.TotalMonths > 0 && item.PaidMonths >= item.TotalMonths {
			item.Status = "completed"
		}

		modified = true
		executedExpenses = append(executedExpenses, expense)

		h.LogAudit(ctx, "system", "System Scheduler", "Auto-Deducted Recurring Expense", "Expense", expense.ID.Hex(), "",
			fmt.Sprintf("Auto-deducted %s: %.0f ETB for %s", item.Title, item.MonthlyAmount, currentMonthStr))

		notif := models.Notification{
			ID:         bson.NewObjectID(),
			TargetRole: string(models.RoleAdmin),
			Title:      fmt.Sprintf("%s Auto-Deducted", item.Title),
			Message:    fmt.Sprintf("Monthly recurring expense of %.0f ETB automatically deducted for %s.", item.MonthlyAmount, currentMonthStr),
			Type:       "expense",
			IsRead:     false,
			CreatedAt:  now,
		}
		_, _ = h.DB.Notifications.InsertOne(ctx, notif)
	}

	if modified {
		updateDoc := bson.M{
			"recurring_expenses": items,
		}
		for _, it := range items {
			if it.ID == "eic_insurance" && settings.EICRecurring != nil {
				updateDoc["eic_recurring.paid_months"] = it.PaidMonths
				updateDoc["eic_recurring.last_deducted_month"] = it.LastDeductedMonth
				updateDoc["eic_recurring.last_deducted_at"] = it.LastDeductedAt
				updateDoc["eic_recurring.status"] = it.Status
				break
			}
		}
		_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": updateDoc})
	}

	return executedExpenses, nil
}

// CheckAndExecuteEICDeduction maintains backward compatibility with legacy caller
func (h *ExpenseHandler) CheckAndExecuteEICDeduction(ctx context.Context) (*models.Expense, error) {
	expenses, err := h.CheckAndExecuteAllRecurringDeductions(ctx)
	if err != nil {
		return nil, err
	}
	for _, exp := range expenses {
		if exp.DriverName == "Ethiopian Insurance Corporation (EIC)" || (len(exp.ReceiptNumber) >= 4 && exp.ReceiptNumber[:4] == "EIC-") {
			return &exp, nil
		}
	}
	return nil, nil
}

type RecurringExpenseDetail struct {
	models.RecurringExpense `bson:",inline" json:",inline"`
	RemainingMonths          int              `json:"remaining_months"`
	TotalContractValue       float64          `json:"total_contract_value"`
	TotalPaidSoFar           float64          `json:"total_paid_so_far"`
	RemainingBalance         float64          `json:"remaining_balance"`
	DeductedThisMonth        bool             `json:"deducted_this_month"`
	NextDeductionDate        string           `json:"next_deduction_date"`
	History                  []models.Expense `json:"history"`
}

// GetRecurringExpenses returns all recurring expense schedules and their status
func (h *ExpenseHandler) GetRecurringExpenses(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, _ = h.CheckAndExecuteAllRecurringDeductions(ctx)

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
		return
	}

	items := h.ensureRecurringExpenses(ctx, &settings)
	now := time.Now()
	currentMonthStr := now.Format("2006-01")

	details := make([]RecurringExpenseDetail, 0, len(items))

	for _, item := range items {
		remMonths := 0
		if item.TotalMonths > 0 {
			remMonths = item.TotalMonths - item.PaidMonths
			if remMonths < 0 {
				remMonths = 0
			}
		}
		totalContractVal := 0.0
		if item.TotalMonths > 0 {
			totalContractVal = item.MonthlyAmount * float64(item.TotalMonths)
		}
		totalPaid := item.MonthlyAmount * float64(item.PaidMonths)
		remBalance := 0.0
		if item.TotalMonths > 0 {
			remBalance = totalContractVal - totalPaid
			if remBalance < 0 {
				remBalance = 0
			}
		}

		deductedThisMonth := (item.LastDeductedMonth == currentMonthStr)

		// Next deduction date
		nextMonth := now
		if deductedThisMonth {
			nextMonth = now.AddDate(0, 1, 0)
		}
		day := item.DeductionDay
		if day <= 0 || day > 28 {
			day = 1
		}
		nextDeductionDate := fmt.Sprintf("%04d-%02d-%02d", nextMonth.Year(), nextMonth.Month(), day)

		// Find history for this item
		var histFilter bson.M
		if item.ID == "eic_insurance" {
			histFilter = bson.M{
				"$or": []bson.M{
					{"expense_type": "insurance"},
					{"receipt_number": bson.M{"$regex": "^EIC-"}},
					{"receipt_number": bson.M{"$regex": "^REC-.*eic"}},
				},
			}
		} else {
			histFilter = bson.M{
				"$or": []bson.M{
					{"receipt_number": bson.M{"$regex": fmt.Sprintf("^REC-(AUTO|MANUAL)-%s", item.ID)}},
					{"description": bson.M{"$regex": item.Title, "$options": "i"}},
				},
			}
		}

		cur, _ := h.DB.Expenses.Find(ctx, histFilter, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}).SetLimit(24))
		var history []models.Expense
		if cur != nil {
			_ = cur.All(ctx, &history)
			cur.Close(ctx)
		}
		if history == nil {
			history = []models.Expense{}
		}

		details = append(details, RecurringExpenseDetail{
			RecurringExpense:   item,
			RemainingMonths:    remMonths,
			TotalContractValue: totalContractVal,
			TotalPaidSoFar:     totalPaid,
			RemainingBalance:   remBalance,
			DeductedThisMonth:  deductedThisMonth,
			NextDeductionDate:  nextDeductionDate,
			History:            history,
		})
	}

	c.JSON(http.StatusOK, details)
}

type CreateRecurringExpenseInput struct {
	Title          string  `json:"title" binding:"required"`
	Category       string  `json:"category"`
	SubDescription string  `json:"sub_description"`
	MonthlyAmount  float64 `json:"monthly_amount" binding:"required"`
	TotalMonths    int     `json:"total_months"` // 0 = indefinite/ongoing
	DeductionDay   int     `json:"deduction_day"`
	StartDate      string  `json:"start_date"`
	EndDate        string  `json:"end_date"`
	Status         string  `json:"status"` // "active" or "paused"
}

// CreateRecurringExpense allows the admin to register another monthly recurring expense
func (h *ExpenseHandler) CreateRecurringExpense(c *gin.Context) {
	var input CreateRecurringExpenseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide valid recurring expense details: " + err.Error()})
		return
	}

	if input.MonthlyAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Monthly amount must be greater than zero"})
		return
	}

	if input.DeductionDay <= 0 || input.DeductionDay > 28 {
		input.DeductionDay = 1
	}

	if input.Category == "" {
		input.Category = "other"
	}

	if input.Status == "" {
		input.Status = "active"
	}

	now := time.Now()
	if input.StartDate == "" {
		input.StartDate = now.Format("2006-01-02")
	}

	if input.SubDescription == "" {
		if input.TotalMonths > 0 {
			input.SubDescription = fmt.Sprintf("Automatic monthly deduction on day %d of the month for %d months. Debited into operational expenses and financial reports.", input.DeductionDay, input.TotalMonths)
		} else {
			input.SubDescription = fmt.Sprintf("Automatic monthly deduction on day %d of the month (ongoing). Debited into operational expenses and financial reports.", input.DeductionDay)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings not found"})
		return
	}

	items := h.ensureRecurringExpenses(ctx, &settings)

	newID := fmt.Sprintf("rec_%d", now.UnixNano())
	newItem := models.RecurringExpense{
		ID:                newID,
		Title:             input.Title,
		Category:          input.Category,
		SubDescription:    input.SubDescription,
		Enabled:           input.Status == "active",
		MonthlyAmount:     input.MonthlyAmount,
		TotalMonths:       input.TotalMonths,
		PaidMonths:        0,
		StartDate:         input.StartDate,
		EndDate:           input.EndDate,
		DeductionDay:      input.DeductionDay,
		LastDeductedMonth: "",
		Status:            input.Status,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	items = append(items, newItem)
	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": bson.M{"recurring_expenses": items}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add recurring expense: " + err.Error()})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Created Recurring Expense Schedule", "RecurringExpense", newItem.ID, "",
		fmt.Sprintf("Added recurring expense: %s (%.0f ETB / month)", newItem.Title, newItem.MonthlyAmount))

	c.JSON(http.StatusCreated, newItem)
}

type UpdateRecurringExpenseInput struct {
	Title          string  `json:"title"`
	Category       string  `json:"category"`
	SubDescription string  `json:"sub_description"` // The user-requested editable text
	MonthlyAmount  float64 `json:"monthly_amount"`
	TotalMonths    *int    `json:"total_months"`
	PaidMonths     *int    `json:"paid_months"`
	DeductionDay   int     `json:"deduction_day"`
	StartDate      string  `json:"start_date"`
	EndDate        string  `json:"end_date"`
	Status         string  `json:"status"`
	Enabled        *bool   `json:"enabled"`
}

// UpdateRecurringExpense updates any recurring expense, including its sub_description note
func (h *ExpenseHandler) UpdateRecurringExpense(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Recurring expense ID is required"})
		return
	}

	var input UpdateRecurringExpenseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings not found"})
		return
	}

	items := h.ensureRecurringExpenses(ctx, &settings)
	foundIdx := -1
	for i := range items {
		if items[i].ID == id {
			foundIdx = i
			break
		}
	}

	if foundIdx == -1 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recurring expense not found"})
		return
	}

	item := &items[foundIdx]
	if input.Title != "" {
		item.Title = input.Title
	}
	if input.Category != "" {
		item.Category = input.Category
	}
	// sub_description is explicitly updated per user request
	if input.SubDescription != "" {
		item.SubDescription = input.SubDescription
	}
	if input.MonthlyAmount > 0 {
		item.MonthlyAmount = input.MonthlyAmount
	}
	if input.TotalMonths != nil {
		item.TotalMonths = *input.TotalMonths
	}
	if input.PaidMonths != nil {
		item.PaidMonths = *input.PaidMonths
	}
	if input.DeductionDay >= 1 && input.DeductionDay <= 28 {
		item.DeductionDay = input.DeductionDay
	}
	if input.StartDate != "" {
		item.StartDate = input.StartDate
	}
	if input.EndDate != "" {
		item.EndDate = input.EndDate
	}
	if input.Status != "" {
		item.Status = input.Status
		item.Enabled = (input.Status == "active")
	}
	if input.Enabled != nil {
		item.Enabled = *input.Enabled
		if *input.Enabled {
			item.Status = "active"
		} else {
			item.Status = "paused"
		}
	}
	item.UpdatedAt = time.Now()

	updateDoc := bson.M{
		"recurring_expenses": items,
	}

	// Keep EIC sync if id == "eic_insurance"
	if item.ID == "eic_insurance" && settings.EICRecurring != nil {
		updateDoc["eic_recurring.monthly_amount"] = item.MonthlyAmount
		updateDoc["eic_recurring.total_months"] = item.TotalMonths
		updateDoc["eic_recurring.deduction_day"] = item.DeductionDay
		updateDoc["eic_recurring.start_date"] = item.StartDate
		updateDoc["eic_recurring.end_date"] = item.EndDate
		updateDoc["eic_recurring.status"] = item.Status
		updateDoc["eic_recurring.enabled"] = item.Enabled
		updateDoc["eic_recurring.description"] = item.SubDescription
	}

	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": updateDoc})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update recurring expense: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Recurring expense schedule updated successfully",
		"item":    item,
	})
}

// DeleteRecurringExpense removes a recurring expense schedule
func (h *ExpenseHandler) DeleteRecurringExpense(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Recurring expense ID is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings not found"})
		return
	}

	items := h.ensureRecurringExpenses(ctx, &settings)
	newItems := make([]models.RecurringExpense, 0, len(items))
	found := false
	for _, it := range items {
		if it.ID == id {
			found = true
			continue
		}
		newItems = append(newItems, it)
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recurring expense schedule not found"})
		return
	}

	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": bson.M{"recurring_expenses": newItems}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete recurring expense: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Recurring expense schedule deleted successfully"})
}

// ToggleRecurringExpense toggles active vs paused status
func (h *ExpenseHandler) ToggleRecurringExpense(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Recurring expense ID is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings not found"})
		return
	}

	items := h.ensureRecurringExpenses(ctx, &settings)
	foundIdx := -1
	for i := range items {
		if items[i].ID == id {
			foundIdx = i
			break
		}
	}

	if foundIdx == -1 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recurring expense not found"})
		return
	}

	item := &items[foundIdx]
	if item.Status == "active" {
		item.Status = "paused"
		item.Enabled = false
	} else {
		item.Status = "active"
		item.Enabled = true
	}
	item.UpdatedAt = time.Now()

	updateDoc := bson.M{
		"recurring_expenses": items,
	}
	if item.ID == "eic_insurance" && settings.EICRecurring != nil {
		updateDoc["eic_recurring.status"] = item.Status
		updateDoc["eic_recurring.enabled"] = item.Enabled
	}

	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": updateDoc})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle schedule: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("%s is now %s", item.Title, item.Status),
		"status":  item.Status,
		"enabled": item.Enabled,
	})
}

// DeductRecurringExpenseNow immediately deducts the item for the current month
func (h *ExpenseHandler) DeductRecurringExpenseNow(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Recurring expense ID is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Settings not found"})
		return
	}

	items := h.ensureRecurringExpenses(ctx, &settings)
	foundIdx := -1
	for i := range items {
		if items[i].ID == id {
			foundIdx = i
			break
		}
	}

	if foundIdx == -1 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recurring expense not found"})
		return
	}

	item := &items[foundIdx]
	now := time.Now()
	currentMonthStr := now.Format("2006-01")
	expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
	newPaidMonths := item.PaidMonths + 1

	receiptNum := fmt.Sprintf("REC-MANUAL-%s-%s", item.ID, currentMonthStr)
	if item.ID == "eic_insurance" {
		receiptNum = fmt.Sprintf("EIC-MANUAL-%s", currentMonthStr)
	}

	desc := fmt.Sprintf("%s - Monthly Deduction (%s) (Manual / On-Demand Deduction)", item.Title, currentMonthStr)
	if item.TotalMonths > 0 {
		desc = fmt.Sprintf("%s - Month %d of %d (Manual / On-Demand Deduction)", item.Title, newPaidMonths, item.TotalMonths)
	}

	expenseType := item.Category
	if expenseType == "" {
		expenseType = "other"
	}

	truckPlate := "All Fleet / Recurring Overhead"
	driverName := item.Title
	if item.ID == "eic_insurance" {
		truckPlate = "All Fleet (Comprehensive Insurance)"
		driverName = "Ethiopian Insurance Corporation (EIC)"
	}

	expense := models.Expense{
		ID:            bson.NewObjectID(),
		ExpenseNumber: expNumber,
		TruckID:       "fleet",
		TruckPlate:    truckPlate,
		DriverID:      "overhead",
		DriverName:    driverName,
		ExpenseType:   expenseType,
		Amount:        item.MonthlyAmount,
		Date:          now,
		Description:   desc,
		ReceiptNumber: receiptNum,
		Status:        "active",
		CreatedAt:     now,
	}

	_, err := h.DB.Expenses.InsertOne(ctx, expense)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert expense: " + err.Error()})
		return
	}

	item.PaidMonths = newPaidMonths
	item.LastDeductedMonth = currentMonthStr
	item.LastDeductedAt = &now
	item.UpdatedAt = now
	if item.TotalMonths > 0 && item.PaidMonths >= item.TotalMonths {
		item.Status = "completed"
	}

	updateDoc := bson.M{
		"recurring_expenses": items,
	}
	if item.ID == "eic_insurance" && settings.EICRecurring != nil {
		updateDoc["eic_recurring.paid_months"] = item.PaidMonths
		updateDoc["eic_recurring.last_deducted_month"] = item.LastDeductedMonth
		updateDoc["eic_recurring.last_deducted_at"] = item.LastDeductedAt
		updateDoc["eic_recurring.status"] = item.Status
	}

	_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": updateDoc})

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Executed Recurring Expense Deduction", "Expense", expense.ID.Hex(), "",
		fmt.Sprintf("Deducted %s: %.0f ETB for %s", item.Title, item.MonthlyAmount, currentMonthStr))

	c.JSON(http.StatusOK, gin.H{
		"message":     fmt.Sprintf("Successfully recorded deduction of %.0f ETB for %s", item.MonthlyAmount, item.Title),
		"expense":     expense,
		"paid_months": newPaidMonths,
	})
}

// GetEICRecurring returns the EIC auto-deduction schedule and status (backward compatibility)
func (h *ExpenseHandler) GetEICRecurring(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Run auto-deduction check first
	_, _ = h.CheckAndExecuteAllRecurringDeductions(ctx)

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
		return
	}

	items := h.ensureRecurringExpenses(ctx, &settings)
	var eicItem models.RecurringExpense
	for _, it := range items {
		if it.ID == "eic_insurance" {
			eicItem = it
			break
		}
	}

	eic := settings.EICRecurring
	if eic == nil {
		eic = &models.EICRecurringConfig{
			Enabled:           eicItem.Enabled,
			MonthlyAmount:     eicItem.MonthlyAmount,
			TotalMonths:       eicItem.TotalMonths,
			PaidMonths:        eicItem.PaidMonths,
			StartDate:         eicItem.StartDate,
			EndDate:           eicItem.EndDate,
			DeductionDay:      eicItem.DeductionDay,
			LastDeductedMonth: eicItem.LastDeductedMonth,
			Description:       eicItem.SubDescription,
			Status:            eicItem.Status,
		}
	}

	// Fetch all EIC expenses
	cur, _ := h.DB.Expenses.Find(ctx, bson.M{
		"$or": []bson.M{
			{"expense_type": "insurance"},
			{"receipt_number": bson.M{"$regex": "^EIC-"}},
			{"receipt_number": bson.M{"$regex": "^REC-.*eic"}},
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

// UpdateEICRecurring updates the EIC configuration (backward compatibility)
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
		input.Description = "Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports."
	}

	var settings models.Settings
	if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err == nil {
		items := h.ensureRecurringExpenses(ctx, &settings)
		for i := range items {
			if items[i].ID == "eic_insurance" {
				items[i].MonthlyAmount = input.MonthlyAmount
				items[i].TotalMonths = input.TotalMonths
				items[i].DeductionDay = input.DeductionDay
				items[i].StartDate = input.StartDate
				items[i].EndDate = input.EndDate
				items[i].Status = input.Status
				items[i].Enabled = input.Enabled
				items[i].SubDescription = input.Description
				items[i].UpdatedAt = time.Now()
				break
			}
		}
		_, _ = h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{"$set": bson.M{
			"recurring_expenses": items,
		}})
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

// ToggleEICRecurring toggles active / paused (backward compatibility)
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

	items := h.ensureRecurringExpenses(ctx, &settings)
	for i := range items {
		if items[i].ID == "eic_insurance" {
			items[i].Status = newStatus
			items[i].Enabled = newEnabled
			items[i].UpdatedAt = time.Now()
			break
		}
	}

	_, err := h.DB.Settings.UpdateOne(ctx, bson.M{"_id": settings.ID}, bson.M{
		"$set": bson.M{
			"eic_recurring.status":  newStatus,
			"eic_recurring.enabled": newEnabled,
			"recurring_expenses":   items,
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

// DeductEICNow manually forces or executes the EIC deduction for the current month (backward compatibility)
func (h *ExpenseHandler) DeductEICNow(c *gin.Context) {
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "eic_insurance"})
	h.DeductRecurringExpenseNow(c)
}

