import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatNumber, formatDate, formatDateTime, exportToCSV } from '../../utils/formatters';
import {
  Gauge,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  Calendar,
  Truck,
  User,
  CheckCircle,
  Clock,
  Compass,
  AlertCircle,
  FileText,
  TrendingUp,
  X
} from 'lucide-react';

export const OdometerRecordsView = () => {
  const { t } = useLanguage();

  const [records, setRecords] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_distance_km: 0,
    today_distance_km: 0,
    month_distance_km: 0,
    active_trucks_today: 0,
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    truck_id: '',
    driver_id: '',
    date: new Date().toISOString().split('T')[0],
    start_reading: '',
    end_reading: '',
    start_notes: '',
    end_notes: '',
    source: 'manual',
    status: 'completed',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Build query string
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedTruck) params.append('truck_id', selectedTruck);
      if (selectedDriver) params.append('driver_id', selectedDriver);
      if (selectedSource) params.append('source', selectedSource);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedDate) params.append('date', selectedDate);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const [odoData, trucksData, driversData] = await Promise.all([
        api.get(`/odometer${qs}`),
        api.get('/trucks'),
        api.get('/drivers'),
      ]);

      if (odoData) {
        setRecords(odoData.records || []);
        setStats({
          total_distance_km: odoData.total_distance_km || 0,
          today_distance_km: odoData.today_distance_km || 0,
          month_distance_km: odoData.month_distance_km || 0,
          active_trucks_today: odoData.active_trucks_today || 0,
        });
      }
      setTrucks(trucksData || []);
      setDrivers(driversData || []);
    } catch (err) {
      console.error('Failed to load odometer records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTruck, selectedDriver, selectedSource, selectedStatus, selectedDate]);

  // Handle Search submit / debounce
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setErrorMsg('');
    setFormData({
      truck_id: trucks.length > 0 ? trucks[0].id : '',
      driver_id: '',
      date: new Date().toISOString().split('T')[0],
      start_reading: '',
      end_reading: '',
      start_notes: '',
      end_notes: '',
      source: 'manual',
      status: 'completed',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rec) => {
    setEditingRecord(rec);
    setErrorMsg('');
    setFormData({
      truck_id: rec.truck_id || '',
      driver_id: rec.driver_id || '',
      date: rec.date || new Date().toISOString().split('T')[0],
      start_reading: rec.start_reading || '',
      end_reading: rec.end_reading || '',
      start_notes: rec.start_notes || '',
      end_notes: rec.end_notes || '',
      source: rec.source || 'manual',
      status: rec.status || 'completed',
    });
    setIsModalOpen(true);
  };

  const handleSaveRecord = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const startVal = parseFloat(formData.start_reading);
    const endVal = formData.end_reading ? parseFloat(formData.end_reading) : 0;

    if (isNaN(startVal) || startVal <= 0) {
      setErrorMsg('Please enter a valid starting odometer reading greater than 0');
      return;
    }

    if (endVal > 0 && endVal < startVal) {
      setErrorMsg('Ending odometer reading cannot be less than starting odometer reading');
      return;
    }

    setSaving(true);
    try {
      if (editingRecord) {
        await api.put(`/odometer/${editingRecord.id}`, {
          truck_id: formData.truck_id,
          driver_id: formData.driver_id,
          date: formData.date,
          start_reading: startVal,
          end_reading: endVal,
          start_notes: formData.start_notes,
          end_notes: formData.end_notes,
          status: endVal > startVal ? 'completed' : formData.status,
        });
      } else {
        await api.post('/odometer', {
          truck_id: formData.truck_id,
          driver_id: formData.driver_id,
          date: formData.date,
          start_reading: startVal,
          end_reading: endVal,
          notes: formData.start_notes,
          source: formData.source || 'manual',
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = (rec) => {
    if (!rec) return;
    setDeleteTarget({
      id: rec.id || rec._id,
      plate: rec.truck_plate || 'Unknown',
      date: rec.date || (rec.created_at ? formatDate(rec.created_at) : 'N/A'),
      start_reading: rec.start_reading,
      end_reading: rec.end_reading,
      source: rec.source,
      trip_number: rec.trip_number,
    });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const recordId = deleteTarget.id;
    if (!recordId) {
      alert('Error: Record ID not found');
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/odometer/${recordId}`);
      setSuccessMsg(`Odometer record for truck ${deleteTarget.plate} deleted successfully.`);
      setDeleteTarget(null);
      if (isModalOpen) setIsModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('Delete failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      { key: 'date', label: 'Date' },
      { key: 'truck_plate', label: 'Truck Plate' },
      { key: 'driver_name', label: 'Driver' },
      { key: 'source', label: 'Source' },
      { key: 'start_reading', label: 'Start Odo (KM)' },
      { key: 'end_reading', label: 'End Odo (KM)' },
      { key: 'distance_km', label: 'Distance (KM)' },
      { key: 'trip_number', label: 'Trip #' },
      { key: 'receipt_number', label: 'Receipt #' },
      { key: 'status', label: 'Status' },
      { key: 'start_notes', label: 'Notes' },
    ];
    exportToCSV(`HornFleet_Odometer_Records_${new Date().toISOString().split('T')[0]}.csv`, records, headers);
  };

  // Helper source badge
  const renderSourceBadge = (source, tripNum, receiptNum) => {
    switch (source) {
      case 'trip_start':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <span>🚀 {t('odo_source_trip_start', 'Trip Start')}</span>
            {tripNum && <span className="text-blue-400 font-mono">({tripNum})</span>}
          </span>
        );
      case 'trip_complete':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span>🏁 {t('odo_source_trip_complete', 'Trip Complete')}</span>
            {tripNum && <span className="text-emerald-400 font-mono">({tripNum})</span>}
          </span>
        );
      case 'daily_shift':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <span>🌅 {t('odo_source_daily_shift', 'Daily Shift')}</span>
          </span>
        );
      case 'manual':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <span>✍️ {t('odo_source_manual', 'Manual Entry')}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-slate-900 border border-slate-800 p-6 sm:p-7 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 shadow-sm">
            <Gauge className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 flex items-center space-x-3 tracking-tight">
              <span>{t('odo_records_title', 'Odometer Records')}</span>
              <span className="text-[11px] bg-slate-800 border border-slate-700 text-slate-300 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {records.length} {t('records', 'Records')}
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {t(
                'odo_records_sub',
                'Audit vehicle mileage logs from hauling trips, daily shifts, and manual admin adjustments'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0 flex-wrap gap-y-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-2xl text-sm font-bold transition-all shadow-sm flex items-center space-x-2"
            title="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            <span className="hidden sm:inline">{t('refresh', 'Refresh')}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!records.length}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-2xl text-sm font-bold transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50"
            title="Export CSV"
          >
            <Download className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">{t('export', 'Export CSV')}</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl text-sm font-extrabold shadow-md shadow-amber-500/20 transition-all flex items-center space-x-2 border border-amber-400"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t('odo_log_new', 'Log Odometer Reading')}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300 font-bold shadow-sm">
          <div className="flex items-center space-x-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Verified Distance */}
        <div className="bg-slate-900 border-2 border-slate-800 hover:border-amber-500/50 p-5 rounded-3xl shadow-sm transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-amber-500 transition-colors">
              {t('odo_stat_total', 'Total Logged Distance')}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center font-bold">
              <Compass className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-1.5">
            <span className="text-3xl font-black text-slate-100 tracking-tight">
              {formatNumber(stats.total_distance_km, 0)}
            </span>
            <span className="text-sm font-black text-amber-500">KM</span>
          </div>
          <div className="text-xs text-slate-500 mt-1.5 font-medium">Across all hauling operations</div>
        </div>

        {/* Today's Distance */}
        <div className="bg-slate-900 border-2 border-slate-800 hover:border-emerald-500/50 p-5 rounded-3xl shadow-sm transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              {t('odo_stat_today', "Today's Distance")}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-1.5">
            <span className="text-3xl font-black text-emerald-500 tracking-tight">
              {formatNumber(stats.today_distance_km, 0)}
            </span>
            <span className="text-sm font-black text-emerald-500">KM</span>
          </div>
          <div className="text-xs text-slate-500 mt-1.5 font-medium">Recorded on current shift date</div>
        </div>

        {/* Month Distance */}
        <div className="bg-slate-900 border-2 border-slate-800 hover:border-blue-500/50 p-5 rounded-3xl shadow-sm transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-500">
              {t('odo_stat_month', "This Month's Distance")}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-1.5">
            <span className="text-3xl font-black text-blue-500 tracking-tight">
              {formatNumber(stats.month_distance_km, 0)}
            </span>
            <span className="text-sm font-black text-blue-500">KM</span>
          </div>
          <div className="text-xs text-slate-500 mt-1.5 font-medium">Month-to-date fleet total</div>
        </div>

        {/* Active Trucks Today */}
        <div className="bg-slate-900 border-2 border-slate-800 hover:border-purple-500/50 p-5 rounded-3xl shadow-sm transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-500">
              {t('odo_stat_trucks', 'Active Trucks Today')}
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-500 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-1.5">
            <span className="text-3xl font-black text-purple-500 tracking-tight">{stats.active_trucks_today}</span>
            <span className="text-sm font-black text-purple-500/80">TRUCKS</span>
          </div>
          <div className="text-xs text-slate-500 mt-1.5 font-medium">Logged odometer today</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-amber-500 transition-colors" />
            <input
              type="text"
              placeholder={t('search_odo_placeholder', 'Search truck plate, driver, trip #, receipt #...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/70 focus:bg-slate-800/80 transition-all shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold text-sm rounded-2xl transition shrink-0 shadow-sm"
          >
            {t('search', 'Search')}
          </button>
        </form>

        {/* Sleek Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1.5" /> Filters:
          </div>
          {/* Truck Filter */}
          <select
            value={selectedTruck}
            onChange={(e) => setSelectedTruck(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 hover:bg-slate-800 transition-colors"
          >
            <option value="">{t('odo_filter_truck', 'All Trucks')}</option>
            {trucks.map((trk) => (
              <option key={trk.id} value={trk.id}>
                {trk.plate_number} ({trk.model || trk.type})
              </option>
            ))}
          </select>

          {/* Driver Filter */}
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 hover:bg-slate-800 transition-colors"
          >
            <option value="">{t('odo_filter_driver', 'All Drivers')}</option>
            {drivers.map((drv) => (
              <option key={drv.id || drv.user_id} value={drv.user_id || drv.id}>
                {drv.full_name}
              </option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 hover:bg-slate-800 transition-colors"
          >
            <option value="">{t('odo_filter_source', 'All Sources')}</option>
            <option value="trip_start">🚀 {t('odo_source_trip_start', 'Trip Start')}</option>
            <option value="trip_complete">🏁 {t('odo_source_trip_complete', 'Trip Complete')}</option>
            <option value="daily_shift">🌅 {t('odo_source_daily_shift', 'Daily Shift')}</option>
            <option value="manual">✍️ {t('odo_source_manual', 'Manual Entry')}</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 hover:bg-slate-800 transition-colors"
          >
            <option value="">{t('odo_filter_status', 'All Statuses')}</option>
            <option value="completed">Completed</option>
            <option value="started">Started / In-Progress</option>
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500 hover:bg-slate-800 transition-colors"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">{t('odo_col_datetime', 'Date & Time')}</th>
                <th className="py-3.5 px-4">{t('odo_col_truck', 'Truck')}</th>
                <th className="py-3.5 px-4">{t('odo_col_driver', 'Driver')}</th>
                <th className="py-3.5 px-4">{t('odo_col_source', 'Source / Run')}</th>
                <th className="py-3.5 px-4 text-right">{t('odo_col_start', 'Start Odo')}</th>
                <th className="py-3.5 px-4 text-right">{t('odo_col_end', 'End Odo')}</th>
                <th className="py-3.5 px-4 text-right">{t('odo_col_distance', 'Distance')}</th>
                <th className="py-3.5 px-4">{t('odo_col_ref', 'Trip / Receipt #')}</th>
                <th className="py-3.5 px-4">{t('odo_col_status', 'Status')}</th>
                <th className="py-3.5 px-4 text-center">{t('odo_col_actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                      <span>Loading odometer records...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-20 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="w-16 h-16 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mx-auto shadow-sm">
                        <Gauge className="w-8 h-8 text-slate-400" />
                      </div>
                      <div className="font-bold text-slate-300 text-base">
                        {t('odo_no_records', 'No odometer records found.')}
                      </div>
                      <p className="text-xs text-slate-500 px-6">
                        Start trips or enter daily odometer readings on the driver side to populate this audit log. You can also manually log a reading using the button above.
                      </p>
                      <button
                        onClick={openAddModal}
                        className="px-5 py-2 mt-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs font-bold rounded-xl transition"
                      >
                        + Log First Reading
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const dist = rec.distance_km > 0 ? rec.distance_km : (rec.end_reading > rec.start_reading ? rec.end_reading - rec.start_reading : 0);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Date & Time */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-200">{rec.date || formatDate(rec.created_at)}</div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          {rec.created_at ? formatDateTime(rec.created_at) : '-'}
                        </div>
                      </td>

                      {/* Truck */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs shadow-sm group-hover:bg-amber-500/15 transition-colors">
                            {rec.truck_plate || 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Driver */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700/80 text-slate-300 font-bold flex items-center justify-center text-[10px] shadow-inner">
                            {rec.driver_name ? rec.driver_name.charAt(0) : 'D'}
                          </div>
                          <span className="font-semibold text-slate-300">{rec.driver_name || 'Unassigned'}</span>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {renderSourceBadge(rec.source, rec.trip_number, rec.receipt_number)}
                      </td>

                      {/* Start Odometer */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-200">
                          {rec.start_reading ? `${formatNumber(rec.start_reading, 0)} km` : '-'}
                        </span>
                      </td>

                      {/* End Odometer */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {rec.end_reading > 0 ? (
                          <span className="font-mono font-bold text-emerald-400">
                            {formatNumber(rec.end_reading, 0)} km
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic font-medium">In progress...</span>
                        )}
                      </td>

                      {/* Distance */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {dist > 0 ? (
                          <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 shadow-sm">
                            +{formatNumber(dist, 0)} km
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Trip / Receipt # */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="space-y-1 text-[11px]">
                          {rec.trip_number && (
                            <div className="font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 inline-block">
                              TRIP: {rec.trip_number}
                            </div>
                          )}
                          {rec.receipt_number && (
                            <div className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 inline-block mt-1">
                              RCPT: {rec.receipt_number}
                            </div>
                          )}
                          {!rec.trip_number && !rec.receipt_number && (
                            <span className="text-slate-600 font-medium">-</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {rec.status === 'completed' || rec.end_reading > 0 ? (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                            <CheckCircle className="w-3 h-3" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                            <Clock className="w-3 h-3 animate-pulse" />
                            <span>In-Progress</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => openEditModal(rec)}
                            className="p-2 bg-slate-800 border border-slate-700 hover:border-slate-500 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-xl transition-all shadow-sm cursor-pointer"
                            title="Edit / Correct record"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(rec)}
                            className="p-2 bg-slate-800 border border-slate-700 hover:border-red-500/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl transition-all shadow-sm cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-3xl max-w-lg w-full p-7 space-y-6 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                  <Gauge className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-100 tracking-tight">
                    {editingRecord
                      ? t('odo_modal_edit_title', 'Edit Odometer Record')
                      : t('odo_modal_add_title', 'Log Manual Odometer Reading')}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                    {editingRecord
                      ? 'Correct odometer readings and adjust distances'
                      : 'Create manual odometer entry for audit or yard adjustment'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center space-x-3 text-xs text-red-400 font-bold shadow-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveRecord} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Truck selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {t('odo_select_truck', 'Truck *')}
                  </label>
                  <select
                    value={formData.truck_id}
                    onChange={(e) => setFormData({ ...formData, truck_id: e.target.value })}
                    required
                    disabled={!!editingRecord}
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-50 transition-colors shadow-inner"
                  >
                    <option value="">Select Truck</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.plate_number} - {t.model || t.type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Driver selection */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {t('odo_select_driver', 'Driver (Optional)')}
                  </label>
                  <select
                    value={formData.driver_id}
                    onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-100 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
                  >
                    <option value="">No Driver Assigned</option>
                    {drivers.map((d) => (
                      <option key={d.id || d.user_id} value={d.user_id || d.id}>
                        {d.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t('odo_date_label', 'Date *')}
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-100 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
                />
              </div>

              {/* Odometer Readings */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl relative shadow-inner">
                {/* Middle connector icon (visual only) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center z-10 hidden sm:flex shadow-sm">
                  <span className="text-[10px] text-slate-500">→</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">
                    {t('odo_start_reading_label', 'Start Odometer (KM) *')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 125000"
                    value={formData.start_reading}
                    onChange={(e) => setFormData({ ...formData, start_reading: e.target.value })}
                    required
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1.5">
                    {t('odo_end_reading_label', 'End Odometer (KM)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 125150"
                    value={formData.end_reading}
                    onChange={(e) => setFormData({ ...formData, end_reading: e.target.value })}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                  />
                </div>

                {/* Distance calculation preview */}
                {parseFloat(formData.start_reading) > 0 &&
                  parseFloat(formData.end_reading) >= parseFloat(formData.start_reading) && (
                    <div className="col-span-2 mt-2 pt-3 flex items-center justify-between text-xs border-t border-slate-700/50">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Calculated Distance</span>
                      <span className="font-mono font-black text-amber-400 text-base bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                        +{(parseFloat(formData.end_reading) - parseFloat(formData.start_reading)).toLocaleString()} km
                      </span>
                    </div>
                  )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {t('odo_notes_label', 'Notes / Justification')}
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Yard transfer odometer adjustment, trip correction..."
                  value={formData.start_notes}
                  onChange={(e) => setFormData({ ...formData, start_notes: e.target.value })}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-3 text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-5 border-t border-slate-800/80">
                {editingRecord ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteRecord(editingRecord);
                    }}
                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('delete_record', 'Delete Record')}</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>{editingRecord ? t('save_changes', 'Save Changes') : t('create_record', 'Record Entry')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {t('confirm_delete_odo', 'Delete Odometer Record?')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete this odometer reading for truck{' '}
                <strong className="text-amber-400 font-mono">{deleteTarget.plate}</strong>?
              </p>

              <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Date:</span>
                  <span className="font-semibold text-slate-200">{deleteTarget.date}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Start Reading:</span>
                  <span className="font-mono font-bold text-amber-400">{formatNumber(deleteTarget.start_reading, 0)} km</span>
                </div>
                {deleteTarget.end_reading > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>End Reading:</span>
                    <span className="font-mono font-bold text-emerald-400">{formatNumber(deleteTarget.end_reading, 0)} km</span>
                  </div>
                )}
                {deleteTarget.trip_number && (
                  <div className="flex justify-between text-slate-400">
                    <span>Associated Trip:</span>
                    <span className="font-mono font-bold text-blue-400">{deleteTarget.trip_number}</span>
                  </div>
                )}
                {deleteTarget.source && (
                  <div className="flex justify-between text-slate-400">
                    <span>Source:</span>
                    <span className="font-semibold text-slate-300 uppercase text-[10px]">{deleteTarget.source}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Removing this entry will adjust the odometer audit log for this truck.</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={deleting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{deleting ? 'Deleting...' : 'Yes, Delete Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
