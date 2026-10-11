package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type UserRole string

const (
	RoleAdmin  UserRole = "admin"
	RoleDriver UserRole = "driver"
)

type User struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Email     string        `bson:"email" json:"email"`
	Phone     string        `bson:"phone" json:"phone"`
	Password  string        `bson:"password" json:"-"`
	FullName  string        `bson:"full_name" json:"full_name"`
	Role      UserRole      `bson:"role" json:"role"`
	Status    string        `bson:"status" json:"status"` // "active", "inactive"
	Avatar            string        `bson:"avatar" json:"avatar"`
	PreferredLanguage string        `bson:"preferred_language,omitempty" json:"preferred_language,omitempty"`
	CreatedAt         time.Time     `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time     `bson:"updated_at" json:"updated_at"`
}

type Driver struct {
	ID                 bson.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID             bson.ObjectID `bson:"user_id" json:"user_id"`
	DriverNumber       string        `bson:"driver_number" json:"driver_number"`
	FullName           string        `bson:"full_name" json:"full_name"`
	Email              string        `bson:"email,omitempty" json:"email"`
	TempPassword       string        `bson:"temp_password,omitempty" json:"temp_password"`
	Phone              string        `bson:"phone" json:"phone"`
	LicenseNumber      string        `bson:"license_number" json:"license_number"`
	LicenseExpiry      string        `bson:"license_expiry" json:"license_expiry"`
	AssignedTruckID    string        `bson:"assigned_truck_id" json:"assigned_truck_id"`
	AssignedTruckPlate string        `bson:"assigned_truck_plate" json:"assigned_truck_plate"`
	Status             string        `bson:"status" json:"status"` // "active", "inactive"
	Notes              string        `bson:"notes" json:"notes"`
	CreatedAt          time.Time     `bson:"created_at" json:"created_at"`
}

type Truck struct {
	ID                 bson.ObjectID `bson:"_id,omitempty" json:"id"`
	TruckNumber        string        `bson:"truck_number" json:"truck_number"`
	PlateNumber        string        `bson:"plate_number" json:"plate_number"`
	Type               string        `bson:"type" json:"type"` // "Dump Truck", "Trailer", "Tipper", etc.
	Model              string        `bson:"model" json:"model"`
	Capacity           float64       `bson:"capacity" json:"capacity"` // Capacity in tons
	DriverAssignedID   string        `bson:"driver_assigned_id" json:"driver_assigned_id"`
	DriverAssignedName string        `bson:"driver_assigned_name" json:"driver_assigned_name"`
	Status             string        `bson:"status" json:"status"` // "available", "working", "maintenance", "inactive"
	RegistrationExpiry string        `bson:"registration_expiry" json:"registration_expiry"`
	InsuranceExpiry    string        `bson:"insurance_expiry" json:"insurance_expiry"`
	InspectionExpiry   string        `bson:"inspection_expiry" json:"inspection_expiry"`
	PurchaseDate       string        `bson:"purchase_date" json:"purchase_date"`
	Mileage            float64       `bson:"mileage" json:"mileage"`
	CurrentOdometer    float64       `bson:"current_odometer,omitempty" json:"current_odometer"`
	CurrentMileage     float64       `bson:"current_mileage,omitempty" json:"current_mileage"`
	Notes              string        `bson:"notes" json:"notes"`
	CreatedAt          time.Time     `bson:"created_at" json:"created_at"`
}

type SiteType string

const (
	SiteTypeLoading    SiteType = "loading"
	SiteTypeDumping    SiteType = "dumping"
	SiteTypeTransition SiteType = "transition"
)

type Site struct {
	ID          bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string        `bson:"name" json:"name"`
	Location    string        `bson:"location" json:"location"`
	Type        SiteType      `bson:"type" json:"type"` // "loading", "dumping", "transition"
	Description string        `bson:"description" json:"description"`
	Status      string        `bson:"status" json:"status"` // "active", "inactive"
	CreatedAt   time.Time     `bson:"created_at" json:"created_at"`
}

type Material struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Name         string        `bson:"name" json:"name"`
	DefaultUnit  string        `bson:"default_unit" json:"default_unit"`   // "ton", "quintal", "kg"
	DefaultPrice float64       `bson:"default_price" json:"default_price"` // Default unit price in ETB
	Description  string        `bson:"description" json:"description"`
	Status       string        `bson:"status" json:"status"` // "active", "inactive"
	CreatedAt    time.Time     `bson:"created_at" json:"created_at"`
}

type Route struct {
	ID                  bson.ObjectID `bson:"_id,omitempty" json:"id"`
	LoadingSiteID       string        `bson:"loading_site_id" json:"loading_site_id"`
	LoadingSiteName     string        `bson:"loading_site_name" json:"loading_site_name"`
	DumpingSiteID       string        `bson:"dumping_site_id" json:"dumping_site_id"`
	DumpingSiteName     string        `bson:"dumping_site_name" json:"dumping_site_name"`
	TransitionPointIDs  []string      `bson:"transition_point_ids" json:"transition_point_ids"`
	TransitionPointName string        `bson:"transition_point_name" json:"transition_point_name"`
	MaterialID          string        `bson:"material_id" json:"material_id"`
	MaterialName        string        `bson:"material_name" json:"material_name"`
	DefaultPrice        float64       `bson:"default_price" json:"default_price"`
	PricingMethod       string        `bson:"pricing_method" json:"pricing_method"` // "per_ton", "per_quintal", "per_kg", "lump_sum"
	LumpSum              float64       `bson:"lump_sum,omitempty" json:"lump_sum,omitempty"`
	TransitPrice         float64       `bson:"transit_price,omitempty" json:"transit_price,omitempty"`
	TransitPricingMethod string        `bson:"transit_pricing_method,omitempty" json:"transit_pricing_method,omitempty"`
	TransitLumpSum       float64       `bson:"transit_lump_sum,omitempty" json:"transit_lump_sum,omitempty"`
	Status              string        `bson:"status" json:"status"`
	CreatedAt           time.Time     `bson:"created_at" json:"created_at"`
}

type TripFee struct {
	FeeType     string  `bson:"fee_type" json:"fee_type"` // "toll", "weighbridge", "parking", "gate_fee", "other"
	Amount      float64 `bson:"amount" json:"amount"`
	Description string  `bson:"description" json:"description"`
}

type Trip struct {
	ID                  bson.ObjectID `bson:"_id,omitempty" json:"id"`
	TripNumber          string        `bson:"trip_number" json:"trip_number"` // TR-000001
	DriverID            string        `bson:"driver_id" json:"driver_id"`
	DriverName          string        `bson:"driver_name" json:"driver_name"`
	TruckID             string        `bson:"truck_id" json:"truck_id"`
	TruckPlate          string        `bson:"truck_plate" json:"truck_plate"`
	LoadingSiteID       string        `bson:"loading_site_id" json:"loading_site_id"`
	LoadingSiteName     string        `bson:"loading_site_name" json:"loading_site_name"`
	DumpingSiteID       string        `bson:"dumping_site_id" json:"dumping_site_id"`
	DumpingSiteName     string        `bson:"dumping_site_name" json:"dumping_site_name"`
	HasTransition       bool          `bson:"has_transition" json:"has_transition"`
	TransitionPointIDs  []string      `bson:"transition_point_ids" json:"transition_point_ids"`
	TransitionPointName string        `bson:"transition_point_name" json:"transition_point_name"`
	MaterialID          string        `bson:"material_id" json:"material_id"`
	MaterialName        string        `bson:"material_name" json:"material_name"`
	Quantity            float64       `bson:"quantity" json:"quantity"`
	Unit                string        `bson:"unit" json:"unit"`             // "kg", "quintal", "ton"
	QuantityKg          float64       `bson:"quantity_kg" json:"quantity_kg"` // normalized to kg: 1 ton=1000kg, 1 quintal=100kg
	PricingMethod        string        `bson:"pricing_method" json:"pricing_method"` // "per_kg", "per_quintal", "per_ton", "lump_sum"
	UnitPrice            float64       `bson:"unit_price" json:"unit_price"`
	PricingTarget        string        `bson:"pricing_target,omitempty" json:"pricing_target,omitempty"` // "destination", "transit", "split"
	TransitUnitPrice          float64       `bson:"transit_unit_price,omitempty" json:"transit_unit_price,omitempty"`
	TransitUnitPriceSplit     float64       `bson:"transit_unit_price_split,omitempty" json:"transit_unit_price_split,omitempty"`
	DestinationUnitPrice      float64       `bson:"destination_unit_price,omitempty" json:"destination_unit_price,omitempty"`
	DestinationUnitPriceSplit float64       `bson:"destination_unit_price_split,omitempty" json:"destination_unit_price_split,omitempty"`
	PriceDifference           float64       `bson:"price_difference,omitempty" json:"price_difference,omitempty"`
	LumpSum              float64       `bson:"lump_sum" json:"lump_sum"`
	DropOffLocation      string        `bson:"drop_off_location,omitempty" json:"drop_off_location,omitempty"`
	TransitNotes         string        `bson:"transit_notes,omitempty" json:"transit_notes,omitempty"`
	// Multi-drop / Partial Unload at Intermediate Transit Point
	IsSplitDrop              bool    `bson:"is_split_drop" json:"is_split_drop"`
	TransitQuantity          float64 `bson:"transit_quantity,omitempty" json:"transit_quantity"`
	TransitUnit              string  `bson:"transit_unit,omitempty" json:"transit_unit"`
	TransitQuantityKg        float64 `bson:"transit_quantity_kg,omitempty" json:"transit_quantity_kg"`
	TransitPricingMethod     string  `bson:"transit_pricing_method,omitempty" json:"transit_pricing_method"` // "per_ton", "per_quintal", "per_kg", "lump_sum"
	TransitLumpSum           float64 `bson:"transit_lump_sum,omitempty" json:"transit_lump_sum"`
	TransitRevenue           float64 `bson:"transit_revenue,omitempty" json:"transit_revenue"`
	TransitReceiptNumber     string  `bson:"transit_receipt_number,omitempty" json:"transit_receipt_number"`
	DestinationQuantity      float64 `bson:"destination_quantity,omitempty" json:"destination_quantity"`
	DestinationUnit          string  `bson:"destination_unit,omitempty" json:"destination_unit"`
	DestinationQuantityKg    float64 `bson:"destination_quantity_kg,omitempty" json:"destination_quantity_kg"`
	DestinationPricingMethod string  `bson:"destination_pricing_method,omitempty" json:"destination_pricing_method"` // "per_ton", "per_quintal", "per_kg", "lump_sum"
	DestinationLumpSum       float64 `bson:"destination_lump_sum,omitempty" json:"destination_lump_sum"`
	DestinationRevenue       float64 `bson:"destination_revenue,omitempty" json:"destination_revenue"`
	DestinationReceiptNumber string  `bson:"destination_receipt_number,omitempty" json:"destination_receipt_number"`
	GrossRevenue        float64       `bson:"gross_revenue" json:"gross_revenue"`
	TotalRevenue        float64       `bson:"total_revenue" json:"total_revenue"`
	AdditionalFees      []TripFee     `bson:"additional_fees,omitempty" json:"additional_fees,omitempty"`
	TotalAdditionalFees float64       `bson:"total_additional_fees" json:"total_additional_fees"`
	NetRevenue          float64       `bson:"net_revenue" json:"net_revenue"`
	StartOdometer       float64       `bson:"start_odometer,omitempty" json:"start_odometer"`
	EndOdometer         float64       `bson:"end_odometer,omitempty" json:"end_odometer"`
	ReceiptNumber       string        `bson:"receipt_number,omitempty" json:"receipt_number"`
	Date                time.Time     `bson:"date" json:"date"`
	Status              string        `bson:"status" json:"status"` // "in_progress", "completed", "cancelled"
	PaymentStatus       string        `bson:"payment_status" json:"payment_status"` // "pending", "paid"
	PaymentMethod       string        `bson:"payment_method,omitempty" json:"payment_method,omitempty"` // "cbe", "telebirr", "bank_transfer", "cash", "check", "other"
	PaymentRef          string        `bson:"payment_ref,omitempty" json:"payment_ref,omitempty"` // Reference/receipt/tx ID
	PaidAmount          float64       `bson:"paid_amount,omitempty" json:"paid_amount"`
	PaidAt              *time.Time    `bson:"paid_at,omitempty" json:"paid_at,omitempty"`
	PaidBy              string        `bson:"paid_by,omitempty" json:"paid_by,omitempty"`
	PayerName           string        `bson:"payer_name,omitempty" json:"payer_name,omitempty"`
	PaymentNotes        string        `bson:"payment_notes,omitempty" json:"payment_notes,omitempty"`
	Notes               string        `bson:"notes" json:"notes"`
	CancelReason        string        `bson:"cancel_reason,omitempty" json:"cancel_reason,omitempty"`
	CancelledBy         string        `bson:"cancelled_by,omitempty" json:"cancelled_by,omitempty"`
	CancelledAt         *time.Time    `bson:"cancelled_at,omitempty" json:"cancelled_at,omitempty"`
	StartedAt           *time.Time    `bson:"started_at,omitempty" json:"started_at,omitempty"`
	CompletedAt         *time.Time    `bson:"completed_at,omitempty" json:"completed_at,omitempty"`
	CreatedAt           time.Time     `bson:"created_at" json:"created_at"`
	UpdatedAt           time.Time     `bson:"updated_at" json:"updated_at"`
}

type FuelRequest struct {
	ID              bson.ObjectID `bson:"_id,omitempty" json:"id"`
	RequestNumber   string        `bson:"request_number" json:"request_number"` // FR-000001
	DriverID        string        `bson:"driver_id" json:"driver_id"`
	DriverName      string        `bson:"driver_name" json:"driver_name"`
	TruckID         string        `bson:"truck_id" json:"truck_id"`
	TruckPlate      string        `bson:"truck_plate" json:"truck_plate"`
	FuelSource      string        `bson:"fuel_source,omitempty" json:"fuel_source"` // "gas_station" or "reserve_fuel"
	OdometerReading float64       `bson:"odometer_reading,omitempty" json:"odometer_reading"`
	Liters          float64       `bson:"liters,omitempty" json:"liters"`
	PricePerLiter   float64       `bson:"price_per_liter,omitempty" json:"price_per_liter"`
	AmountRequested float64       `bson:"amount_requested" json:"amount_requested"`
	AmountApproved  float64       `bson:"amount_approved" json:"amount_approved"`
	Reason          string        `bson:"reason" json:"reason"`
	CurrentTripID   string        `bson:"current_trip_id" json:"current_trip_id"`
	FuelStation     string        `bson:"fuel_station" json:"fuel_station"`
	ReceiptURL      string        `bson:"receipt_url" json:"receipt_url"`
	Status          string        `bson:"status" json:"status"` // "pending", "approved", "rejected", "paid"
	Notes           string        `bson:"notes" json:"notes"`
	AdminNote       string        `bson:"admin_note" json:"admin_note"`
	RequestedAt          time.Time     `bson:"requested_at" json:"requested_at"`
	ApprovedAt           *time.Time    `bson:"approved_at,omitempty" json:"approved_at,omitempty"`
	PaidAt               *time.Time    `bson:"paid_at,omitempty" json:"paid_at,omitempty"`
	LinkedExpenseID      string        `bson:"linked_expense_id,omitempty" json:"linked_expense_id,omitempty"`
	ReserveAction        string        `bson:"reserve_action,omitempty" json:"reserve_action"`                 // "procure" (Step 1: refill yard tank) or "draw" (Step 2: pump from yard tank into truck)
	ReserveProcureReqID  string        `bson:"reserve_procure_req_id,omitempty" json:"reserve_procure_req_id,omitempty"` // For Step 2: references procurement refill request
	ReserveBalanceBefore float64       `bson:"reserve_balance_before,omitempty" json:"reserve_balance_before,omitempty"`
	ReserveBalanceAfter  float64       `bson:"reserve_balance_after,omitempty" json:"reserve_balance_after,omitempty"`
	InventoryDeducted    bool          `bson:"inventory_deducted,omitempty" json:"inventory_deducted,omitempty"`
	InventoryAdded       bool          `bson:"inventory_added,omitempty" json:"inventory_added,omitempty"`
	CreatedAt            time.Time     `bson:"created_at" json:"created_at"`
}

type Expense struct {
	ID            bson.ObjectID `bson:"_id,omitempty" json:"id"`
	ExpenseNumber string        `bson:"expense_number" json:"expense_number"` // EX-000001
	TruckID       string        `bson:"truck_id" json:"truck_id"`
	TruckPlate    string        `bson:"truck_plate" json:"truck_plate"`
	DriverID      string        `bson:"driver_id" json:"driver_id"`
	DriverName    string        `bson:"driver_name" json:"driver_name"`
	TripID        string        `bson:"trip_id,omitempty" json:"trip_id,omitempty"`
	TripNumber    string        `bson:"trip_number,omitempty" json:"trip_number,omitempty"`
	FuelRequestID string        `bson:"fuel_request_id,omitempty" json:"fuel_request_id,omitempty"`
	ExpenseType   string        `bson:"expense_type" json:"expense_type"` // "fuel", "maintenance", "tire", "oil", "spare_parts", "driver_advance", "washing", "parking", "toll", "weighbridge", "gate_fee", "repair", "other"
	Amount        float64       `bson:"amount" json:"amount"`
	Date          time.Time     `bson:"date" json:"date"`
	Description   string        `bson:"description" json:"description"`
	ReceiptNumber string        `bson:"receipt_number" json:"receipt_number"`
	ReceiptURL    string        `bson:"receipt_url" json:"receipt_url"`
	Status        string        `bson:"status" json:"status"` // "active", "cancelled"
	CancelledBy   string        `bson:"cancelled_by,omitempty" json:"cancelled_by,omitempty"`
	CancelReason  string        `bson:"cancel_reason,omitempty" json:"cancel_reason,omitempty"`
	CreatedAt     time.Time     `bson:"created_at" json:"created_at"`
}

type Maintenance struct {
	ID                bson.ObjectID `bson:"_id,omitempty" json:"id"`
	MaintenanceNumber string        `bson:"maintenance_number" json:"maintenance_number"` // MT-000001
	TruckID           string        `bson:"truck_id" json:"truck_id"`
	TruckPlate        string        `bson:"truck_plate" json:"truck_plate"`
	DriverID          string        `bson:"driver_id,omitempty" json:"driver_id,omitempty"`
	DriverName        string        `bson:"driver_name,omitempty" json:"driver_name,omitempty"`
	MaintenanceType   string        `bson:"maintenance_type" json:"maintenance_type"` // "oil_change", "tire_replacement", "engine_repair", "brake_repair", "general_service", "inspection", "other"
	Priority          string        `bson:"priority,omitempty" json:"priority,omitempty"` // "low", "normal", "high", "urgent"
	Status            string        `bson:"status,omitempty" json:"status,omitempty"` // "pending", "in_progress", "completed", "cancelled"
	Date              time.Time     `bson:"date" json:"date"`
	Mileage           float64       `bson:"mileage" json:"mileage"`
	Cost              float64       `bson:"cost" json:"cost"`
	NextDate          string        `bson:"next_date" json:"next_date"`
	NextMileage       float64       `bson:"next_mileage" json:"next_mileage"`
	Description       string        `bson:"description" json:"description"`
	ReceiptURL        string        `bson:"receipt_url" json:"receipt_url"`
	CreatedAt         time.Time     `bson:"created_at" json:"created_at"`
}

type OdometerReading struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"id"`
	DriverID     string        `bson:"driver_id" json:"driver_id"`
	DriverName   string        `bson:"driver_name" json:"driver_name"`
	TruckID      string        `bson:"truck_id" json:"truck_id"`
	TruckPlate   string        `bson:"truck_plate" json:"truck_plate"`
	Date         string        `bson:"date" json:"date"` // "YYYY-MM-DD"
	StartReading float64       `bson:"start_reading" json:"start_reading"`
	StartTime    *time.Time    `bson:"start_time,omitempty" json:"start_time,omitempty"`
	StartNotes   string        `bson:"start_notes,omitempty" json:"start_notes,omitempty"`
	EndReading   float64       `bson:"end_reading" json:"end_reading"`
	EndTime      *time.Time    `bson:"end_time,omitempty" json:"end_time,omitempty"`
	EndNotes     string        `bson:"end_notes,omitempty" json:"end_notes,omitempty"`
	DistanceKm    float64       `bson:"distance_km" json:"distance_km"`
	TripID        string        `bson:"trip_id,omitempty" json:"trip_id,omitempty"`
	TripNumber    string        `bson:"trip_number,omitempty" json:"trip_number,omitempty"`
	ReceiptNumber string        `bson:"receipt_number,omitempty" json:"receipt_number,omitempty"`
	Source        string        `bson:"source,omitempty" json:"source,omitempty"` // "trip_start", "trip_complete", "daily_shift", "manual"
	Status        string        `bson:"status" json:"status"`                     // "started", "completed"
	CreatedAt     time.Time     `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time     `bson:"updated_at" json:"updated_at"`
}

type AuditLog struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    string        `bson:"user_id" json:"user_id"`
	UserName  string        `bson:"user_name" json:"user_name"`
	Action    string        `bson:"action" json:"action"`
	Entity    string        `bson:"entity" json:"entity"`
	EntityID  string        `bson:"entity_id" json:"entity_id"`
	OldValue  string        `bson:"old_value" json:"old_value"`
	NewValue  string        `bson:"new_value" json:"new_value"`
	Timestamp time.Time     `bson:"timestamp" json:"timestamp"`
}

type Notification struct {
	ID         bson.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID     string        `bson:"user_id" json:"user_id"`         // "" for all or specific user ID
	TargetRole string        `bson:"target_role" json:"target_role"` // "admin", "driver", "all"
	Title      string        `bson:"title" json:"title"`
	Message    string        `bson:"message" json:"message"`
	Type       string        `bson:"type" json:"type"` // "fuel_request", "trip_submitted", "fuel_approved", "fuel_rejected", "license_expiry", "maintenance_due", "system"
	IsRead     bool          `bson:"is_read" json:"is_read"`
	CreatedAt  time.Time     `bson:"created_at" json:"created_at"`
}

type FeeSuggestion struct {
	Name    string  `bson:"name" json:"name"`
	Amount  float64 `bson:"amount" json:"amount"`
	FeeType string  `bson:"fee_type" json:"fee_type"` // "toll", "weighbridge", "parking", "gate_fee", "other"
}

type MaintenanceIssueSuggestion struct {
	ID    string `bson:"id" json:"id"`
	Label string `bson:"label" json:"label"`
	Icon  string `bson:"icon" json:"icon"`
}

type EICRecurringConfig struct {
	Enabled           bool       `bson:"enabled" json:"enabled"`
	MonthlyAmount     float64    `bson:"monthly_amount" json:"monthly_amount"`         // 150,000 ETB
	TotalMonths       int        `bson:"total_months" json:"total_months"`             // 24 (2 years)
	PaidMonths        int        `bson:"paid_months" json:"paid_months"`
	StartDate         string     `bson:"start_date" json:"start_date"`                 // "2026-10-01"
	EndDate           string     `bson:"end_date" json:"end_date"`                     // "2028-10-01"
	DeductionDay      int        `bson:"deduction_day" json:"deduction_day"`           // 1 (1st day of month)
	LastDeductedMonth string     `bson:"last_deducted_month" json:"last_deducted_month"` // e.g. "2026-10"
	LastDeductedAt    *time.Time `bson:"last_deducted_at,omitempty" json:"last_deducted_at,omitempty"`
	Description       string     `bson:"description" json:"description"`               // "EIC Fleet Insurance Monthly Installment"
	Status            string     `bson:"status" json:"status"`                         // "active", "paused", "completed"
}

type TransitPointSuggestion struct {
	ID                     string  `bson:"id" json:"id"`
	Name                   string  `bson:"name" json:"name"`
	Location               string  `bson:"location" json:"location"`
	SuggestedRatePerTon    float64 `bson:"suggested_rate_per_ton,omitempty" json:"suggested_rate_per_ton,omitempty"`
	SuggestedRatePerQuintal float64 `bson:"suggested_rate_per_quintal,omitempty" json:"suggested_rate_per_quintal,omitempty"`
	SuggestedRatePerKg     float64 `bson:"suggested_rate_per_kg,omitempty" json:"suggested_rate_per_kg,omitempty"`
	SuggestedLumpSum       float64 `bson:"suggested_lump_sum,omitempty" json:"suggested_lump_sum,omitempty"`
	DefaultPricingMethod   string  `bson:"default_pricing_method,omitempty" json:"default_pricing_method,omitempty"` // "per_ton", "per_quintal", "per_kg", "lump_sum"
	Notes                  string  `bson:"notes,omitempty" json:"notes"`
}

type DestinationRateSuggestion struct {
	ID                     string  `bson:"id" json:"id"`
	Name                   string  `bson:"name" json:"name"`
	Location               string  `bson:"location" json:"location"`
	SuggestedRatePerTon    float64 `bson:"suggested_rate_per_ton,omitempty" json:"suggested_rate_per_ton,omitempty"`
	SuggestedRatePerQuintal float64 `bson:"suggested_rate_per_quintal,omitempty" json:"suggested_rate_per_quintal,omitempty"`
	SuggestedRatePerKg     float64 `bson:"suggested_rate_per_kg,omitempty" json:"suggested_rate_per_kg,omitempty"`
	SuggestedLumpSum       float64 `bson:"suggested_lump_sum,omitempty" json:"suggested_lump_sum,omitempty"`
	DefaultPricingMethod   string  `bson:"default_pricing_method,omitempty" json:"default_pricing_method,omitempty"` // "per_ton", "per_quintal", "per_kg", "lump_sum"
	Notes                  string  `bson:"notes,omitempty" json:"notes"`
}

type Settings struct {
	ID                         bson.ObjectID                `bson:"_id,omitempty" json:"id"`
	CompanyName                string                       `bson:"company_name" json:"company_name"`
	CompanyLogo                string                       `bson:"company_logo" json:"company_logo"`
	Currency                   string                       `bson:"currency" json:"currency"`         // Default "ETB"
	DefaultUnit                string                       `bson:"default_unit" json:"default_unit"` // Default "ton"
	CompanyPhone               string                       `bson:"company_phone" json:"company_phone"`
	CompanyEmail               string                       `bson:"company_email" json:"company_email"`
	DieselPrice                float64                      `bson:"diesel_price" json:"diesel_price"` // Default 100 ETB / Liter
	FeeSuggestions             []FeeSuggestion              `bson:"fee_suggestions,omitempty" json:"fee_suggestions,omitempty"`
	FuelLitersPresets          []float64                    `bson:"fuel_liters_presets,omitempty" json:"fuel_liters_presets,omitempty"`
	MaintenanceSuggestions     []MaintenanceIssueSuggestion `bson:"maintenance_suggestions,omitempty" json:"maintenance_suggestions,omitempty"`
	TransitPointSuggestions    []TransitPointSuggestion     `bson:"transit_point_suggestions,omitempty" json:"transit_point_suggestions,omitempty"`
	DestinationRateSuggestions []DestinationRateSuggestion `bson:"destination_rate_suggestions,omitempty" json:"destination_rate_suggestions,omitempty"`
	EICRecurring               *EICRecurringConfig          `bson:"eic_recurring,omitempty" json:"eic_recurring,omitempty"`
	ReserveFuelBalanceLiters   float64                      `bson:"reserve_fuel_balance_liters" json:"reserve_fuel_balance_liters"`     // Remaining yard tank stock in Liters
	ReserveFuelCapacityLiters  float64                      `bson:"reserve_fuel_capacity_liters" json:"reserve_fuel_capacity_liters"`   // Yard tank maximum capacity in Liters (e.g. 10000 L)
	ReserveFuelLowThreshold    float64                      `bson:"reserve_fuel_low_threshold" json:"reserve_fuel_low_threshold"`       // Threshold for low inventory warning (e.g. 1500 L)
	DriverWelcomeMessage       string                       `bson:"driver_welcome_message,omitempty" json:"driver_welcome_message,omitempty"`
	WelcomeMessageSuggestions  []string                     `bson:"welcome_message_suggestions,omitempty" json:"welcome_message_suggestions,omitempty"`
	UpdatedAt                  time.Time                    `bson:"updated_at" json:"updated_at"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token  string   `json:"token"`
	User   User     `json:"user"`
	Driver *Driver  `json:"driver,omitempty"`
	Truck  *Truck   `json:"truck,omitempty"`
}
