# 🚛 Truck Hauling & Fleet Management System

A modern, responsive, full-stack **Truck Management & Hauling Operations System** designed for construction logistics, quarry operators, and commercial dump truck fleets.

Built with **React (Frontend)**, **Go Gin (Backend)**, and **MongoDB (Database)**.

---

## 🌟 Key Architecture & Highlights

The system features **two completely separate dashboards**:

### 1. 📱 Driver Dashboard (Mobile-First)
- **Top Summary Banner**: Driver name, assigned truck plate number (`ET-3-12345`), today's trip counter, today's revenue, and pending fuel badges.
- **Large Touch Action Buttons**:
  - `+ New Hauling Trip`
  - `⛽ Request Fuel Money`
  - `📋 My Trips History`
  - `💰 My Financial Summary`
- **Smart Repeat ("USE PREVIOUS")**: 1-click duplication of the last completed trip. Pre-fills loading site, dumping site, transition checkpoint, material, and rate—driver just enters quantity!
- **Fast 8-Step Trip Recording Form**:
  - Step 1: Loading site / quarry (with large buttons + recent history + quick inline adder)
  - Step 2: Dumping / delivery site
  - Step 3: Material selection (Sand, Aggregate, Selected Material, Gravel, Cement, etc.)
  - Step 4: Optional transition points (e.g., Weigh Station, Checkpoints)
  - Step 5: Quantity & Units (`Ton`, `Quintal`, `Kilogram`) with automatic unit conversion display (`1 ton = 1,000 kg`, `1 quintal = 100 kg`)
  - Step 6: Pricing Method (`Per Ton`, `Per Quintal`, `Per KG`, `Lump Sum`) with **Smart Route Price Auto-suggestions**
  - Step 7: **Additional Fees & Tolls** (Toll gates, Weighbridge / Scale, Parking / Staging, Gate passes, and miscellaneous extra fees with live net earnings preview)
  - Step 8: Trip summary review & confirmation with complete fees breakdown before submitting
- **Fuel Money Advance Request**: Quick amount chips (`500 ETB`, `1,000 ETB`, `2,000 ETB`, `5,000 ETB`, or Custom) with reason and gas station.
- **Driver Financial Summary**: Today's Revenue, This Week, This Month, Fuel Requested, Fuel Approved, Fuel Used, and **Net Operational Profit** (Revenue − Fuel advances).
- **Mobile Sticky Bottom Navigation**: Home | New Trip | Fuel | Trips | Summary.

---

### 2. 💻 Admin Dashboard (Desktop-Friendly)
- **Executive KPI Cards**: Total Trucks, Active Fleet, Total Drivers, Trips Today, Today's Revenue, Today's Expenses, Today's Profit, Monthly Revenue, Monthly Fuel, Monthly Other Expenses, and Monthly Net Profit.
- **Visual Analytics**: Revenue vs Expenses, Trips by Truck, Revenue by Material.
- **Top Performing Trucks**: Live comparison of trucks by trips, revenue, expenses, and profitability.
- **Complete Module Navigation**:
  - **Trips Management**: Search, multi-filtering (driver, truck, site, material, status), CSV export, and audit-safe void/cancel.
  - **Truck Fleet Management**: Capacity, make, model, driver assignment, insurance and inspection expiry warnings.
  - **Driver Management**: Driver roster, license numbers, assigned trucks, and driver profitability metrics.
  - **Sites & Transit Network**: Loading sites (quarries), destination sites, and weigh stations.
  - **Materials Catalog**: Standard material units and default prices.
  - **Routes & Pricing Matrix**: Predefined route pricing (Quarry A → Project B = 450 ETB/ton).
  - **Fuel Requests Management**: Approval workflow with **editable approved amounts** (e.g. driver requested 3,000 ETB, admin approves 2,500 ETB) and **automatic expense generation** on payment!
  - **Other Expenses Management**: Fuel, maintenance, tires, oil, spare parts, washing, toll, parking, etc.
  - **Maintenance Logging**: Preventive maintenance schedules, odometer tracking, and auto-expense syncing.
  - **Reports & Analytics**: Daily, Weekly, Monthly, Truck Performance, Driver Efficiency, Material Volume, and Route Profitability reports with 1-click **CSV / Excel export**.
  - **Financial Audit Logs**: Chronological log of all modifications, trip submissions, cancellations, and approvals.
  - **System Settings**: Configurable company name, currency (`ETB` default), contact details, and numbering formats.

---

## 🔒 Financial Integrity & Audit Rules
- **Zero Permanent Deletion of Financial Data**: Trips and expenses are never hard-deleted. They can only be marked as `cancelled` with an audit reason and timestamp to preserve complete financial reporting accountability.
- **Automatic Expense Synchronization**: Approved fuel disbursements and maintenance costs automatically generate operational expense records linked to the specific truck and driver.

---

## 🚀 Quick Start Instructions

### Prerequisites
- **Node.js** (v18+)
- **Go** (1.21+)
- **MongoDB** running locally on port 27017 (or MongoDB Atlas URI)

---

### Step 1: Start MongoDB
MongoDB runs on port `27017`. If using Docker:
```bash
docker run -d -p 27017:27017 --name mongo-fleet mongo:latest
```
*(On systems where MongoDB is already running as a Windows Service, this step is automatic).*

---

### Step 2: Start the Go Backend Server
```bash
cd backend
go run ./cmd/server
```
The backend will:
1. Connect to MongoDB (`mongodb://localhost:27017`)
2. Auto-seed realistic demo data (Trucks, Drivers, Routes, Materials, Trips, Expenses, and Settings)
3. Start listening on `http://localhost:6061`

---

### Step 3: Start the React Frontend
```bash
cd frontend
npm run dev
```
Open your browser to:
```
http://localhost:6060
```

---

## 🔑 Demo Login Credentials

You can use the 1-click demo switcher in the header or login manually with:

| Role | Email | Password | Assigned Truck |
|---|---|---|---|
| **Fleet Manager (Admin)** | `soneschool1@gmail.com` | `sone@7151` | Full Fleet Oversight |
| **Driver 1 (John Doe)** | `john@fleet.com` | `driver123` | Sinotruk Howo 371 (`ET-3-12345`) |
| **Driver 2 (Ahmed Mohammed)** | `ahmed@fleet.com` | `driver123` | Isuzu FSR 15T (`ET-3-67890`) |

---

## 📦 Numbering Formats
- Trips: `TR-000001`
- Fuel Requests: `FR-000001`
- Expenses: `EX-000001`
- Maintenance: `MT-000001`
- Trucks: `TRK-001`
- Drivers: `DRV-001`

---

## 🌐 CI/CD & VPS Production Deployment

This project includes a fully automated **GitHub Actions CI/CD pipeline** that tests and deploys the full stack to your VPS using **Docker Compose**.

For complete step-by-step instructions on setting up GitHub Secrets, VPS provisioning, and SSH keys, see the dedicated:
👉 **[CI/CD & VPS Deployment Guide](DEPLOYMENT.md)**

### Quick Summary of Required GitHub Secrets
In your GitHub repo (**Settings** > **Secrets and variables** > **Actions**):
- `VPS_HOST`: IP address or domain of your VPS
- `VPS_USER`: SSH username (e.g., `root` or `ubuntu`)
- `VPS_SSH_KEY`: Private SSH Key for authentication
- `JWT_SECRET`: Random 32+ character key for production auth

