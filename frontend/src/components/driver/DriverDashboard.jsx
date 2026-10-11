import React, { useState, useEffect, useMemo } from 'react';
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
  X,
  Sparkles,
  RefreshCw,
  Zap,
  Plus
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
  const [driverWelcomeMessage, setDriverWelcomeMessage] = useState('');

  const loadDriverData = async () => {
    try {
      const [tripsData, fuelData, summaryData, recentData, odoTodayData, odoHistoryData, activeTripData, settingsData] = await Promise.all([
        api.get('/trips'),
        api.get('/fuel-requests'),
        api.get('/drivers/summary'),
        api.get('/trips/recent'),
        api.get('/odometer/today').catch(() => null),
        api.get('/odometer/history').catch(() => []),
        api.get('/trips/active').catch(() => null),
        api.get('/settings').catch(() => null),
      ]);

      setMyTrips(tripsData || []);
      setFuelRequests(fuelData || []);
      setFinancialSummary(summaryData || null);
      if (settingsData?.driver_welcome_message) {
        setDriverWelcomeMessage(settingsData.driver_welcome_message);
      }
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

    const handleWelcomeUpdated = () => {
      api.get('/settings')
        .then(res => {
          if (res?.driver_welcome_message) {
            setDriverWelcomeMessage(res.driver_welcome_message);
          }
        })
        .catch(console.error);
    };

    window.addEventListener('welcome-message-updated', handleWelcomeUpdated);
    window.addEventListener('settings-updated', handleWelcomeUpdated);

    return () => {
      window.removeEventListener('welcome-message-updated', handleWelcomeUpdated);
      window.removeEventListener('settings-updated', handleWelcomeUpdated);
    };
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

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDriverData();
    await refreshUser();
    setRefreshing(false);
  };

  return (
    <div className="pb-24 pt-3 px-3 sm:px-6 max-w-5xl mx-auto space-y-4 sm:space-y-5">
      {/* 0. HERO GREETING SECTION (Matching Reference Design sample_ui_2.jpg) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-lg sm:text-xl flex items-center justify-center shadow-md shadow-amber-500/20">
              {user?.full_name ? user.full_name.charAt(0) : 'D'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Hi, {user?.full_name || 'Driver'}
              </h1>
              <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/30 px-2.5 py-0.5 rounded-full shrink-0">
                {t('driver', 'Driver')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t('assigned_truck', 'Assigned Truck:')} <strong className="text-slate-800 dark:text-slate-200">{truck?.plate_number || t('no_truck_assigned', 'No Truck')}</strong>
              {truck?.model && <span className="text-slate-400 dark:text-slate-500"> • {truck.model} ({truck.capacity}T)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Refresh fleet data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">{t('edit_profile', 'Profile')}</span>
          </button>
        </div>
      </div>

      {/* DRIVER WELCOME & SAFETY ANNOUNCEMENT FROM ADMIN */}
      {driverWelcomeMessage && (
        <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-amber-200/90 dark:border-amber-500/30 rounded-3xl shadow-xs flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-500/20">
                  {t('driver_announcement_badge', 'Company Dispatch Notice')}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {t('from_fleet_admin', 'From Admin')}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                {driverWelcomeMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Fuel Alert Banner */}
      {financialSummary?.pending_fuel_count > 0 && (
        <div className="py-2.5 px-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 shadow-xs">
          <span className="flex items-center gap-2 font-semibold">
            <Clock className="w-4 h-4 text-amber-500 animate-spin" />
            {financialSummary.pending_fuel_count} {t('pending_fuel_alert', 'fuel requests awaiting admin approval')}
          </span>
          <button
            onClick={() => setActiveTab('fuel')}
            className="text-amber-600 dark:text-amber-400 underline font-bold cursor-pointer"
          >
            {t('view', 'View')}
          </button>
        </div>
      )}

      {/* Shift Completed Banner */}
      {todayOdometer?.has_end && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/80 dark:border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>
              {t('shift_completed_banner', 'Today shift closed:')} <strong className="text-emerald-600 dark:text-emerald-400 font-black">+{formatNumber(todayOdometer.reading.distance_km)} km</strong> ({formatNumber(todayOdometer.reading.start_reading)} → {formatNumber(todayOdometer.reading.end_reading)} km)
            </span>
          </div>
          <button
            onClick={() => {
              setOdometerModalMode('end');
              setIsOdometerModalOpen(true);
            }}
            className="text-xs text-emerald-600 dark:text-emerald-400 underline font-bold cursor-pointer"
          >
            {t('edit', 'Edit')}
          </button>
        </div>
      )}

      {/* 2. TAB TOGGLES (Matching Capsule Switcher in sample_ui_2.jpg) */}
      <div className="flex bg-slate-100 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 p-1 rounded-2xl text-xs shadow-inner">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition text-center cursor-pointer ${
            activeTab === 'home'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('tab_dashboard', 'Dashboard')}
        </button>
        <button
          onClick={() => setActiveTab('odometer')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition text-center cursor-pointer ${
            activeTab === 'odometer'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('tab_odometer', 'Odometer')}
        </button>
        <button
          onClick={() => setActiveTab('fuel')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition text-center cursor-pointer ${
            activeTab === 'fuel'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('tab_fuel', 'Fuel Requests')}
        </button>
        <button
          onClick={() => setActiveTab('trips')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition text-center cursor-pointer ${
            activeTab === 'trips'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t('tab_trips', 'My Trips')} ({myTrips.length})
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
                title={t('dismiss_btn', 'Dismiss')}
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

          {/* 3. LARGE TOUCH ACTION BUTTONS (2x2 Grid matching sample_ui_2.jpg) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {/* BUTTON 1: START TRIP */}
            <button
              type="button"
              onClick={handleStartTrip}
              className="p-4 sm:p-5 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-3xl shadow-md sm:shadow-lg shadow-amber-500/20 text-left flex flex-col justify-between h-32 sm:h-36 touch-btn group cursor-pointer border border-amber-300/60 active:scale-95 transition-all"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-950/20 border border-slate-950/20 flex items-center justify-center">
                <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-black tracking-tight leading-snug">{t('start_trip_btn', '🚀 Start Trip')}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-slate-950/80 mt-0.5 line-clamp-1">{t('start_trip_sub', 'Record departure & cargo')}</div>
              </div>
            </button>

            {/* BUTTON 2: COMPLETE THE TRIP */}
            <button
              type="button"
              onClick={handleCompleteTrip}
              className={`p-4 sm:p-5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 hover:from-indigo-500 hover:to-purple-700 text-white rounded-3xl shadow-md sm:shadow-lg shadow-indigo-600/20 text-left flex flex-col justify-between h-32 sm:h-36 touch-btn group cursor-pointer relative overflow-hidden active:scale-95 transition-all ${
                activeTrip ? 'ring-2 ring-emerald-400 shadow-emerald-500/20' : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                {activeTrip ? (
                  <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-400/25 text-emerald-200 border-emerald-300/40 animate-pulse">
                    Active
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white/10 text-slate-200 border-white/20">
                    Step 2
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm sm:text-base font-black tracking-tight leading-snug text-white">{t('complete_trip_btn', '🏁 Complete Trip')}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-indigo-100/90 mt-0.5 line-clamp-1">
                  {activeTrip ? `${activeTrip.trip_number} • ${t('insert_receipt', 'Insert receipt')}` : t('complete_trip_sub', 'Insert receipt & finish run')}
                </div>
              </div>
            </button>

            {/* BUTTON 3: REQUEST FUEL */}
            <button
              type="button"
              onClick={() => setIsFuelModalOpen(true)}
              className="p-4 sm:p-5 bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-3xl shadow-md sm:shadow-lg shadow-emerald-600/20 text-left flex flex-col justify-between h-32 sm:h-36 touch-btn group cursor-pointer active:scale-95 transition-all"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center">
                <Fuel className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-black tracking-tight leading-snug">{t('request_fuel_btn', '⛽ Fuel Advance')}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-emerald-100/90 mt-0.5 line-clamp-1">{t('request_fuel_sub', 'Request diesel money or yard draw')}</div>
              </div>
            </button>

            {/* BUTTON 4: REQUEST MAINTENANCE */}
            <button
              type="button"
              onClick={() => setIsMaintenanceModalOpen(true)}
              className="p-4 sm:p-5 bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 hover:from-purple-500 hover:via-violet-500 hover:to-indigo-600 text-white rounded-3xl shadow-md sm:shadow-lg shadow-purple-600/25 text-left flex flex-col justify-between h-32 sm:h-36 touch-btn group cursor-pointer active:scale-95 transition-all"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center">
                <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-black tracking-tight leading-snug">{t('request_maintenance_btn', '🔧 Maintenance')}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-purple-100/90 mt-0.5 line-clamp-1">{t('request_maintenance_sub', 'Report truck issue or repair')}</div>
              </div>
            </button>
          </div>

          {/* SMART REPEAT: 1-CLICK "REPEAT PREVIOUS TRIP" */}
          {recentTrip && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <RotateCcw className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                    {t('smart_repeat_badge', 'Smart Repeat')}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {recentTrip.trip_number}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/60 my-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                    {recentTrip.loading_site_name}
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                    {recentTrip.dumping_site_name}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('material', 'Cargo:')} <strong className="text-amber-600 dark:text-amber-400">{recentTrip.material_name}</strong> •{' '}
                    {t('rate', 'Rate:')} {formatCurrency(recentTrip.unit_price)} / {recentTrip.unit}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRepeatTrip}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 touch-btn flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {t('use_previous', 'Use Previous Run')}
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                {t('smart_repeat_sub', 'Pre-fills starting odometer, loading site, dumping site, and cargo material from your last run.')}
              </p>
            </div>
          )}

          {/* 6. RECENT TRIPS CARDS (Matching task list rows in sample_ui_2.jpg) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-500" /> {t('recent_trips_title', 'Recent Hauling Trips Feed')}
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('trips')}
                className="text-xs text-amber-500 font-semibold hover:underline cursor-pointer"
              >
                {t('view_all', 'View All →')}
              </button>
            </div>

            {myTrips.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {t('no_trips_today', 'No trips recorded yet.')}
              </div>
            ) : (
              <div className="space-y-2.5">
                {myTrips.slice(0, 4).map(trip => (
                  <div
                    key={trip.id}
                    onClick={() => setSelectedTripDetail(trip)}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/70 rounded-2xl transition cursor-pointer flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-500">{trip.trip_number}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{trip.material_name}</span>
                        <span className="text-[10px] bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                          {trip.quantity} {trip.unit}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {trip.loading_site_name} → {trip.dumping_site_name}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(trip.net_revenue || trip.total_revenue)}
                      </div>
                      {trip.total_additional_fees > 0 && (
                        <div className="text-[10px] text-amber-500 font-mono">
                          fees: -{formatCurrency(trip.total_additional_fees)}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-500" /> {t('my_hauling_trips', 'My Hauling Trips')}
              </h2>
              <p className="text-xs text-slate-400">{t('history_loads_sub', 'Complete personal history of transported loads')}</p>
            </div>

            {/* Date period filters */}
            <div className="flex bg-slate-100 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 p-1 rounded-2xl text-xs">
              {[
                { id: 'all', label: t('all_time', 'All') },
                { id: 'today', label: t('today_filter', 'Today') },
                { id: 'this_week', label: t('this_week', 'This Week') },
                { id: 'this_month', label: t('this_month', 'This Month') },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPeriodFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    periodFilter === f.id ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTrips.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No trips match the selected filter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTrips.map(trip => (
                <div
                  key={trip.id}
                  onClick={() => setSelectedTripDetail(trip)}
                  className={`p-4 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-800 border rounded-2xl cursor-pointer transition shadow-xs ${
                    trip.status === 'cancelled' ? 'border-rose-200 dark:border-red-500/30 opacity-70' : 'border-slate-100 dark:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-500 text-xs">{trip.trip_number}</span>
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{trip.material_name}</span>
                        {trip.status === 'cancelled' && (
                          <span className="text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40 px-2 py-0.5 rounded-full">
                            {t('cancelled', 'Cancelled')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                        <span className="text-slate-400">{t('from_label', 'From:')}</span> {trip.loading_site_name}
                      </div>
                      {trip.has_transition && (
                        <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                          <span className="text-slate-400">{t('via_label', 'Via:')}</span> {trip.transition_point_name}
                        </div>
                      )}
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <span className="text-slate-400">{t('to_label', 'To:')}</span> {trip.dumping_site_name}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(trip.net_revenue || trip.total_revenue)}
                      </div>
                      {trip.total_additional_fees > 0 && (
                        <div className="text-[10px] text-amber-500 font-mono font-semibold">
                          fees: -{formatCurrency(trip.total_additional_fees)}
                        </div>
                      )}
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                        {trip.quantity} {trip.unit}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Fuel className="w-5 h-5 text-emerald-500" /> {t('fuel_money_requests', 'Fuel Money Requests')}
              </h2>
              <p className="text-xs text-slate-400">{t('fuel_advances_status_sub', 'View status of fuel advances and disbursements')}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFuelModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-md shadow-emerald-600/20 touch-btn cursor-pointer transition"
            >
              {t('request_fuel_btn', '+ Request Fuel')}
            </button>
          </div>

          {fuelRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              {t('no_fuel_requests_yet', 'No fuel requests submitted yet.')}
            </div>
          ) : (
            <div className="space-y-3">
              {fuelRequests.map(f => (
                <div
                  key={f.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 rounded-2xl space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-amber-500">{f.request_number}</span>
                      <span className="text-xs text-slate-400">{formatDate(f.requested_at)}</span>
                    </div>

                    <span
                      className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
                        f.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40'
                          : f.status === 'approved'
                          ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40'
                          : f.status === 'rejected'
                          ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40'
                          : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40 animate-pulse'
                      }`}
                    >
                      {f.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{f.reason}</div>
                      {f.fuel_station && (
                        <div className="text-[11px] text-slate-400">{t('station_label', 'Station:')} {f.fuel_station}</div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {t('req_short', 'Req:')} {formatCurrency(f.amount_requested)}
                      </div>
                      {f.amount_approved > 0 && (
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {t('approved_short', 'Approved:')} {formatCurrency(f.amount_approved)}
                        </div>
                      )}
                    </div>
                  </div>

                  {f.admin_note && (
                    <div className="p-2.5 bg-white dark:bg-slate-900/60 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/50">
                      <strong className="text-amber-500">{t('admin_note_label', 'Admin Note:')}</strong> {f.admin_note}
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
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Gauge className="w-5 h-5 text-indigo-500" /> {t('odo_tab_title', 'Odometer Reading & Daily Mileage')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('odo_tab_sub', 'Log and verify truck distance readings to calculate fuel consumption')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setOdometerModalMode('start');
                setIsOdometerModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl shadow-md shadow-indigo-600/20 touch-btn flex items-center gap-1.5 self-start sm:self-center cursor-pointer transition"
            >
              <Gauge className="w-4 h-4" />
              <span>{t('odo_record_btn', 'Log Reading')}</span>
            </button>
          </div>

          {/* Today's Shift Card */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700/80 rounded-3xl space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/60 pb-3">
              <div className="flex items-center gap-2 text-xs">
                <Truck className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-slate-900 dark:text-white">{truck?.plate_number || t('no_truck_assigned', 'No Truck')}</span>
                {truck?.model && <span className="text-slate-400">({truck.model})</span>}
                <span className="text-slate-400">•</span>
                <span className="text-slate-600 dark:text-slate-300 font-medium">{formatDate(new Date())}</span>
              </div>

              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                !todayOdometer?.has_start
                  ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40 animate-pulse'
                  : !todayOdometer?.has_end
                  ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40'
              }`}>
                {!todayOdometer?.has_start ? t('start_required_badge', 'Start Required') : !todayOdometer?.has_end ? t('shift_in_progress', 'In Progress') : t('completed_badge', 'Completed')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Start reading box */}
              <div className="p-4 bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5" /> {t('odo_sec_start', 'Morning Departure')}
                  </span>
                  {todayOdometer?.has_start ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                  {todayOdometer?.has_start ? (
                    `${formatNumber(todayOdometer.reading.start_reading)} km`
                  ) : (
                    <span className="text-slate-400 text-sm italic">{t('odo_not_entered', 'Not entered')}</span>
                  )}
                </div>
                {todayOdometer?.has_start && todayOdometer?.reading?.start_time && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(todayOdometer.reading.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {todayOdometer?.reading?.start_notes && (
                  <div className="text-[10px] text-slate-400 italic truncate">
                    "{todayOdometer.reading.start_notes}"
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOdometerModalMode('start');
                    setIsOdometerModalOpen(true);
                  }}
                  className="w-full mt-2 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold text-[11px] rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  {todayOdometer?.has_start ? t('odo_update_start', 'Update Start Reading') : t('enter_start', 'Enter Morning Reading')}
                </button>
              </div>

              {/* End reading box */}
              <div className="p-4 bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5" /> {t('odo_sec_end', 'Evening Finish')}
                  </span>
                  {todayOdometer?.has_end ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                  {todayOdometer?.has_end ? (
                    `${formatNumber(todayOdometer.reading.end_reading)} km`
                  ) : todayOdometer?.last_reading_today > 0 ? (
                    <div>
                      <span>{formatNumber(todayOdometer.last_reading_today)} km</span>
                      <div className="text-[10px] text-purple-500 font-semibold tracking-wide">
                        {t('odo_latest_today', 'Latest today')}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm italic">{t('odo_pending_end', 'Pending end')}</span>
                  )}
                </div>
                {todayOdometer?.has_end && todayOdometer?.reading?.end_time && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(todayOdometer.reading.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {todayOdometer?.reading?.end_notes && (
                  <div className="text-[10px] text-slate-400 italic truncate">
                    "{todayOdometer.reading.end_notes}"
                  </div>
                )}
                <button
                  type="button"
                  disabled={!todayOdometer?.has_start && !todayOdometer?.first_reading_today && !todayOdometer?.last_reading_today}
                  onClick={() => {
                    setOdometerModalMode('end');
                    setIsOdometerModalOpen(true);
                  }}
                  className="w-full mt-2 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-purple-600 dark:text-purple-400 font-bold text-[11px] rounded-xl border border-slate-200 dark:border-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {todayOdometer?.has_end ? t('odo_update_end', 'Update End Reading') : t('enter_end', 'Enter Evening Reading')}
                </button>
              </div>

              {/* Total distance box */}
              <div className="p-4 bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl space-y-1.5 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> {t('odo_distance_hauled', 'Distance Traveled')}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                    {todayOdometer?.has_end ? (
                      `+${formatNumber(todayOdometer.reading.distance_km)} km`
                    ) : (
                      <span className="text-slate-400 text-sm font-semibold">{t('odo_calculating', 'Calculating...')}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {todayOdometer?.has_end
                      ? `${t('odo_diff', 'Net Distance:')} ${formatNumber(todayOdometer.reading.start_reading)} → ${formatNumber(todayOdometer.reading.end_reading)} km`
                      : t('odo_calc_info', 'Enter end odometer reading to calculate total shift mileage.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Previous Odometer Logs History */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-amber-500" /> {t('odo_past_history', 'Past Odometer Shifts')}
            </h3>

            {odometerHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {t('odo_no_history', 'No past odometer logs recorded.')}
              </div>
            ) : (
              <div className="space-y-2">
                {odometerHistory.map(item => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{formatDate(item.date)}</span>
                        <span className="text-[10px] bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono">
                          {item.truck_plate}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                        }`}>
                          {item.status === 'completed' ? t('completed_badge', 'Completed') : t('shift_in_progress', 'In Progress')}
                        </span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 flex items-center gap-3 text-[11px]">
                        <span>{t('start_label', 'Start:')} <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatNumber(item.start_reading)} km</strong></span>
                        {item.end_reading > 0 && (
                          <span>{t('end_label', 'End:')} <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatNumber(item.end_reading)} km</strong></span>
                        )}
                        {item.start_notes && <span className="text-slate-400 italic">"{item.start_notes}"</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {item.distance_km > 0 ? (
                        <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          +{formatNumber(item.distance_km)} km
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">{t('in_progress', 'In progress')}</div>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{t('trip_details_title', 'Trip Details')}</h3>
                <span className="font-mono text-xs text-amber-500 font-bold">{selectedTripDetail.trip_number}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTripDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">{t('from', 'From')}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedTripDetail.loading_site_name}</span>
              </div>
              {selectedTripDetail.has_transition && (
                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">{t('via', 'Via')}</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{selectedTripDetail.transition_point_name}</span>
                </div>
              )}
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">{t('to', 'To')}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedTripDetail.dumping_site_name}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">{t('material', 'Cargo Material')}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{selectedTripDetail.material_name}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">{t('quantity', 'Quantity')}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedTripDetail.quantity} {selectedTripDetail.unit} ({formatNumber(selectedTripDetail.quantity_kg)} kg)</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-400">{t('rate', 'Rate')}</span>
                <div className="text-right">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(selectedTripDetail.unit_price)} / {selectedTripDetail.unit || 'ton'}</span>
                  {selectedTripDetail.pricing_target && (
                    <span className="block text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      {t('priced_to_label', 'Priced to:')} {selectedTripDetail.pricing_target === 'transit' ? (selectedTripDetail.transition_point_name || t('transit_point', 'Transit Point')) : (selectedTripDetail.dumping_site_name || t('destination', 'Destination'))}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between pt-2 items-center">
                <span className="text-xs text-slate-400">{t('fee_gross_revenue', 'Gross Revenue:')}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(selectedTripDetail.total_revenue)}</span>
              </div>
              {selectedTripDetail.total_additional_fees > 0 && (
                <div className="flex justify-between pt-1 items-center text-xs text-amber-600 dark:text-amber-400">
                  <span>{t('step_additional_fees', 'Additional Fees:')}</span>
                  <span className="font-mono font-bold">- {formatCurrency(selectedTripDetail.total_additional_fees)}</span>
                </div>
              )}
              {selectedTripDetail.additional_fees && selectedTripDetail.additional_fees.length > 0 && (
                <div className="pt-1.5 pb-1 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedTripDetail.additional_fees.map((fee, idx) => (
                    <div key={idx} className="flex justify-between pl-2">
                      <span>• {fee.fee_type === 'toll' ? ('🛣️ ' + t('toll_fee', 'Toll')) : fee.fee_type === 'weighbridge' ? ('⚖️ ' + t('scale_fee', 'Scale')) : fee.fee_type === 'parking' ? ('🅿️ ' + t('parking_fee', 'Parking')) : ('📝 ' + t('extra_fee', 'Extra'))} {fee.description ? `(${fee.description})` : ''}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{formatCurrency(fee.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 items-center">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('fee_net_earnings', 'Net Trip Revenue:')}</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(selectedTripDetail.net_revenue || (selectedTripDetail.total_revenue - (selectedTripDetail.total_additional_fees || 0)))}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTripDetail(null)}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl cursor-pointer transition"
            >
              {t('close', 'Close')}
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

      {/* 6. MOBILE STICKY BOTTOM NAVIGATION (Frosted Glass matching modern design) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#121624]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 py-2 px-4 flex justify-around items-center sm:hidden shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center text-[10px] font-bold cursor-pointer ${
            activeTab === 'home' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Truck className="w-5 h-5 mb-0.5" />
          {t('tab_dashboard', 'Dashboard')}
        </button>

        <button
          type="button"
          onClick={handleStartTrip}
          className="flex flex-col items-center text-[10px] font-bold text-slate-950 -mt-5 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 shadow-lg shadow-amber-500/40 flex items-center justify-center active:scale-95 transition">
            <Truck className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <span className="text-amber-500 mt-1 font-bold">{t('start_trip_btn', 'Start Trip')}</span>
        </button>

        <button
          type="button"
          onClick={handleCompleteTrip}
          className={`flex flex-col items-center text-[10px] font-bold relative cursor-pointer ${
            activeTrip ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {activeTrip && (
            <span className="absolute -top-1 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
          )}
          <CheckCircle2 className="w-5 h-5 mb-0.5" />
          {t('complete_trip_btn', 'Complete Trip')}
        </button>

        <button
          type="button"
          onClick={() => setIsFuelModalOpen(true)}
          className={`flex flex-col items-center text-[10px] font-bold cursor-pointer ${
            activeTab === 'fuel' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Fuel className="w-5 h-5 mb-0.5" />
          {t('tab_fuel', 'Fuel')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trips')}
          className={`flex flex-col items-center text-[10px] font-bold cursor-pointer ${
            activeTab === 'trips' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <ClipboardList className="w-5 h-5 mb-0.5" />
          {t('tab_trips', 'Trips')}
        </button>
      </div>

      {/* Profile Edit Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};
