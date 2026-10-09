package handlers

import (
	"context"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"truck-fleet-backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type ReportHandler struct {
	BaseHandler
}

func NewReportHandler(base BaseHandler) *ReportHandler {
	return &ReportHandler{BaseHandler: base}
}

func (h *ReportHandler) GetDashboardStats(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	// Trucks count
	totalTrucks, _ := h.DB.Trucks.CountDocuments(ctx, bson.M{})
	activeTrucks, _ := h.DB.Trucks.CountDocuments(ctx, bson.M{"status": bson.M{"$in": []string{"working", "available"}}})

	// Drivers count
	totalDrivers, _ := h.DB.Drivers.CountDocuments(ctx, bson.M{"status": "active"})

	// Pending fuel requests
	pendingFuelCount, _ := h.DB.FuelRequests.CountDocuments(ctx, bson.M{"status": "pending"})

	// Fetch all completed trips
	tripCursor, _ := h.DB.Trips.Find(ctx, bson.M{"status": "completed"})
	var allTrips []models.Trip
	if tripCursor != nil {
		_ = tripCursor.All(ctx, &allTrips)
		tripCursor.Close(ctx)
	}

	// Fetch all active expenses
	expCursor, _ := h.DB.Expenses.Find(ctx, bson.M{"status": "active"})
	var allExpenses []models.Expense
	if expCursor != nil {
		_ = expCursor.All(ctx, &allExpenses)
		expCursor.Close(ctx)
	}

	var tripsTodayCount int
	var quantityToday float64
	var revenueToday float64
	var expensesToday float64

	var tripsMonthCount int
	var quantityMonth float64
	var revenueMonth float64
	var fuelExpenseMonth float64
	var otherExpenseMonth float64

	// Payment-specific counters
	var pendingPaymentsCount int
	var pendingRevenueToday float64
	var pendingRevenueMonth float64
	var totalPendingRevenue float64
	var paidPaymentsCount int
	var totalPaidRevenue float64

	// Process Trips
	truckRevenueMap := make(map[string]float64)
	truckTripsMap := make(map[string]int)
	truckPlateMap := make(map[string]string)
	materialRevenueMap := make(map[string]float64)

	for _, t := range allTrips {
		truckTripsMap[t.TruckID]++
		truckPlateMap[t.TruckID] = t.TruckPlate

		isPaid := (t.PaymentStatus == "paid")

		if isPaid {
			paidPaymentsCount++
			totalPaidRevenue += t.TotalRevenue
			truckRevenueMap[t.TruckID] += t.TotalRevenue
			materialRevenueMap[t.MaterialName] += t.TotalRevenue

			if !t.Date.Before(startOfDay) {
				revenueToday += t.TotalRevenue
			}

			if !t.Date.Before(startOfMonth) {
				revenueMonth += t.TotalRevenue
			}
		} else {
			// Trip payment is pending approval
			pendingPaymentsCount++
			totalPendingRevenue += t.TotalRevenue

			if !t.Date.Before(startOfDay) {
				pendingRevenueToday += t.TotalRevenue
			}

			if !t.Date.Before(startOfMonth) {
				pendingRevenueMonth += t.TotalRevenue
			}
		}

		// Operations / Volumes count for all completed trips
		if !t.Date.Before(startOfDay) {
			tripsTodayCount++
			quantityToday += (t.QuantityKg / 1000)
		}

		if !t.Date.Before(startOfMonth) {
			tripsMonthCount++
			quantityMonth += (t.QuantityKg / 1000)
		}
	}

	// Process Expenses
	truckExpenseMap := make(map[string]float64)
	for _, e := range allExpenses {
		truckExpenseMap[e.TruckID] += e.Amount

		if !e.Date.Before(startOfDay) {
			expensesToday += e.Amount
		}

		if !e.Date.Before(startOfMonth) {
			if e.ExpenseType == "fuel" {
				fuelExpenseMonth += e.Amount
			} else {
				otherExpenseMonth += e.Amount
			}
		}
	}

	profitToday := revenueToday - expensesToday
	totalExpenseMonth := fuelExpenseMonth + otherExpenseMonth
	netProfitMonth := revenueMonth - totalExpenseMonth

	// Top Performing Trucks
	type TruckStat struct {
		TruckID    string  `json:"truck_id"`
		TruckPlate string  `json:"truck_plate"`
		Trips      int     `json:"trips"`
		Revenue    float64 `json:"revenue"`
		Expense    float64 `json:"expense"`
		Profit     float64 `json:"profit"`
	}

	truckStats := make([]TruckStat, 0)
	for tID, rev := range truckRevenueMap {
		exp := truckExpenseMap[tID]
		truckStats = append(truckStats, TruckStat{
			TruckID:    tID,
			TruckPlate: truckPlateMap[tID],
			Trips:      truckTripsMap[tID],
			Revenue:    rev,
			Expense:    exp,
			Profit:     rev - exp,
		})
	}
	sort.Slice(truckStats, func(i, j int) bool {
		return truckStats[i].Revenue > truckStats[j].Revenue
	})

	if len(truckStats) > 5 {
		truckStats = truckStats[:5]
	}

	dieselPrice := 100.0
	if dpStr := c.Query("diesel_price"); dpStr != "" {
		if p, err := strconv.ParseFloat(dpStr, 64); err == nil && p > 0 {
			dieselPrice = p
		}
	} else {
		var settings models.Settings
		if err := h.DB.Settings.FindOne(ctx, bson.M{}).Decode(&settings); err == nil && settings.DieselPrice > 0 {
			dieselPrice = settings.DieselPrice
		}
	}
	fuelEstimation := h.computeFuelEstimation(ctx, dieselPrice)

	c.JSON(http.StatusOK, gin.H{
		"total_trucks":          totalTrucks,
		"active_trucks":         activeTrucks,
		"total_drivers":         totalDrivers,
		"trips_today":           tripsTodayCount,
		"quantity_today":        quantityToday,
		"revenue_today":         revenueToday,
		"expenses_today":        expensesToday,
		"profit_today":          profitToday,
		"trips_month":           tripsMonthCount,
		"quantity_month":        quantityMonth,
		"monthly_revenue":       revenueMonth,
		"monthly_fuel_expense":  fuelExpenseMonth,
		"monthly_other_expense": otherExpenseMonth,
		"monthly_total_expense": totalExpenseMonth,
		"monthly_net_profit":    netProfitMonth,
		"pending_fuel_requests": pendingFuelCount,
		"pending_payments_count":   pendingPaymentsCount,
		"pending_revenue_today":    pendingRevenueToday,
		"pending_revenue_month":    pendingRevenueMonth,
		"total_pending_revenue":    totalPendingRevenue,
		"paid_payments_count":      paidPaymentsCount,
		"total_paid_revenue":       totalPaidRevenue,
		"top_trucks":               truckStats,
		"material_revenue":              materialRevenueMap,
		"fuel_estimation":               fuelEstimation,
		"avg_trip_distance_km":          fuelEstimation["avg_trip_distance_km"],
		"today_avg_trip_distance_km":    fuelEstimation["today_avg_trip_distance_km"],
		"month_avg_trip_distance_km":    fuelEstimation["month_avg_trip_distance_km"],
		"avg_fuel_consumption_l_per_km": fuelEstimation["avg_fuel_consumption_l_per_km"],
		"month_fuel_consumption_l_per_km": fuelEstimation["month_fuel_consumption_l_per_km"],
		"total_completed_trips":         fuelEstimation["total_completed_trips"],
	})
}

func (h *ReportHandler) GetTruckPerformanceReport(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get all trucks
	cursor, err := h.DB.Trucks.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trucks"})
		return
	}
	defer cursor.Close(ctx)

	var trucks []models.Truck
	_ = cursor.All(ctx, &trucks)

	// Fetch all trips
	tripCursor, _ := h.DB.Trips.Find(ctx, bson.M{"status": "completed"})
	var trips []models.Trip
	if tripCursor != nil {
		_ = tripCursor.All(ctx, &trips)
		tripCursor.Close(ctx)
	}

	// Fetch all expenses
	expCursor, _ := h.DB.Expenses.Find(ctx, bson.M{"status": "active"})
	var expenses []models.Expense
	if expCursor != nil {
		_ = expCursor.All(ctx, &expenses)
		expCursor.Close(ctx)
	}

	type TruckRow struct {
		TruckID       string  `json:"truck_id"`
		TruckNumber   string  `json:"truck_number"`
		PlateNumber   string  `json:"plate_number"`
		Model         string  `json:"model"`
		Capacity      float64 `json:"capacity"`
		DriverName    string  `json:"driver_name"`
		Status        string  `json:"status"`
		TripsCount    int     `json:"trips_count"`
		QuantityTons  float64 `json:"quantity_tons"`
		Revenue       float64 `json:"revenue"`
		FuelExpense   float64 `json:"fuel_expense"`
		OtherExpenses float64 `json:"other_expenses"`
		TotalExpenses float64 `json:"total_expenses"`
		Profit        float64 `json:"profit"`
	}

	rows := make([]TruckRow, 0)
	for _, t := range trucks {
		row := TruckRow{
			TruckID:     t.ID.Hex(),
			TruckNumber: t.TruckNumber,
			PlateNumber: t.PlateNumber,
			Model:       t.Model,
			Capacity:    t.Capacity,
			DriverName:  t.DriverAssignedName,
			Status:      t.Status,
		}

		for _, trip := range trips {
			if trip.TruckID == t.ID.Hex() {
				row.TripsCount++
				row.QuantityTons += (trip.QuantityKg / 1000)
				row.Revenue += trip.TotalRevenue
			}
		}

		for _, exp := range expenses {
			if exp.TruckID == t.ID.Hex() {
				if exp.ExpenseType == "fuel" {
					row.FuelExpense += exp.Amount
				} else {
					row.OtherExpenses += exp.Amount
				}
			}
		}

		row.TotalExpenses = row.FuelExpense + row.OtherExpenses
		row.Profit = row.Revenue - row.TotalExpenses
		rows = append(rows, row)
	}

	c.JSON(http.StatusOK, rows)
}

func (h *ReportHandler) GetDriverPerformanceReport(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := h.DB.Drivers.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch drivers"})
		return
	}
	defer cursor.Close(ctx)

	var drivers []models.Driver
	_ = cursor.All(ctx, &drivers)

	tripCursor, _ := h.DB.Trips.Find(ctx, bson.M{"status": "completed"})
	var trips []models.Trip
	if tripCursor != nil {
		_ = tripCursor.All(ctx, &trips)
		tripCursor.Close(ctx)
	}

	expCursor, _ := h.DB.Expenses.Find(ctx, bson.M{"status": "active"})
	var expenses []models.Expense
	if expCursor != nil {
		_ = expCursor.All(ctx, &expenses)
		expCursor.Close(ctx)
	}

	type DriverRow struct {
		DriverID      string  `json:"driver_id"`
		DriverNumber  string  `json:"driver_number"`
		FullName      string  `json:"full_name"`
		Phone         string  `json:"phone"`
		TruckPlate    string  `json:"truck_plate"`
		Status        string  `json:"status"`
		TripsCount    int     `json:"trips_count"`
		QuantityTons  float64 `json:"quantity_tons"`
		Revenue       float64 `json:"revenue"`
		FuelExpense   float64 `json:"fuel_expense"`
		OtherExpenses float64 `json:"other_expenses"`
		Profit        float64 `json:"profit"`
	}

	rows := make([]DriverRow, 0)
	for _, d := range drivers {
		row := DriverRow{
			DriverID:     d.UserID.Hex(),
			DriverNumber: d.DriverNumber,
			FullName:     d.FullName,
			Phone:        d.Phone,
			TruckPlate:   d.AssignedTruckPlate,
			Status:       d.Status,
		}

		for _, trip := range trips {
			if trip.DriverID == d.UserID.Hex() {
				row.TripsCount++
				row.QuantityTons += (trip.QuantityKg / 1000)
				row.Revenue += trip.TotalRevenue
			}
		}

		for _, exp := range expenses {
			if exp.DriverID == d.UserID.Hex() {
				if exp.ExpenseType == "fuel" {
					row.FuelExpense += exp.Amount
				} else {
					row.OtherExpenses += exp.Amount
				}
			}
		}

		row.Profit = row.Revenue - (row.FuelExpense + row.OtherExpenses)
		rows = append(rows, row)
	}

	c.JSON(http.StatusOK, rows)
}

func (h *ReportHandler) GetMaterialReport(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tripCursor, _ := h.DB.Trips.Find(ctx, bson.M{"status": "completed"})
	var trips []models.Trip
	if tripCursor != nil {
		_ = tripCursor.All(ctx, &trips)
		tripCursor.Close(ctx)
	}

	type MatStat struct {
		MaterialName string  `json:"material_name"`
		TripsCount   int     `json:"trips_count"`
		QuantityTons float64 `json:"quantity_tons"`
		Revenue      float64 `json:"revenue"`
	}

	statsMap := make(map[string]*MatStat)
	for _, t := range trips {
		if _, ok := statsMap[t.MaterialName]; !ok {
			statsMap[t.MaterialName] = &MatStat{MaterialName: t.MaterialName}
		}
		statsMap[t.MaterialName].TripsCount++
		statsMap[t.MaterialName].QuantityTons += (t.QuantityKg / 1000)
		statsMap[t.MaterialName].Revenue += t.TotalRevenue
	}

	res := make([]MatStat, 0)
	for _, v := range statsMap {
		res = append(res, *v)
	}

	c.JSON(http.StatusOK, res)
}

func (h *ReportHandler) GetRouteReport(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tripCursor, _ := h.DB.Trips.Find(ctx, bson.M{"status": "completed"})
	var trips []models.Trip
	if tripCursor != nil {
		_ = tripCursor.All(ctx, &trips)
		tripCursor.Close(ctx)
	}

	type RouteStat struct {
		RouteName    string  `json:"route_name"`
		LoadingSite  string  `json:"loading_site"`
		DumpingSite  string  `json:"dumping_site"`
		TripsCount   int     `json:"trips_count"`
		QuantityTons float64 `json:"quantity_tons"`
		Revenue      float64 `json:"revenue"`
		AvgPrice     float64 `json:"avg_price"`
	}

	statsMap := make(map[string]*RouteStat)
	for _, t := range trips {
		key := t.LoadingSiteName + " → " + t.DumpingSiteName
		if _, ok := statsMap[key]; !ok {
			statsMap[key] = &RouteStat{
				RouteName:   key,
				LoadingSite: t.LoadingSiteName,
				DumpingSite: t.DumpingSiteName,
			}
		}
		statsMap[key].TripsCount++
		statsMap[key].QuantityTons += (t.QuantityKg / 1000)
		statsMap[key].Revenue += t.TotalRevenue
	}

	res := make([]RouteStat, 0)
	for _, v := range statsMap {
		if v.QuantityTons > 0 {
			v.AvgPrice = v.Revenue / v.QuantityTons
		}
		res = append(res, *v)
	}

	c.JSON(http.StatusOK, res)
}

func (h *ReportHandler) GetFuelEstimationReport(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	dieselPrice := 100.0
	if dpStr := c.Query("diesel_price"); dpStr != "" {
		if p, err := strconv.ParseFloat(dpStr, 64); err == nil && p > 0 {
			dieselPrice = p
		}
	}

	c.JSON(http.StatusOK, h.computeFuelEstimation(ctx, dieselPrice))
}

func (h *ReportHandler) computeFuelEstimation(ctx context.Context, dieselPrice float64) gin.H {
	if dieselPrice <= 0 {
		dieselPrice = 100.0 // Default 100 ETB / Liter
	}

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	daysInMonth := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).Day()
	dayOfMonth := now.Day()
	todayDateStr := now.Format("2006-01-02")
	currentMonthStr := now.Format("2006-01")

	// 1. Fetch Odometer readings
	odoCursor, _ := h.DB.OdometerReadings.Find(ctx, bson.M{})
	var allOdo []models.OdometerReading
	if odoCursor != nil {
		_ = odoCursor.All(ctx, &allOdo)
		odoCursor.Close(ctx)
	}

	// 2. Fetch Fuel requests
	fuelCursor, _ := h.DB.FuelRequests.Find(ctx, bson.M{})
	var allFuel []models.FuelRequest
	if fuelCursor != nil {
		_ = fuelCursor.All(ctx, &allFuel)
		fuelCursor.Close(ctx)
	}

	// 3. Fetch Trucks
	trkCursor, _ := h.DB.Trucks.Find(ctx, bson.M{})
	var allTrucks []models.Truck
	if trkCursor != nil {
		_ = trkCursor.All(ctx, &allTrucks)
		trkCursor.Close(ctx)
	}

	// 4. Fetch Completed Trips for Trip Distance & Efficiency Analysis
	tripCursor, _ := h.DB.Trips.Find(ctx, bson.M{"status": "completed"})
	var allTrips []models.Trip
	if tripCursor != nil {
		_ = tripCursor.All(ctx, &allTrips)
		tripCursor.Close(ctx)
	}

	// Maps for aggregation
	type TruckAgg struct {
		TruckID       string
		PlateNumber   string
		Model         string
		DriverName    string
		TotalDistance float64
		MonthDistance float64
		TodayDistance float64
		TotalFuelCost float64
		MonthFuelCost float64
		TodayFuelCost float64
	}

	truckAggMap := make(map[string]*TruckAgg)
	for _, trk := range allTrucks {
		id := trk.ID.Hex()
		truckAggMap[id] = &TruckAgg{
			TruckID:     id,
			PlateNumber: trk.PlateNumber,
			Model:       trk.Model,
			DriverName:  trk.DriverAssignedName,
		}
	}

	var totalDistance float64
	var todayDistance float64
	var monthDistance float64

	monthlyDistances := make(map[string]float64)
	monthlyFuel := make(map[string]float64)

	for _, odo := range allOdo {
		dist := odo.DistanceKm
		if dist <= 0 && odo.EndReading > odo.StartReading {
			dist = odo.EndReading - odo.StartReading
		}
		if dist <= 0 {
			continue
		}

		totalDistance += dist

		rDate, err := time.Parse("2006-01-02", odo.Date)
		if err != nil {
			rDate = odo.CreatedAt
		}

		monthKey := rDate.Format("2006-01")
		monthlyDistances[monthKey] += dist

		isToday := (odo.Date == todayDateStr) || (rDate.Year() == now.Year() && rDate.Month() == now.Month() && rDate.Day() == now.Day())
		isMonth := (monthKey == currentMonthStr) || (rDate.Year() == now.Year() && rDate.Month() == now.Month())

		if isToday {
			todayDistance += dist
		}
		if isMonth {
			monthDistance += dist
		}

		if odo.TruckID != "" {
			agg, ok := truckAggMap[odo.TruckID]
			if !ok {
				agg = &TruckAgg{
					TruckID:     odo.TruckID,
					PlateNumber: odo.TruckPlate,
					DriverName:  odo.DriverName,
				}
				truckAggMap[odo.TruckID] = agg
			}
			agg.TotalDistance += dist
			if isToday {
				agg.TodayDistance += dist
			}
			if isMonth {
				agg.MonthDistance += dist
			}
		}
	}

	var totalFuelCost float64
	var todayFuelCost float64
	var monthFuelCost float64

	for _, fr := range allFuel {
		if fr.Status == "rejected" {
			continue
		}
		amt := fr.AmountApproved
		if amt <= 0 {
			amt = fr.AmountRequested
		}
		if amt <= 0 {
			continue
		}

		totalFuelCost += amt

		frDate := fr.RequestedAt
		if frDate.IsZero() {
			frDate = fr.CreatedAt
		}

		monthKey := frDate.Format("2006-01")
		monthlyFuel[monthKey] += amt

		isToday := frDate.After(startOfDay) || (frDate.Year() == now.Year() && frDate.Month() == now.Month() && frDate.Day() == now.Day())
		isMonth := frDate.After(startOfMonth) || (monthKey == currentMonthStr)

		if isToday {
			todayFuelCost += amt
		}
		if isMonth {
			monthFuelCost += amt
		}

		truckKey := fr.TruckID
		if truckKey == "" && fr.TruckPlate != "" {
			for id, a := range truckAggMap {
				if a.PlateNumber == fr.TruckPlate {
					truckKey = id
					break
				}
			}
		}

		if truckKey != "" {
			agg, ok := truckAggMap[truckKey]
			if !ok {
				agg = &TruckAgg{
					TruckID:     truckKey,
					PlateNumber: fr.TruckPlate,
					DriverName:  fr.DriverName,
				}
				truckAggMap[truckKey] = agg
			}
			agg.TotalFuelCost += amt
			if isToday {
				agg.TodayFuelCost += amt
			}
			if isMonth {
				agg.MonthFuelCost += amt
			}
		}
	}

	totalFuelLiters := totalFuelCost / dieselPrice
	monthFuelLiters := monthFuelCost / dieselPrice
	todayFuelLiters := todayFuelCost / dieselPrice

	var costPerKm float64
	var litersPerKm float64
	var litersPer100Km float64
	var kmPerLiter float64

	if totalDistance > 0 {
		costPerKm = totalFuelCost / totalDistance
		litersPerKm = totalFuelLiters / totalDistance
		litersPer100Km = (totalFuelLiters / totalDistance) * 100
	}
	if totalFuelLiters > 0 && totalDistance > 0 {
		kmPerLiter = totalDistance / totalFuelLiters
	}

	var monthCostPerKm float64
	var monthLitersPer100Km float64
	var monthKmPerLiter float64
	var monthLitersPerKm float64

	if monthDistance > 0 {
		monthCostPerKm = monthFuelCost / monthDistance
		monthLitersPer100Km = (monthFuelLiters / monthDistance) * 100
		monthLitersPerKm = monthFuelLiters / monthDistance
		if monthFuelLiters > 0 {
			monthKmPerLiter = monthDistance / monthFuelLiters
		}
	} else if totalDistance > 0 {
		monthCostPerKm = costPerKm
		monthLitersPer100Km = litersPer100Km
		monthKmPerLiter = kmPerLiter
		monthLitersPerKm = litersPerKm
	}

	runRateFactor := float64(daysInMonth) / math.Max(1.0, float64(dayOfMonth))
	projectedMonthCost := monthFuelCost * runRateFactor
	projectedMonthLiters := monthFuelLiters * runRateFactor
	projectedMonthDistance := monthDistance * runRateFactor

	// Process Completed Trips to derive Average Trip Distance
	var tripsDistanceSum float64
	var tripsWithOdoCount int
	var todayTripsDistSum float64
	var todayTripsWithOdoCount int
	var todayTripsCount int
	var monthTripsDistSum float64
	var monthTripsWithOdoCount int
	var monthTripsCount int
	truckTripCounts := make(map[string]int)

	for _, t := range allTrips {
		if t.TruckID != "" {
			truckTripCounts[t.TruckID]++
		}
		var tripDist float64
		if t.EndOdometer > t.StartOdometer {
			tripDist = t.EndOdometer - t.StartOdometer
			tripsDistanceSum += tripDist
			tripsWithOdoCount++
		}

		isToday := !t.Date.Before(startOfDay)
		isMonth := !t.Date.Before(startOfMonth)

		if isToday {
			todayTripsCount++
			if tripDist > 0 {
				todayTripsDistSum += tripDist
				todayTripsWithOdoCount++
			}
		}
		if isMonth {
			monthTripsCount++
			if tripDist > 0 {
				monthTripsDistSum += tripDist
				monthTripsWithOdoCount++
			}
		}
	}

	var avgTripDistance float64
	if tripsWithOdoCount > 0 {
		avgTripDistance = tripsDistanceSum / float64(tripsWithOdoCount)
	} else if len(allTrips) > 0 && totalDistance > 0 {
		avgTripDistance = totalDistance / float64(len(allTrips))
	}

	var todayAvgTripDist float64
	if todayTripsWithOdoCount > 0 {
		todayAvgTripDist = todayTripsDistSum / float64(todayTripsWithOdoCount)
	} else if todayTripsCount > 0 && todayDistance > 0 {
		todayAvgTripDist = todayDistance / float64(todayTripsCount)
	} else if todayTripsCount > 0 && avgTripDistance > 0 {
		todayAvgTripDist = avgTripDistance
	}

	var monthAvgTripDist float64
	if monthTripsWithOdoCount > 0 {
		monthAvgTripDist = monthTripsDistSum / float64(monthTripsWithOdoCount)
	} else if monthTripsCount > 0 && monthDistance > 0 {
		monthAvgTripDist = monthDistance / float64(monthTripsCount)
	} else if monthTripsCount > 0 && avgTripDistance > 0 {
		monthAvgTripDist = avgTripDistance
	}

	// Per-Truck array
	trucksList := make([]gin.H, 0)
	for _, agg := range truckAggMap {
		totLiters := agg.TotalFuelCost / dieselPrice
		moLiters := agg.MonthFuelCost / dieselPrice

		var trkCostPerKm float64
		var trkL100Km float64
		var trkKmPerL float64
		var trkLPerKm float64

		if agg.TotalDistance > 0 {
			trkCostPerKm = agg.TotalFuelCost / agg.TotalDistance
			trkL100Km = (totLiters / agg.TotalDistance) * 100
			trkLPerKm = totLiters / agg.TotalDistance
		}
		if totLiters > 0 && agg.TotalDistance > 0 {
			trkKmPerL = agg.TotalDistance / totLiters
		}

		trkTrips := truckTripCounts[agg.TruckID]
		var trkAvgTripDist float64
		if trkTrips > 0 && agg.TotalDistance > 0 {
			trkAvgTripDist = agg.TotalDistance / float64(trkTrips)
		} else if agg.TotalDistance > 0 && avgTripDistance > 0 {
			trkAvgTripDist = avgTripDistance
		}

		efficiency := "standard"
		if agg.TotalDistance == 0 || totLiters == 0 {
			efficiency = "pending_data"
		} else if trkL100Km < 38.0 {
			efficiency = "optimal"
		} else if trkL100Km > 52.0 {
			efficiency = "high_consumption"
		}

		trucksList = append(trucksList, gin.H{
			"truck_id":             agg.TruckID,
			"plate_number":         agg.PlateNumber,
			"model":                agg.Model,
			"driver_name":          agg.DriverName,
			"trips_count":          trkTrips,
			"avg_trip_distance_km": math.Round(trkAvgTripDist*10) / 10,
			"total_distance_km": math.Round(agg.TotalDistance*10) / 10,
			"month_distance_km": math.Round(agg.MonthDistance*10) / 10,
			"today_distance_km": math.Round(agg.TodayDistance*10) / 10,
			"total_fuel_cost":   math.Round(agg.TotalFuelCost*100) / 100,
			"month_fuel_cost":   math.Round(agg.MonthFuelCost*100) / 100,
			"today_fuel_cost":   math.Round(agg.TodayFuelCost*100) / 100,
			"total_fuel_liters": math.Round(totLiters*10) / 10,
			"month_fuel_liters": math.Round(moLiters*10) / 10,
			"cost_per_km":       math.Round(trkCostPerKm*100) / 100,
			"liters_per_km":     math.Round(trkLPerKm*1000) / 1000,
			"liters_per_100km":  math.Round(trkL100Km*10) / 10,
			"km_per_liter":      math.Round(trkKmPerL*10) / 10,
			"efficiency_status": efficiency,
		})
	}

	// Monthly Trends
	allMonths := make(map[string]bool)
	for m := range monthlyDistances {
		allMonths[m] = true
	}
	for m := range monthlyFuel {
		allMonths[m] = true
	}
	allMonths[currentMonthStr] = true

	monthKeys := make([]string, 0, len(allMonths))
	for m := range allMonths {
		monthKeys = append(monthKeys, m)
	}
	sort.Strings(monthKeys)

	monthlyTrends := make([]gin.H, 0)
	for _, mKey := range monthKeys {
		mDist := monthlyDistances[mKey]
		mCost := monthlyFuel[mKey]
		mLiters := mCost / dieselPrice

		var mCPK float64
		var mL100 float64
		var mKPL float64
		if mDist > 0 {
			mCPK = mCost / mDist
			mL100 = (mLiters / mDist) * 100
		}
		if mLiters > 0 && mDist > 0 {
			mKPL = mDist / mLiters
		}

		parsedT, _ := time.Parse("2006-01", mKey)
		label := parsedT.Format("January 2006")
		if label == "" {
			label = mKey
		}

		monthlyTrends = append(monthlyTrends, gin.H{
			"month_year":       mKey,
			"month_label":      label,
			"distance_km":      math.Round(mDist*10) / 10,
			"fuel_cost":        math.Round(mCost*100) / 100,
			"fuel_liters":      math.Round(mLiters*10) / 10,
			"cost_per_km":      math.Round(mCPK*100) / 100,
			"liters_per_100km": math.Round(mL100*10) / 10,
			"km_per_liter":     math.Round(mKPL*10) / 10,
		})
	}

	return gin.H{
		"diesel_price_per_liter":    dieselPrice,
		"total_distance_km":         math.Round(totalDistance*10) / 10,
		"total_fuel_cost":           math.Round(totalFuelCost*100) / 100,
		"total_fuel_liters":         math.Round(totalFuelLiters*10) / 10,
		"cost_per_km":               math.Round(costPerKm*100) / 100,
		"liters_per_km":             math.Round(litersPerKm*1000) / 1000,
		"liters_per_100km":          math.Round(litersPer100Km*10) / 10,
		"km_per_liter":              math.Round(kmPerLiter*10) / 10,
		"month_distance_km":         math.Round(monthDistance*10) / 10,
		"month_fuel_cost":           math.Round(monthFuelCost*100) / 100,
		"month_fuel_liters":         math.Round(monthFuelLiters*10) / 10,
		"month_cost_per_km":         math.Round(monthCostPerKm*100) / 100,
		"month_liters_per_km":       math.Round(monthLitersPerKm*1000) / 1000,
		"month_liters_per_100km":    math.Round(monthLitersPer100Km*10) / 10,
		"month_km_per_liter":        math.Round(monthKmPerLiter*10) / 10,
		"projected_month_fuel_cost": math.Round(projectedMonthCost*100) / 100,
		"projected_month_liters":    math.Round(projectedMonthLiters*10) / 10,
		"projected_month_distance":  math.Round(projectedMonthDistance*10) / 10,
		"today_distance_km":         math.Round(todayDistance*10) / 10,
		"today_fuel_cost":           math.Round(todayFuelCost*100) / 100,
		"today_fuel_liters":         math.Round(todayFuelLiters*10) / 10,
		"trucks":                    trucksList,
		"monthly_trends":                monthlyTrends,
		"avg_trip_distance_km":          math.Round(avgTripDistance*10) / 10,
		"today_avg_trip_distance_km":    math.Round(todayAvgTripDist*10) / 10,
		"month_avg_trip_distance_km":    math.Round(monthAvgTripDist*10) / 10,
		"avg_fuel_consumption_l_per_km": math.Round(litersPerKm*1000) / 1000,
		"month_fuel_consumption_l_per_km": math.Round(monthLitersPerKm*1000) / 1000,
		"total_completed_trips":         len(allTrips),
	}
}
