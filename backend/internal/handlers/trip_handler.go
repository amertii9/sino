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

type TripHandler struct {
	BaseHandler
}

func NewTripHandler(base BaseHandler) *TripHandler {
	return &TripHandler{BaseHandler: base}
}

func normalizeUnit(u string) string {
	switch strings.ToLower(strings.TrimSpace(u)) {
	case "ton", "tons", "t":
		return "ton"
	case "quintal", "quintals", "q":
		return "quintal"
	case "kg", "kilogram", "kilograms":
		return "kg"
	default:
		return "ton"
	}
}

func calculateUnifiedQuantity(quantityKg float64, targetUnit string) float64 {
	switch normalizeUnit(targetUnit) {
	case "quintal":
		return quantityKg / 100.0
	case "kg":
		return quantityKg
	default: // "ton"
		return quantityKg / 1000.0
	}
}

func toKg(quantity float64, unit string) float64 {
	switch normalizeUnit(unit) {
	case "quintal":
		return quantity * 100.0
	case "kg":
		return quantity
	default: // "ton"
		return quantity * 1000.0
	}
}

func computeLegRevenue(qty float64, unit string, method string, unitPrice float64, lumpSum float64) float64 {
	m := strings.ToLower(strings.TrimSpace(method))
	if m == "lump_sum" {
		return lumpSum
	}
	return qty * unitPrice
}

type CreateTripInput struct {
	TruckID                  string           `json:"truck_id"`
	TruckPlate               string           `json:"truck_plate"`
	DriverID                 string           `json:"driver_id"`
	DriverName               string           `json:"driver_name"`
	LoadingSiteID            string           `json:"loading_site_id" binding:"required"`
	LoadingSiteName          string           `json:"loading_site_name"`
	DumpingSiteID            string           `json:"dumping_site_id" binding:"required"`
	DumpingSiteName          string           `json:"dumping_site_name"`
	HasTransition            bool             `json:"has_transition"`
	TransitionPointIDs       []string         `json:"transition_point_ids"`
	TransitionPointName      string           `json:"transition_point_name"`
	MaterialID               string           `json:"material_id" binding:"required"`
	MaterialName             string           `json:"material_name"`
	Quantity                 float64          `json:"quantity"`
	Unit                     string           `json:"unit"`
	PricingMethod            string           `json:"pricing_method"`
	UnitPrice                float64          `json:"unit_price"`
	PricingTarget            string           `json:"pricing_target"`
	TransitUnitPrice          float64          `json:"transit_unit_price"`
	TransitUnitPriceSplit     float64          `json:"transit_unit_price_split"`
	DestinationUnitPrice      float64          `json:"destination_unit_price"`
	DestinationUnitPriceSplit float64          `json:"destination_unit_price_split"`
	PriceDifference          float64          `json:"price_difference"`
	LumpSum                  float64          `json:"lump_sum"`
	IsSplitDrop              bool             `json:"is_split_drop"`
	TransitQuantity          float64          `json:"transit_quantity"`
	TransitUnit              string           `json:"transit_unit"`
	TransitPricingMethod     string           `json:"transit_pricing_method"`
	TransitLumpSum           float64          `json:"transit_lump_sum"`
	TransitReceiptNumber     string           `json:"transit_receipt_number"`
	DestinationQuantity      float64          `json:"destination_quantity"`
	DestinationUnit          string           `json:"destination_unit"`
	DestinationPricingMethod string           `json:"destination_pricing_method"`
	DestinationLumpSum       float64          `json:"destination_lump_sum"`
	DestinationReceiptNumber string           `json:"destination_receipt_number"`
	AdditionalFees           []models.TripFee `json:"additional_fees"`
	StartOdometer            float64          `json:"start_odometer"`
	EndOdometer              float64          `json:"end_odometer"`
	ReceiptNumber            string           `json:"receipt_number"`
	Status                   string           `json:"status"`
	Date                     string           `json:"date"`
	DropOffLocation          string           `json:"drop_off_location"`
	TransitNotes             string           `json:"transit_notes"`
	Notes                    string           `json:"notes"`
}

func (h *TripHandler) CreateTrip(c *gin.Context) {
	var input CreateTripInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please fill all required trip fields: " + err.Error()})
		return
	}

	if input.TransitUnitPrice <= 0 && input.TransitUnitPriceSplit > 0 {
		input.TransitUnitPrice = input.TransitUnitPriceSplit
	}
	if input.DestinationUnitPrice <= 0 && input.DestinationUnitPriceSplit > 0 {
		input.DestinationUnitPrice = input.DestinationUnitPriceSplit
	}

	isSplit := input.IsSplitDrop && (input.TransitQuantity > 0 || input.DestinationQuantity > 0)
	if isSplit {
		if input.TransitQuantity <= 0 && input.DestinationQuantity <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify cargo quantities unloaded at transit point or destination"})
			return
		}
	} else {
		if input.Quantity <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than zero"})
			return
		}

		if input.PricingMethod != "lump_sum" && input.UnitPrice <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unit price must be greater than zero"})
			return
		}

		if input.PricingMethod == "lump_sum" && input.LumpSum <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lump sum amount must be greater than zero"})
			return
		}
	}

	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")
	fullName := c.GetString("fullName")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	driverID := input.DriverID
	driverName := input.DriverName
	truckID := input.TruckID
	truckPlate := input.TruckPlate

	if userRole == string(models.RoleDriver) || driverID == "" {
		driverID = userIDStr
		driverName = fullName
	}

	// Always ensure truckID and truckPlate are resolved
	if truckID == "" {
		// 1. Try finding truck from driver profile
		var driver models.Driver
		userObjID, err := bson.ObjectIDFromHex(driverID)
		if err == nil {
			if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": userObjID}).Decode(&driver); err == nil {
				truckID = driver.AssignedTruckID
				truckPlate = driver.AssignedTruckPlate
			}
		}

		// 2. Try finding truck assigned to this driver user_id
		if truckID == "" {
			var trk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"driver_assigned_id": driverID}).Decode(&trk); err == nil {
				truckID = trk.ID.Hex()
				truckPlate = trk.PlateNumber
			}
		}

		// 3. Fallback to any active/available truck
		if truckID == "" {
			var fallbackTrk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"status": bson.M{"$in": []string{"working", "available"}}}).Decode(&fallbackTrk); err == nil {
				truckID = fallbackTrk.ID.Hex()
				truckPlate = fallbackTrk.PlateNumber
			}
		}
	}

	if truckPlate == "" && truckID != "" {
		var trk models.Truck
		trkObjID, err := bson.ObjectIDFromHex(truckID)
		if err == nil {
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": trkObjID}).Decode(&trk); err == nil {
				truckPlate = trk.PlateNumber
			}
		}
	}

	if truckID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No truck assigned to this driver. Please assign a truck in the Admin Portal."})
		return
	}

	// Validate odometer reading cannot be less than previous recorded reading
	if input.StartOdometer > 0 {
		prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
		if prevOdo > 0 && input.StartOdometer < prevOdo {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Starting odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) for truck %s. As the vehicle travels, odometer readings must increase.", input.StartOdometer, prevOdo, truckPlate),
				"min_odometer": prevOdo,
			})
			return
		}
	}

	if input.EndOdometer > 0 {
		if input.StartOdometer > 0 && input.EndOdometer < input.StartOdometer {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Ending odometer reading (%.0f km) cannot be less than the starting odometer reading (%.0f km). As the vehicle travels, odometer readings must increase.", input.EndOdometer, input.StartOdometer),
				"min_odometer": input.StartOdometer,
			})
			return
		}
		prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
		if prevOdo > 0 && input.EndOdometer < prevOdo {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Ending odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) for truck %s. As the vehicle travels, odometer readings must increase.", input.EndOdometer, prevOdo, truckPlate),
				"min_odometer": prevOdo,
			})
			return
		}
	}

	// Calculate Quantity in Kg and Gross Revenue
	var quantityKg float64
	var grossRevenue float64
	var transitRevenue float64
	var destinationRevenue float64

	if isSplit {
		if input.TransitUnit == "" {
			input.TransitUnit = "ton"
		}
		if input.DestinationUnit == "" {
			input.DestinationUnit = "ton"
		}
		if input.TransitPricingMethod == "" {
			input.TransitPricingMethod = "per_ton"
		}
		if input.DestinationPricingMethod == "" {
			input.DestinationPricingMethod = "per_ton"
		}

		transitKg := toKg(input.TransitQuantity, input.TransitUnit)
		destKg := toKg(input.DestinationQuantity, input.DestinationUnit)
		quantityKg = transitKg + destKg

		normT := normalizeUnit(input.TransitUnit)
		normD := normalizeUnit(input.DestinationUnit)
		if input.Unit == "" {
			if normT == normD {
				input.Unit = normT
			} else {
				input.Unit = "ton"
			}
		} else {
			input.Unit = normalizeUnit(input.Unit)
		}

		input.Quantity = calculateUnifiedQuantity(quantityKg, input.Unit)
		if input.PricingTarget == "" {
			input.PricingTarget = "split"
		}

		if input.PricingMethod == "lump_sum" && input.LumpSum > 0 && input.TransitLumpSum <= 0 && input.DestinationLumpSum <= 0 {
			grossRevenue = input.LumpSum
		} else {
			transitRevenue = computeLegRevenue(input.TransitQuantity, input.TransitUnit, input.TransitPricingMethod, input.TransitUnitPrice, input.TransitLumpSum)
			destinationRevenue = computeLegRevenue(input.DestinationQuantity, input.DestinationUnit, input.DestinationPricingMethod, input.DestinationUnitPrice, input.DestinationLumpSum)
			grossRevenue = transitRevenue + destinationRevenue
			if grossRevenue <= 0 && input.LumpSum > 0 {
				grossRevenue = input.LumpSum
			}
		}

		if input.ReceiptNumber == "" {
			if input.TransitReceiptNumber != "" && input.DestinationReceiptNumber != "" {
				input.ReceiptNumber = input.TransitReceiptNumber + " / " + input.DestinationReceiptNumber
			} else if input.TransitReceiptNumber != "" {
				input.ReceiptNumber = input.TransitReceiptNumber
			} else {
				input.ReceiptNumber = input.DestinationReceiptNumber
			}
		}
	} else {
		if input.Unit == "" {
			input.Unit = "ton"
		} else {
			input.Unit = normalizeUnit(input.Unit)
		}
		quantityKg = toKg(input.Quantity, input.Unit)

		if input.PricingMethod == "lump_sum" {
			grossRevenue = input.LumpSum
		} else {
			grossRevenue = input.Quantity * input.UnitPrice
		}
	}

	// Calculate Additional Fees and Net/Total Revenue
	var totalAdditionalFees float64
	validFees := make([]models.TripFee, 0)
	for _, f := range input.AdditionalFees {
		if f.Amount > 0 {
			feeType := strings.ToLower(strings.TrimSpace(f.FeeType))
			if feeType == "" {
				feeType = "other"
			}
			f.FeeType = feeType
			totalAdditionalFees += f.Amount
			validFees = append(validFees, f)
		}
	}
	totalRevenue := grossRevenue - totalAdditionalFees
	netRevenue := totalRevenue

	// Determine trip date
	tripDate := time.Now()
	if input.Date != "" {
		if t, err := time.Parse("2006-01-02", input.Date); err == nil {
			tripDate = t
		}
	}

	tripNumber := h.GenerateNextNumber(ctx, "trips", "TR")

	loadingSiteName := input.LoadingSiteName
	if loadingSiteName == "" && input.LoadingSiteID != "" {
		if sObjID, err := bson.ObjectIDFromHex(input.LoadingSiteID); err == nil {
			var s models.Site
			if err := h.DB.Sites.FindOne(ctx, bson.M{"_id": sObjID}).Decode(&s); err == nil {
				loadingSiteName = s.Name
			}
		}
	}

	dumpingSiteName := input.DumpingSiteName
	if dumpingSiteName == "" && input.DumpingSiteID != "" {
		if sObjID, err := bson.ObjectIDFromHex(input.DumpingSiteID); err == nil {
			var s models.Site
			if err := h.DB.Sites.FindOne(ctx, bson.M{"_id": sObjID}).Decode(&s); err == nil {
				dumpingSiteName = s.Name
			}
		}
	}

	materialName := input.MaterialName
	if materialName == "" && input.MaterialID != "" {
		if mObjID, err := bson.ObjectIDFromHex(input.MaterialID); err == nil {
			var m models.Material
			if err := h.DB.Materials.FindOne(ctx, bson.M{"_id": mObjID}).Decode(&m); err == nil {
				materialName = m.Name
			}
		}
	}

	transitionPointName := input.TransitionPointName
	hasTransition := input.HasTransition || len(input.TransitionPointIDs) > 0 || isSplit
	if transitionPointName == "" && len(input.TransitionPointIDs) > 0 {
		var names []string
		for _, tid := range input.TransitionPointIDs {
			if tObjID, err := bson.ObjectIDFromHex(tid); err == nil {
				var s models.Site
				if err := h.DB.Sites.FindOne(ctx, bson.M{"_id": tObjID}).Decode(&s); err == nil {
					names = append(names, s.Name)
				}
			}
		}
		transitionPointName = strings.Join(names, ", ")
	}

	dropOffLoc := input.DropOffLocation
	if dropOffLoc == "" {
		if input.PricingTarget == "transit" && transitionPointName != "" {
			dropOffLoc = transitionPointName
		} else if isSplit {
			dropOffLoc = fmt.Sprintf("%s + %s (Split)", transitionPointName, dumpingSiteName)
		} else {
			dropOffLoc = dumpingSiteName
		}
	}
	pricingTarget := input.PricingTarget
	if pricingTarget == "" {
		if isSplit {
			pricingTarget = "split"
		} else {
			pricingTarget = "destination"
		}
	}

	transitUnitPrice := input.TransitUnitPrice
	transitLumpSum := input.TransitLumpSum
	destUnitPrice := input.DestinationUnitPrice
	destLumpSum := input.DestinationLumpSum

	if !isSplit {
		if pricingTarget == "transit" {
			transitUnitPrice = input.UnitPrice
			transitLumpSum = input.LumpSum
		} else {
			destUnitPrice = input.UnitPrice
			destLumpSum = input.LumpSum
		}
	}

	trip := models.Trip{
		ID:                       bson.NewObjectID(),
		TripNumber:               tripNumber,
		DriverID:                 driverID,
		DriverName:               driverName,
		TruckID:                  truckID,
		TruckPlate:               truckPlate,
		LoadingSiteID:            input.LoadingSiteID,
		LoadingSiteName:          loadingSiteName,
		DumpingSiteID:            input.DumpingSiteID,
		DumpingSiteName:          dumpingSiteName,
		HasTransition:            hasTransition,
		TransitionPointIDs:       input.TransitionPointIDs,
		TransitionPointName:      transitionPointName,
		MaterialID:               input.MaterialID,
		MaterialName:             materialName,
		Quantity:                 input.Quantity,
		Unit:                     input.Unit,
		QuantityKg:               quantityKg,
		PricingMethod:            input.PricingMethod,
		UnitPrice:                input.UnitPrice,
		PricingTarget:            pricingTarget,
		DropOffLocation:          dropOffLoc,
		TransitNotes:             input.TransitNotes,
		TransitUnitPrice:         transitUnitPrice,
		TransitUnitPriceSplit:    transitUnitPrice,
		DestinationUnitPrice:     destUnitPrice,
		DestinationUnitPriceSplit: destUnitPrice,
		PriceDifference:          input.PriceDifference,
		LumpSum:                  input.LumpSum,
		IsSplitDrop:              isSplit,
		TransitQuantity:          input.TransitQuantity,
		TransitUnit:              input.TransitUnit,
		TransitQuantityKg:        toKg(input.TransitQuantity, input.TransitUnit),
		TransitPricingMethod:     input.TransitPricingMethod,
		TransitLumpSum:           transitLumpSum,
		TransitRevenue:           transitRevenue,
		TransitReceiptNumber:     input.TransitReceiptNumber,
		DestinationQuantity:      input.DestinationQuantity,
		DestinationUnit:          input.DestinationUnit,
		DestinationQuantityKg:    toKg(input.DestinationQuantity, input.DestinationUnit),
		DestinationPricingMethod: input.DestinationPricingMethod,
		DestinationLumpSum:       destLumpSum,
		DestinationRevenue:       destinationRevenue,
		DestinationReceiptNumber: input.DestinationReceiptNumber,
		GrossRevenue:             grossRevenue,
		TotalRevenue:             totalRevenue,
		AdditionalFees:           validFees,
		TotalAdditionalFees:      totalAdditionalFees,
		NetRevenue:               netRevenue,
		StartOdometer:            input.StartOdometer,
		EndOdometer:              input.EndOdometer,
		ReceiptNumber:            input.ReceiptNumber,
		Date:                     tripDate,
		Status:                   "completed",
		PaymentStatus:            "pending",
		PaidAmount:               0,
		Notes:                    input.Notes,
		CreatedAt:                time.Now(),
		UpdatedAt:                time.Now(),
	}
	if input.Status != "" {
		trip.Status = input.Status
	}

	_, err := h.DB.Trips.InsertOne(ctx, trip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record trip: " + err.Error()})
		return
	}

	// Automatically create synchronized active Expense records for fees incurred
	for _, fee := range validFees {
		expType := fee.FeeType
		if expType != "toll" && expType != "parking" && expType != "washing" && expType != "maintenance" && expType != "weighbridge" && expType != "gate_fee" {
			expType = "other"
		}

		// Prevent duplicate expense record if already recorded for this trip fee
		existingFeeCount, _ := h.DB.Expenses.CountDocuments(ctx, bson.M{
			"$or": []bson.M{
				{"trip_id": trip.ID.Hex(), "amount": fee.Amount, "expense_type": expType},
				{"receipt_number": fmt.Sprintf("TRIP-%s", tripNumber), "amount": fee.Amount},
			},
			"status": bson.M{"$ne": "cancelled"},
		})
		if existingFeeCount > 0 {
			continue
		}

		expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
		desc := fee.Description
		if desc == "" {
			desc = fmt.Sprintf("Trip %s: %s fee", tripNumber, strings.Title(fee.FeeType))
		} else {
			desc = fmt.Sprintf("Trip %s [%s]: %s", tripNumber, fee.FeeType, desc)
		}
		expense := models.Expense{
			ID:            bson.NewObjectID(),
			ExpenseNumber: expNumber,
			TruckID:       truckID,
			TruckPlate:    truckPlate,
			DriverID:      driverID,
			DriverName:    driverName,
			TripID:        trip.ID.Hex(),
			TripNumber:    tripNumber,
			ExpenseType:   expType,
			Amount:        fee.Amount,
			Date:          tripDate,
			Description:   desc,
			ReceiptNumber: fmt.Sprintf("TRIP-%s", tripNumber),
			Status:        "active",
			CreatedAt:     time.Now(),
		}
		_, _ = h.DB.Expenses.InsertOne(ctx, expense)
	}

	// Audit Log
	h.LogAudit(ctx, userIDStr, fullName, "Submitted Trip", "Trip", trip.ID.Hex(), "",
		fmt.Sprintf("Trip %s: %.1f %s %s (Revenue: %.0f ETB, Fees: %.0f ETB, Net: %.0f ETB)",
			tripNumber, trip.Quantity, trip.Unit, trip.MaterialName, trip.TotalRevenue, trip.TotalAdditionalFees, trip.NetRevenue))

	// Notification for Admins
	h.CreateNotification(ctx, "", "admin", fmt.Sprintf("New Trip %s Recorded", tripNumber),
		fmt.Sprintf("%s recorded trip with %s (Net: %.0f ETB)", driverName, trip.MaterialName, trip.NetRevenue), "trip_submitted")

	c.JSON(http.StatusCreated, trip)
}

func (h *TripHandler) GetTrips(c *gin.Context) {
	userRole := c.GetString("role")
	userIDStr := c.GetString("userID")

	filter := bson.M{}

	// Enforce strict RBAC: Drivers only see their own trips
	if userRole == string(models.RoleDriver) {
		filter["driver_id"] = userIDStr
	} else {
		// Admin filters
		if driverID := c.Query("driver_id"); driverID != "" {
			filter["driver_id"] = driverID
		}
		if truckID := c.Query("truck_id"); truckID != "" {
			filter["truck_id"] = truckID
		}
		if siteID := c.Query("loading_site_id"); siteID != "" {
			filter["loading_site_id"] = siteID
		}
		if materialID := c.Query("material_id"); materialID != "" {
			filter["material_id"] = materialID
		}
		if status := c.Query("status"); status != "" {
			filter["status"] = status
		}
		if paymentStatus := c.Query("payment_status"); paymentStatus != "" {
			if paymentStatus == "pending" {
				filter["$or"] = []bson.M{
					{"payment_status": "pending"},
					{"payment_status": ""},
					{"payment_status": bson.M{"$exists": false}},
				}
			} else {
				filter["payment_status"] = paymentStatus
			}
		}
	}

	// Date filters
	period := c.Query("period") // "today", "yesterday", "this_week", "this_month", "last_month", "custom"
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	dateStr := c.Query("date")

	now := time.Now()
	if period == "today" {
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		filter["date"] = bson.M{"$gte": startOfDay}
	} else if period == "yesterday" {
		yest := now.AddDate(0, 0, -1)
		startOfYest := time.Date(yest.Year(), yest.Month(), yest.Day(), 0, 0, 0, 0, now.Location())
		endOfYest := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		filter["date"] = bson.M{"$gte": startOfYest, "$lt": endOfYest}
	} else if period == "this_week" {
		startOfWeek := now.AddDate(0, 0, -int(now.Weekday()))
		startOfWeek = time.Date(startOfWeek.Year(), startOfWeek.Month(), startOfWeek.Day(), 0, 0, 0, 0, startOfWeek.Location())
		filter["date"] = bson.M{"$gte": startOfWeek}
	} else if period == "this_month" {
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		filter["date"] = bson.M{"$gte": startOfMonth}
	} else if period == "last_month" {
		firstDayLastMonth := time.Date(now.Year(), now.Month()-1, 1, 0, 0, 0, 0, now.Location())
		firstDayThisMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		filter["date"] = bson.M{"$gte": firstDayLastMonth, "$lt": firstDayThisMonth}
	} else if dateStr != "" {
		if d, err := time.Parse("2006-01-02", dateStr); err == nil {
			startOfDay := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, now.Location())
			endOfDay := startOfDay.AddDate(0, 0, 1)
			filter["date"] = bson.M{"$gte": startOfDay, "$lt": endOfDay}
		}
	} else if startDateStr != "" || endDateStr != "" {
		dateFilter := bson.M{}
		if startDateStr != "" {
			if st, err := time.Parse("2006-01-02", startDateStr); err == nil {
				startOfDay := time.Date(st.Year(), st.Month(), st.Day(), 0, 0, 0, 0, now.Location())
				dateFilter["$gte"] = startOfDay
			}
		}
		if endDateStr != "" {
			if et, err := time.Parse("2006-01-02", endDateStr); err == nil {
				endExclusive := time.Date(et.Year(), et.Month(), et.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, 1)
				dateFilter["$lt"] = endExclusive
			}
		}
		if len(dateFilter) > 0 {
			filter["date"] = dateFilter
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}, {Key: "created_at", Value: -1}})
	cursor, err := h.DB.Trips.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trips"})
		return
	}
	defer cursor.Close(ctx)

	trips := make([]models.Trip, 0)
	if err := cursor.All(ctx, &trips); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode trips"})
		return
	}

	c.JSON(http.StatusOK, trips)
}

func (h *TripHandler) GetRecentTrip(c *gin.Context) {
	userIDStr := c.GetString("userID")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	findOpts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	var trip models.Trip
	err := h.DB.Trips.FindOne(ctx, bson.M{"driver_id": userIDStr, "status": "completed"}, findOpts).Decode(&trip)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"has_recent": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"has_recent": true,
		"trip":       trip,
	})
}

type StartTripInput struct {
	TruckID                  string   `json:"truck_id"`
	TruckPlate               string   `json:"truck_plate"`
	DriverID                 string   `json:"driver_id"`
	DriverName               string   `json:"driver_name"`
	StartOdometer            float64  `json:"start_odometer" binding:"required"`
	LoadingSiteID            string   `json:"loading_site_id" binding:"required"`
	LoadingSiteName          string   `json:"loading_site_name"`
	DumpingSiteID            string   `json:"dumping_site_id" binding:"required"`
	DumpingSiteName          string   `json:"dumping_site_name"`
	MaterialID               string   `json:"material_id" binding:"required"`
	MaterialName             string   `json:"material_name"`
	HasTransition            bool     `json:"has_transition"`
	TransitionPointIDs       []string `json:"transition_point_ids"`
	TransitionPointName      string   `json:"transition_point_name"`
	PricingTarget            string   `json:"pricing_target"`
	PricingMethod            string   `json:"pricing_method"`
	UnitPrice                float64  `json:"unit_price"`
	TransitUnitPrice         float64  `json:"transit_unit_price"`
	DestinationUnitPrice     float64  `json:"destination_unit_price"`
	PriceDifference          float64  `json:"price_difference"`
	LumpSum                  float64  `json:"lump_sum"`
	IsSplitDrop              bool     `json:"is_split_drop"`
	TransitQuantity          float64  `json:"transit_quantity"`
	TransitUnit              string   `json:"transit_unit"`
	TransitPricingMethod     string   `json:"transit_pricing_method"`
	TransitLumpSum           float64  `json:"transit_lump_sum"`
	DestinationQuantity      float64  `json:"destination_quantity"`
	DestinationUnit          string   `json:"destination_unit"`
	DestinationPricingMethod string   `json:"destination_pricing_method"`
	DestinationLumpSum       float64  `json:"destination_lump_sum"`
	CargoWeight              float64  `json:"cargo_weight"`
	WeightTicketNumber       string   `json:"weight_ticket_number"`
	DropOffLocation          string   `json:"drop_off_location"`
	TransitNotes             string   `json:"transit_notes"`
	Date                     string   `json:"date"`
}

func (h *TripHandler) StartTrip(c *gin.Context) {
	var input StartTripInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide required trip start data: " + err.Error()})
		return
	}

	if input.StartOdometer <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please enter a valid starting odometer reading (km)"})
		return
	}

	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")
	fullName := c.GetString("fullName")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	driverID := input.DriverID
	driverName := input.DriverName
	truckID := input.TruckID
	truckPlate := input.TruckPlate

	if userRole == string(models.RoleDriver) || driverID == "" {
		driverID = userIDStr
		driverName = fullName
	}

	if truckID == "" {
		var driver models.Driver
		userObjID, err := bson.ObjectIDFromHex(driverID)
		if err == nil {
			if err := h.DB.Drivers.FindOne(ctx, bson.M{"user_id": userObjID}).Decode(&driver); err == nil {
				truckID = driver.AssignedTruckID
				truckPlate = driver.AssignedTruckPlate
			}
		}
		if truckID == "" {
			var trk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"driver_assigned_id": driverID}).Decode(&trk); err == nil {
				truckID = trk.ID.Hex()
				truckPlate = trk.PlateNumber
			}
		}
		if truckID == "" {
			var fallbackTrk models.Truck
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"status": bson.M{"$in": []string{"working", "available"}}}).Decode(&fallbackTrk); err == nil {
				truckID = fallbackTrk.ID.Hex()
				truckPlate = fallbackTrk.PlateNumber
			}
		}
	}

	if truckPlate == "" && truckID != "" {
		var trk models.Truck
		trkObjID, err := bson.ObjectIDFromHex(truckID)
		if err == nil {
			if err := h.DB.Trucks.FindOne(ctx, bson.M{"_id": trkObjID}).Decode(&trk); err == nil {
				truckPlate = trk.PlateNumber
			}
		}
	}

	if truckID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No truck assigned to this driver. Please assign a truck in the Admin Portal."})
		return
	}

	// Validate odometer reading cannot be less than previous recorded reading
	prevOdo := h.GetTruckLatestOdometer(ctx, truckID, driverID)
	if prevOdo > 0 && input.StartOdometer < prevOdo {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Starting odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) for truck %s. As the vehicle travels, odometer readings must increase.", input.StartOdometer, prevOdo, truckPlate),
			"min_odometer": prevOdo,
		})
		return
	}

	tripDate := time.Now()
	if input.Date != "" {
		if t, err := time.Parse("2006-01-02", input.Date); err == nil {
			tripDate = t
		}
	}

	now := time.Now()
	tripNumber := h.GenerateNextNumber(ctx, "trips", "TR")

	loadingSiteName := input.LoadingSiteName
	if loadingSiteName == "" && input.LoadingSiteID != "" {
		if sObjID, err := bson.ObjectIDFromHex(input.LoadingSiteID); err == nil {
			var s models.Site
			if err := h.DB.Sites.FindOne(ctx, bson.M{"_id": sObjID}).Decode(&s); err == nil {
				loadingSiteName = s.Name
			}
		}
	}

	dumpingSiteName := input.DumpingSiteName
	if dumpingSiteName == "" && input.DumpingSiteID != "" {
		if sObjID, err := bson.ObjectIDFromHex(input.DumpingSiteID); err == nil {
			var s models.Site
			if err := h.DB.Sites.FindOne(ctx, bson.M{"_id": sObjID}).Decode(&s); err == nil {
				dumpingSiteName = s.Name
			}
		}
	}

	materialName := input.MaterialName
	if materialName == "" && input.MaterialID != "" {
		if mObjID, err := bson.ObjectIDFromHex(input.MaterialID); err == nil {
			var m models.Material
			if err := h.DB.Materials.FindOne(ctx, bson.M{"_id": mObjID}).Decode(&m); err == nil {
				materialName = m.Name
			}
		}
	}

	transitionPointName := strings.TrimSpace(input.TransitionPointName)
	hasTransition := input.HasTransition || len(input.TransitionPointIDs) > 0 || transitionPointName != ""
	if transitionPointName == "" && len(input.TransitionPointIDs) > 0 {
		var names []string
		for _, tid := range input.TransitionPointIDs {
			if tObjID, err := bson.ObjectIDFromHex(tid); err == nil {
				var s models.Site
				if err := h.DB.Sites.FindOne(ctx, bson.M{"_id": tObjID}).Decode(&s); err == nil {
					names = append(names, s.Name)
				}
			}
		}
		transitionPointName = strings.Join(names, ", ")
	}

	trip := models.Trip{
		ID:                  bson.NewObjectID(),
		TripNumber:          tripNumber,
		DriverID:            driverID,
		DriverName:          driverName,
		TruckID:             truckID,
		TruckPlate:          truckPlate,
		LoadingSiteID:       input.LoadingSiteID,
		LoadingSiteName:     loadingSiteName,
		DumpingSiteID:       input.DumpingSiteID,
		DumpingSiteName:     dumpingSiteName,
		HasTransition:       hasTransition,
		TransitionPointIDs:  input.TransitionPointIDs,
		TransitionPointName: transitionPointName,
		MaterialID:           input.MaterialID,
		MaterialName:         materialName,
		PricingTarget:        input.PricingTarget,
		DropOffLocation:      input.DropOffLocation,
		TransitNotes:         input.TransitNotes,
		PricingMethod:        input.PricingMethod,
		UnitPrice:            input.UnitPrice,
		TransitUnitPrice:         input.TransitUnitPrice,
		DestinationUnitPrice:     input.DestinationUnitPrice,
		PriceDifference:          input.PriceDifference,
		LumpSum:                  input.LumpSum,
		IsSplitDrop:              input.IsSplitDrop,
		TransitQuantity:          input.TransitQuantity,
		TransitUnit:              input.TransitUnit,
		TransitPricingMethod:     input.TransitPricingMethod,
		TransitLumpSum:           input.TransitLumpSum,
		DestinationQuantity:      input.DestinationQuantity,
		DestinationUnit:          input.DestinationUnit,
		DestinationPricingMethod: input.DestinationPricingMethod,
		DestinationLumpSum:       input.DestinationLumpSum,
		StartOdometer:            input.StartOdometer,
		Status:                   "in_progress",
		PaymentStatus:       "pending",
		PaidAmount:          0,
		StartedAt:           &now,
		Date:                tripDate,
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	_, err := h.DB.Trips.InsertOne(ctx, trip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start trip: " + err.Error()})
		return
	}

	// Update truck odometer / mileage
	if trkObjID, err := bson.ObjectIDFromHex(truckID); err == nil {
		_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
			"$set": bson.M{
				"current_odometer": input.StartOdometer,
				"current_mileage":  input.StartOdometer,
				"mileage":          input.StartOdometer,
				"status":           "working",
			},
		})
	}

	// Auto-record starting odometer in OdometerReadings for this trip
	todayStr := time.Now().Format("2006-01-02")
	tripOdo := models.OdometerReading{
		ID:           bson.NewObjectID(),
		DriverID:     driverID,
		DriverName:   driverName,
		TruckID:      truckID,
		TruckPlate:   truckPlate,
		TripID:       trip.ID.Hex(),
		TripNumber:   tripNumber,
		Date:         todayStr,
		StartReading: input.StartOdometer,
		StartTime:    &now,
		StartNotes:   fmt.Sprintf("Trip %s: %s → %s (%s)", tripNumber, input.LoadingSiteName, input.DumpingSiteName, input.MaterialName),
		Source:       "trip_start",
		Status:       "started",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	_, _ = h.DB.OdometerReadings.InsertOne(ctx, tripOdo)

	h.CreateNotification(ctx, "", "admin",
		fmt.Sprintf("Trip %s Started (%s)", tripNumber, truckPlate),
		fmt.Sprintf("Driver %s started trip from %s to %s with %s (Start km: %.0f)",
			driverName, input.LoadingSiteName, input.DumpingSiteName, input.MaterialName, input.StartOdometer),
		"trip_submitted")

	h.LogAudit(ctx, driverID, driverName, "Started Hauling Trip", "Trip", trip.ID.Hex(), "",
		fmt.Sprintf("Driver started trip %s (%s → %s, start km: %.0f)", tripNumber, input.LoadingSiteName, input.DumpingSiteName, input.StartOdometer))

	c.JSON(http.StatusCreated, trip)
}

type CompleteTripInput struct {
	TripID                   string           `json:"trip_id"`
	ReceiptNumber            string           `json:"receipt_number"`
	Quantity                 float64          `json:"quantity"`
	Unit                     string           `json:"unit"`
	PricingMethod            string           `json:"pricing_method"`
	UnitPrice                float64          `json:"unit_price"`
	PricingTarget            string           `json:"pricing_target"`
	TransitUnitPrice          float64          `json:"transit_unit_price"`
	TransitUnitPriceSplit     float64          `json:"transit_unit_price_split"`
	DestinationUnitPrice      float64          `json:"destination_unit_price"`
	DestinationUnitPriceSplit float64          `json:"destination_unit_price_split"`
	PriceDifference          float64          `json:"price_difference"`
	LumpSum                  float64          `json:"lump_sum"`
	IsSplitDrop              bool             `json:"is_split_drop"`
	TransitQuantity          float64          `json:"transit_quantity"`
	TransitUnit              string           `json:"transit_unit"`
	TransitPricingMethod     string           `json:"transit_pricing_method"`
	TransitLumpSum           float64          `json:"transit_lump_sum"`
	TransitReceiptNumber     string           `json:"transit_receipt_number"`
	DestinationQuantity      float64          `json:"destination_quantity"`
	DestinationUnit          string           `json:"destination_unit"`
	DestinationPricingMethod string           `json:"destination_pricing_method"`
	DestinationLumpSum       float64          `json:"destination_lump_sum"`
	DestinationReceiptNumber string           `json:"destination_receipt_number"`
	AdditionalFees           []models.TripFee `json:"additional_fees"`
	DropOffLocation          string           `json:"drop_off_location"`
	TransitNotes             string           `json:"transit_notes"`
	TransitionPointName      string           `json:"transition_point_name"`
	HasTransition            bool             `json:"has_transition"`
	Notes                    string           `json:"notes"`
	EndOdometer              float64          `json:"end_odometer"`
}

func (h *TripHandler) CompleteTrip(c *gin.Context) {
	tripID := c.Param("id")
	var input CompleteTripInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide required trip completion data: " + err.Error()})
		return
	}

	if input.TransitUnitPrice <= 0 && input.TransitUnitPriceSplit > 0 {
		input.TransitUnitPrice = input.TransitUnitPriceSplit
	}
	if input.DestinationUnitPrice <= 0 && input.DestinationUnitPriceSplit > 0 {
		input.DestinationUnitPrice = input.DestinationUnitPriceSplit
	}

	if tripID == "" {
		tripID = input.TripID
	}

	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existingTrip models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&existingTrip); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")
	if userRole == string(models.RoleDriver) && existingTrip.DriverID != userIDStr {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized: you can only complete trips assigned to your account"})
		return
	}

	if input.TransitUnitPrice <= 0 && existingTrip.TransitUnitPrice > 0 {
		input.TransitUnitPrice = existingTrip.TransitUnitPrice
	}
	if input.DestinationUnitPrice <= 0 && existingTrip.DestinationUnitPrice > 0 {
		input.DestinationUnitPrice = existingTrip.DestinationUnitPrice
	}
	if input.TransitPricingMethod == "" && existingTrip.TransitPricingMethod != "" {
		input.TransitPricingMethod = existingTrip.TransitPricingMethod
	}
	if input.DestinationPricingMethod == "" && existingTrip.DestinationPricingMethod != "" {
		input.DestinationPricingMethod = existingTrip.DestinationPricingMethod
	}
	if input.TransitLumpSum <= 0 && existingTrip.TransitLumpSum > 0 {
		input.TransitLumpSum = existingTrip.TransitLumpSum
	}
	if input.DestinationLumpSum <= 0 && existingTrip.DestinationLumpSum > 0 {
		input.DestinationLumpSum = existingTrip.DestinationLumpSum
	}

	isSplit := input.IsSplitDrop && (input.TransitQuantity > 0 || input.DestinationQuantity > 0)
	if isSplit {
		if input.TransitQuantity <= 0 && input.DestinationQuantity <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify cargo quantities unloaded at transit point or destination"})
			return
		}
	} else {
		if input.Quantity <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than zero"})
			return
		}

		if input.PricingMethod != "lump_sum" && input.UnitPrice <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unit price must be greater than zero"})
			return
		}

		if input.PricingMethod == "lump_sum" && input.LumpSum <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Lump sum amount must be greater than zero"})
			return
		}
	}

	var quantityKg float64
	var grossRevenue float64
	var transitRevenue float64
	var destinationRevenue float64

	if isSplit {
		if input.TransitUnit == "" {
			input.TransitUnit = "ton"
		}
		if input.DestinationUnit == "" {
			input.DestinationUnit = "ton"
		}
		if input.TransitPricingMethod == "" {
			input.TransitPricingMethod = "per_ton"
		}
		if input.DestinationPricingMethod == "" {
			input.DestinationPricingMethod = "per_ton"
		}

		transitKg := toKg(input.TransitQuantity, input.TransitUnit)
		destKg := toKg(input.DestinationQuantity, input.DestinationUnit)
		quantityKg = transitKg + destKg

		normT := normalizeUnit(input.TransitUnit)
		normD := normalizeUnit(input.DestinationUnit)
		if input.Unit == "" {
			if normT == normD {
				input.Unit = normT
			} else {
				input.Unit = "ton"
			}
		} else {
			input.Unit = normalizeUnit(input.Unit)
		}

		input.Quantity = calculateUnifiedQuantity(quantityKg, input.Unit)
		if input.PricingTarget == "" {
			input.PricingTarget = "split"
		}

		if input.PricingMethod == "lump_sum" && input.LumpSum > 0 && input.TransitLumpSum <= 0 && input.DestinationLumpSum <= 0 {
			grossRevenue = input.LumpSum
		} else {
			transitRevenue = computeLegRevenue(input.TransitQuantity, input.TransitUnit, input.TransitPricingMethod, input.TransitUnitPrice, input.TransitLumpSum)
			destinationRevenue = computeLegRevenue(input.DestinationQuantity, input.DestinationUnit, input.DestinationPricingMethod, input.DestinationUnitPrice, input.DestinationLumpSum)
			grossRevenue = transitRevenue + destinationRevenue
			if grossRevenue <= 0 && input.LumpSum > 0 {
				grossRevenue = input.LumpSum
			}
		}

		if input.ReceiptNumber == "" {
			if input.TransitReceiptNumber != "" && input.DestinationReceiptNumber != "" {
				input.ReceiptNumber = input.TransitReceiptNumber + " / " + input.DestinationReceiptNumber
			} else if input.TransitReceiptNumber != "" {
				input.ReceiptNumber = input.TransitReceiptNumber
			} else {
				input.ReceiptNumber = input.DestinationReceiptNumber
			}
		}
	} else {
		if input.Unit == "" {
			input.Unit = "ton"
		} else {
			input.Unit = normalizeUnit(input.Unit)
		}
		quantityKg = toKg(input.Quantity, input.Unit)

		if input.PricingMethod == "lump_sum" {
			grossRevenue = input.LumpSum
		} else {
			grossRevenue = input.Quantity * input.UnitPrice
		}
	}

	var totalAdditionalFees float64
	validFees := make([]models.TripFee, 0)
	for _, f := range input.AdditionalFees {
		if f.Amount > 0 {
			feeType := strings.ToLower(strings.TrimSpace(f.FeeType))
			if feeType == "" {
				feeType = "other"
			}
			f.FeeType = feeType
			totalAdditionalFees += f.Amount
			validFees = append(validFees, f)
		}
	}
	totalRevenue := grossRevenue - totalAdditionalFees
	netRevenue := totalRevenue

	now := time.Now()

	dropOffLoc := input.DropOffLocation
	if dropOffLoc == "" {
		if input.PricingTarget == "transit" && existingTrip.TransitionPointName != "" {
			dropOffLoc = existingTrip.TransitionPointName
		} else if isSplit {
			dropOffLoc = fmt.Sprintf("%s + %s (Split)", existingTrip.TransitionPointName, existingTrip.DumpingSiteName)
		} else if existingTrip.DropOffLocation != "" {
			dropOffLoc = existingTrip.DropOffLocation
		} else {
			dropOffLoc = existingTrip.DumpingSiteName
		}
	}
	pricingTarget := input.PricingTarget
	if pricingTarget == "" {
		if isSplit {
			pricingTarget = "split"
		} else if existingTrip.PricingTarget != "" {
			pricingTarget = existingTrip.PricingTarget
		} else {
			pricingTarget = "destination"
		}
	}

	transitUnitPrice := input.TransitUnitPrice
	transitLumpSum := input.TransitLumpSum
	destUnitPrice := input.DestinationUnitPrice
	destLumpSum := input.DestinationLumpSum

	if !isSplit {
		if pricingTarget == "transit" {
			transitUnitPrice = input.UnitPrice
			transitLumpSum = input.LumpSum
		} else {
			destUnitPrice = input.UnitPrice
			destLumpSum = input.LumpSum
		}
	}

	updateFields := bson.M{
		"receipt_number":             input.ReceiptNumber,
		"quantity":                   input.Quantity,
		"unit":                       input.Unit,
		"quantity_kg":                quantityKg,
		"pricing_method":             input.PricingMethod,
		"unit_price":                 input.UnitPrice,
		"pricing_target":             pricingTarget,
		"drop_off_location":          dropOffLoc,
		"transit_notes":              input.TransitNotes,
		"transit_unit_price":         transitUnitPrice,
		"transit_unit_price_split":   transitUnitPrice,
		"destination_unit_price":     destUnitPrice,
		"destination_unit_price_split": destUnitPrice,
		"price_difference":           input.PriceDifference,
		"lump_sum":                   input.LumpSum,
		"is_split_drop":              isSplit,
		"transit_quantity":           input.TransitQuantity,
		"transit_unit":               input.TransitUnit,
		"transit_quantity_kg":        toKg(input.TransitQuantity, input.TransitUnit),
		"transit_pricing_method":     input.TransitPricingMethod,
		"transit_lump_sum":           transitLumpSum,
		"transit_revenue":            transitRevenue,
		"transit_receipt_number":     input.TransitReceiptNumber,
		"destination_quantity":       input.DestinationQuantity,
		"destination_unit":           input.DestinationUnit,
		"destination_quantity_kg":    toKg(input.DestinationQuantity, input.DestinationUnit),
		"destination_pricing_method": input.DestinationPricingMethod,
		"destination_lump_sum":       destLumpSum,
		"destination_revenue":        destinationRevenue,
		"destination_receipt_number": input.DestinationReceiptNumber,
		"gross_revenue":              grossRevenue,
		"total_revenue":              totalRevenue,
		"additional_fees":            validFees,
		"total_additional_fees":      totalAdditionalFees,
		"net_revenue":                netRevenue,
		"status":                     "completed",
		"completed_at":               now,
		"updated_at":                 now,
	}

	if isSplit {
		updateFields["has_transition"] = true
	}
	if strings.TrimSpace(input.TransitionPointName) != "" {
		updateFields["transition_point_name"] = strings.TrimSpace(input.TransitionPointName)
		updateFields["has_transition"] = true
	}

	if existingTrip.PaymentStatus != "paid" {
		updateFields["payment_status"] = "pending"
	}

	if input.Notes != "" {
		updateFields["notes"] = input.Notes
	}
	if input.EndOdometer > 0 {
		if existingTrip.StartOdometer > 0 && input.EndOdometer < existingTrip.StartOdometer {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Closing odometer reading (%.0f km) cannot be less than the trip's starting odometer reading (%.0f km). As the vehicle travels, odometer readings must increase.", input.EndOdometer, existingTrip.StartOdometer),
				"min_odometer": existingTrip.StartOdometer,
			})
			return
		}

		prevOdo := h.GetTruckLatestOdometer(ctx, existingTrip.TruckID, existingTrip.DriverID)
		if prevOdo > 0 && input.EndOdometer < prevOdo {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Closing odometer reading (%.0f km) cannot be less than the previous recorded reading (%.0f km) for truck %s. As the vehicle travels, odometer readings must increase.", input.EndOdometer, prevOdo, existingTrip.TruckPlate),
				"min_odometer": prevOdo,
			})
			return
		}

		updateFields["end_odometer"] = input.EndOdometer
	}

	_, err = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": objID}, bson.M{"$set": updateFields})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete trip: " + err.Error()})
		return
	}

	// Record expenses for each additional fee
	for _, f := range validFees {
		expType := f.FeeType
		if expType != "toll" && expType != "parking" && expType != "washing" && expType != "maintenance" && expType != "weighbridge" && expType != "gate_fee" {
			expType = "other"
		}

		// Prevent duplicate expense record if already recorded for this trip fee
		existingCount, _ := h.DB.Expenses.CountDocuments(ctx, bson.M{
			"$or": []bson.M{
				{"trip_id": existingTrip.ID.Hex(), "amount": f.Amount, "expense_type": expType},
				{"receipt_number": fmt.Sprintf("TRIP-%s", existingTrip.TripNumber), "amount": f.Amount},
				{"description": bson.M{"$regex": fmt.Sprintf("Trip #?%s", existingTrip.TripNumber)}, "amount": f.Amount},
			},
			"status": bson.M{"$ne": "cancelled"},
		})
		if existingCount > 0 {
			// Ensure trip_id and trip_number are attached if missing
			_, _ = h.DB.Expenses.UpdateMany(ctx, bson.M{
				"description": bson.M{"$regex": fmt.Sprintf("Trip #?%s", existingTrip.TripNumber)},
				"trip_id":     "",
			}, bson.M{
				"$set": bson.M{
					"trip_id":        existingTrip.ID.Hex(),
					"trip_number":    existingTrip.TripNumber,
					"receipt_number": fmt.Sprintf("TRIP-%s", existingTrip.TripNumber),
				},
			})
			continue
		}

		expNumber := h.GenerateNextNumber(ctx, "expenses", "EX")
		receiptNum := fmt.Sprintf("TRIP-%s", existingTrip.TripNumber)
		if input.ReceiptNumber != "" {
			receiptNum = input.ReceiptNumber
		}
		expense := models.Expense{
			ID:            bson.NewObjectID(),
			ExpenseNumber: expNumber,
			TruckID:       existingTrip.TruckID,
			TruckPlate:    existingTrip.TruckPlate,
			DriverID:      existingTrip.DriverID,
			DriverName:    existingTrip.DriverName,
			TripID:        existingTrip.ID.Hex(),
			TripNumber:    existingTrip.TripNumber,
			ExpenseType:   expType,
			Amount:        f.Amount,
			Date:          time.Now(),
			Description:   fmt.Sprintf("Trip #%s: %s (%s)", existingTrip.TripNumber, f.Description, expType),
			ReceiptNumber: receiptNum,
			Status:        "active",
			CreatedAt:     time.Now(),
		}
		_, _ = h.DB.Expenses.InsertOne(ctx, expense)
	}

	// If end odometer is provided, update truck mileage and odometer records
	if input.EndOdometer > 0 && existingTrip.TruckID != "" {
		if trkObjID, err := bson.ObjectIDFromHex(existingTrip.TruckID); err == nil {
			_, _ = h.DB.Trucks.UpdateOne(ctx, bson.M{"_id": trkObjID}, bson.M{
				"$max": bson.M{
					"current_odometer": input.EndOdometer,
					"current_mileage":  input.EndOdometer,
					"mileage":          input.EndOdometer,
				},
			})
		}

		// Calculate trip distance
		var tripDist float64
		if existingTrip.StartOdometer > 0 && input.EndOdometer >= existingTrip.StartOdometer {
			tripDist = input.EndOdometer - existingTrip.StartOdometer
		}

		// Update or insert the trip's record in OdometerReadings
		updateTripOdo := bson.M{
			"$set": bson.M{
				"end_reading":    input.EndOdometer,
				"end_time":       &now,
				"receipt_number": input.ReceiptNumber,
				"distance_km":    tripDist,
				"source":         "trip_complete",
				"status":         "completed",
				"updated_at":     now,
				"end_notes":      fmt.Sprintf("Completed trip %s. Receipt #%s. Distance: %.0f km", existingTrip.TripNumber, input.ReceiptNumber, tripDist),
			},
		}
		res, _ := h.DB.OdometerReadings.UpdateOne(ctx, bson.M{"trip_id": existingTrip.ID.Hex()}, updateTripOdo)
		if res.MatchedCount == 0 {
			tripOdo := models.OdometerReading{
				ID:            bson.NewObjectID(),
				DriverID:      existingTrip.DriverID,
				DriverName:    existingTrip.DriverName,
				TruckID:       existingTrip.TruckID,
				TruckPlate:    existingTrip.TruckPlate,
				TripID:        existingTrip.ID.Hex(),
				TripNumber:    existingTrip.TripNumber,
				ReceiptNumber: input.ReceiptNumber,
				Date:          existingTrip.Date.Format("2006-01-02"),
				StartReading:  existingTrip.StartOdometer,
				EndReading:    input.EndOdometer,
				EndTime:       &now,
				DistanceKm:    tripDist,
				Source:        "trip_complete",
				Status:        "completed",
				CreatedAt:     now,
				UpdatedAt:     now,
				EndNotes:      fmt.Sprintf("Completed trip %s. Receipt #%s", existingTrip.TripNumber, input.ReceiptNumber),
			}
			_, _ = h.DB.OdometerReadings.InsertOne(ctx, tripOdo)
		}
	}

	// Fetch updated trip
	var updatedTrip models.Trip
	_ = h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&updatedTrip)

	h.CreateNotification(ctx, "", "admin",
		fmt.Sprintf("Trip %s Completed (%s)", existingTrip.TripNumber, existingTrip.TruckPlate),
		fmt.Sprintf("Trip completed: %s → %s, Receipt: #%s, Revenue: %.0f ETB (Net: %.0f ETB)",
			existingTrip.LoadingSiteName, existingTrip.DumpingSiteName, input.ReceiptNumber, grossRevenue, netRevenue),
		"trip_submitted")

	h.LogAudit(ctx, existingTrip.DriverID, existingTrip.DriverName, "Completed Hauling Trip", "Trip", existingTrip.ID.Hex(), "",
		fmt.Sprintf("Trip %s completed with receipt #%s. Pay: %.0f ETB", existingTrip.TripNumber, input.ReceiptNumber, netRevenue))

	c.JSON(http.StatusOK, updatedTrip)
}

func (h *TripHandler) GetActiveTrip(c *gin.Context) {
	userIDStr := c.GetString("userID")
	userRole := c.GetString("role")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"status": "in_progress"}
	if userRole == string(models.RoleDriver) {
		filter["driver_id"] = userIDStr
	} else if driverID := c.Query("driver_id"); driverID != "" {
		filter["driver_id"] = driverID
	} else if truckID := c.Query("truck_id"); truckID != "" {
		filter["truck_id"] = truckID
	}

	findOpts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
	var trip models.Trip
	err := h.DB.Trips.FindOne(ctx, filter, findOpts).Decode(&trip)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"has_active": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"has_active": true,
		"trip":       trip,
	})
}

func (h *TripHandler) GetSmartRoutePrice(c *gin.Context) {
	loadingSiteID := c.Query("loading_site_id")
	dumpingSiteID := c.Query("dumping_site_id")
	transitPointID := c.Query("transit_point_id")
	if transitPointID == "" {
		transitPointID = c.Query("transition_point_id")
	}
	materialID := c.Query("material_id")

	if loadingSiteID == "" || dumpingSiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "loading_site_id and dumping_site_id are required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	toPerKg := func(price float64, method string) float64 {
		switch method {
		case "per_ton":
			return price / 1000.0
		case "per_quintal":
			return price / 100.0
		case "per_kg":
			return price
		default:
			return price / 1000.0
		}
	}

	toPerTon := func(price float64, method string) float64 {
		switch method {
		case "per_kg":
			return price * 1000.0
		case "per_quintal":
			return price * 10.0
		case "per_ton":
			return price
		default:
			return price
		}
	}

	var destinationPrice float64
	destinationMethod := "per_ton"
	source := "none"

	// 1. Check configured route for Loading -> Dumping (Final Destination)
	destRouteFilter := bson.M{
		"loading_site_id": loadingSiteID,
		"dumping_site_id": dumpingSiteID,
	}
	if materialID != "" {
		destRouteFilter["material_id"] = materialID
	}
	var destRoute models.Route
	if err := h.DB.Routes.FindOne(ctx, destRouteFilter).Decode(&destRoute); err == nil && destRoute.DefaultPrice > 0 {
		destinationPrice = destRoute.DefaultPrice
		if destRoute.PricingMethod != "" {
			destinationMethod = destRoute.PricingMethod
		}
		source = "configured_route"
	}

	// 2. Check previous trips for Loading -> Dumping
	if destinationPrice == 0 {
		tripFilter := bson.M{
			"loading_site_id": loadingSiteID,
			"dumping_site_id": dumpingSiteID,
			"status":          "completed",
		}
		if materialID != "" {
			tripFilter["material_id"] = materialID
		}
		findOpts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
		var lastTrip models.Trip
		if err := h.DB.Trips.FindOne(ctx, tripFilter, findOpts).Decode(&lastTrip); err == nil {
			price := lastTrip.UnitPrice
			if lastTrip.PricingMethod == "lump_sum" {
				price = lastTrip.LumpSum
			}
			if price > 0 {
				destinationPrice = price
				if lastTrip.PricingMethod != "" {
					destinationMethod = lastTrip.PricingMethod
				}
				source = "previous_trip"
			}
		}
	}

	// 3. Fallback to material default price or system settings destination rates
	var sysSettings models.Settings
	_ = h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&sysSettings)

	if destinationPrice == 0 && materialID != "" {
		matObjID, err := bson.ObjectIDFromHex(materialID)
		if err == nil {
			var mat models.Material
			if err := h.DB.Materials.FindOne(ctx, bson.M{"_id": matObjID}).Decode(&mat); err == nil && mat.DefaultPrice > 0 {
				destinationPrice = mat.DefaultPrice
				destinationMethod = "per_ton"
				source = "material_default"
			}
		}
	}

	if destinationPrice == 0 && len(sysSettings.DestinationRateSuggestions) > 0 {
		var dumpingSite models.Site
		if dObjID, err := bson.ObjectIDFromHex(dumpingSiteID); err == nil {
			_ = h.DB.Sites.FindOne(ctx, bson.M{"_id": dObjID}).Decode(&dumpingSite)
		}
		for _, ds := range sysSettings.DestinationRateSuggestions {
			if ds.ID == dumpingSiteID || (dumpingSite.Name != "" && strings.EqualFold(ds.Name, dumpingSite.Name)) {
				if ds.SuggestedRatePerTon > 0 {
					destinationPrice = ds.SuggestedRatePerTon
					destinationMethod = "per_ton"
					source = "system_settings_destination"
					break
				} else if ds.SuggestedLumpSum > 0 {
					destinationPrice = ds.SuggestedLumpSum
					destinationMethod = "lump_sum"
					source = "system_settings_destination"
					break
				}
			}
		}
	}

	// 4. If Transit Point is present, check route/pricing for Loading -> Transit Point
	var transitPrice float64
	transitMethod := destinationMethod
	hasTransitPrice := false
	var configuredTransitLumpSum float64
	var configuredDestLumpSum float64

	if destRoute.TransitPrice > 0 {
		transitPrice = destRoute.TransitPrice
		if destRoute.TransitPricingMethod != "" {
			transitMethod = destRoute.TransitPricingMethod
		}
		hasTransitPrice = true
	}
	if destRoute.TransitLumpSum > 0 {
		configuredTransitLumpSum = destRoute.TransitLumpSum
	}
	if destRoute.LumpSum > 0 {
		configuredDestLumpSum = destRoute.LumpSum
	}

	if transitPointID != "" && !hasTransitPrice {
		transitRouteFilter := bson.M{
			"loading_site_id": loadingSiteID,
			"$or": []bson.M{
				{"dumping_site_id": transitPointID},
				{"transition_point_ids": transitPointID},
			},
		}
		if materialID != "" {
			transitRouteFilter["material_id"] = materialID
		}
		var transitRoute models.Route
		if err := h.DB.Routes.FindOne(ctx, transitRouteFilter).Decode(&transitRoute); err == nil && transitRoute.DefaultPrice > 0 {
			transitPrice = transitRoute.DefaultPrice
			if transitRoute.PricingMethod != "" {
				transitMethod = transitRoute.PricingMethod
			}
			if transitRoute.LumpSum > 0 {
				configuredTransitLumpSum = transitRoute.LumpSum
			}
			hasTransitPrice = true
		}

		if !hasTransitPrice {
			prevTransitFilter := bson.M{
				"loading_site_id": loadingSiteID,
				"$or": []bson.M{
					{"dumping_site_id": transitPointID},
					{"transition_point_ids": transitPointID},
				},
				"status": "completed",
			}
			if materialID != "" {
				prevTransitFilter["material_id"] = materialID
			}
			findOpts := options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}})
			var lastTransitTrip models.Trip
			if err := h.DB.Trips.FindOne(ctx, prevTransitFilter, findOpts).Decode(&lastTransitTrip); err == nil {
				if lastTransitTrip.TransitUnitPrice > 0 {
					transitPrice = lastTransitTrip.TransitUnitPrice
					hasTransitPrice = true
				} else if lastTransitTrip.UnitPrice > 0 && (lastTransitTrip.DumpingSiteID == transitPointID || lastTransitTrip.PricingTarget == "transit") {
					transitPrice = lastTransitTrip.UnitPrice
					if lastTransitTrip.PricingMethod != "" {
						transitMethod = lastTransitTrip.PricingMethod
					}
					hasTransitPrice = true
				}
				if lastTransitTrip.TransitLumpSum > 0 {
					configuredTransitLumpSum = lastTransitTrip.TransitLumpSum
				}
			}
		}

		// Fallback to System Settings Transit Point Suggestions
		if !hasTransitPrice && len(sysSettings.TransitPointSuggestions) > 0 {
			var tpSite models.Site
			if tpObjID, err := bson.ObjectIDFromHex(transitPointID); err == nil {
				_ = h.DB.Sites.FindOne(ctx, bson.M{"_id": tpObjID}).Decode(&tpSite)
			}
			for _, ts := range sysSettings.TransitPointSuggestions {
				if ts.ID == transitPointID || (tpSite.Name != "" && strings.EqualFold(ts.Name, tpSite.Name)) {
					if ts.SuggestedRatePerTon > 0 {
						transitPrice = ts.SuggestedRatePerTon
						transitMethod = "per_ton"
						hasTransitPrice = true
					}
					if ts.SuggestedLumpSum > 0 {
						configuredTransitLumpSum = ts.SuggestedLumpSum
					}
					break
				}
			}
		}
	}

	destPerKg := toPerKg(destinationPrice, destinationMethod)
	transitPerKg := toPerKg(transitPrice, transitMethod)
	diffPerKg := destPerKg - transitPerKg

	destPerTon := toPerTon(destinationPrice, destinationMethod)
	transitPerTon := toPerTon(transitPrice, transitMethod)
	diffPerTon := destPerTon - transitPerTon

	destPerQuintal := destPerTon / 10.0
	transitPerQuintal := transitPerTon / 10.0
	diffPerQuintal := destPerQuintal - transitPerQuintal

	destLumpSum := configuredDestLumpSum
	if destLumpSum == 0 {
		if destinationMethod == "lump_sum" {
			destLumpSum = destinationPrice
		} else if destPerTon > 0 {
			destLumpSum = destPerTon * 25.0
		}
	}

	transitLumpSum := configuredTransitLumpSum
	if transitLumpSum == 0 {
		if transitMethod == "lump_sum" {
			transitLumpSum = transitPrice
		} else if transitPerTon > 0 {
			transitLumpSum = transitPerTon * 25.0
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"source":                        source,
		"price":                         destinationPrice,
		"pricing_method":                destinationMethod,
		"destination_price":             destinationPrice,
		"destination_pricing_method":    destinationMethod,
		"destination_price_per_kg":      destPerKg,
		"destination_price_per_quintal": destPerQuintal,
		"destination_price_per_ton":     destPerTon,
		"destination_lump_sum":          destLumpSum,
		"has_transit":                   transitPointID != "",
		"transit_point_id":              transitPointID,
		"transit_price":                 transitPrice,
		"transit_pricing_method":        transitMethod,
		"transit_price_per_kg":          transitPerKg,
		"transit_price_per_quintal":     transitPerQuintal,
		"transit_price_per_ton":         transitPerTon,
		"transit_lump_sum":              transitLumpSum,
		"has_transit_price":             hasTransitPrice,
		"price_difference":              diffPerTon,
		"price_difference_per_kg":       diffPerKg,
		"price_difference_per_quintal":  diffPerQuintal,
		"price_difference_per_ton":      diffPerTon,
		"price_difference_lump_sum":     destLumpSum - transitLumpSum,
	})
}

type CancelTripInput struct {
	Reason string `json:"reason" binding:"required"`
}

func (h *TripHandler) CancelTrip(c *gin.Context) {
	tripID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	var input CancelTripInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cancellation reason is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var trip models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&trip); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	if trip.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Trip is already cancelled"})
		return
	}

	now := time.Now()
	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")

	update := bson.M{
		"$set": bson.M{
			"status":        "cancelled",
			"cancel_reason": input.Reason,
			"cancelled_by":  userName,
			"cancelled_at":  now,
			"updated_at":    now,
		},
	}

	_, err = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel trip"})
		return
	}

	// Also mark all linked trip expenses as cancelled
	_, _ = h.DB.Expenses.UpdateMany(ctx,
		bson.M{"trip_id": trip.ID.Hex()},
		bson.M{
			"$set": bson.M{
				"status":        "cancelled",
				"cancel_reason": fmt.Sprintf("Linked Trip %s was cancelled: %s", trip.TripNumber, input.Reason),
				"cancelled_by":  userName,
			},
		},
	)

	h.LogAudit(ctx, userIDStr, userName, "Cancelled Trip", "Trip", trip.ID.Hex(),
		fmt.Sprintf("Status: %s", trip.Status), fmt.Sprintf("Status: cancelled, Reason: %s", input.Reason))

	c.JSON(http.StatusOK, gin.H{"message": "Trip marked as cancelled and preserved for audit trail"})
}

func (h *TripHandler) UpdateTrip(c *gin.Context) {
	tripID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	var input models.Trip
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existing models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	if input.TransitUnitPrice <= 0 && input.TransitUnitPriceSplit > 0 {
		input.TransitUnitPrice = input.TransitUnitPriceSplit
	}
	if input.TransitUnitPrice <= 0 && existing.TransitUnitPrice > 0 {
		input.TransitUnitPrice = existing.TransitUnitPrice
	}
	if input.DestinationUnitPrice <= 0 && input.DestinationUnitPriceSplit > 0 {
		input.DestinationUnitPrice = input.DestinationUnitPriceSplit
	}
	if input.DestinationUnitPrice <= 0 && existing.DestinationUnitPrice > 0 {
		input.DestinationUnitPrice = existing.DestinationUnitPrice
	}
	if input.TransitPricingMethod == "" && existing.TransitPricingMethod != "" {
		input.TransitPricingMethod = existing.TransitPricingMethod
	}
	if input.DestinationPricingMethod == "" && existing.DestinationPricingMethod != "" {
		input.DestinationPricingMethod = existing.DestinationPricingMethod
	}
	if input.TransitLumpSum <= 0 && existing.TransitLumpSum > 0 {
		input.TransitLumpSum = existing.TransitLumpSum
	}
	if input.DestinationLumpSum <= 0 && existing.DestinationLumpSum > 0 {
		input.DestinationLumpSum = existing.DestinationLumpSum
	}

	isSplit := input.IsSplitDrop && (input.TransitQuantity > 0 || input.DestinationQuantity > 0)
	var quantityKg float64
	var grossRevenue float64
	var transitRev float64
	var destRev float64

	if isSplit {
		if input.TransitUnit == "" {
			input.TransitUnit = "ton"
		}
		if input.DestinationUnit == "" {
			input.DestinationUnit = "ton"
		}
		if input.TransitPricingMethod == "" {
			input.TransitPricingMethod = "per_ton"
		}
		if input.DestinationPricingMethod == "" {
			input.DestinationPricingMethod = "per_ton"
		}

		transitKg := toKg(input.TransitQuantity, input.TransitUnit)
		destKg := toKg(input.DestinationQuantity, input.DestinationUnit)
		quantityKg = transitKg + destKg

		normT := normalizeUnit(input.TransitUnit)
		normD := normalizeUnit(input.DestinationUnit)
		if input.Unit == "" {
			if normT == normD {
				input.Unit = normT
			} else {
				input.Unit = "ton"
			}
		} else {
			input.Unit = normalizeUnit(input.Unit)
		}

		input.Quantity = calculateUnifiedQuantity(quantityKg, input.Unit)

		if input.PricingMethod == "lump_sum" && input.LumpSum > 0 && input.TransitLumpSum <= 0 && input.DestinationLumpSum <= 0 {
			grossRevenue = input.LumpSum
		} else {
			transitRev = computeLegRevenue(input.TransitQuantity, input.TransitUnit, input.TransitPricingMethod, input.TransitUnitPrice, input.TransitLumpSum)
			destRev = computeLegRevenue(input.DestinationQuantity, input.DestinationUnit, input.DestinationPricingMethod, input.DestinationUnitPrice, input.DestinationLumpSum)
			grossRevenue = transitRev + destRev
			if grossRevenue <= 0 && input.LumpSum > 0 {
				grossRevenue = input.LumpSum
			}
		}
	} else {
		if input.Unit == "" {
			input.Unit = "ton"
		} else {
			input.Unit = normalizeUnit(input.Unit)
		}
		quantityKg = toKg(input.Quantity, input.Unit)
		if input.PricingMethod == "lump_sum" {
			grossRevenue = input.LumpSum
		} else {
			grossRevenue = input.Quantity * input.UnitPrice
		}
	}

	// Calculate Additional Fees & Total Revenue
	var totalAdditionalFees float64
	validFees := make([]models.TripFee, 0)
	for _, f := range input.AdditionalFees {
		if f.Amount > 0 {
			feeType := strings.ToLower(strings.TrimSpace(f.FeeType))
			if feeType == "" {
				feeType = "other"
			}
			f.FeeType = feeType
			totalAdditionalFees += f.Amount
			validFees = append(validFees, f)
		}
	}
	if len(input.AdditionalFees) == 0 && existing.TotalAdditionalFees > 0 {
		validFees = existing.AdditionalFees
		totalAdditionalFees = existing.TotalAdditionalFees
	}
	totalRevenue := grossRevenue - totalAdditionalFees
	netRevenue := totalRevenue

	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"truck_id":                   input.TruckID,
			"truck_plate":                input.TruckPlate,
			"driver_id":                  input.DriverID,
			"driver_name":                input.DriverName,
			"loading_site_id":            input.LoadingSiteID,
			"loading_site_name":          input.LoadingSiteName,
			"dumping_site_id":            input.DumpingSiteID,
			"dumping_site_name":          input.DumpingSiteName,
			"has_transition":             input.HasTransition || isSplit,
			"transition_point_ids":       input.TransitionPointIDs,
			"transition_point_name":      input.TransitionPointName,
			"material_id":                input.MaterialID,
			"material_name":              input.MaterialName,
			"quantity":                   input.Quantity,
			"unit":                       input.Unit,
			"quantity_kg":                quantityKg,
			"pricing_method":             input.PricingMethod,
			"unit_price":                 input.UnitPrice,
			"pricing_target":             input.PricingTarget,
			"drop_off_location":          input.DropOffLocation,
			"transit_notes":              input.TransitNotes,
			"transit_unit_price":         input.TransitUnitPrice,
			"transit_unit_price_split":   input.TransitUnitPrice,
			"destination_unit_price":     input.DestinationUnitPrice,
			"destination_unit_price_split": input.DestinationUnitPrice,
			"price_difference":           input.PriceDifference,
			"lump_sum":                   input.LumpSum,
			"is_split_drop":              isSplit,
			"transit_quantity":           input.TransitQuantity,
			"transit_unit":               input.TransitUnit,
			"transit_quantity_kg":        toKg(input.TransitQuantity, input.TransitUnit),
			"transit_pricing_method":     input.TransitPricingMethod,
			"transit_lump_sum":           input.TransitLumpSum,
			"transit_revenue":            transitRev,
			"transit_receipt_number":     input.TransitReceiptNumber,
			"destination_quantity":       input.DestinationQuantity,
			"destination_unit":           input.DestinationUnit,
			"destination_quantity_kg":    toKg(input.DestinationQuantity, input.DestinationUnit),
			"destination_pricing_method": input.DestinationPricingMethod,
			"destination_lump_sum":       input.DestinationLumpSum,
			"destination_revenue":        destRev,
			"destination_receipt_number": input.DestinationReceiptNumber,
			"gross_revenue":              grossRevenue,
			"total_revenue":              totalRevenue,
			"additional_fees":            validFees,
			"total_additional_fees":      totalAdditionalFees,
			"net_revenue":                netRevenue,
			"status":                     input.Status,
			"notes":                      input.Notes,
			"updated_at":                 now,
		},
	}

	_, err = h.DB.Trips.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update trip"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Updated Trip", "Trip", tripID,
		fmt.Sprintf("%.1f %s (%s)", existing.Quantity, existing.Unit, existing.MaterialName),
		fmt.Sprintf("%.1f %s (%s) = %.0f ETB", input.Quantity, input.Unit, input.MaterialName, totalRevenue))

	c.JSON(http.StatusOK, gin.H{"message": "Trip updated and recalculated successfully"})
}

func (h *TripHandler) DeleteTrip(c *gin.Context) {
	tripID := c.Param("id")
	objID, err := bson.ObjectIDFromHex(tripID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var trip models.Trip
	if err := h.DB.Trips.FindOne(ctx, bson.M{"_id": objID}).Decode(&trip); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip not found"})
		return
	}

	_, err = h.DB.Trips.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete trip"})
		return
	}

	userName := c.GetString("fullName")
	userIDStr := c.GetString("userID")
	h.LogAudit(ctx, userIDStr, userName, "Deleted Trip", "Trip", tripID, trip.TripNumber, "Permanently removed by admin")

	c.JSON(http.StatusOK, gin.H{"message": "Trip permanently deleted"})
}

