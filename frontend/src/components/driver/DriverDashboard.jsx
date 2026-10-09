import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../api/client';
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../../utils/formatters';
import { StartTripModal } from './StartTripModal';
import { CompleteTripModal } from './CompleteTripModal';
import { FuelRequestModal } from './FuelRequestModal';
import { OdometerModal } from './OdometerModal';
import { MaintenanceRequestModal } from './MaintenanceRequestModal';
import { ProfileModal } from '../common/ProfileModal';
import {
  Truck,
  PlusCircle,
  Fuel,
  ClipboardList,
  RotateCcw,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  Calendar,
  Filter,
  Eye,
  UserCheck,
  Edit,
  Gauge,
  Sun,
  Moon,
  Wrench,
  Receipt,
  X
} from 'lucide-react';

export const DriverDashboard = () => {
  const { user, driver, truck, refreshUser } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('home'); // 'home', 'trips', 'fuel', 'odometer'
  const [isStartTripModalOpen, setIsStartTripModalOpen] = useState(false);
  const [isCompleteTripModalOpen, setIsCompleteTripModalOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [isOdometerModalOpen, setIsOdometerModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [odometerModalMode, setOdometerModalMode] = useState(null); // 'start' | 'end'
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [repeatTripData, setRepeatTripData] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);

  const [recentTrip, setRecentTrip] = useState(null);
  const [myTrips, setMyTrips] = useState([]);
  const [fuelRequests, setFuelRequests] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [todayOdometer, setTodayOdometer] = useState(null);
  const [odometerHistory, setOdometerHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Trips filter
  const [periodFilter, setPeriodFilter] = useState('all'); // 'all', 'today', 'this_week', 'this_month'
  const [selectedTripDetail, setSelectedTripDetail] = useState(null);

  const loadDriverData = async () => {
    try {
      const [tripsData, fuelData, summaryData, recentData, odoTodayData, odoHistoryData, activeTripData] = await Promise.all([
        api.get('/trips'),
        api.get('/fuel-requests'),
        api.get('/drivers/summary'),
        api.get('/trips/recent'),
        api.get('/odometer/today').catch(() => null),
        api.get('/odometer/history').catch(() => []),
        api.get('/trips/active').catch(() => null),
      ]);

      setMyTrips(tripsData || []);
      setFuelRequests(fuelData || []);
      setFinancialSummary(summaryData || null);
      if (recentData?.has_recent) {
        setRecentTrip(recentData.trip);
      }
      if (activeTripData?.has_active) {
        setActiveTrip(activeTripData.trip);
      } else {
        const inProg = Array.isArray(tripsData) ? tripsData.find(t => t.status === 'in_progress') : null;
        setActiveTrip(inProg || null);
      }
      if (odoTodayData) {
        setTodayOdometer(odoTodayData);
      }
      if (odoHistoryData) {
        setOdometerHistory(odoHistoryData);
      }
    } catch (err) {
      console.error('Error loading driver data:', err);
    } finally {
      setLoading(false);
    }
  };

  const [tripStartedAlert, setTripStartedAlert] = useState(null);

  useEffect(() => {
    loadDriverData();
  }, []);

  useEffect(() => {
    if (tripStartedAlert) {
      const timer = setTimeout(() => {
        setTripStartedAlert(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [tripStartedAlert]);

  const handleStartTripSuccess = (startedTrip) => {
    setActiveTab('home');
    setIsStartTripModalOpen(false);
    setTripStartedAlert(startedTrip || { trip_number: 'Active' });
    loadDriverData();
    refreshUser();
  };

  const handleTripSuccess = () => {
    setTripStartedAlert(null);
    loadDriverData();
    refreshUser();
  };

  const handleFuelSuccess = () => {
    loadDriverData();
  };

  const handleOdometerSuccess = () => {
    loadDriverData();
    refreshUser();
  };

  const handleStartTrip = () => {
    setRepeatTripData(null);
    setIsStartTripModalOpen(true);
  };

  const handleCompleteTrip = () => {
    setIsCompleteTripModalOpen(true);
  };

  const handleRepeatTrip = () => {
    if (recentTrip) {
      setRepeatTripData(recentTrip);
    }
    setIsStartTripModalOpen(true);
  };

  const filteredTrips = myTrips.filter(t => {
    if (periodFilter === 'all') return true;
    const tripDate = new Date(t.date);
    const now = new Date();
    if (periodFilter === 'today') {
      return tripDate.toDateString() === now.toDateString();
    }
    if (periodFilter === 'this_week') {
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      return tripDate >= startOfWeek;
    }
    if (periodFilter === 'this_month') {
      return tripDate.getMonth() === new Date().getMonth() && tripDate.getFullYear() === new Date().getFullYear();
    }
    return true;
  });

  return (
    <div className="pb-24 pt-4 px-3 sm:px-6 max-w-4xl mx-auto space-y-4">
      {/* 1. DRIVER PROFILE & TRUCK BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-amber-500/5 -skew-x-12 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-3.5">
            <div className="relative shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-lg sm:text-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                {user?.full_name ? user.full_name.charAt(0) : 'D'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white truncate">{user?.full_name}</h1>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
                  {t('driver')}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                {t('assigned_truck')} <strong className="text-slate-200">{truck?.plate_number || t('no_truck_assigned')}</strong>
                {truck?.model && <span className="text-slate-500"> • {truck.model} ({truck.capacity}T)</span>}
              </p>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition underline cursor-pointer"
              >
                <Edit className="w-3 h-3" /> {t('edit_profile')}
              </button>
            </div>
          </div>

          {/* Today's quick snapshot pills */}
          <div className="flex items-center justify-around sm:justify-start gap-2 sm:gap-3 bg-slate-800/90 border border-slate-700 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl">
            <div className="px-2.5 sm:px-3 py-1 text-center flex-1 sm:flex-initial">
              <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('todays_trips')}</div>
              <div className="text-sm sm:text-base font-black text-amber-400">
                {financialSummary?.today_trips_count || 0}
              </div>
            </div>
            <div className="h-6 sm:h-7 w-px bg-slate-700"></div>
            <div className="px-2.5 sm:px-3 py-1 text-center flex-1 sm:flex-initial">
              <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('todays_revenue')}</div>
              <div className="text-sm sm:text-base font-black text-emerald-400">
                {formatCurrency(financialSummary?.today_revenue || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Pending fuel alerts banner */}
        {financialSummary?.pending_fuel_count > 0 && (
          <div className="mt-3 py-2 px-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-amber-400 animate-spin" />
              {financialSummary.pending_fuel_count} {t('pending_fuel_alert')}
            </span>
            <button
              onClick={() => setActiveTab('fuel')}
              className="text-amber-400 underline font-bold"
            >
              {t('view')}
            </button>
          </div>
        )}

        {/* Shift completed banner */}
        {todayOdometer?.has_end && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                {t('shift_completed_banner')} <strong className="text-emerald-400 font-black">+{formatNumber(todayOdometer.reading.distance_km)} km</strong> ({formatNumber(todayOdometer.reading.start_reading)} → {formatNumber(todayOdometer.reading.end_reading)} km)
              </span>
            </div>
            <button
              onClick={() => {
                setOdometerModalMode('end');
                setIsOdometerModalOpen(true);
              }}
              className="text-xs text-emerald-400 underline font-bold cursor-pointer"
            >
              {t('edit')}
            </button>
          </div>
        )}
      </div>

      {/* 2. TAB TOGGLES */}
      <div className="grid grid-cols-4 gap-1 sm:gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl">
        <button
          onClick={() => setActiveTab('home')}
          className={`py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition truncate px-1 ${
            activeTab === 'home' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          {t('tab_dashboard')}
        </button>
        <button
          onClick={() => setActiveTab('odometer')}
          className={`py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition truncate px-1 ${
            activeTab === 'odometer' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          {t('tab_odometer')}
        </button>
        <button
          onClick={() => setActiveTab('fuel')}
          className={`py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition truncate px-1 ${
            activeTab === 'fuel' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          {t('tab_fuel')}
        </button>
        <button
          onClick={() => setActiveTab('trips')}
          className={`py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl transition truncate px-1 ${
            activeTab === 'trips' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          {t('tab_trips')} ({myTrips.length})
        </button>
      </div>

      {/* ================= VIEW: HOME ================= */}
      {activeTab === 'home' && (
        <div className="space-y-3.5 sm:space-y-4">
          {/* TRIP STARTED SUCCESS NOTIFICATION */}
          {tripStartedAlert && (
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/15 border-2 border-emerald-500/60 rounded-2xl sm:rounded-3xl shadow-xl shadow-emerald-500/15 flex items-start sm:items-center justify-between gap-3 text-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6 text-slate-950 font-black" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-black text-sm sm:text-base">
                      🚀 {t('trip_has_started', 'Your trip has started!')}
                    </span>
                    {tripStartedAlert.trip_number && (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/50">
                        {tripStartedAlert.trip_number}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-emerald-200 mt-0.5">
                    {tripStartedAlert.loading_site_name && (
                      <span><strong>{tripStartedAlert.loading_site_name}</strong> → <strong>{tripStartedAlert.dumping_site_name}</strong> • </span>
                    )}
                    {tripStartedAlert.material_name && (
                      <span className="text-amber-300 font-bold">{tripStartedAlert.material_name}</span>
                    )}
                    {tripStartedAlert.start_odometer > 0 && (
                      <span className="text-emerald-300/80 ml-1.5 font-mono">({formatNumber(tripStartedAlert.start_odometer)} km)</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setTripStartedAlert(null)}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ACTIVE TRIP IN PROGRESS BANNER */}
          {activeTrip && (
            <div className="bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/70 border border-blue-500/40 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3 sm:space-x-3.5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 animate-pulse">
                  <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-300">
                      Trip In Progress
                    </span>
                    <span className="font-mono text-xs text-amber-400 font-bold">
                      {activeTrip.trip_number}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white mt-0.5">
                    {activeTrip.loading_site_name} → {activeTrip.dumping_site_name}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                    Cargo: <strong className="text-amber-400">{activeTrip.material_name}</strong>
                    {activeTrip.start_odometer > 0 && ` • Departure: ${formatNumber(activeTrip.start_odometer)} km`}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCompleteTrip}
                className="w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer touch-btn shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('complete_trip_btn', 'Complete the Trip')}</span>
              </button>
            </div>
          )}

          {/* 3. LARGE TOUCH BUTTONS (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {/* BUTTON 1: START TRIP */}
            <button
              onClick={handleStartTrip}
              className="p-3.5 sm:p-5 bg-amber-500 bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl shadow-amber-500/25 text-left flex flex-col justify-between h-28 sm:h-36 touch-btn group cursor-pointer border border-amber-400"
            >
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-950/20 border border-slate-950/20 flex items-center justify-center">
                <Truck className="w-5 h-5 sm:w-7 sm:h-7 text-slate-950" />
              </div>
              <div>
                <div className="text-sm sm:text-lg font-black tracking-tight leading-snug sm:leading-tight">{t('start_trip_btn', '🚀 Start Trip')}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-slate-900/80 mt-0.5 line-clamp-1">{t('start_trip_sub', 'Record departure & cargo')}</div>
              </div>
            </button>

            {/* BUTTON 2: COMPLETE THE TRIP */}
            <button
              onClick={handleCompleteTrip}
              className={`p-3.5 sm:p-5 bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl shadow-blue-600/20 text-left flex flex-col justify-between h-28 sm:h-36 touch-btn group cursor-pointer relative overflow-hidden ${
                activeTrip ? 'ring-2 ring-emerald-400' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                {activeTrip ? (
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border bg-emerald-400/25 text-emerald-200 border-emerald-300/40 animate-pulse">
                    Active
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border bg-white/10 text-slate-300 border-white/20">
                    Step 2
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm sm:text-lg font-black tracking-tight leading-snug sm:leading-tight text-white">{t('complete_trip_btn', '🏁 Complete Trip')}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-blue-100/90 mt-0.5 line-clamp-1">
                  {activeTrip ? `${activeTrip.trip_number} • ${t('insert_receipt', 'Insert receipt')}` : t('complete_trip_sub', 'Insert receipt & finish run')}
                </div>
              </div>
            </button>

            {/* BUTTON 3: REQUEST FUEL */}
            <button
              onClick={() => setIsFuelModalOpen(true)}
              className="p-3.5 sm:p-5 bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl shadow-emerald-600/20 text-left flex flex-col justify-between h-28 sm:h-36 touch-btn group cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center">
                <Fuel className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <div className="text-sm sm:text-lg font-black tracking-tight leading-snug sm:leading-tight">{t('request_fuel_btn')}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-emerald-100/80 mt-0.5 line-clamp-1">{t('request_fuel_sub')}</div>
              </div>
            </button>

            {/* BUTTON 4: REQUEST MAINTENANCE */}
            <button
              onClick={() => setIsMaintenanceModalOpen(true)}
              className="p-3.5 sm:p-5 bg-gradient-to-br from-purple-600 via-violet-700 to-indigo-800 hover:from-purple-500 hover:to-violet-600 text-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl shadow-purple-600/20 text-left flex flex-col justify-between h-28 sm:h-36 touch-btn group cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center">
                <Wrench className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <div className="text-sm sm:text-lg font-black tracking-tight leading-snug sm:leading-tight">{t('request_maintenance_btn')}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-purple-100/80 mt-0.5 line-clamp-1">{t('request_maintenance_sub')}</div>
              </div>
            </button>
          </div>

          {/* 4. SMART REPEAT: 1-CLICK "REPEAT PREVIOUS TRIP" */}
          {recentTrip && (
            <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <RotateCcw className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    {t('smart_repeat_badge')}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {recentTrip.trip_number}
                </span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60 my-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                    {recentTrip.loading_site_name}
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    {recentTrip.dumping_site_name}
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    {t('material')} <strong className="text-amber-400">{recentTrip.material_name}</strong> •{' '}
                    {t('rate')} {formatCurrency(recentTrip.unit_price)} / {recentTrip.unit}
                  </div>
                </div>

                <button
                  onClick={handleRepeatTrip}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 touch-btn flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {t('use_previous')}
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                {t('smart_repeat_sub')}
              </p>
            </div>
          )}

          {/* 5. RECENT TRIPS CARDS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" /> {t('recent_trips_title')}
              </h3>
              <button
                onClick={() => setActiveTab('trips')}
                className="text-xs text-amber-400 font-semibold hover:underline cursor-pointer"
              >
                {t('view_all')}
              </button>
            </div>

            {myTrips.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {t('no_trips_today')}
              </div>
            ) : (
              <div className="space-y-2.5">
                {myTrips.slice(0, 3).map(trip => (
                  <div
                    key={trip.id}
                    onClick={() => setSelectedTripDetail(trip)}
                    className="p-3.5 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 rounded-2xl transition cursor-pointer flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-400">{trip.trip_number}</span>
                        <span className="text-xs font-bold text-slate-100">{trip.material_name}</span>
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                          {trip.quantity} {trip.unit}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {trip.loading_site_name} → {trip.dumping_site_name}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-400">
                        {formatCurrency(trip.net_revenue || trip.total_revenue)}
                      </div>
                      {trip.total_additional_fees > 0 && (
                        <div className="text-[10px] text-amber-400 font-mono">
                          fees: -{formatCurrency(trip.total_additional_fees)}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        {formatDate(trip.date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= VIEW: MY TRIPS ================= */}
      {activeTab === 'trips' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-400" /> My Hauling Trips
              </h2>
              <p className="text-xs text-slate-400">Complete personal history of transported loads</p>
            </div>

            {/* Date period filters (Requirement 15) */}
            <div className="flex bg-slate-800 p-1 rounded-xl text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setPeriodFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                    periodFilter === f.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTrips.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No trips match the selected filter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTrips.map(trip => (
                <div
                  key={trip.id}
                  onClick={() => setSelectedTripDetail(trip)}
                  className={`p-4 bg-slate-800/80 hover:bg-slate-800 border rounded-2xl cursor-pointer transition ${
                    trip.status === 'cancelled' ? 'border-red-500/30 opacity-70' : 'border-slate-700/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs">{trip.trip_number}</span>
                        <span className="font-bold text-sm text-slate-100">{trip.material_name}</span>
                        {trip.status === 'cancelled' && (
                          <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                        <span className="text-slate-400">From:</span> {trip.loading_site_name}
                      </div>
                      {trip.has_transition && (
                        <div className="text-xs text-purple-400 flex items-center gap-1.5">
                          <span className="text-slate-400">Via:</span> {trip.transition_point_name}
                        </div>
                      )}
                      <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                        <span className="text-slate-400">To:</span> {trip.dumping_site_name}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-emerald-400">
                        {formatCurrency(trip.net_revenue || trip.total_revenue)}
                      </div>
                      {trip.total_additional_fees > 0 && (
                        <div className="text-[10px] text-amber-400 font-mono">
                          fees: -{formatCurrency(trip.total_additional_fees)}
                        </div>
                      )}
                      <div className="text-xs font-semibold text-slate-300 mt-0.5">
                        {trip.quantity} {trip.unit}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {formatDateTime(trip.date)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= VIEW: FUEL REQUESTS ================= */}
      {activeTab === 'fuel' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Fuel className="w-5 h-5 text-emerald-400" /> Fuel Money Requests
              </h2>
              <p className="text-xs text-slate-400">View status of fuel advances and disbursements</p>
            </div>
            <button
              onClick={() => setIsFuelModalOpen(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md touch-btn"
            >
              + Request Fuel
            </button>
          </div>

          {fuelRequests.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No fuel requests submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {fuelRequests.map(f => (
                <div
                  key={f.id}
                  className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-amber-400">{f.request_number}</span>
                      <span className="text-xs text-slate-400">{formatDate(f.requested_at)}</span>
                    </div>

                    <span
                      className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
                        f.status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : f.status === 'approved'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : f.status === 'rejected'
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                      }`}
                    >
                      {f.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{f.reason}</div>
                      {f.fuel_station && (
                        <div className="text-[11px] text-slate-400">Station: {f.fuel_station}</div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-slate-100">
                        Req: {formatCurrency(f.amount_requested)}
                      </div>
                      {f.amount_approved > 0 && (
                        <div className="text-xs font-bold text-emerald-400">
                          Approved: {formatCurrency(f.amount_approved)}
                        </div>
                      )}
                    </div>
                  </div>

                  {f.admin_note && (
                    <div className="p-2.5 bg-slate-900/60 rounded-xl text-[11px] text-slate-300 border border-slate-700/50">
                      <strong className="text-amber-400">Admin Note:</strong> {f.admin_note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= VIEW: ODOMETER READING ================= */}
      {activeTab === 'odometer' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Gauge className="w-5 h-5 text-indigo-400" /> {t('odo_tab_title')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('odo_tab_sub')}
              </p>
            </div>

            <button
              onClick={() => {
                setOdometerModalMode('start');
                setIsOdometerModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md touch-btn flex items-center gap-1.5 self-start sm:self-center cursor-pointer transition"
            >
              <Gauge className="w-4 h-4" />
              <span>{t('odo_record_btn')}</span>
            </button>
          </div>

          {/* Today's Shift Card */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-800/90 via-slate-800 to-indigo-950/30 border border-slate-700/80 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2 text-xs">
                <Truck className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">{truck?.plate_number || t('no_truck_assigned')}</span>
                {truck?.model && <span className="text-slate-400">({truck.model})</span>}
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-medium">{formatDate(new Date())}</span>
              </div>

              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                !todayOdometer?.has_start
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                  : !todayOdometer?.has_end
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              }`}>
                {!todayOdometer?.has_start ? t('start_required_badge') : !todayOdometer?.has_end ? t('shift_in_progress') : t('completed_badge')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Start reading box */}
              <div className="p-3.5 bg-slate-900/80 border border-slate-700/60 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5" /> {t('odo_sec_start')}
                  </span>
                  {todayOdometer?.has_start ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
                <div className="text-xl font-black text-white">
                  {todayOdometer?.has_start ? (
                    `${formatNumber(todayOdometer.reading.start_reading)} km`
                  ) : (
                    <span className="text-slate-500 text-sm italic">{t('odo_not_entered')}</span>
                  )}
                </div>
                {todayOdometer?.has_start && todayOdometer?.reading?.start_time && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(todayOdometer.reading.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {todayOdometer?.reading?.start_notes && (
                  <div className="text-[10px] text-slate-400 italic truncate">
                    "{todayOdometer.reading.start_notes}"
                  </div>
                )}
                <button
                  onClick={() => {
                    setOdometerModalMode('start');
                    setIsOdometerModalOpen(true);
                  }}
                  className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[11px] rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  {todayOdometer?.has_start ? t('odo_update_start') : t('enter_start')}
                </button>
              </div>

              {/* End reading box */}
              <div className="p-3.5 bg-slate-900/80 border border-slate-700/60 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5" /> {t('odo_sec_end')}
                  </span>
                  {todayOdometer?.has_end ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
                <div className="text-xl font-black text-white">
                  {todayOdometer?.has_end ? (
                    `${formatNumber(todayOdometer.reading.end_reading)} km`
                  ) : todayOdometer?.last_reading_today > 0 ? (
                    <div>
                      <span>{formatNumber(todayOdometer.last_reading_today)} km</span>
                      <div className="text-[10px] text-purple-400 font-semibold tracking-wide">
                        {t('odo_latest_today', 'Latest today')}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-sm italic">{t('odo_pending_end')}</span>
                  )}
                </div>
                {todayOdometer?.has_end && todayOdometer?.reading?.end_time && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(todayOdometer.reading.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {todayOdometer?.reading?.end_notes && (
                  <div className="text-[10px] text-slate-400 italic truncate">
                    "{todayOdometer.reading.end_notes}"
                  </div>
                )}
                <button
                  disabled={!todayOdometer?.has_start && !todayOdometer?.first_reading_today && !todayOdometer?.last_reading_today}
                  onClick={() => {
                    setOdometerModalMode('end');
                    setIsOdometerModalOpen(true);
                  }}
                  className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 font-bold text-[11px] rounded-lg border border-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {todayOdometer?.has_end ? t('odo_update_end') : t('enter_end')}
                </button>
              </div>

              {/* Total distance box */}
              <div className="p-3.5 bg-slate-900/80 border border-slate-700/60 rounded-xl space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> {t('odo_distance_hauled')}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">
                    {todayOdometer?.has_end ? (
                      `+${formatNumber(todayOdometer.reading.distance_km)} km`
                    ) : (
                      <span className="text-slate-500 text-sm font-semibold">{t('odo_calculating')}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {todayOdometer?.has_end
                      ? `${t('odo_diff')} ${formatNumber(todayOdometer.reading.start_reading)} → ${formatNumber(todayOdometer.reading.end_reading)} km`
                      : t('odo_calc_info')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Previous Odometer Logs History */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> {t('odo_past_history')}
            </h3>

            {odometerHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                {t('odo_no_history')}
              </div>
            ) : (
              <div className="space-y-2">
                {odometerHistory.map(item => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-800/70 border border-slate-700/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{formatDate(item.date)}</span>
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                          {item.truck_plate}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {item.status === 'completed' ? t('completed_badge') : t('shift_in_progress')}
                        </span>
                      </div>
                      <div className="text-slate-400 flex items-center gap-3 text-[11px]">
                        <span>Start: <strong className="text-slate-200">{formatNumber(item.start_reading)} km</strong></span>
                        {item.end_reading > 0 && (
                          <span>End: <strong className="text-slate-200">{formatNumber(item.end_reading)} km</strong></span>
                        )}
                        {item.start_notes && <span className="text-slate-500 italic">"{item.start_notes}"</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {item.distance_km > 0 ? (
                        <div className="text-base font-black text-emerald-400">
                          +{formatNumber(item.distance_km)} km
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">In progress</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRIP DETAIL MODAL */}
      {selectedTripDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Trip Details</h3>
                <span className="font-mono text-xs text-amber-400">{selectedTripDetail.trip_number}</span>
              </div>
              <button
                onClick={() => setSelectedTripDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300 divide-y divide-slate-800">
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">{t('from')}</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.loading_site_name}</span>
              </div>
              {selectedTripDetail.has_transition && (
                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">{t('via')}</span>
                  <span className="font-bold text-purple-400">{selectedTripDetail.transition_point_name}</span>
                </div>
              )}
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">{t('to')}</span>
                <span className="font-bold text-emerald-400">{selectedTripDetail.dumping_site_name}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">{t('material')}</span>
                <span className="font-bold text-amber-400">{selectedTripDetail.material_name}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">{t('quantity')}</span>
                <span className="font-bold">{selectedTripDetail.quantity} {selectedTripDetail.unit} ({formatNumber(selectedTripDetail.quantity_kg)} kg)</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">{t('rate')}</span>
                <span className="font-bold">{formatCurrency(selectedTripDetail.unit_price)}</span>
              </div>
              <div className="flex justify-between pt-2 items-center">
                <span className="text-xs text-slate-400">{t('fee_gross_revenue', 'Gross Revenue:')}</span>
                <span className="font-bold text-slate-200">{formatCurrency(selectedTripDetail.total_revenue)}</span>
              </div>
              {selectedTripDetail.total_additional_fees > 0 && (
                <div className="flex justify-between pt-1 items-center text-xs text-amber-400">
                  <span>{t('step_additional_fees', 'Additional Fees:')}</span>
                  <span className="font-mono font-bold">- {formatCurrency(selectedTripDetail.total_additional_fees)}</span>
                </div>
              )}
              {selectedTripDetail.additional_fees && selectedTripDetail.additional_fees.length > 0 && (
                <div className="pt-1.5 pb-1 space-y-1 text-[11px] text-slate-400">
                  {selectedTripDetail.additional_fees.map((fee, idx) => (
                    <div key={idx} className="flex justify-between pl-2">
                      <span>• {fee.fee_type === 'toll' ? '🛣️ Toll' : fee.fee_type === 'weighbridge' ? '⚖️ Scale' : fee.fee_type === 'parking' ? '🅿️ Parking' : '📝 Extra'} {fee.description ? `(${fee.description})` : ''}</span>
                      <span className="font-mono text-slate-300">{formatCurrency(fee.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-700/80 items-center">
                <span className="text-sm font-bold text-slate-200">{t('fee_net_earnings', 'Net Trip Revenue:')}</span>
                <span className="text-xl font-black text-emerald-400">
                  {formatCurrency(selectedTripDetail.net_revenue || (selectedTripDetail.total_revenue - (selectedTripDetail.total_additional_fees || 0)))}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedTripDetail(null)}
              className="w-full py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {/* START TRIP MODAL */}
      <StartTripModal
        isOpen={isStartTripModalOpen}
        onClose={() => setIsStartTripModalOpen(false)}
        onSuccess={handleStartTripSuccess}
        initialTrip={repeatTripData}
      />

      {/* COMPLETE TRIP MODAL */}
      <CompleteTripModal
        isOpen={isCompleteTripModalOpen}
        onClose={() => setIsCompleteTripModalOpen(false)}
        onSuccess={handleTripSuccess}
        initialTrip={activeTrip}
      />

      {/* FUEL REQUEST MODAL */}
      <FuelRequestModal
        isOpen={isFuelModalOpen}
        onClose={() => setIsFuelModalOpen(false)}
        onSuccess={handleFuelSuccess}
      />

      {/* ODOMETER MODAL */}
      <OdometerModal
        isOpen={isOdometerModalOpen}
        onClose={() => setIsOdometerModalOpen(false)}
        onSuccess={handleOdometerSuccess}
        truck={truck}
        initialMode={odometerModalMode}
      />

      {/* MAINTENANCE REQUEST MODAL */}
      <MaintenanceRequestModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        onSuccess={() => {
          loadDriverData();
        }}
      />

      {/* 6. MOBILE STICKY BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-2 px-4 flex justify-around items-center sm:hidden">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center text-[10px] font-bold ${
            activeTab === 'home' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <Truck className="w-5 h-5 mb-0.5" />
          {t('tab_dashboard')}
        </button>

        <button
          onClick={handleStartTrip}
          className="flex flex-col items-center text-[10px] font-bold text-slate-950 -mt-5"
        >
          <div className="w-12 h-12 rounded-full bg-amber-500 shadow-lg shadow-amber-500/40 flex items-center justify-center">
            <Truck className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <span className="text-amber-400 mt-1 font-bold">{t('start_trip_btn', 'Start Trip')}</span>
        </button>

        <button
          onClick={handleCompleteTrip}
          className={`flex flex-col items-center text-[10px] font-bold relative ${
            activeTrip ? 'text-indigo-400' : 'text-slate-400'
          }`}
        >
          {activeTrip && (
            <span className="absolute -top-1 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
          )}
          <CheckCircle2 className="w-5 h-5 mb-0.5" />
          {t('complete_trip_btn', 'Complete Trip')}
        </button>

        <button
          onClick={() => setIsFuelModalOpen(true)}
          className={`flex flex-col items-center text-[10px] font-bold ${
            activeTab === 'fuel' ? 'text-emerald-400' : 'text-slate-400'
          }`}
        >
          <Fuel className="w-5 h-5 mb-0.5" />
          {t('tab_fuel')}
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`flex flex-col items-center text-[10px] font-bold ${
            activeTab === 'trips' ? 'text-amber-400' : 'text-slate-400'
          }`}
        >
          <ClipboardList className="w-5 h-5 mb-0.5" />
          {t('tab_trips')}
        </button>
      </div>

      {/* Profile Edit Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};
