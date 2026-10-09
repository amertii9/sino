import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Truck,
  Users,
  TrendingUp,
  Receipt,
  Fuel,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  BarChart3,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Gauge,
  Calculator,
  Zap,
  CheckCircle2,
  RefreshCw,
  Info,
  Sparkles,
  Edit,
  Trash2,
  X,
  Check,
  Save,
  Route,
  MapPin,
  PieChart,
  Activity,
  Layers,
  Filter,
  CreditCard,
  Clock,
  ArrowRight
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const AdminDashboard = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [stats, setStats] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dieselPrice, setDieselPrice] = useState(100);
  const [dieselPriceInput, setDieselPriceInput] = useState('100');
  const [priceSavedBadge, setPriceSavedBadge] = useState(false);
  const [fuelViewMode, setFuelViewMode] = useState('per_km'); // 'per_km' | 'per_month' | 'trucks'
  const [refreshingFuel, setRefreshingFuel] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState('month'); // 'month' | 'today'
  const [chartCategory, setChartCategory] = useState('all'); // 'all' | 'financial' | 'materials' | 'trucks' | 'trends' | 'fuel'

  // Fuel Management / Editing Modals State
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [fuelRecordsModalOpen, setFuelRecordsModalOpen] = useState(false);
  const [fuelRequestsList, setFuelRequestsList] = useState([]);
  const [editingFuelRequest, setEditingFuelRequest] = useState(null);
  const [trucksList, setTrucksList] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const [fuelForm, setFuelForm] = useState({
    truck_id: '',
    truck_plate: '',
    driver_id: '',
    driver_name: '',
    amount_requested: 2000,
    amount_approved: 2000,
    status: 'paid',
    fuel_station: 'TotalEnergies Kality',
    reason: 'Diesel refueling for hauling runs',
    notes: '',
    admin_note: 'Approved per operational quota',
    requested_at: new Date().toISOString().slice(0, 10),
  });

  const fetchStats = async (price = dieselPrice) => {
    try {
      const [dashStats, trips] = await Promise.all([
        api.get(`/reports/dashboard?diesel_price=${price}`),
        api.get('/trips'),
      ]);
      setStats(dashStats);
      setRecentTrips(trips?.slice(0, 6) || []);
      if (dashStats?.fuel_estimation?.diesel_price_per_liter) {
        setDieselPrice(dashStats.fuel_estimation.diesel_price_per_liter);
        setDieselPriceInput(String(dashStats.fuel_estimation.diesel_price_per_liter));
      }
    } catch (err) {
      console.error('Error fetching admin dashboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshingFuel(false);
    }
  };

  const loadFuelSupportData = async () => {
    try {
      const [reqs, trks, drvs] = await Promise.all([
        api.get('/fuel-requests'),
        api.get('/trucks'),
        api.get('/drivers'),
      ]);
      setFuelRequestsList(reqs || []);
      setTrucksList(trks || []);
      setDriversList(drvs || []);
      return { reqs: reqs || [], trks: trks || [], drvs: drvs || [] };
    } catch (err) {
      console.error('Failed to load fuel records:', err);
      return { reqs: [], trks: [], drvs: [] };
    }
  };

  const handlePriceUpdate = async (e) => {
    e?.preventDefault();
    const p = parseFloat(dieselPriceInput);
    if (!isNaN(p) && p > 0) {
      setDieselPrice(p);
      setRefreshingFuel(true);
      await fetchStats(p);
    }
  };

  const handleSavePricePermanent = async () => {
    const p = parseFloat(dieselPriceInput);
    if (!isNaN(p) && p > 0) {
      setRefreshingFuel(true);
      try {
        await api.patch('/settings/diesel-price', { diesel_price: p });
        setDieselPrice(p);
        setPriceSavedBadge(true);
        setTimeout(() => setPriceSavedBadge(false), 3000);
        await fetchStats(p);
      } catch (err) {
        alert('Failed to save diesel price: ' + err.message);
      } finally {
        setRefreshingFuel(false);
      }
    }
  };

  const openNewFuelModal = async (presetTruck = null) => {
    const { trks, drvs } = await loadFuelSupportData();
    let tId = presetTruck?.truck_id || '';
    let tPlate = presetTruck?.plate_number || '';
    let dId = '';
    let dName = presetTruck?.driver_name || '';

    if (!tId && trks.length > 0) {
      tId = trks[0].id;
      tPlate = trks[0].plate_number;
      dId = trks[0].driver_assigned_id || '';
      dName = trks[0].driver_assigned_name || '';
    } else if (tId) {
      const matched = trks.find(t => t.id === tId || t.plate_number === tPlate);
      if (matched) {
        dId = matched.driver_assigned_id || '';
        if (!dName) dName = matched.driver_assigned_name || '';
      }
    }

    setEditingFuelRequest(null);
    setFuelForm({
      truck_id: tId,
      truck_plate: tPlate,
      driver_id: dId,
      driver_name: dName,
      amount_requested: 2000,
      amount_approved: 2000,
      status: 'paid',
      fuel_station: 'TotalEnergies Kality',
      reason: 'Diesel refueling for hauling runs',
      notes: '',
      admin_note: 'Approved per operational quota',
      requested_at: new Date().toISOString().slice(0, 10),
    });
    setFuelModalOpen(true);
  };

  const openEditFuelModal = async (req) => {
    await loadFuelSupportData();
    setEditingFuelRequest(req);
    setFuelForm({
      truck_id: req.truck_id || '',
      truck_plate: req.truck_plate || '',
      driver_id: req.driver_id || '',
      driver_name: req.driver_name || '',
      amount_requested: req.amount_requested || 0,
      amount_approved: req.amount_approved || req.amount_requested || 0,
      status: req.status || 'paid',
      fuel_station: req.fuel_station || '',
      reason: req.reason || '',
      notes: req.notes || '',
      admin_note: req.admin_note || '',
      requested_at: req.requested_at ? req.requested_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setFuelRecordsModalOpen(false);
    setFuelModalOpen(true);
  };

  const handleSaveFuelSubmit = async (e) => {
    e.preventDefault();
    setRefreshingFuel(true);
    try {
      const payload = {
        truck_id: fuelForm.truck_id,
        truck_plate: fuelForm.truck_plate,
        driver_id: fuelForm.driver_id,
        driver_name: fuelForm.driver_name,
        amount_requested: parseFloat(fuelForm.amount_requested) || 0,
        amount_approved: parseFloat(fuelForm.amount_approved) || parseFloat(fuelForm.amount_requested) || 0,
        status: fuelForm.status,
        reason: fuelForm.reason,
        fuel_station: fuelForm.fuel_station,
        notes: fuelForm.notes,
        admin_note: fuelForm.admin_note,
        requested_at: fuelForm.requested_at ? new Date(fuelForm.requested_at).toISOString() : undefined,
      };

      if (editingFuelRequest) {
        await api.put(`/fuel-requests/${editingFuelRequest.id}`, payload);
      } else {
        await api.post('/fuel-requests', payload);
      }

      setFuelModalOpen(false);
      setEditingFuelRequest(null);
      await fetchStats();
      await loadFuelSupportData();
    } catch (err) {
      alert('Failed to save fuel information: ' + err.message);
    } finally {
      setRefreshingFuel(false);
    }
  };

  const handleDeleteFuelReq = async (id) => {
    if (!confirm('Are you sure you want to delete this fuel record?')) return;
    try {
      await api.delete(`/fuel-requests/${id}`);
      await fetchStats();
      await loadFuelSupportData();
      setFuelModalOpen(false);
    } catch (err) {
      alert('Failed to delete fuel record: ' + err.message);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Chart styling colors based on current dark / light theme
  const chartColors = useMemo(() => {
    const text = isDark ? '#94a3b8' : '#334155';
    const grid = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.15)';
    const tooltipBg = isDark ? '#0f172a' : '#ffffff';
    const tooltipText = isDark ? '#f8fafc' : '#0f172a';
    const tooltipBorder = isDark ? '#334155' : '#cbd5e1';
    return { text, grid, tooltipBg, tooltipText, tooltipBorder };
  }, [isDark]);

  // Base options for bar / standard charts
  const baseChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: chartColors.text,
          font: { size: 11, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipText,
        bodyColor: chartColors.text,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
        boxPadding: 4,
        callbacks: {
          label: (context) => ` ${context.dataset.label || ''}: ${formatCurrency(context.raw || 0)}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: chartColors.text, font: { size: 10, weight: '500' } },
        grid: { color: chartColors.grid }
      },
      y: {
        ticks: {
          color: chartColors.text,
          font: { size: 10, weight: '500' },
          callback: (value) => {
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
            return value;
          }
        },
        grid: { color: chartColors.grid }
      }
    }
  }), [chartColors]);

  const currencyTooltipOptions = baseChartOptions;

  // 1. Financial Performance Bar Chart Data
  const financialChartData = useMemo(() => {
    if (chartTimeframe === 'month') {
      return {
        labels: [
          t('monthly_revenue', 'Revenue'),
          t('fuel_expenses', 'Fuel Expense'),
          t('other_expenses', 'Other Expense'),
          t('total_expenses', 'Total Expense'),
          t('monthly_net_profit', 'Net Profit')
        ],
        datasets: [
          {
            label: t('monthly_performance', 'Monthly Amount (ETB)'),
            data: [
              stats?.monthly_revenue || 0,
              stats?.monthly_fuel_expense || 0,
              stats?.monthly_other_expense || 0,
              stats?.monthly_total_expense || (stats?.monthly_fuel_expense || 0) + (stats?.monthly_other_expense || 0),
              stats?.monthly_net_profit || 0
            ],
            backgroundColor: [
              'rgba(16, 185, 129, 0.85)', // emerald
              'rgba(249, 115, 22, 0.85)',  // orange
              'rgba(168, 85, 247, 0.85)',  // purple
              'rgba(239, 68, 68, 0.85)',   // red
              'rgba(6, 182, 212, 0.85)',   // cyan
            ],
            borderColor: [
              '#10b981',
              '#f97316',
              '#a855f7',
              '#ef4444',
              '#06b6d4',
            ],
            borderWidth: 1.5,
            borderRadius: 8,
          }
        ]
      };
    }
    // Daily (Today)
    return {
      labels: [
        t('todays_revenue', "Today's Revenue"),
        t('todays_expenses', "Today's Expenses"),
        t('todays_net_profit', "Today's Net Profit")
      ],
      datasets: [
        {
          label: t('daily_performance', 'Daily Cashflow (ETB)'),
          data: [
            stats?.revenue_today || 0,
            stats?.expenses_today || 0,
            stats?.profit_today || 0
          ],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)',
            'rgba(239, 68, 68, 0.85)',
            'rgba(6, 182, 212, 0.85)'
          ],
          borderColor: ['#10b981', '#ef4444', '#06b6d4'],
          borderWidth: 1.5,
          borderRadius: 8,
        }
      ]
    };
  }, [stats, chartTimeframe, t]);

  // 2. Material Doughnut Chart Data
  const materialChartData = useMemo(() => {
    const matMap = stats?.material_revenue || {};
    const labels = Object.keys(matMap);
    const data = Object.values(matMap);
    const colors = [
      '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6',
      '#ec4899', '#3b82f6', '#f97316', '#14b8a6'
    ];
    return {
      labels: labels.length ? labels : ['No Data'],
      datasets: [
        {
          data: data.length ? data : [1],
          backgroundColor: data.length ? colors.slice(0, labels.length) : ['#64748b'],
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    };
  }, [stats, isDark]);

  // Doughnut options
  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: chartColors.text,
          padding: 12,
          font: { size: 11, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipText,
        bodyColor: chartColors.text,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
        callbacks: {
          label: (context) => {
            const val = context.raw || 0;
            const total = stats?.monthly_revenue || (context.dataset.data.reduce((a, b) => a + b, 0)) || 1;
            const pct = Math.round((val / total) * 100);
            return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
          }
        }
      }
    },
    cutout: '62%'
  }), [chartColors, stats]);

  // 3. Top Trucks Grouped Bar Chart Data
  const topTrucksChartData = useMemo(() => {
    const trucks = stats?.top_trucks || [];
    const labels = trucks.map(trk => trk.truck_plate || 'Truck');
    return {
      labels,
      datasets: [
        {
          label: t('revenue', 'Revenue (ETB)'),
          data: trucks.map(trk => trk.revenue || 0),
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: t('profit', 'Net Profit (ETB)'),
          data: trucks.map(trk => trk.profit || 0),
          backgroundColor: 'rgba(6, 182, 212, 0.85)',
          borderColor: '#06b6d4',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: t('expense', 'Expense (ETB)'),
          data: trucks.map(trk => trk.expense || 0),
          backgroundColor: 'rgba(239, 68, 68, 0.85)',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    };
  }, [stats, t]);

  // 4. Recent Operations Trend (Revenue & Quantity over days)
  const tripTrendsChartData = useMemo(() => {
    if (!recentTrips || recentTrips.length === 0) return null;
    const dateMap = {};
    recentTrips.forEach(tr => {
      const d = tr.date ? tr.date.slice(0, 10) : 'Recent';
      if (!dateMap[d]) {
        dateMap[d] = { revenue: 0, tons: 0, count: 0 };
      }
      dateMap[d].revenue += Number(tr.total_revenue || 0);
      dateMap[d].tons += Number(tr.quantity || 0);
      dateMap[d].count += 1;
    });

    const dates = Object.keys(dateMap).sort();
    return {
      labels: dates.map(d => formatDate(d)),
      datasets: [
        {
          type: 'line',
          label: t('revenue', 'Revenue (ETB)'),
          data: dates.map(d => dateMap[d].revenue),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          type: 'bar',
          label: t('volume_tons', 'Cargo Volume (Tons)'),
          data: dates.map(d => Math.round(dateMap[d].tons)),
          backgroundColor: 'rgba(245, 158, 11, 0.65)',
          borderColor: '#f59e0b',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y1'
        }
      ]
    };
  }, [recentTrips, t]);

  const trendChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: chartColors.text, font: { size: 11, weight: '600' } }
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipText,
        bodyColor: chartColors.text,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
      }
    },
    scales: {
      x: {
        ticks: { color: chartColors.text, font: { size: 10 } },
        grid: { color: chartColors.grid }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        ticks: {
          color: chartColors.text,
          font: { size: 10 },
          callback: (value) => {
            if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
            return value;
          }
        },
        grid: { color: chartColors.grid }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        ticks: { color: '#f59e0b', font: { size: 10 } },
        grid: { drawOnChartArea: false }
      }
    }
  }), [chartColors]);

  // 5. Fuel Efficiency Benchmark by Truck (L/100km)
  const truckFuelChartData = useMemo(() => {
    const trucks = stats?.fuel_estimation?.trucks || [];
    if (!trucks.length) return null;

    const labels = trucks.map(t => t.truck_plate);
    const data = trucks.map(t => Number(t.liters_per_100km || 0));
    const bgColors = data.map(v => {
      if (v <= 40) return 'rgba(16, 185, 129, 0.85)'; // Good (green)
      if (v <= 50) return 'rgba(245, 158, 11, 0.85)'; // Moderate (amber)
      return 'rgba(239, 68, 68, 0.85)'; // High consumption (red)
    });

    return {
      labels,
      datasets: [
        {
          label: 'Liters / 100km',
          data,
          backgroundColor: bgColors,
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    };
  }, [stats]);

  const fuelChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipText,
        bodyColor: chartColors.text,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
        callbacks: {
          label: (context) => ` Consumption: ${context.raw} L / 100km`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: chartColors.text, font: { size: 10 } },
        grid: { color: chartColors.grid }
      },
      y: {
        ticks: { color: chartColors.text, font: { size: 10 } },
        grid: { color: chartColors.grid }
      }
    }
  }), [chartColors]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Loading fleet analytics...
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. TOP CARDS (Fleet Overview & Key Operational Indicators) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 sm:gap-3.5">
        {/* Trucks */}
        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400">{t('total_trucks', 'Total Trucks')}</span>
            <span className="text-emerald-400 text-[9px] sm:text-[10px] font-bold bg-emerald-500/10 px-1.5 sm:px-2 py-0.5 rounded-full">
              {stats?.active_trucks || 0} {t('active_trucks', 'Active')}
            </span>
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1.5 sm:mt-2">
            {stats?.total_trucks || 0}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate">{t('fleet_working_avail', 'Fleet working & available')}</div>
        </div>

        {/* Drivers */}
        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400">{t('total_drivers', 'Total Drivers')}</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1.5 sm:mt-2">
            {stats?.total_drivers || 0}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate">{t('active_operators', 'Active licensed operators')}</div>
        </div>

        {/* Trips Today */}
        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400">{t('trips_today', 'Trips Today')}</span>
            <span className="text-amber-400 text-[9px] sm:text-[10px] font-bold bg-amber-500/10 px-1.5 sm:px-2 py-0.5 rounded-full">
              {formatNumber(stats?.quantity_today || 0)} t
            </span>
          </div>
          <div className="text-xl sm:text-3xl font-black text-amber-400 mt-1.5 sm:mt-2">
            {stats?.trips_today || 0}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate">{t('hauling_today', 'Hauling operations today')}</div>
        </div>

        {/* Average Trip Distance */}
        <div className="p-3 sm:p-4 bg-slate-900 border-2 border-cyan-500/30 rounded-2xl sm:rounded-3xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] sm:text-xs font-semibold text-cyan-300">{t('avg_trip_distance', 'Avg Trip Distance')}</span>
            <span className="text-cyan-400 text-[9px] sm:text-[10px] font-bold bg-cyan-500/15 border border-cyan-500/30 px-1.5 sm:px-2 py-0.5 rounded-full">
              KM / Trip
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-3xl font-black text-cyan-400 font-mono">
              {formatNumber(stats?.avg_trip_distance_km ?? stats?.fuel_estimation?.avg_trip_distance_km ?? 0)}
            </span>
            <span className="text-[10px] sm:text-xs text-cyan-300/80 font-bold">km</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate" title={`Today: ${formatNumber(stats?.today_avg_trip_distance_km || 0)} km • Month: ${formatNumber(stats?.month_avg_trip_distance_km || 0)} km`}>
            {stats?.month_avg_trip_distance_km ? `Mo avg: ${formatNumber(stats.month_avg_trip_distance_km)} km` : t('fleet_avg_haul', 'Fleet average haul')}
          </div>
        </div>

        {/* Average Fuel Consumption (Liter per Kilometer) */}
        <div className="p-3 sm:p-4 bg-slate-900 border-2 border-amber-500/30 rounded-2xl sm:rounded-3xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-300">{t('avg_fuel_consumption', 'Avg Fuel Consumption')}</span>
            <span className="text-amber-400 text-[9px] sm:text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 px-1.5 sm:px-2 py-0.5 rounded-full">
              L / km
            </span>
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-3xl font-black text-amber-400 font-mono">
              {stats?.avg_fuel_consumption_l_per_km !== undefined
                ? Number(stats.avg_fuel_consumption_l_per_km).toFixed(3)
                : (stats?.fuel_estimation?.liters_per_km !== undefined ? Number(stats.fuel_estimation.liters_per_km).toFixed(3) : '0.000')}
            </span>
            <span className="text-[10px] sm:text-xs text-amber-300/80 font-bold">L/km</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate" title={`${stats?.fuel_estimation?.liters_per_100km || 0} L/100km • ${stats?.fuel_estimation?.km_per_liter || 0} km/L`}>
            {stats?.fuel_estimation?.liters_per_100km ? `${stats.fuel_estimation.liters_per_100km} L/100km` : t('liter_per_km', 'Liter per kilometer')}
          </div>
        </div>

        {/* Pending Fuel Requests */}
        <div
          onClick={() => onNavigate('fuel')}
          className="p-3 sm:p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/50 cursor-pointer rounded-2xl sm:rounded-3xl relative overflow-hidden transition"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400">{t('pending_fuel_reqs', 'Pending Fuel Requests')}</span>
            <Fuel className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-xl sm:text-3xl font-black mt-1.5 sm:mt-2 ${
            stats?.pending_fuel_requests > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'
          }`}>
            {stats?.pending_fuel_requests || 0}
          </div>
          <div className="text-[10px] sm:text-[11px] text-amber-400/80 mt-1 font-semibold truncate">{t('click_to_review', 'Click to review & approve →')}</div>
        </div>

        {/* Pending Payments Card */}
        <div
          onClick={() => onNavigate('payments')}
          className="p-3 sm:p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/50 cursor-pointer rounded-2xl sm:rounded-3xl relative overflow-hidden transition"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400">{t('pending_payments', 'Pending Payments')}</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-xl sm:text-3xl font-black mt-1.5 sm:mt-2 ${
            stats?.pending_payments_count > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'
          }`}>
            {stats?.pending_payments_count || 0}
          </div>
          <div className="text-[10px] sm:text-[11px] text-amber-400/80 mt-1 font-semibold truncate">
            {stats?.pending_payments_count > 0
              ? `${formatCurrency(stats?.total_pending_revenue || 0)} awaiting →`
              : 'All payments approved'}
          </div>
        </div>
      </div>

      {/* PENDING PAYMENTS ACTION BANNER */}
      {stats?.pending_payments_count > 0 && (
        <div
          onClick={() => onNavigate('payments')}
          className="p-4 bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border-2 border-amber-500/40 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-amber-400 transition shadow-lg shadow-amber-500/5"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white">
                  {stats.pending_payments_count} Hauling Trips Awaiting Payment Approval
                </span>
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black rounded-full text-[10px]">
                  Pending Collection
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Total uncollected receivables:{' '}
                <span className="text-amber-400 font-mono font-bold">
                  {formatCurrency(stats.total_pending_revenue || 0)}
                </span>
                . Once company receives money and admin approves, revenue appears on the dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('payments');
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center space-x-1.5 shrink-0 shadow-md cursor-pointer transition"
          >
            <span>Review & Approve Payments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. TODAY'S FINANCIAL HIGHLIGHT BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl">
          <div className="flex justify-between items-center">
            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{t('todays_revenue', "Today's Revenue")}</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Realized (Paid)</span>
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-400 mt-1">
            {formatCurrency(stats?.revenue_today || 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> From {stats?.trips_today || 0} trips completed today
          </div>
          {stats?.pending_revenue_today > 0 && (
            <div className="text-[10px] text-amber-400 mt-1 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
              <span>+{formatCurrency(stats.pending_revenue_today)} pending approval</span>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl">
          <div className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{t('todays_expenses', "Today's Expenses")}</div>
          <div className="text-xl sm:text-3xl font-black text-red-400 mt-1">
            {formatCurrency(stats?.expenses_today || 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" /> Fuel advances & maintenance recorded
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-slate-900 border-2 border-emerald-500/40 rounded-2xl sm:rounded-3xl">
          <div className="text-[11px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider">{t('todays_net_profit', "Today's Net Profit")}</div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1">
            {formatCurrency(stats?.profit_today || 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-emerald-400/90 mt-1 font-semibold">
            {t('pos_cashflow', 'Realized Revenue − Expenses (Cashflow)')}
          </div>
        </div>
      </div>

      {/* 3. MONTHLY FINANCIAL REPORT CARDS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" /> {t('monthly_perf', 'Monthly Operational Performance')}
            </h3>
            <p className="text-xs text-slate-400">{t('monthly_perf_sub', 'Aggregated current month financials')}</p>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            {t('full_analytics_report', 'Full Analytics Report →')}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-400">{t('monthly_revenue', 'Monthly Revenue')}</span>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">Realized</span>
            </div>
            <div className="text-lg font-black text-emerald-400 mt-1">
              {formatCurrency(stats?.monthly_revenue || 0)}
            </div>
            <div className="text-[10px] text-slate-500">{stats?.trips_month || 0} {t('trips', 'trips')} ({formatNumber(stats?.quantity_month || 0)} {t('tons', 'tons')})</div>
            {stats?.pending_revenue_month > 0 && (
              <div className="text-[10px] text-amber-400 mt-1 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                <span>+{formatCurrency(stats.pending_revenue_month)} pending</span>
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <div className="text-[11px] text-slate-400">{t('fuel_expenses', 'Fuel Expenses')}</div>
            <div className="text-lg font-black text-red-400 mt-1">
              {formatCurrency(stats?.monthly_fuel_expense || 0)}
            </div>
            <div className="text-[10px] text-slate-500">{t('disbursed_fuel_advances', 'Disbursed fuel advances')}</div>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700">
            <div className="text-[11px] text-slate-400">{t('other_expenses', 'Other Expenses')}</div>
            <div className="text-lg font-black text-slate-200 mt-1">
              {formatCurrency(stats?.monthly_other_expense || 0)}
            </div>
            <div className="text-[10px] text-slate-500">{t('parts_tires_maint', 'Parts, tires, maintenance, wash')}</div>
          </div>

          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-emerald-500/40 bg-emerald-950/20">
            <div className="text-[11px] text-emerald-400 font-bold">{t('monthly_net_profit', 'Monthly Net Profit')}</div>
            <div className="text-lg font-black text-white mt-1">
              {formatCurrency(stats?.monthly_net_profit || 0)}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold">{t('after_all_expenses', 'After all expenses')}</div>
          </div>
        </div>
      </div>

      {/* 4. FUEL CONSUMPTION ESTIMATION (Per KM & Per Month) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
        {/* Header with Title and Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-md">
              <Gauge className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  {t('fuel_estimation_title', 'Fuel Consumption & Efficiency Estimation')}
                </h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {t('live_auto_estimation', 'Live Auto-Estimation')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('estimated_from_requests', 'Estimated from driver fuel requests and verified daily odometer readings')}
              </p>
            </div>
          </div>

          {/* Mode Switcher + Diesel Price Adjuster */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-800/90 border border-slate-700 p-1 rounded-2xl text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setFuelViewMode('per_km')}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  fuelViewMode === 'per_km'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> {t('per_km', 'Per KM')}
              </button>
              <button
                type="button"
                onClick={() => setFuelViewMode('per_month')}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  fuelViewMode === 'per_month'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> {t('per_month', 'Per Month')}
              </button>
              <button
                type="button"
                onClick={() => setFuelViewMode('trucks')}
                className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  fuelViewMode === 'trucks'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" /> {t('by_truck', 'By Truck')} ({stats?.fuel_estimation?.trucks?.length || 0})
              </button>
            </div>

            {/* Action Buttons: Log Fuel Advance + Manage Fuel Entries */}
            <button
              type="button"
              onClick={() => openNewFuelModal()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {t('record_fuel_advance', '+ Log Fuel Advance')}
            </button>

            <button
              type="button"
              onClick={async () => {
                await loadFuelSupportData();
                setFuelRecordsModalOpen(true);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-amber-400" /> {t('edit_fuel_entries', 'Edit Fuel Entries')}
            </button>

            {/* Diesel Price Adjuster */}
            <form onSubmit={handlePriceUpdate} className="flex items-center bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-2xl text-xs gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Diesel:</span>
              <input
                type="number"
                min="1"
                step="any"
                value={dieselPriceInput}
                onChange={e => setDieselPriceInput(e.target.value)}
                onBlur={handlePriceUpdate}
                className="w-14 bg-slate-900 border border-slate-700 text-amber-400 font-mono font-bold text-center px-1 py-0.5 rounded-lg focus:outline-none focus:border-amber-500 text-xs"
                title="Diesel Price per Liter in ETB"
              />
              <span className="text-[10px] text-slate-400 font-mono">ETB/L</span>
              <button
                type="button"
                onClick={handleSavePricePermanent}
                disabled={refreshingFuel}
                title="Save this diesel price permanently to system settings"
                className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Save className="w-3 h-3" /> Save
              </button>
              {priceSavedBadge && (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5 animate-pulse">
                  <Check className="w-3 h-3" /> Saved!
                </span>
              )}
            </form>
          </div>
        </div>

        {/* MODE 1: PER KM ESTIMATION */}
        {fuelViewMode === 'per_km' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Card 1: Average Fuel Consumption (Liter per Kilometer) */}
              <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-amber-300">Avg Fuel Consumption</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    L / km
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                    {stats?.avg_fuel_consumption_l_per_km !== undefined
                      ? Number(stats.avg_fuel_consumption_l_per_km).toFixed(3)
                      : (stats?.fuel_estimation?.liters_per_km !== undefined ? Number(stats.fuel_estimation.liters_per_km).toFixed(3) : '0.000')}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">L / km</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">
                    {stats?.fuel_estimation?.liters_per_100km || 0} L / 100km
                  </span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {stats?.fuel_estimation?.km_per_liter || 0} km / L
                  </span>
                </div>
              </div>

              {/* Card 2: Average Trip Distance */}
              <div className="p-4 bg-slate-800/80 border border-cyan-500/30 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-cyan-300">Avg Trip Distance</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    KM / Trip
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">
                    {formatNumber(stats?.avg_trip_distance_km ?? stats?.fuel_estimation?.avg_trip_distance_km ?? 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">KM</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    Today: {formatNumber(stats?.today_avg_trip_distance_km || 0)} km
                  </span>
                  <span className="text-cyan-300 font-bold font-mono">
                    Mo: {formatNumber(stats?.month_avg_trip_distance_km || 0)} km
                  </span>
                </div>
              </div>

              {/* Card 3: Fuel Cost Per KM */}
              <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400">Fuel Cost Per KM</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ETB / KM
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                    {formatCurrency(stats?.fuel_estimation?.cost_per_km || 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">/ km</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Total Fuel:</span>
                  <span className="text-slate-200 font-bold font-mono">
                    {formatCurrency(stats?.fuel_estimation?.total_fuel_cost || 0)}
                  </span>
                </div>
              </div>

              {/* Card 4: Total Verified Odometer Distance */}
              <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400">Odometer Distance</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Verified Logs
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                    {formatNumber(stats?.fuel_estimation?.total_distance_km || 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">KM</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Today: {formatNumber(stats?.fuel_estimation?.today_distance_km || 0)} km</span>
                  <span className="text-slate-300 font-semibold">Month: {formatNumber(stats?.fuel_estimation?.month_distance_km || 0)} km</span>
                </div>
              </div>

              {/* Card 5: Total Fuel Volume */}
              <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400">Fuel Allocated</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    Fuel Requests
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">
                    {formatNumber(stats?.fuel_estimation?.total_fuel_liters || 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">Liters</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Today: {formatNumber(stats?.fuel_estimation?.today_fuel_liters || 0)} L</span>
                  <span className="text-slate-300 font-semibold">Month: {formatNumber(stats?.fuel_estimation?.month_fuel_liters || 0)} L</span>
                </div>
              </div>
            </div>

            {/* Formula Ribbon */}
            <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Fleet Metrics Formula:</strong> Avg Fuel Consumption = Fuel Requests ({stats?.fuel_estimation?.total_fuel_liters || 0} L) ÷ Odometer Mileage ({stats?.fuel_estimation?.total_distance_km || 0} KM) = <span className="text-amber-400 font-mono font-bold">{Number(stats?.avg_fuel_consumption_l_per_km || stats?.fuel_estimation?.liters_per_km || 0).toFixed(3)} L/km</span> ({stats?.fuel_estimation?.liters_per_100km || 0} L/100km) at <span className="text-emerald-400 font-mono font-bold">{formatCurrency(stats?.fuel_estimation?.cost_per_km || 0)}/km</span> • Avg Trip Distance = Total Distance ÷ Trips ({stats?.total_completed_trips || stats?.trips_month || 0}) = <span className="text-cyan-400 font-mono font-bold">{formatNumber(stats?.avg_trip_distance_km ?? stats?.fuel_estimation?.avg_trip_distance_km ?? 0)} km/trip</span>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('fuel')}
                className="text-amber-400 hover:underline font-bold text-[11px] shrink-0 cursor-pointer"
              >
                Review Fuel Requests →
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: PER MONTH ESTIMATION & FORECAST */}
        {fuelViewMode === 'per_month' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Month Fuel Liters */}
              <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400">Month Fuel Consumption</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    MTD Volume
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                    {formatNumber(stats?.fuel_estimation?.month_fuel_liters || 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">Liters</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Month Fuel Spend:</span>
                  <span className="text-slate-200 font-bold font-mono">
                    {formatCurrency(stats?.fuel_estimation?.month_fuel_cost || 0)}
                  </span>
                </div>
              </div>

              {/* Card 2: Month Odometer Distance */}
              <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-slate-400">Month Odometer Distance</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    MTD Mileage
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                    {formatNumber(stats?.fuel_estimation?.month_distance_km || 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">KM</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Month Economy:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {stats?.fuel_estimation?.month_liters_per_100km || 0} L/100km ({formatCurrency(stats?.fuel_estimation?.month_cost_per_km || 0)}/km)
                  </span>
                </div>
              </div>

              {/* Card 3: Projected Month Fuel (Forecast) */}
              <div className="p-4 bg-slate-800/80 border-2 border-amber-500/40 rounded-2xl relative overflow-hidden shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-amber-300">Projected Month Fuel</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Month Forecast
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                    ~{formatNumber(stats?.fuel_estimation?.projected_month_liters || 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">Liters</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Est. Total Cost:</span>
                  <span className="text-amber-400 font-bold font-mono">
                    ~{formatCurrency(stats?.fuel_estimation?.projected_month_fuel_cost || 0)}
                  </span>
                </div>
              </div>

              {/* Card 4: Projected Month Distance */}
              <div className="p-4 bg-slate-800/80 border-2 border-emerald-500/40 rounded-2xl relative overflow-hidden shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-emerald-300">Projected Month Distance</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Month Forecast
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                    ~{formatNumber(stats?.fuel_estimation?.projected_month_distance || 0)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">KM</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Run-rate basis:</span>
                  <span className="text-emerald-300 font-semibold">
                    Extrapolated for full month
                  </span>
                </div>
              </div>
            </div>

            {/* Month-by-Month Trends Table */}
            {stats?.fuel_estimation?.monthly_trends?.length > 0 && (
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" /> Month-by-Month Consumption & Odometer Mileage
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Historical tracking</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/60 text-slate-400 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-3 rounded-l-lg">Accounting Month</th>
                        <th className="py-2 px-3">Odometer Distance</th>
                        <th className="py-2 px-3">Fuel Requests Cost</th>
                        <th className="py-2 px-3">Fuel Volume</th>
                        <th className="py-2 px-3">Consumption Rate</th>
                        <th className="py-2 px-3">Cost / KM</th>
                        <th className="py-2 px-3 rounded-r-lg">Fuel Economy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {stats.fuel_estimation.monthly_trends.map(m => (
                        <tr key={m.month_year} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-200">{m.month_label}</td>
                          <td className="py-2.5 px-3 font-mono text-white">{formatNumber(m.distance_km)} km</td>
                          <td className="py-2.5 px-3 font-mono text-red-400">{formatCurrency(m.fuel_cost)}</td>
                          <td className="py-2.5 px-3 font-mono text-amber-400">{formatNumber(m.fuel_liters)} L</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">{m.liters_per_100km} L / 100km</td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">{formatCurrency(m.cost_per_km)} / km</td>
                          <td className="py-2.5 px-3 font-mono text-slate-300 font-semibold">{m.km_per_liter} km / L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: BY TRUCK FLEET BREAKDOWN */}
        {fuelViewMode === 'trucks' && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-xl">Truck Plate & Model</th>
                    <th className="py-2.5 px-3">Assigned Driver</th>
                    <th className="py-2.5 px-3">Odometer (Month / Total)</th>
                    <th className="py-2.5 px-3">Fuel Requests (Month / Total)</th>
                    <th className="py-2.5 px-3">Consumption Rate</th>
                    <th className="py-2.5 px-3">Cost / KM</th>
                    <th className="py-2.5 px-3">Economy</th>
                    <th className="py-2.5 px-3">Efficiency Status</th>
                    <th className="py-2.5 px-3 rounded-r-xl text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!stats?.fuel_estimation?.trucks || stats.fuel_estimation.trucks.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-6 text-center text-slate-500">
                        No truck odometer or fuel records found
                      </td>
                    </tr>
                  ) : (
                    stats.fuel_estimation.trucks.map(t => {
                      const efficiencyBadge = {
                        optimal: { bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Optimal (<38 L/100km)' },
                        standard: { bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Standard (38-52 L/100km)' },
                        high_consumption: { bg: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'High Consumption (>52 L/100km)' },
                        pending_data: { bg: 'bg-slate-700/40 text-slate-400 border-slate-600', label: 'Pending Data' },
                      }[t.efficiency_status] || { bg: 'bg-slate-700/40 text-slate-400 border-slate-600', label: t.efficiency_status };

                      return (
                        <tr key={t.truck_id || t.plate_number} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-amber-400" /> {t.plate_number || 'Truck'}
                            </div>
                            <div className="text-[10px] text-slate-400">{t.model}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-semibold">
                            {t.driver_name || 'Unassigned'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-white font-mono">{formatNumber(t.month_distance_km)} km <span className="text-[10px] text-slate-400 font-normal">mo</span></div>
                            <div className="text-[10px] text-slate-400 font-mono">Total: {formatNumber(t.total_distance_km)} km</div>
                            {t.avg_trip_distance_km ? (
                              <div className="text-[10px] text-cyan-400 font-mono">Avg: {t.avg_trip_distance_km} km / trip</div>
                            ) : null}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-amber-400 font-mono">{formatNumber(t.month_fuel_liters)} L ({formatCurrency(t.month_fuel_cost)})</div>
                            <div className="text-[10px] text-slate-400 font-mono">Total: {formatNumber(t.total_fuel_liters)} L ({formatCurrency(t.total_fuel_cost)})</div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                            {t.liters_per_km !== undefined ? (
                              <div>
                                <span className="text-amber-400 font-black">{Number(t.liters_per_km).toFixed(3)} L/km</span>
                                {t.liters_per_100km ? <div className="text-[10px] text-slate-400 font-normal">({t.liters_per_100km} L/100km)</div> : null}
                              </div>
                            ) : (t.liters_per_100km ? `${t.liters_per_100km} L/100km` : '—')}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-200">
                            {t.cost_per_km ? `${formatCurrency(t.cost_per_km)} / km` : '—'}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-300 font-semibold">
                            {t.km_per_liter ? `${t.km_per_liter} km/L` : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${efficiencyBadge.bg}`}>
                              {efficiencyBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => openNewFuelModal(t)}
                              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                              title="Edit or log fuel advance for this truck"
                            >
                              <Edit className="w-3 h-3" /> Edit Fuel
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. ADMIN QUICK ACTIONS (Requirement 18) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <h3 className="font-bold text-sm text-slate-200 mb-3">Admin Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate('trucks')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 touch-btn"
          >
            <Plus className="w-4 h-4 text-amber-400" /> Add Truck
          </button>
          <button
            onClick={() => onNavigate('drivers')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 touch-btn"
          >
            <Plus className="w-4 h-4 text-amber-400" /> Add Driver
          </button>
          <button
            onClick={() => onNavigate('sites')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 touch-btn"
          >
            <Plus className="w-4 h-4 text-amber-400" /> Add Loading / Dumping Site
          </button>
          <button
            onClick={() => onNavigate('materials')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 touch-btn"
          >
            <Plus className="w-4 h-4 text-amber-400" /> Add Material
          </button>
          <button
            onClick={() => onNavigate('routes')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 touch-btn"
          >
            <Plus className="w-4 h-4 text-amber-400" /> Set Route Price
          </button>
          <button
            onClick={() => onNavigate('fuel')}
            className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 touch-btn"
          >
            <Fuel className="w-4 h-4" /> View Fuel Requests ({stats?.pending_fuel_requests || 0})
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 touch-btn"
          >
            <BarChart3 className="w-4 h-4" /> Generate Reports
          </button>
        </div>
      </div>

      {/* 5. VISUAL CHARTS & INTERACTIVE DATA GRAPHS */}
      <div className="space-y-4">
        {/* Graphs Header & Category Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                {t('fleet_graphs_title', 'Fleet Analytics & Interactive Graphs')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('fleet_graphs_sub', 'Visual performance metrics across finances, cargo materials, truck profitability, and haulage trends')}
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/90 p-1 rounded-2xl border border-slate-700">
            {[
              { id: 'all', label: t('all_graphs', 'All Analytics'), icon: Layers },
              { id: 'financial', label: t('financial_flow', 'Financial Flow'), icon: TrendingUp },
              { id: 'materials', label: t('materials', 'Material Share'), icon: PieChart },
              { id: 'trucks', label: t('top_trucks', 'Truck Rankings'), icon: Truck },
              { id: 'trends', label: t('hauling_trends', 'Hauling Trends'), icon: Activity },
              { id: 'fuel', label: t('fuel_benchmarks', 'Fuel Efficiency'), icon: Fuel }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setChartCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer touch-btn ${
                  chartCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Financial Flow & Profitability Bar Chart */}
          {(chartCategory === 'all' || chartCategory === 'financial') && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{t('financial_flow_title', 'Revenue vs Expenses & Net Profit')}</h3>
                    <p className="text-[11px] text-slate-400">{t('financial_flow_sub', 'Cashflow breakdown and operational margins')}</p>
                  </div>
                </div>
                <div className="flex bg-slate-800/90 border border-slate-700 p-0.5 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setChartTimeframe('month')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      chartTimeframe === 'month' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('month', 'Month')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartTimeframe('today')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      chartTimeframe === 'today' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('today', 'Today')}
                  </button>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full relative">
                <Bar data={financialChartData} options={currencyTooltipOptions} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">{chartTimeframe === 'month' ? 'Mo. Revenue' : 'Today Revenue'}</div>
                  <div className="text-xs sm:text-sm font-black text-emerald-400 truncate">
                    {formatCurrency(chartTimeframe === 'month' ? stats?.monthly_revenue || 0 : stats?.revenue_today || 0)}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">{chartTimeframe === 'month' ? 'Total Expenses' : 'Today Expenses'}</div>
                  <div className="text-xs sm:text-sm font-black text-red-400 truncate">
                    {formatCurrency(chartTimeframe === 'month' ? stats?.monthly_total_expense || 0 : stats?.expenses_today || 0)}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">{chartTimeframe === 'month' ? 'Mo. Net Profit' : 'Today Net Profit'}</div>
                  <div className="text-xs sm:text-sm font-black text-cyan-400 truncate">
                    {formatCurrency(chartTimeframe === 'month' ? stats?.monthly_net_profit || 0 : stats?.profit_today || 0)}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400">Net Margin</div>
                  <div className="text-xs sm:text-sm font-black text-amber-400">
                    {(() => {
                      const rev = chartTimeframe === 'month' ? stats?.monthly_revenue || 0 : stats?.revenue_today || 0;
                      const prof = chartTimeframe === 'month' ? stats?.monthly_net_profit || 0 : stats?.profit_today || 0;
                      if (rev <= 0) return '0%';
                      return `${Math.round((prof / rev) * 100)}%`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chart 2: Revenue by Cargo Material Doughnut Chart */}
          {(chartCategory === 'all' || chartCategory === 'materials') && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{t('material_revenue_share', 'Revenue by Hauled Material')}</h3>
                    <p className="text-[11px] text-slate-400">{t('material_share_sub', 'Distribution of income by cargo type')}</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  {Object.keys(stats?.material_revenue || {}).length} materials
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-60 sm:h-64 relative flex items-center justify-center">
                  {Object.keys(stats?.material_revenue || {}).length > 0 ? (
                    <Doughnut data={materialChartData} options={doughnutOptions} />
                  ) : (
                    <div className="text-xs text-slate-400">No material data recorded</div>
                  )}
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {stats?.material_revenue && Object.keys(stats.material_revenue).length > 0 ? (
                    Object.entries(stats.material_revenue).map(([mat, rev]) => {
                      const total = stats.monthly_revenue || 1;
                      const pct = Math.min(100, Math.round((rev / total) * 100));
                      return (
                        <div key={mat} className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-200">{mat}</span>
                            <span className="font-black text-emerald-400 font-mono">
                              {formatCurrency(rev)} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-700/60 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">No material data recorded yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Chart 3: Top Performing Trucks Grouped Bar Chart */}
          {(chartCategory === 'all' || chartCategory === 'trucks') && (
            <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 ${
              chartCategory === 'trucks' ? 'lg:col-span-2' : ''
            }`}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{t('top_trucks_perf', 'Top Performing Trucks (Revenue vs Profit)')}</h3>
                    <p className="text-[11px] text-slate-400">{t('top_trucks_perf_sub', 'Comparative profitability across active fleet vehicles')}</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">Ranked by Revenue</span>
              </div>

              {stats?.top_trucks?.length > 0 ? (
                <>
                  <div className="h-64 sm:h-72 w-full relative">
                    <Bar data={topTrucksChartData} options={currencyTooltipOptions} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
                    {stats.top_trucks.map((trk, idx) => (
                      <div
                        key={trk.truck_id || idx}
                        className="p-3 bg-slate-800/70 border border-slate-700/80 rounded-2xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-100">{trk.truck_plate || 'Truck'}</div>
                            <div className="text-[10px] text-slate-400">{trk.trips} Hauling Trips</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-emerald-400">{formatCurrency(trk.revenue)}</div>
                          <div className="text-[10px] text-slate-400">
                            Profit: <strong className="text-cyan-300">{formatCurrency(trk.profit)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">No truck performance data available</div>
              )}
            </div>
          )}

          {/* Chart 4: Hauling Volume & Revenue Trend Line Chart */}
          {(chartCategory === 'all' || chartCategory === 'trends') && tripTrendsChartData && (
            <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 ${
              chartCategory === 'trends' ? 'lg:col-span-2' : ''
            }`}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{t('hauling_trends_title', 'Hauling Operations & Revenue Trend')}</h3>
                    <p className="text-[11px] text-slate-400">{t('hauling_trends_sub', 'Daily cargo tonnage vs generated revenue over recent dispatches')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <span className="w-2.5 h-1 bg-emerald-400 rounded-full inline-block" /> Revenue
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                    <span className="w-2.5 h-2 bg-amber-400 rounded inline-block" /> Volume (Tons)
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full relative">
                <Line data={tripTrendsChartData} options={trendChartOptions} />
              </div>
            </div>
          )}

          {/* Chart 5: Fuel Efficiency Comparison Benchmark Chart */}
          {(chartCategory === 'all' || chartCategory === 'fuel') && truckFuelChartData && (
            <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 ${
              chartCategory === 'fuel' ? 'lg:col-span-2' : ''
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Fuel className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{t('fuel_efficiency_comparison', 'Truck Fuel Consumption Benchmark (L/100km)')}</h3>
                    <p className="text-[11px] text-slate-400">{t('fuel_efficiency_sub', 'Liters consumed per 100km by vehicle (<40 Green, 40-50 Amber, >50 Red)')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Good ≤40</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Moderate 40-50</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">High &gt;50</span>
                </div>
              </div>

              <div className="h-60 sm:h-64 w-full relative">
                <Bar data={truckFuelChartData} options={fuelChartOptions} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. RECENT TRIPS TABLE (Requirement 47) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-100">{t('recent_hauling_trips', 'Recent Hauling Trips Feed')}</h3>
            <p className="text-xs text-slate-400">{t('recent_trips_sub', 'Live trip submissions across all trucks and drivers')}</p>
          </div>
          <button
            onClick={() => onNavigate('trips')}
            className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
          >
            {t('view_all_trips', 'Manage All Trips →')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3 rounded-l-xl">Trip #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Truck & Driver</th>
                <th className="py-2.5 px-3">Route</th>
                <th className="py-2.5 px-3">Material</th>
                <th className="py-2.5 px-3">Quantity</th>
                <th className="py-2.5 px-3">Revenue</th>
                <th className="py-2.5 px-3 rounded-r-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentTrips.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/50 transition">
                  <td className="py-3 px-3 font-mono font-bold text-amber-400">{t.trip_number}</td>
                  <td className="py-3 px-3 text-slate-400">{formatDate(t.date)}</td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-200">{t.truck_plate}</div>
                    <div className="text-[11px] text-slate-400">{t.driver_name}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-slate-300">{t.loading_site_name}</div>
                    <div className="text-[10px] text-slate-500">→ {t.dumping_site_name}</div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-200">{t.material_name}</td>
                  <td className="py-3 px-3 text-slate-300 font-semibold">{t.quantity} {t.unit}</td>
                  <td className="py-3 px-3 font-black text-emerald-400">{formatCurrency(t.total_revenue)}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.status === 'cancelled'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT FUEL RECORD OR ADVANCE */}
      {/* ========================================================================= */}
      {fuelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative my-8">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingFuelRequest ? 'Edit Fuel Advance / Record' : 'Log New Fuel Advance'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingFuelRequest
                      ? `Updating voucher #${editingFuelRequest.request_number || editingFuelRequest.id}`
                      : 'Record fuel disbursement directly into fleet fuel logs'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFuelModalOpen(false);
                  setEditingFuelRequest(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFuelSubmit} className="space-y-3.5 text-xs">
              {/* Truck & Driver Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Assigned Truck *</label>
                  <select
                    value={fuelForm.truck_id}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const trk = trucksList.find(t => String(t.id) === String(selId));
                      if (trk) {
                        setFuelForm(prev => ({
                          ...prev,
                          truck_id: trk.id,
                          truck_plate: trk.plate_number,
                          driver_id: trk.driver_assigned_id || prev.driver_id,
                          driver_name: trk.driver_assigned_name || prev.driver_name,
                        }));
                      } else {
                        setFuelForm(prev => ({ ...prev, truck_id: '', truck_plate: '' }));
                      }
                    }}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    required
                  >
                    <option value="">-- Select Truck --</option>
                    {trucksList.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.plate_number} ({t.model || 'Truck'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Driver</label>
                  <select
                    value={fuelForm.driver_id}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const drv = driversList.find(d => String(d.id) === String(selId));
                      if (drv) {
                        setFuelForm(prev => ({
                          ...prev,
                          driver_id: drv.id,
                          driver_name: drv.full_name,
                        }));
                      } else {
                        setFuelForm(prev => ({ ...prev, driver_id: '', driver_name: '' }));
                      }
                    }}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- Select Driver --</option>
                    {driversList.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({d.phone || 'Driver'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount & Approved Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Amount Requested (ETB) *</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={fuelForm.amount_requested}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFuelForm(prev => ({
                        ...prev,
                        amount_requested: val,
                        amount_approved: prev.amount_approved === prev.amount_requested ? val : prev.amount_approved,
                      }));
                    }}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-amber-400"
                    required
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    ≈ {(parseFloat(fuelForm.amount_requested || 0) / (dieselPrice || 1)).toFixed(1)} Liters (@ {dieselPrice} ETB/L)
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Amount Disbursed / Approved (ETB)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={fuelForm.amount_approved}
                    onChange={(e) => setFuelForm({ ...fuelForm, amount_approved: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-emerald-400 font-bold focus:outline-none focus:border-emerald-400"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">
                    ≈ {(parseFloat(fuelForm.amount_approved || 0) / (dieselPrice || 1)).toFixed(1)} Liters approved
                  </div>
                </div>
              </div>

              {/* Status & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Disbursement Status *</label>
                  <select
                    value={fuelForm.status}
                    onChange={(e) => setFuelForm({ ...fuelForm, status: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="paid">Paid & Disbursed (Syncs Expense)</option>
                    <option value="approved">Approved (Awaiting Cashier)</option>
                    <option value="pending">Pending Approval</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Record Date</label>
                  <input
                    type="date"
                    value={fuelForm.requested_at}
                    onChange={(e) => setFuelForm({ ...fuelForm, requested_at: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Fuel Station & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Fuel Station / Depot</label>
                  <input
                    type="text"
                    placeholder="e.g. TotalEnergies Kality"
                    value={fuelForm.fuel_station}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuel_station: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Purpose / Reason *</label>
                  <input
                    type="text"
                    placeholder="e.g. Quarry hauling route fuel"
                    value={fuelForm.reason}
                    onChange={(e) => setFuelForm({ ...fuelForm, reason: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              {/* Admin Note / Voucher */}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Admin Notes / Receipt Voucher Ref</label>
                <textarea
                  rows="2"
                  value={fuelForm.admin_note}
                  onChange={(e) => setFuelForm({ ...fuelForm, admin_note: e.target.value })}
                  placeholder="Receipt number, payment voucher reference, or quota notes..."
                  className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white resize-none focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Footer Controls */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                {editingFuelRequest ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteFuelReq(editingFuelRequest.id)}
                    className="px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-xl text-xs flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFuelModalOpen(false);
                      setEditingFuelRequest(null);
                    }}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={refreshingFuel}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingFuelRequest ? 'Save Fuel Changes' : 'Record Fuel Advance'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW & EDIT ALL RECENT FUEL RECORDS */}
      {/* ========================================================================= */}
      {fuelRecordsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full p-6 space-y-4 shadow-2xl relative my-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Fuel Advance & Expense Records</h3>
                  <p className="text-[11px] text-slate-400">
                    Click "Edit" on any record to adjust amounts, truck assignment, status, or notes
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openNewFuelModal()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Fuel
                </button>
                <button
                  type="button"
                  onClick={() => setFuelRecordsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[60vh] border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 sticky top-0 text-[10px] uppercase tracking-wider backdrop-blur-sm">
                  <tr>
                    <th className="py-2.5 px-3">Req # / Date</th>
                    <th className="py-2.5 px-3">Truck & Driver</th>
                    <th className="py-2.5 px-3">Amount (ETB)</th>
                    <th className="py-2.5 px-3">Est. Liters</th>
                    <th className="py-2.5 px-3">Station / Reason</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fuelRequestsList.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-slate-500">
                        No fuel records found. Click "Log Fuel" to add your first record.
                      </td>
                    </tr>
                  ) : (
                    fuelRequestsList.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-800/50 transition">
                        <td className="py-2.5 px-3 font-mono">
                          <div className="font-bold text-amber-400">{req.request_number || req.id?.slice(0, 8)}</div>
                          <div className="text-[10px] text-slate-400">{formatDate(req.requested_at || req.created_at)}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white">{req.truck_plate || 'Unassigned'}</div>
                          <div className="text-[10px] text-slate-400">{req.driver_name || 'Driver'}</div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">
                          {formatCurrency(req.amount_approved || req.amount_requested || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono">
                          {((req.amount_approved || req.amount_requested || 0) / (dieselPrice || 1)).toFixed(1)} L
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-300 font-semibold">{req.fuel_station || 'Station'}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{req.reason}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'paid'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : req.status === 'approved'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : req.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditFuelModal(req)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition"
                          >
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 text-xs text-slate-400">
              <div>Total Fuel Records: {fuelRequestsList.length}</div>
              <button
                type="button"
                onClick={() => setFuelRecordsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
