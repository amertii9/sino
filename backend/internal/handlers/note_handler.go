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
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type NoteHandler struct {
	BaseHandler
}

func NewNoteHandler(base BaseHandler) *NoteHandler {
	return &NoteHandler{BaseHandler: base}
}

type CreateNoteInput struct {
	Title       string  `json:"title" binding:"required"`
	Category    string  `json:"category" binding:"required"` // "driver_allowance", "operational", "fuel", "maintenance", "route", "safety", "other"
	Content     string  `json:"content"`
	DriverID    string  `json:"driver_id"`
	DriverName  string  `json:"driver_name"`
	TruckID     string  `json:"truck_id"`
	TruckPlate  string  `json:"truck_plate"`
	Amount      float64 `json:"amount"`
	Date        string  `json:"date"`
	SyncExpense bool    `json:"sync_expense"`
	Priority    string  `json:"priority"` // "low", "normal", "high", "urgent"
}

type UpdateNoteInput struct {
	Title    string  `json:"title"`
	Category string  `json:"category"`
	Content  string  `json:"content"`
	Amount   float64 `json:"amount"`
	Priority string  `json:"priority"`
	Status   string  `json:"status"`
}

func (h *NoteHandler) CreateNote(c *gin.Context) {
	var input CreateNoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide required note details: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	noteDateStr := strings.TrimSpace(input.Date)
	if noteDateStr == "" {
		noteDateStr = time.Now().Format("2006-01-02")
	}

	noteDate := time.Now()
	if t, err := time.Parse("2006-01-02", noteDateStr); err == nil {
		noteDate = t
	}

	priority := strings.TrimSpace(input.Priority)
	if priority == "" {
		priority = "normal"
	}

	userName := c.GetString("fullName")
	if userName == "" {
		userName = "Fleet Administrator"
	}
	userIDStr := c.GetString("userID")

	noteNumber := h.GenerateNextNumber(ctx, "notes", "NT")

	note := models.Note{
		ID:          bson.NewObjectID(),
		NoteNumber:  noteNumber,
		Title:       strings.TrimSpace(input.Title),
		Category:    strings.TrimSpace(input.Category),
		Content:     strings.TrimSpace(input.Content),
		DriverID:    strings.TrimSpace(input.DriverID),
		DriverName:  strings.TrimSpace(input.DriverName),
		TruckID:     strings.TrimSpace(input.TruckID),
		TruckPlate:  strings.TrimSpace(input.TruckPlate),
		Amount:      input.Amount,
		Date:        noteDateStr,
		RecordedBy:  userName,
		SyncExpense: input.SyncExpense,
		Priority:    priority,
		Status:      "active",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// If this is a driver allowance or expense-syncable note with amount > 0 and SyncExpense enabled:
	if input.Amount > 0 && input.SyncExpense {
		truckID := input.TruckID
		if truckID == "" {
			truckID = "fleet"
		}
		truckPlate := input.TruckPlate
		if truckPlate == "" {
			truckPlate = "All Fleet / Overhead"
		}

		desc := fmt.Sprintf("Note %s: %s", noteNumber, input.Title)
		if input.Category == "driver_allowance" {
			desc = fmt.Sprintf("Driver Allowance: %s [%s]", input.Title, noteNumber)
		}
		if input.Content != "" {
			desc += fmt.Sprintf(" - %s", input.Content)
		}

		expType := "other"
		if input.Category == "driver_allowance" {
			expType = "driver_advance"
		} else if input.Category == "fuel" {
			expType = "fuel"
		} else if input.Category == "maintenance" {
			expType = "maintenance"
		} else if input.Category == "route" {
			expType = "toll"
		}

		expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
		expense := models.Expense{
			ID:            bson.NewObjectID(),
			ExpenseNumber: expNumber,
			TruckID:       truckID,
			TruckPlate:    truckPlate,
			DriverID:      input.DriverID,
			DriverName:    input.DriverName,
			ExpenseType:   expType,
			Amount:        input.Amount,
			Date:          noteDate,
			Description:   desc,
			ReceiptNumber: noteNumber,
			Status:        "active",
			CreatedAt:     time.Now(),
		}

		if _, err := h.DB.Expenses.InsertOne(ctx, expense); err == nil {
			note.LinkedExpenseID = expense.ID.Hex()
		}
	}

	if _, err := h.DB.Notes.InsertOne(ctx, note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record note: " + err.Error()})
		return
	}

	h.LogAudit(ctx, userIDStr, userName, "Recorded Operational Note", "Note", note.ID.Hex(), "",
		fmt.Sprintf("Note %s [%s]: %s (Amount: %.2f ETB)", noteNumber, note.Category, note.Title, note.Amount))

	c.JSON(http.StatusCreated, note)
}

func (h *NoteHandler) GetNotes(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{}

	if cat := strings.TrimSpace(c.Query("category")); cat != "" && cat != "all" {
		filter["category"] = cat
	}
	if driverID := strings.TrimSpace(c.Query("driver_id")); driverID != "" && driverID != "all" {
		filter["driver_id"] = driverID
	}
	if truckID := strings.TrimSpace(c.Query("truck_id")); truckID != "" && truckID != "all" {
		filter["truck_id"] = truckID
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		filter["status"] = status
	}

	// Search filter
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		regexPattern := bson.M{"$regex": search, "$options": "i"}
		filter["$or"] = []bson.M{
			{"title": regexPattern},
			{"content": regexPattern},
			{"driver_name": regexPattern},
			{"truck_plate": regexPattern},
			{"note_number": regexPattern},
			{"recorded_by": regexPattern},
		}
	}

	// Date filter logic
	period := strings.TrimSpace(c.Query("period"))
	startDate := strings.TrimSpace(c.Query("start_date"))
	endDate := strings.TrimSpace(c.Query("end_date"))

	loc := time.Local
	now := time.Now().In(loc)
	todayStr := now.Format("2006-01-02")

	if period == "today" {
		filter["date"] = todayStr
	} else if period == "yesterday" {
		filter["date"] = now.AddDate(0, 0, -1).Format("2006-01-02")
	} else if period == "this_week" {
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		startOfWeek := now.AddDate(0, 0, -(weekday - 1)).Format("2006-01-02")
		filter["date"] = bson.M{"$gte": startOfWeek, "$lte": todayStr}
	} else if period == "this_month" {
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc).Format("2006-01-02")
		filter["date"] = bson.M{"$gte": startOfMonth, "$lte": todayStr}
	} else if startDate != "" || endDate != "" {
		dateFilter := bson.M{}
		if startDate != "" {
			dateFilter["$gte"] = startDate
		}
		if endDate != "" {
			dateFilter["$lte"] = endDate
		}
		filter["date"] = dateFilter
	}

	findOpts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(500)
	cursor, err := h.DB.Notes.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notes: " + err.Error()})
		return
	}
	defer cursor.Close(ctx)

	notes := make([]models.Note, 0)
	if err := cursor.All(ctx, &notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse notes: " + err.Error()})
		return
	}

	// Summary stats
	var totalAllowanceAmount float64
	var allowanceCount int
	var operationalCount int

	for _, n := range notes {
		if n.Category == "driver_allowance" || n.Amount > 0 {
			totalAllowanceAmount += n.Amount
			allowanceCount++
		} else {
			operationalCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"notes": notes,
		"summary": gin.H{
			"total_notes":            len(notes),
			"total_allowance_amount": totalAllowanceAmount,
			"allowance_count":        allowanceCount,
			"operational_count":      operationalCount,
		},
	})
}

func (h *NoteHandler) UpdateNote(c *gin.Context) {
	idStr := c.Param("id")
	objID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	var input UpdateNoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	updateFields := bson.M{
		"updated_at": time.Now(),
	}
	if input.Title != "" {
		updateFields["title"] = strings.TrimSpace(input.Title)
	}
	if input.Content != "" {
		updateFields["content"] = strings.TrimSpace(input.Content)
	}
	if input.Category != "" {
		updateFields["category"] = strings.TrimSpace(input.Category)
	}
	if input.Priority != "" {
		updateFields["priority"] = strings.TrimSpace(input.Priority)
	}
	if input.Status != "" {
		updateFields["status"] = strings.TrimSpace(input.Status)
	}
	if input.Amount >= 0 {
		updateFields["amount"] = input.Amount
	}

	var existing models.Note
	if err := h.DB.Notes.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}

	_, err = h.DB.Notes.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update note: " + err.Error()})
		return
	}

	// If there is a linked expense, keep amount and description synced
	if existing.LinkedExpenseID != "" && input.Amount > 0 {
		if expObjID, err := bson.ObjectIDFromHex(existing.LinkedExpenseID); err == nil {
			expUpdates := bson.M{
				"amount": input.Amount,
			}
			if input.Title != "" {
				desc := fmt.Sprintf("Driver Allowance: %s [%s]", input.Title, existing.NoteNumber)
				if input.Content != "" {
					desc += fmt.Sprintf(" - %s", input.Content)
				}
				expUpdates["description"] = desc
			}
			_, _ = h.DB.Expenses.UpdateOne(ctx, bson.M{"_id": expObjID}, bson.M{"$set": expUpdates})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Note updated successfully"})
}

func (h *NoteHandler) DeleteNote(c *gin.Context) {
	idStr := c.Param("id")
	objID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existing models.Note
	if err := h.DB.Notes.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}

	// If there is a linked expense, cancel/delete it to maintain ledger accuracy
	if existing.LinkedExpenseID != "" {
		if expObjID, err := bson.ObjectIDFromHex(existing.LinkedExpenseID); err == nil {
			_, _ = h.DB.Expenses.DeleteOne(ctx, bson.M{"_id": expObjID})
		}
	}

	_, err = h.DB.Notes.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete note: " + err.Error()})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Deleted Operational Note", "Note", idStr, existing.Title, "Deleted")

	c.JSON(http.StatusOK, gin.H{"message": "Note deleted successfully"})
}

type AddNoteToExpenseInput struct {
	Amount float64 `json:"amount"`
}

func (h *NoteHandler) AddNoteToExpense(c *gin.Context) {
	idStr := c.Param("id")
	objID, err := bson.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid note ID"})
		return
	}

	var input AddNoteToExpenseInput
	_ = c.ShouldBindJSON(&input)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var note models.Note
	if err := h.DB.Notes.FindOne(ctx, bson.M{"_id": objID}).Decode(&note); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}

	expAmount := note.Amount
	if input.Amount > 0 {
		expAmount = input.Amount
	}

	if expAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify an amount of money (ETB) above 0 to add to company expenses"})
		return
	}

	truckID := note.TruckID
	if truckID == "" {
		truckID = "fleet"
	}
	truckPlate := note.TruckPlate
	if truckPlate == "" {
		truckPlate = "All Fleet / Overhead"
	}

	noteDate := time.Now()
	if t, err := time.Parse("2006-01-02", note.Date); err == nil {
		noteDate = t
	}

	desc := fmt.Sprintf("Note %s: %s", note.NoteNumber, note.Title)
	if note.Category == "driver_allowance" {
		desc = fmt.Sprintf("Driver Allowance: %s [%s]", note.Title, note.NoteNumber)
	}
	if note.Content != "" {
		desc += fmt.Sprintf(" - %s", note.Content)
	}

	expType := "other"
	if note.Category == "driver_allowance" {
		expType = "driver_advance"
	} else if note.Category == "fuel" {
		expType = "fuel"
	} else if note.Category == "maintenance" {
		expType = "maintenance"
	} else if note.Category == "route" {
		expType = "toll"
	}

	expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
	expense := models.Expense{
		ID:            bson.NewObjectID(),
		ExpenseNumber: expNumber,
		TruckID:       truckID,
		TruckPlate:    truckPlate,
		DriverID:      note.DriverID,
		DriverName:    note.DriverName,
		ExpenseType:   expType,
		Amount:        expAmount,
		Date:          noteDate,
		Description:   desc,
		ReceiptNumber: note.NoteNumber,
		Status:        "active",
		CreatedAt:     time.Now(),
	}

	if _, err := h.DB.Expenses.InsertOne(ctx, expense); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record expense: " + err.Error()})
		return
	}

	updateFields := bson.M{
		"linked_expense_id": expense.ID.Hex(),
		"sync_expense":     true,
		"updated_at":        time.Now(),
	}
	if input.Amount > 0 {
		updateFields["amount"] = input.Amount
	}

	_, _ = h.DB.Notes.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{
		"$set": updateFields,
	})

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Added Note to Expense", "Expense", expense.ID.Hex(), "",
		fmt.Sprintf("Added note %s amount %.2f ETB to expense %s", note.NoteNumber, expAmount, expNumber))

	c.JSON(http.StatusOK, gin.H{
		"message":           "Recorded amount successfully added to company expenses",
		"linked_expense_id": expense.ID.Hex(),
		"expense_number":    expNumber,
		"amount":            expAmount,
	})
}
