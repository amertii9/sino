package handlers

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"truck-fleet-backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type PaymentHandler struct {
	BaseHandler
}

func NewPaymentHandler(base BaseHandler) *PaymentHandler {
	return &PaymentHandler{BaseHandler: base}
}

type ApprovePaymentInput struct {
	PaymentMethod string  `json:"payment_method"` // "cbe", "telebirr", "awash_bank", "dashen_bank", "cash", "check", "bank_transfer", "other"
	PaymentRef    string  `json:"payment_ref"`
	PaidAmount    float64 `json:"paid_amount"`
	PayerName     string  `json:"payer_name"`
	PaymentNotes  string  `json:"payment_notes"`
	PaidAt        string  `json:"paid_at"` // YYYY-MM-DD
}

type BatchApproveInput struct {
	TripIDs       []string `json:"trip_ids"`
	PaymentMethod string   `json:"payment_method"`
	PaymentRef    string   `json:"payment_ref"`
	PayerName     string   `json:"payer_name"`
	PaymentNotes  string   `json:"payment_notes"`
	PaidAt        string   `json:"paid_at"`
}

// GetPayments lists all completed trips with payment status, filtering, and summary statistics
func (h *PaymentHandler) GetPayments(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	status := c.DefaultQuery("status", "all")       // "all", "pending", "paid"
	period := c.DefaultQuery("period", "all")       // "all", "today", "this_week", "this_month", "custom"
	search := strings.TrimSpace(c.Query("search"))
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	driverID := c.Query("driver_id")
	truckID := c.Query("truck_id")

	// Base filter: only completed trips represent finalized hauling receivables
	filter := bson.M{
		"status": "completed",
	}

	// Payment status filter
	if status == "pending" {
		filter["$or"] = []bson.M{
			{"payment_status": "pending"},
			{"payment_status": ""},
			{"payment_status": bson.M{"$exists": false}},
		}
	} else if status == "paid" {
		filter["payment_status"] = "paid"
	}

	// Specific driver or truck
	if driverID != "" {
		filter["driver_id"] = driverID
	}
	if truckID != "" {
		filter["truck_id"] = truckID
	}

	// Date range filters
	now := time.Now()
	if period == "today" {
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		filter["date"] = bson.M{"$gte": startOfDay}
	} else if period == "this_week" {
		startOfWeek := now.AddDate(0, 0, -int(now.Weekday()))
		startOfWeek = time.Date(startOfWeek.Year(), startOfWeek.Month(), startOfWeek.Day(), 0, 0, 0, 0, startOfWeek.Location())
		filter["date"] = bson.M{"$gte": startOfWeek}
	} else if period == "this_month" {
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		filter["date"] = bson.M{"$gte": startOfMonth}
	} else if startDateStr != "" && endDateStr != "" {
		st, err1 := time.Parse("2006-01-02", startDateStr)
		et, err2 := time.Parse("2006-01-02", endDateStr)
		if err1 == nil && err2 == nil {
			endExclusive := et.AddDate(0, 0, 1)
			filter["date"] = bson.M{
				"$gte": st,
				"$lt":  endExclusive,
			}
		}
	}

	// Search filter
	if search != "" {
		rgx := bson.M{"$regex": search, "$options": "i"}
		filter["$and"] = []bson.M{
			{
				"$or": []bson.M{
					{"trip_number": rgx},
					{"driver_name": rgx},
					{"truck_plate": rgx},
					{"loading_site_name": rgx},
					{"dumping_site_name": rgx},
					{"material_name": rgx},
					{"payer_name": rgx},
					{"payment_ref": rgx},
					{"receipt_number": rgx},
					{"payment_notes": rgx},
				},
			},
		}
	}

	// Fetch filtered list
	findOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}, {Key: "created_at", Value: -1}})
	cursor, err := h.DB.Trips.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query payments: " + err.Error()})
		return
	}
	defer cursor.Close(ctx)

	var payments []models.Trip
	if err := cursor.All(ctx, &payments); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode payments"})
		return
	}

	// Normalize payment status for empty values
	for i := range payments {
		if payments[i].PaymentStatus == "" {
			payments[i].PaymentStatus = "pending"
		}
	}

	// Calculate overall global summary for all completed trips (unfiltered for KPIs)
	summaryCursor, err := h.DB.Trips.Find(ctx, bson.M{"status": "completed"})
	var allCompleted []models.Trip
	if err == nil && summaryCursor != nil {
		_ = summaryCursor.All(ctx, &allCompleted)
		summaryCursor.Close(ctx)
	}

	var totalPendingAmount float64
	var totalPendingCount int
	var totalPaidAmount float64
	var totalPaidCount int

	for _, t := range allCompleted {
		gross := t.GrossRevenue
		if gross <= 0 {
			gross = t.TotalRevenue
		}
		if t.PaymentStatus == "paid" {
			totalPaidCount++
			if t.PaidAmount > 0 {
				totalPaidAmount += t.PaidAmount
			} else {
				totalPaidAmount += gross
			}
		} else {
			totalPendingCount++
			totalPendingAmount += gross
		}
	}

	totalAmount := totalPendingAmount + totalPaidAmount
	totalCount := totalPendingCount + totalPaidCount
	var collectionRate float64
	if totalAmount > 0 {
		collectionRate = math.Round((totalPaidAmount/totalAmount)*1000) / 10
	}

	c.JSON(http.StatusOK, gin.H{
		"payments": payments,
		"summary": gin.H{
			"total_pending_amount": totalPendingAmount,
			"total_pending_count":  totalPendingCount,
			"total_paid_amount":    totalPaidAmount,
			"total_paid_count":      totalPaidCount,
			"total_amount":         totalAmount,
			"total_count":          totalCount,
			"collection_rate":      collectionRate,
		},
	})
}

// GetPaymentSummary returns lightweight KPI statistics for badges and dashboards
func (h *PaymentHandler) GetPaymentSummary(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := h.DB.Trips.Find(ctx, bson.M{"status": "completed"})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch summary"})
		return
	}
	defer cursor.Close(ctx)

	var trips []models.Trip
	if err := cursor.All(ctx, &trips); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode trips"})
		return
	}

	var pendingAmount float64
	var pendingCount int
	var paidAmount float64
	var paidCount int

	for _, t := range trips {
		gross := t.GrossRevenue
		if gross <= 0 {
			gross = t.TotalRevenue
		}
		if t.PaymentStatus == "paid" {
			paidCount++
			if t.PaidAmount > 0 {
				paidAmount += t.PaidAmount
			} else {
				paidAmount += gross
			}
		} else {
			pendingCount++
			pendingAmount += gross
		}
	}

	totalAmount := pendingAmount + paidAmount
	var collectionRate float64
	if totalAmount > 0 {
		collectionRate = math.Round((paidAmount/totalAmount)*1000) / 10
	}

	c.JSON(http.StatusOK, gin.H{
		"pending_count":   pendingCount,
		"pending_amount":  pendingAmount,
		"paid_count":      paidCount,
		"paid_amount":     paidAmount,
		"total_amount":    totalAmount,
		"collection_rate": collectionRate,
	})
}

// ApprovePayment marks a completed trip payment as "paid" once the company receives the funds
func (h *PaymentHandler) ApprovePayment(c *gin.Context) {
	tripID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	var input ApprovePaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		// Non-fatal if body is empty (allows quick 1-click approval)
		input = ApprovePaymentInput{}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existing models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	adminName := c.GetString("fullName")
	if adminName == "" {
		adminName = c.GetString("email")
	}
	if adminName == "" {
		adminName = "Admin"
	}
	adminID := c.GetString("userID")

	paidAmount := input.PaidAmount
	if paidAmount <= 0 {
		if existing.GrossRevenue > 0 {
			paidAmount = existing.GrossRevenue
		} else {
			paidAmount = existing.TotalRevenue
		}
	}

	netRevenue := paidAmount - existing.TotalAdditionalFees

	paidAt := time.Now()
	if input.PaidAt != "" {
		if t, err := time.Parse("2006-01-02", input.PaidAt); err == nil {
			paidAt = t
		}
	}

	paymentMethod := strings.TrimSpace(input.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = "cbe"
	}

	updateFields := bson.M{
		"payment_status": "paid",
		"payment_method": paymentMethod,
		"paid_amount":    paidAmount,
		"net_revenue":    netRevenue,
		"total_revenue":  netRevenue,
		"paid_at":        paidAt,
		"paid_by":        adminName,
		"updated_at":     time.Now(),
	}

	if input.PaymentRef != "" {
		updateFields["payment_ref"] = input.PaymentRef
	}
	if input.PayerName != "" {
		updateFields["payer_name"] = input.PayerName
	}
	if input.PaymentNotes != "" {
		updateFields["payment_notes"] = input.PaymentNotes
	}

	_, err = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve payment: " + err.Error()})
		return
	}

	// Ensure synchronized active Expense records exist for all additional fees incurred on this trip
	for _, fee := range existing.AdditionalFees {
		if fee.Amount > 0 {
			expType := fee.FeeType
			if expType != "toll" && expType != "parking" && expType != "washing" && expType != "maintenance" && expType != "weighbridge" && expType != "gate_fee" {
				expType = "other"
			}
			count, _ := h.DB.Expenses.CountDocuments(ctx, bson.M{
				"$or": []bson.M{
					{"trip_id": existing.ID.Hex(), "amount": fee.Amount, "expense_type": expType},
					{"receipt_number": fmt.Sprintf("TRIP-%s", existing.TripNumber), "amount": fee.Amount},
					{"description": bson.M{"$regex": fmt.Sprintf("Trip #?%s", existing.TripNumber)}, "amount": fee.Amount},
				},
				"status": "active",
			})
			if count > 0 {
				// Already exists! Just update trip_id/trip_number if missing
				_, _ = h.DB.Expenses.UpdateMany(ctx, bson.M{
					"description": bson.M{"$regex": fmt.Sprintf("Trip #?%s", existing.TripNumber)},
					"trip_id":     "",
				}, bson.M{
					"$set": bson.M{
						"trip_id":        existing.ID.Hex(),
						"trip_number":    existing.TripNumber,
						"receipt_number": fmt.Sprintf("TRIP-%s", existing.TripNumber),
					},
				})
				continue
			}

			expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
			desc := fee.Description
			if desc == "" {
				desc = fmt.Sprintf("Trip %s: %s fee (deducted upon payment approval)", existing.TripNumber, strings.Title(fee.FeeType))
			}
			expense := models.Expense{
				ID:            bson.NewObjectID(),
				ExpenseNumber: expNumber,
				TruckID:       existing.TruckID,
				TruckPlate:    existing.TruckPlate,
				DriverID:      existing.DriverID,
				DriverName:    existing.DriverName,
				TripID:        existing.ID.Hex(),
				TripNumber:    existing.TripNumber,
				ExpenseType:   expType,
				Amount:        fee.Amount,
				Date:          paidAt,
				Description:   desc,
				ReceiptNumber: fmt.Sprintf("TRIP-%s", existing.TripNumber),
				Status:        "active",
				CreatedAt:     time.Now(),
			}
			_, _ = h.DB.Expenses.InsertOne(ctx, expense)
		}
	}

	// Fetch updated trip
	var updated models.Trip
	_ = h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&updated)

	// Audit Log
	h.LogAudit(ctx, adminID, adminName, "Approved Trip Payment", "Trip", existing.ID.Hex(),
		"pending",
		fmt.Sprintf("Gross payment of %.0f ETB approved for Trip %s (Net: %.0f ETB after %.0f ETB expenses) via %s (Ref: %s)",
			paidAmount, existing.TripNumber, netRevenue, existing.TotalAdditionalFees, paymentMethod, input.PaymentRef))

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Gross payment for Trip %s approved successfully (expenses deducted)", existing.TripNumber),
		"trip":    updated,
	})
}

// RevertPayment sets a trip payment back to pending
func (h *PaymentHandler) RevertPayment(c *gin.Context) {
	tripID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existing models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	adminName := c.GetString("fullName")
	adminID := c.GetString("userID")

	updateFields := bson.M{
		"payment_status": "pending",
		"paid_amount":    0.0,
		"paid_at":        nil,
		"paid_by":        "",
		"updated_at":     time.Now(),
	}

	_, err = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revert payment: " + err.Error()})
		return
	}

	var updated models.Trip
	_ = h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&updated)

	h.LogAudit(ctx, adminID, adminName, "Reverted Trip Payment", "Trip", existing.ID.Hex(),
		"paid", fmt.Sprintf("Payment for Trip %s reverted to pending", existing.TripNumber))

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Payment for Trip %s reverted to pending", existing.TripNumber),
		"trip":    updated,
	})
}

// BatchApprovePayments allows approving multiple trip payments at once
func (h *PaymentHandler) BatchApprovePayments(c *gin.Context) {
	var input BatchApproveInput
	if err := c.ShouldBindJSON(&input); err != nil || len(input.TripIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide an array of trip IDs to approve"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	adminName := c.GetString("fullName")
	if adminName == "" {
		adminName = "Admin"
	}
	adminID := c.GetString("userID")

	paidAt := time.Now()
	if input.PaidAt != "" {
		if t, err := time.Parse("2006-01-02", input.PaidAt); err == nil {
			paidAt = t
		}
	}

	paymentMethod := strings.TrimSpace(input.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = "cbe"
	}

	var objIDs []bson.ObjectID
	for _, idStr := range input.TripIDs {
		if oid, err := bson.ObjectIDFromHex(idStr); err == nil {
			objIDs = append(objIDs, oid)
		}
	}

	if len(objIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid trip IDs provided"})
		return
	}

	var modifiedCount int64
	for _, oid := range objIDs {
		var trip models.Trip
		if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": oid}).Decode(&trip); err == nil {
			tripPaid := trip.GrossRevenue
			if tripPaid <= 0 {
				tripPaid = trip.TotalRevenue
			}
			netRevenue := tripPaid - trip.TotalAdditionalFees
			tripUpdate := bson.M{
				"$set": bson.M{
					"payment_status": "paid",
					"payment_method": paymentMethod,
					"payment_ref":    input.PaymentRef,
					"payer_name":     input.PayerName,
					"payment_notes":  input.PaymentNotes,
					"paid_amount":    tripPaid,
					"net_revenue":    netRevenue,
					"total_revenue":  netRevenue,
					"paid_at":        paidAt,
					"paid_by":        adminName,
					"updated_at":     time.Now(),
				},
			}
			if uRes, err := h.DB.Trips.UpdateOne(ctx, bson.M{"_id": oid}, tripUpdate); err == nil {
				modifiedCount += uRes.ModifiedCount
			}

			// Ensure synchronized active Expense records exist for all fees incurred on this trip
			for _, fee := range trip.AdditionalFees {
				if fee.Amount > 0 {
					expType := fee.FeeType
					if expType != "toll" && expType != "parking" && expType != "washing" && expType != "maintenance" && expType != "weighbridge" && expType != "gate_fee" {
						expType = "other"
					}
					count, _ := h.DB.Expenses.CountDocuments(ctx, bson.M{
						"$or": []bson.M{
							{"trip_id": trip.ID.Hex(), "amount": fee.Amount, "expense_type": expType},
							{"receipt_number": fmt.Sprintf("TRIP-%s", trip.TripNumber), "amount": fee.Amount},
							{"description": bson.M{"$regex": fmt.Sprintf("Trip #?%s", trip.TripNumber)}, "amount": fee.Amount},
						},
						"status": "active",
					})
					if count > 0 {
						// Already exists! Just update trip_id/trip_number if missing
						_, _ = h.DB.Expenses.UpdateMany(ctx, bson.M{
							"description": bson.M{"$regex": fmt.Sprintf("Trip #?%s", trip.TripNumber)},
							"trip_id":     "",
						}, bson.M{
							"$set": bson.M{
								"trip_id":        trip.ID.Hex(),
								"trip_number":    trip.TripNumber,
								"receipt_number": fmt.Sprintf("TRIP-%s", trip.TripNumber),
							},
						})
						continue
					}

					expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
					desc := fee.Description
					if desc == "" {
						desc = fmt.Sprintf("Trip %s: %s fee (deducted upon payment approval)", trip.TripNumber, strings.Title(fee.FeeType))
					}
					expense := models.Expense{
						ID:            bson.NewObjectID(),
						ExpenseNumber: expNumber,
						TruckID:       trip.TruckID,
						TruckPlate:    trip.TruckPlate,
						DriverID:      trip.DriverID,
						DriverName:    trip.DriverName,
						TripID:        trip.ID.Hex(),
						TripNumber:    trip.TripNumber,
						ExpenseType:   expType,
						Amount:        fee.Amount,
						Date:          paidAt,
						Description:   desc,
						ReceiptNumber: fmt.Sprintf("TRIP-%s", trip.TripNumber),
						Status:        "active",
						CreatedAt:     time.Now(),
					}
					_, _ = h.DB.Expenses.InsertOne(ctx, expense)
				}
			}
		}
	}

	h.LogAudit(ctx, adminID, adminName, "Batch Approved Trip Payments", "Trip",
		fmt.Sprintf("%d trips", len(objIDs)), "pending",
		fmt.Sprintf("Batch approved %d trips via %s (Ref: %s)", modifiedCount, paymentMethod, input.PaymentRef))

	c.JSON(http.StatusOK, gin.H{
		"message":        fmt.Sprintf("Successfully approved %d trip payments", modifiedCount),
		"modified_count": modifiedCount,
	})
}
