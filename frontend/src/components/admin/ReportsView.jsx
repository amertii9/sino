import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatNumber, formatDate, exportToCSV } from '../../utils/formatters';
import {
  BarChart3,
  Download,
  Calendar,
  Truck,
  Users,
  Package,
  Route,
  TrendingUp,
  RefreshCw,
  Fuel,
  Gauge
} from 'lucide-react';

export const ReportsView = () => {
  const { t } = useLanguage();
  const [activeReport, setActiveReport] = useState('monthly'); // 'monthly', 'trucks', 'drivers', 'materials', 'routes'
  const [loading, setLoading] = useState(false);

  const [truckRows, setTruckRows] = useState([]);
  const [driverRows, setDriverRows] = useState([]);
  const [materialRows, setMaterialRows] = useState([]);
  const [routeRows, setRouteRows] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [t, d, m, r, s] = await Promise.all([
        api.get('/reports/trucks'),
        api.get('/reports/drivers'),
        api.get('/reports/materials'),
        api.get('/reports/routes'),
        api.get('/reports/dashboard'),
      ]);
      setTruckRows(t || []);
      setDriverRows(d || []);
      setMaterialRows(m || []);
      setRouteRows(r || []);
      setDashboardStats(s || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const handleExport = () => {
    if (activeReport === 'trucks') {
      const headers = [
        { key: 'plate_number', label: 'Truck Plate' },
        { key: 'model', label: 'Model' },
        { key: 'capacity', label: 'Capacity (Tons)' },
        { key: 'driver_name', label: 'Assigned Driver' },
        { key: 'trips_count', label: 'Trips Count' },
        { key: 'quantity_tons', label: 'Hauled Tons' },
        { key: 'revenue', label: 'Revenue (ETB)' },
        { key: 'fuel_expense', label: 'Fuel Expense' },
        { key: 'other_expenses', label: 'Other Expenses' },
        { key: 'total_expenses', label: 'Total Expenses' },
        { key: 'profit', label: 'Net Profit (ETB)' },
      ];
      exportToCSV(`truck_performance_report_${new Date().toISOString().slice(0, 10)}`, truckRows, headers);
    } else if (activeReport === 'drivers') {
      const headers = [
        { key: 'full_name', label: 'Driver Name' },
        { key: 'truck_plate', label: 'Assigned Truck' },
        { key: 'trips_count', label: 'Trips' },
        { key: 'quantity_tons', label: 'Tons Hauled' },
        { key: 'revenue', label: 'Revenue (ETB)' },
        { key: 'fuel_expense', label: 'Fuel Expense' },
        { key: 'profit', label: 'Net Operational Profit (ETB)' },
      ];
      exportToCSV(`driver_performance_report_${new Date().toISOString().slice(0, 10)}`, driverRows, headers);
    } else if (activeReport === 'materials') {
      const headers = [
        { key: 'material_name', label: 'Material' },
        { key: 'quantity_tons', label: 'Tons Hauled' },
        { key: 'trips_count', label: 'Trips Count' },
        { key: 'revenue', label: 'Revenue (ETB)' },
      ];
      exportToCSV(`material_volume_report_${new Date().toISOString().slice(0, 10)}`, materialRows, headers);
    } else if (activeReport === 'routes') {
      const headers = [
        { key: 'route_name', label: 'Route' },
        { key: 'trips_count', label: 'Trips' },
        { key: 'quantity_tons', label: 'Tons Hauled' },
        { key: 'revenue', label: 'Revenue (ETB)' },
        { key: 'avg_price', label: 'Average Price / Ton' },
      ];
      exportToCSV(`route_profitability_report_${new Date().toISOString().slice(0, 10)}`, routeRows, headers);
    } else if (activeReport === 'fuel_estimation') {
      const headers = [
        { key: 'plate_number', label: 'Truck Plate' },
        { key: 'model', label: 'Model' },
        { key: 'driver_name', label: 'Assigned Driver' },
        { key: 'month_distance_km', label: 'Month Distance (KM)' },
        { key: 'total_distance_km', label: 'Total Distance (KM)' },
        { key: 'month_fuel_liters', label: 'Month Fuel (L)' },
        { key: 'month_fuel_cost', label: 'Month Fuel Cost (ETB)' },
        { key: 'total_fuel_liters', label: 'Total Fuel (L)' },
        { key: 'total_fuel_cost', label: 'Total Fuel Cost (ETB)' },
        { key: 'cost_per_km', label: 'Cost / KM (ETB)' },
        { key: 'liters_per_100km', label: 'L / 100km' },
        { key: 'km_per_liter', label: 'KM / Liter' },
        { key: 'efficiency_status', label: 'Efficiency Status' },
      ];
      exportToCSV(`fuel_odometer_efficiency_${new Date().toISOString().slice(0, 10)}`, dashboardStats?.fuel_estimation?.trucks || [], headers);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" /> {t('reports_title', 'Operational & Financial Reports')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('reports_sub', 'Exportable performance analytics by truck, driver, route, material, and accounting period')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadReportData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn"
          >
            <Download className="w-4 h-4" /> {t('export_csv', 'Export CSV')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap bg-slate-900 border border-slate-800 p-1 rounded-2xl text-xs gap-1">
        {[
          { id: 'monthly', label: t('rep_tab_monthly', 'Executive Period Summary'), icon: TrendingUp },
          { id: 'fuel_estimation', label: t('fuel_estimation_title', 'Fuel & Odometer Efficiency'), icon: Fuel },
          { id: 'trucks', label: t('rep_tab_trucks', 'Truck Performance Comparison'), icon: Truck },
          { id: 'drivers', label: t('rep_tab_drivers', 'Driver Efficiency & Profit'), icon: Users },
          { id: 'materials', label: t('rep_tab_materials', 'Material Volume Report'), icon: Package },
          { id: 'routes', label: t('rep_tab_routes', 'Route Profitability Matrix'), icon: Route },
        ].map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setActiveReport(tabItem.id)}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${
              activeReport === tabItem.id ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <tabItem.icon className="w-3.5 h-3.5" />
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* REPORT 1: Executive Period Summary (Requirement 27) */}
      {activeReport === 'monthly' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('total_trips_month_stat', 'Total Trips (Month)')}</span>
              <div className="text-2xl font-black text-white mt-1">{dashboardStats?.trips_month || 0}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('tons_transported', 'Tons Transported')}</span>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {formatNumber(dashboardStats?.quantity_month || 0)} {t('tons', 'tons')}
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('gross_hauling_revenue', 'Gross Hauling Revenue')}</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {formatCurrency(dashboardStats?.monthly_revenue || 0)}
              </div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('total_company_expenses_stat', 'Total Company Expenses')}</span>
              <div className="text-2xl font-black text-red-400 mt-1">
                {formatCurrency(dashboardStats?.monthly_total_expense || 0)}
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <h3 className="font-bold text-base text-white">{t('monthly_pl_breakdown', 'Monthly Profit & Loss Breakdown')}</h3>
            <div className="divide-y divide-slate-800 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-300">{t('total_hauling_revenue', 'Total Hauling Revenue')}</span>
                <span className="font-black text-emerald-400 font-mono text-sm">{formatCurrency(dashboardStats?.monthly_revenue || 0)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 pl-4">{t('less_fuel_advances', 'Less: Diesel Fuel Advances')}</span>
                <span className="font-bold text-red-400 font-mono">- {formatCurrency(dashboardStats?.monthly_fuel_expense || 0)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 pl-4">🛣️ Less: Tolls, Weighbridges & Road Fees</span>
                <span className="font-bold text-amber-400 font-mono">- {formatCurrency(dashboardStats?.monthly_toll_expense || 0)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 pl-4">🔧 Less: Truck Maintenance & Repairs</span>
                <span className="font-bold text-blue-400 font-mono">- {formatCurrency(dashboardStats?.monthly_maintenance_expense || 0)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400 pl-4">📦 Less: Other Things (Tires, Parts, Oil & Misc)</span>
                <span className="font-bold text-purple-400 font-mono">- {formatCurrency(dashboardStats?.monthly_other_expense || 0)}</span>
              </div>
              <div className="py-3 flex justify-between items-center bg-emerald-950/20 px-3 rounded-2xl border border-emerald-500/30">
                <span className="font-bold text-emerald-400 text-sm">{t('net_operational_profit', 'NET OPERATIONAL PROFIT:')}</span>
                <span className="text-xl font-black text-emerald-400 font-mono">{formatCurrency(dashboardStats?.monthly_net_profit || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT: Fuel & Odometer Efficiency Report */}
      {activeReport === 'fuel_estimation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('avg_fuel_consumption_label', 'Avg. Fuel Consumption')}</span>
              <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
                {dashboardStats?.avg_fuel_consumption_l_per_km !== undefined ? Number(dashboardStats.avg_fuel_consumption_l_per_km).toFixed(3) : (dashboardStats?.fuel_estimation?.liters_per_km !== undefined ? Number(dashboardStats.fuel_estimation.liters_per_km).toFixed(3) : '0.000')} <span className="text-sm">{t('liters_per_km_unit', 'L/km')}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{dashboardStats?.fuel_estimation?.liters_per_100km || 0} L/100km • {dashboardStats?.fuel_estimation?.km_per_liter || 0} km/L</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('avg_trip_dist_stat', 'Avg. Trip Distance')}</span>
              <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">
                {formatNumber(dashboardStats?.avg_trip_distance_km ?? dashboardStats?.fuel_estimation?.avg_trip_distance_km ?? 0)} <span className="text-sm">KM</span>
              </div>
              <div className="text-[10px] text-cyan-400 mt-0.5">Month: {formatNumber(dashboardStats?.month_avg_trip_distance_km || 0)} KM/trip</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('total_dist_stat', 'Total Distance')}</span>
              <div className="text-2xl font-black text-white mt-1">
                {formatNumber(dashboardStats?.fuel_estimation?.total_distance_km || 0)} KM
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Month: {formatNumber(dashboardStats?.fuel_estimation?.month_distance_km || 0)} KM</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('total_fuel_vol_stat', 'Total Fuel Volume')}</span>
              <div className="text-2xl font-black text-purple-400 mt-1">
                {formatNumber(dashboardStats?.fuel_estimation?.total_fuel_liters || 0)} L
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Spend: {formatCurrency(dashboardStats?.fuel_estimation?.total_fuel_cost || 0)}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <span className="text-[11px] text-slate-400">{t('effective_cost_per_km', 'Effective Cost Per KM')}</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {formatCurrency(dashboardStats?.fuel_estimation?.cost_per_km || 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Month: {formatCurrency(dashboardStats?.fuel_estimation?.month_cost_per_km || 0)} / KM</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-white">{t('truck_fuel_efficiency_matrix', 'Truck Fuel Efficiency Matrix')}</h3>
                <p className="text-xs text-slate-400">{t('cross_analyzing_sub', 'Cross-analyzing approved fuel advances against verified odometer distance')}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3">{t('odo_col_truck', 'Truck Plate')}</th>
                    <th className="py-3 px-3">{t('truck_model_col', 'Model')}</th>
                    <th className="py-3 px-3">{t('driver', 'Driver')}</th>
                    <th className="py-3 px-3">{t('col_month_km', 'Month KM')}</th>
                    <th className="py-3 px-3">{t('col_total_km', 'Total KM')}</th>
                    <th className="py-3 px-3">{t('month_fuel_l_header', 'Month Fuel (L)')}</th>
                    <th className="py-3 px-3">{t('total_fuel_l_header', 'Total Fuel (L)')}</th>
                    <th className="py-3 px-3">{t('col_l_per_100km', 'L / 100km')}</th>
                    <th className="py-3 px-3">{t('cost_per_km_header', 'Cost / KM')}</th>
                    <th className="py-3 px-3">{t('col_economy', 'Economy')}</th>
                    <th className="py-3 px-3">{t('status', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {dashboardStats?.fuel_estimation?.trucks?.map(t => {
                    const badge = {
                      optimal: { bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Optimal' },
                      standard: { bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Standard' },
                      high_consumption: { bg: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'High' },
                      pending_data: { bg: 'bg-slate-700/40 text-slate-400 border-slate-600', label: 'Pending' },
                    }[t.efficiency_status] || { bg: 'bg-slate-700/40 text-slate-400 border-slate-600', label: t.efficiency_status };

                    return (
                      <tr key={t.truck_id || t.plate_number} className="hover:bg-slate-800/50">
                        <td className="py-3 px-3 font-bold text-slate-100">{t.plate_number}</td>
                        <td className="py-3 px-3 text-slate-400">{t.model}</td>
                        <td className="py-3 px-3 text-slate-300 font-semibold">{t.driver_name || 'Unassigned'}</td>
                        <td className="py-3 px-3 font-mono font-bold text-white">{formatNumber(t.month_distance_km)}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{formatNumber(t.total_distance_km)}</td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">{formatNumber(t.month_fuel_liters)} L</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{formatNumber(t.total_fuel_liters)} L</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-400">{t.liters_per_100km} L/100km</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-200">{formatCurrency(t.cost_per_km)}/km</td>
                        <td className="py-3 px-3 font-mono text-slate-300 font-semibold">{t.km_per_liter} km/L</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: Truck Performance Report (Requirement 28) */}
      {activeReport === 'trucks' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">{t('odo_col_truck', 'Truck Plate')}</th>
                  <th className="py-3 px-3">{t('truck_model_col', 'Model')}</th>
                  <th className="py-3 px-3">{t('truck_assigned_driver', 'Assigned Driver')}</th>
                  <th className="py-3 px-3">{t('driver_trips_kpi', 'Trips')}</th>
                  <th className="py-3 px-3">{t('tons_hauled_header', 'Tons Hauled')}</th>
                  <th className="py-3 px-3">{t('driver_rev_kpi', 'Revenue')}</th>
                  <th className="py-3 px-3">{t('fuel_cost_header', 'Fuel Cost')}</th>
                  <th className="py-3 px-3">{t('col_other_expenses', 'Other Expenses')}</th>
                  <th className="py-3 px-3">{t('net_profit_header', 'Net Profit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {truckRows.map(r => (
                  <tr key={r.truck_id} className="hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-bold text-slate-100">{r.plate_number}</td>
                    <td className="py-3 px-3 text-slate-400">{r.model}</td>
                    <td className="py-3 px-3 text-slate-300">{r.driver_name || 'Unassigned'}</td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{r.trips_count}</td>
                    <td className="py-3 px-3 font-bold text-amber-400">{formatNumber(r.quantity_tons)} T</td>
                    <td className="py-3 px-3 font-bold text-emerald-400">{formatCurrency(r.revenue)}</td>
                    <td className="py-3 px-3 text-red-400">{formatCurrency(r.fuel_expense)}</td>
                    <td className="py-3 px-3 text-slate-400">{formatCurrency(r.other_expenses)}</td>
                    <td className="py-3 px-3 font-black text-emerald-400 text-sm">{formatCurrency(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: Driver Performance Report (Requirement 29) */}
      {activeReport === 'drivers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">{t('driver_name_col', 'Driver Name')}</th>
                  <th className="py-3 px-3">{t('driver_field_colon', 'Driver #')}</th>
                  <th className="py-3 px-3">{t('assigned_truck_col', 'Assigned Truck')}</th>
                  <th className="py-3 px-3">{t('col_trips_count', 'Trips Count')}</th>
                  <th className="py-3 px-3">{t('total_tons_col', 'Total Tons')}</th>
                  <th className="py-3 px-3">{t('fee_gross_revenue', 'Gross Revenue')}</th>
                  <th className="py-3 px-3">{t('fuel_advances_col', 'Fuel Advances')}</th>
                  <th className="py-3 px-3">{t('driver_profitability', 'Driver Profitability')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {driverRows.map(d => (
                  <tr key={d.driver_id} className="hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-bold text-slate-100">{d.full_name}</td>
                    <td className="py-3 px-3 font-mono text-amber-400">{d.driver_number}</td>
                    <td className="py-3 px-3 text-slate-300 font-semibold">{d.truck_plate || 'None'}</td>
                    <td className="py-3 px-3 font-bold text-slate-200">{d.trips_count}</td>
                    <td className="py-3 px-3 text-amber-400">{formatNumber(d.quantity_tons)} T</td>
                    <td className="py-3 px-3 font-bold text-emerald-400">{formatCurrency(d.revenue)}</td>
                    <td className="py-3 px-3 text-red-400">{formatCurrency(d.fuel_expense)}</td>
                    <td className="py-3 px-3 font-black text-emerald-400 text-sm">{formatCurrency(d.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: Material Volume Report (Requirement 30) */}
      {activeReport === 'materials' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">{t('col_material_type', 'Material Type')}</th>
                  <th className="py-3 px-3">{t('col_total_qty_hauled', 'Total Quantity Hauled')}</th>
                  <th className="py-3 px-3">{t('col_trips_count', 'Trips Count')}</th>
                  <th className="py-3 px-3">{t('total_route_revenue', 'Total Revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {materialRows.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-bold text-slate-100">{m.material_name}</td>
                    <td className="py-3 px-3 font-bold text-amber-400">{formatNumber(m.quantity_tons)} Metric Tons</td>
                    <td className="py-3 px-3 text-slate-300">{m.trips_count} trips</td>
                    <td className="py-3 px-3 font-black text-emerald-400 text-sm">{formatCurrency(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 5: Route Profitability Matrix (Requirement 31) */}
      {activeReport === 'routes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">{t('hauling_route', 'Hauling Route')}</th>
                  <th className="py-3 px-3">{t('col_trips_completed', 'Trips Completed')}</th>
                  <th className="py-3 px-3">{t('col_quantity_hauled', 'Quantity Hauled')}</th>
                  <th className="py-3 px-3">{t('total_route_revenue', 'Total Route Revenue')}</th>
                  <th className="py-3 px-3">{t('col_effective_avg_rate', 'Effective Average Rate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {routeRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-bold text-slate-100">{r.route_name}</td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{r.trips_count}</td>
                    <td className="py-3 px-3 text-amber-400 font-bold">{formatNumber(r.quantity_tons)} Tons</td>
                    <td className="py-3 px-3 font-black text-emerald-400 text-sm">{formatCurrency(r.revenue)}</td>
                    <td className="py-3 px-3 text-slate-300 font-mono">{formatCurrency(r.avg_price)} / ton</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
