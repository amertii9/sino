import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  X,
  FileText,
  User,
  Truck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Search,
  RefreshCw,
  Fuel,
  Wrench,
  Route,
  ShieldAlert,
  SlidersHorizontal,
  Plus,
  Coins,
  Check,
  RotateCcw,
  Tag
} from 'lucide-react';

const CATEGORIES = [
  {
    id: 'driver_allowance',
    label: '🪙 Driver Allowance / Per Diem',
    shortLabel: 'Allowance',
    icon: Coins,
    color: 'emerald',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    description: 'Driver stipends, food/lodging per diem, long-haul allowances, and dispatch bonuses'
  },
  {
    id: 'operational',
    label: '📝 General Operational Remark',
    shortLabel: 'Operational',
    icon: FileText,
    color: 'purple',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    description: 'Fleet remarks, administrative notes, dispatch schedules, and site handovers'
  },
  {
    id: 'fuel',
    label: '⛽ Fuel & Station Remark',
    shortLabel: 'Fuel',
    icon: Fuel,
    color: 'amber',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    description: 'Pump observations, receipt verification remarks, consumption anomalies'
  },
  {
    id: 'maintenance',
    label: '🔧 Maintenance & Repair Remark',
    shortLabel: 'Maintenance',
    icon: Wrench,
    color: 'orange',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    description: 'Vehicle conditions, urgent repair notes, tire checks, shop instructions'
  },
  {
    id: 'route',
    label: '🛣️ Route Delay & Road Incident',
    shortLabel: 'Route Incident',
    icon: Route,
    color: 'blue',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    description: 'Weighbridge waiting time, detours, road closures, traffic bottlenecks'
  },
  {
    id: 'safety',
    label: '⚠️ Safety & Compliance Notice',
    shortLabel: 'Safety',
    icon: ShieldAlert,
    color: 'rose',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    description: 'Driver safety violations, licensing notices, speed alerts, compliance warnings'
  }
];

const PRESETS_BY_CATEGORY = {
  driver_allowance: [
    'Overnight Trip Per Diem Stipend',
    'Food & Meal Daily Allowance',
    'Long-Haul Highway Stipend',
    'Quarry Loading Waiting Allowance',
    'Emergency Roadside Repair Allowance',
    'Driver Monthly Performance Bonus'
  ],
  operational: [
    'Shift Handover & Key Exchange',
    'Client Quarry Delivery Guideline',
    'Weekend Dispatch Schedule',
    'Quarry Gate Clearance Protocol'
  ],
  fuel: [
    'Fuel Station Receipt Discrepancy',
    'Reserve Yard Tank Refill Observation',
    'Abnormal Fuel Consumption Inspection',
    'Station Pump Calibration Check'
  ],
  maintenance: [
    'Brake System Immediate Inspection Due',
    'Tire Pressure & Wear Logged',
    'Engine Oil Top-up Required',
    '5,000 KM Periodic Service Reminder'
  ],
  route: [
    'Heavy Weighbridge Queue Delay (3+ hours)',
    'Road Construction Detour at Modjo',
    'Flooded Highway Section Caution',
    'Toll Plaza Scanner Delay'
  ],
  safety: [
    'Driver Speed Limit Adherence Notice',
    'Cabin Fire Extinguisher & First-Aid Check',
    'Driver Driving License Expiry Reminder',
    'Night Driving Safety Caution'
  ]
};

const ALLOWANCE_QUICK_AMOUNTS = [500, 1000, 1500, 2500, 5000];

export const RecordNotesView = () => {
  const { t } = useLanguage();
  const [mobileTab, setMobileTab] = useState('form'); // 'form' | 'history' (used on screens < lg)

  // Master Data
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [summary, setSummary] = useState({
    total_notes: 0,
    total_allowance_amount: 0,
    allowance_count: 0,
    operational_count: 0
  });

  // Form State
  const [category, setCategory] = useState('driver_allowance');
  const [title, setTitle] = useState('');
  const [driverId, setDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [truckId, setTruckId] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState('normal');
  const [syncExpense, setSyncExpense] = useState(false);
  const [content, setContent] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // History Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [historyCategory, setHistoryCategory] = useState('all');
  const [historyPeriod, setHistoryPeriod] = useState('all');

  useEffect(() => {
    loadMasterData();
    fetchNotesHistory();
  }, []);

  const loadMasterData = async () => {
    try {
      const [driversRes, trucksRes] = await Promise.all([
        api.get('/drivers').catch(() => []),
        api.get('/trucks').catch(() => [])
      ]);
      if (Array.isArray(driversRes)) setDrivers(driversRes);
      if (Array.isArray(trucksRes)) setTrucks(trucksRes);
    } catch (err) {
      console.error('Failed to load master data:', err);
    }
  };

  const fetchNotesHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/notes');
      if (res && res.notes) {
        setNotes(res.notes);
        if (res.summary) setSummary(res.summary);
      } else if (Array.isArray(res)) {
        setNotes(res);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDriverChange = (selectedDriverId) => {
    setDriverId(selectedDriverId);
    if (!selectedDriverId) {
      setDriverName('');
      return;
    }
    const foundDriver = drivers.find((d) => (d.id || d._id) === selectedDriverId);
    if (foundDriver) {
      setDriverName(foundDriver.full_name || '');
      if (foundDriver.assigned_truck_id) {
        setTruckId(foundDriver.assigned_truck_id);
        setTruckPlate(foundDriver.assigned_truck_plate || '');
      }
    }
  };

  const handleTruckChange = (selectedTruckId) => {
    setTruckId(selectedTruckId);
    if (!selectedTruckId || selectedTruckId === 'fleet') {
      setTruckPlate(selectedTruckId === 'fleet' ? 'All Fleet / General' : '');
      return;
    }
    const foundTruck = trucks.find((tr) => (tr.id || tr._id) === selectedTruckId);
    if (foundTruck) {
      setTruckPlate(foundTruck.plate_number || '');
    }
  };

  const handlePresetClick = (presetTitle) => {
    setTitle(presetTitle);
  };

  const handleQuickAmount = (val) => {
    setAmount((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + val).toString();
    });
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setContent('');
    setPriority('normal');
    setErrorMsg('');
    setSuccessMsg('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const [addingExpenseId, setAddingExpenseId] = useState(null);

  const handleSave = async (shouldAddToExpense) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!title.trim()) {
      setErrorMsg('Please enter a note title or select one of the quick suggestions below.');
      return;
    }

    const numAmount = parseFloat(amount) || 0;

    if (shouldAddToExpense && numAmount <= 0) {
      setErrorMsg('Please enter a valid amount of money (ETB) above 0 to add to company expenses.');
      return;
    }

    if (category === 'driver_allowance' && numAmount <= 0) {
      setErrorMsg('Please specify an allowance amount in ETB for this driver stipend.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        content: content.trim(),
        driver_id: driverId,
        driver_name: driverName,
        truck_id: truckId,
        truck_plate: truckPlate,
        amount: numAmount,
        date,
        priority,
        sync_expense: shouldAddToExpense
      };

      await api.post('/notes', payload);
      if (shouldAddToExpense && numAmount > 0) {
        setSuccessMsg(`Note recorded & ${numAmount.toLocaleString()} ETB added to company expenses!`);
      } else {
        setSuccessMsg('Note recorded successfully!');
      }

      await fetchNotesHistory();
      resetForm();

      // On mobile screens, automatically show the updated history tab
      if (window.innerWidth < 1024) {
        setMobileTab('history');
      }

      setTimeout(() => {
        setSuccessMsg('');
      }, 3500);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save operational note');
    } finally {
      setSubmitting(false);
    }
  };

  // Add to Expense Modal state for existing notes
  const [expenseModalNote, setExpenseModalNote] = useState(null);
  const [expenseModalAmount, setExpenseModalAmount] = useState('');
  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseModalError, setExpenseModalError] = useState('');

  const openExpenseModalForNote = (note) => {
    setExpenseModalNote(note);
    setExpenseModalAmount(note.amount > 0 ? String(note.amount) : '');
    setExpenseModalError('');
  };

  const closeExpenseModal = () => {
    setExpenseModalNote(null);
    setExpenseModalAmount('');
    setExpenseModalError('');
  };

  const handleConfirmAddToExpense = async () => {
    if (!expenseModalNote) return;
    const numAmount = parseFloat(expenseModalAmount);
    if (!numAmount || numAmount <= 0) {
      setExpenseModalError('Please enter a valid amount in ETB greater than 0.');
      return;
    }

    setAddingExpense(true);
    setExpenseModalError('');
    try {
      const noteId = expenseModalNote.id || expenseModalNote._id;
      await api.post(`/notes/${noteId}/add-to-expense`, { amount: numAmount });
      setSuccessMsg(`Successfully added ${numAmount.toLocaleString()} ETB to company operational expenses!`);
      closeExpenseModal();
      await fetchNotesHistory();
      setTimeout(() => {
        setSuccessMsg('');
      }, 4000);
    } catch (err) {
      console.error(err);
      setExpenseModalError(err.message || 'Failed to add note to expenses');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this recorded note? If linked to an expense, the expense ledger entry will also be removed.')) {
      return;
    }

    setDeletingId(noteId);
    try {
      await api.delete(`/notes/${noteId}`);
      await fetchNotesHistory();
    } catch (err) {
      alert('Failed to delete note: ' + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (historyCategory !== 'all' && n.category !== historyCategory) {
        return false;
      }

      if (historyPeriod !== 'all') {
        const todayStr = new Date().toISOString().split('T')[0];
        const noteDate = n.date || (n.created_at ? n.created_at.split('T')[0] : '');

        if (historyPeriod === 'today' && noteDate !== todayStr) return false;
        if (historyPeriod === 'yesterday') {
          const yest = new Date();
          yest.setDate(yest.getDate() - 1);
          if (noteDate !== yest.toISOString().split('T')[0]) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (n.title || '').toLowerCase().includes(q);
        const matchesContent = (n.content || '').toLowerCase().includes(q);
        const matchesDriver = (n.driver_name || '').toLowerCase().includes(q);
        const matchesTruck = (n.truck_plate || '').toLowerCase().includes(q);
        const matchesNum = (n.note_number || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent && !matchesDriver && !matchesTruck && !matchesNum) {
          return false;
        }
      }

      return true;
    });
  }, [notes, historyCategory, historyPeriod, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 rounded-3xl border border-amber-500/20 dark:border-amber-500/10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold shadow-lg shadow-amber-500/20 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('record_note_title', 'Operational Notes & Driver Allowances')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {t('record_note_page_sub', 'Record driver per diem allowances, fleet dispatch remarks, road delays, and vehicle maintenance notes in a single centralized ledger.')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchNotesHistory}
          disabled={loadingHistory}
          className="self-start sm:self-auto px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-amber-500' : ''}`} />
          <span>{t('refresh_records', 'Refresh Records')}</span>
        </button>
      </div>

      {/* Mobile / Tablet Tab Switcher (Visible on < lg) */}
      <div className="lg:hidden flex items-center p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'form'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('tab_record_note', '✍️ Record Note')}</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('history')}
          className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'history'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t('tab_notes_history', '📋 Notes & Allowances')}</span>
          {notes.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-900/20 text-slate-950 text-[10px] font-extrabold">
              {notes.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Record Note Form (Always visible on lg+, or when mobileTab === 'form' on small) */}
        <div className={`lg:col-span-5 ${mobileTab === 'history' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm sticky top-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t('record_new_operational_note', 'Record New Note')}
                </h2>
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(parseFloat(amount) > 0); }} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* 1. Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {t('select_note_category', 'Category / Purpose:')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategory(cat.id);
                          if (cat.id !== 'driver_allowance' && !amount) {
                            setSyncExpense(false);
                          } else if (cat.id === 'driver_allowance') {
                            setSyncExpense(true);
                          }
                        }}
                        className={`p-2.5 rounded-2xl border text-left flex items-start gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 ring-2 ring-amber-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${isSelected ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>
                            {cat.shortLabel}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {cat.id === 'driver_allowance' ? 'Per diem / stipend' : cat.shortLabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Driver & Truck Linkage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                {/* Driver */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('driver_concerned', 'Driver:')}</span>
                  </label>
                  <select
                    value={driverId}
                    onChange={(e) => handleDriverChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="">{t('select_driver_none', '-- None / General Note --')}</option>
                    {drivers.map((d) => (
                      <option key={d.id || d._id} value={d.id || d._id}>
                        {d.full_name} {d.assigned_truck_plate ? `(${d.assigned_truck_plate})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Truck */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{t('truck_concerned', 'Truck:')}</span>
                  </label>
                  <select
                    value={truckId}
                    onChange={(e) => handleTruckChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="">{t('select_truck_none', '-- Not Truck Specific --')}</option>
                    <option value="fleet">{t('all_fleet_option', '🏢 All Fleet / Overhead')}</option>
                    {trucks.map((tr) => (
                      <option key={tr.id || tr._id} value={tr.id || tr._id}>
                        {tr.plate_number} {tr.model ? `(${tr.model})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Allowance Amount & Presets */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                category === 'driver_allowance'
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
              }`}>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Coins className={`w-3.5 h-3.5 ${category === 'driver_allowance' ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span>
                      {category === 'driver_allowance'
                        ? t('allowance_amount_etb', 'Allowance Amount (ETB) *')
                        : t('optional_amount_etb', 'Associated Amount (ETB)')}
                    </span>
                  </label>

                  {amount && (
                    <button
                      type="button"
                      onClick={() => setAmount('')}
                      className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="relative mb-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00 ETB"
                    className="w-full pl-3 pr-16 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                    ETB
                  </span>
                </div>

                {/* Quick Add Presets */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Quick Add:</span>
                  {ALLOWANCE_QUICK_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAmount(val)}
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-all cursor-pointer"
                    >
                      +{val.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Ledger Sync Checkbox */}
                {parseFloat(amount) > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="syncExpenseCheckPage"
                      checked={syncExpense}
                      onChange={(e) => setSyncExpense(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <label htmlFor="syncExpenseCheckPage" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                      <span className="font-bold text-slate-800 dark:text-white">
                        {t('sync_expense_label', '✅ Also record in Company Operational Expenses')}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Automatically debits under &ldquo;Driver Advance / Allowance&rdquo; in financial reports.
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* 4. Title / Purpose */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('note_title_purpose', 'Title / Reason / Purpose:')} *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    category === 'driver_allowance'
                      ? 'e.g. Overnight Food & Lodging Stipend'
                      : 'e.g. Quarry Loading Delay Notice'
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />

                {/* Presets Chips */}
                {PRESETS_BY_CATEGORY[category] && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {PRESETS_BY_CATEGORY[category].slice(0, 4).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                          title === preset
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-400'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Date & Priority */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('date', 'Date:')}</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('priority', 'Priority:')}</span>
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="normal">{t('priority_normal', '🟢 Normal')}</option>
                    <option value="high">{t('priority_high', '🟡 High')}</option>
                    <option value="urgent">{t('priority_urgent', '🔴 Urgent')}</option>
                  </select>
                </div>
              </div>

              {/* 6. Content Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('detailed_notes', 'Note Details & Administrative Remarks:')}
                </label>
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter any context, transit stops, approval notes, or driver instructions..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                />
              </div>

              {/* Action Buttons: Record Note (Save Note Only) by default */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSave(false)}
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Recording Note...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>📝 Record Note (Save Note Only)</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center font-medium leading-relaxed">
                  Recorded notes are kept for administrative records and are <strong>not added to expenses by default</strong>. They are only added to expenses when added manually or submitted by the driver.
                </p>

                {parseFloat(amount) > 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSave(true)}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span>💳 Manually Add {parseFloat(amount).toLocaleString()} ETB to Expense Now</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Summary KPI Cards + Filter Bar + Notes Stream (Always visible on lg+, or when mobileTab === 'history' on small) */}
        <div className={`lg:col-span-7 space-y-4 ${mobileTab === 'form' ? 'hidden lg:block' : 'block'}`}>
          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('total_notes', 'Total Notes')}</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{summary.total_notes}</div>
            </div>

            <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {t('total_allowances_paid', 'Allowances Paid')}
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {formatCurrency(summary.total_allowance_amount)}
              </div>
            </div>

            <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {t('allowances_count', 'Allowances')}
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{summary.allowance_count}</div>
            </div>

            <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {t('operational_count', 'Operational')}
              </div>
              <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{summary.operational_count}</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_notes_ph', 'Search note #, driver, truck, or description...')}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* Category filter */}
            <select
              value={historyCategory}
              onChange={(e) => setHistoryCategory(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="all">{t('all_categories', 'All Categories')}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.shortLabel}
                </option>
              ))}
            </select>

            {/* Period filter */}
            <select
              value={historyPeriod}
              onChange={(e) => setHistoryPeriod(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="all">{t('all_time', 'All Time')}</option>
              <option value="today">{t('today', 'Today')}</option>
              <option value="yesterday">{t('yesterday', 'Yesterday')}</option>
            </select>
          </div>

          {/* Notes Card Stream */}
          {loadingHistory ? (
            <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              <span>Loading recorded operational notes...</span>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                {notes.length === 0 ? 'No operational notes or driver allowances recorded yet' : 'No notes match your filters'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {notes.length === 0
                  ? 'Use the form on the left to record driver allowances, route delays, maintenance notes, or fuel remarks.'
                  : 'Try clearing your search keyword or switching category to "All Categories".'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => {
                const catObj = CATEGORIES.find((c) => c.id === note.category) || CATEGORIES[1];
                const CatIcon = catObj.icon;
                const isDeleting = deletingId === (note.id || note._id);

                return (
                  <div
                    key={note.id || note._id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${catObj.badgeClass}`}>
                          <CatIcon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          {/* Tags row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${catObj.badgeClass}`}>
                              {catObj.shortLabel}
                            </span>

                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              {note.note_number || 'NT'} • {formatDate(note.date || note.created_at)}
                            </span>

                            {note.priority === 'urgent' && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400">
                                URGENT
                              </span>
                            )}
                            {note.priority === 'high' && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                HIGH
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                            {note.title}
                          </h3>

                          {/* Remarks */}
                          {note.content && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                              {note.content}
                            </p>
                          )}

                          {/* Detail Badges */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {note.driver_name && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <User className="w-3 h-3 text-amber-500" />
                                <span>{note.driver_name}</span>
                              </span>
                            )}

                            {note.truck_plate && note.truck_plate !== 'fleet' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Truck className="w-3 h-3 text-indigo-500" />
                                <span>{note.truck_plate}</span>
                              </span>
                            )}

                            {note.linked_expense_id && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <Coins className="w-3 h-3" />
                                <span>Synced to Financial Expenses</span>
                              </span>
                            )}

                            {note.recorded_by && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                By: {note.recorded_by}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {note.amount > 0 && (
                          <div className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-black flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5" />
                            <span>{formatCurrency(note.amount)}</span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => openExpenseModalForNote(note)}
                          className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-[11px] sm:text-xs font-black flex items-center gap-1.5 shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
                          title="Add this note to company operational expenses"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Add to Expense</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id || note._id)}
                          disabled={isDeleting}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Add To Expense Modal for Recorded Notes */}
      {expenseModalNote && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 relative">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Add Note to Expense
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Disburse amount to company operational expenses
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeExpenseModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Note context summary card */}
            <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-500">{expenseModalNote.note_number || 'NT'}</span>
                <span className="text-slate-400 font-medium">{formatDate(expenseModalNote.date || expenseModalNote.created_at)}</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-white">
                {expenseModalNote.title}
              </p>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] flex-wrap">
                {expenseModalNote.driver_name && (
                  <span>Driver: <strong className="text-slate-700 dark:text-slate-200">{expenseModalNote.driver_name}</strong></span>
                )}
                {expenseModalNote.truck_plate && (
                  <span>Truck: <strong className="text-slate-700 dark:text-slate-200">{expenseModalNote.truck_plate}</strong></span>
                )}
              </div>
              {expenseModalNote.linked_expense_id && (
                <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                  ℹ️ Note already synced previously. Adding again will record an additional expense transaction.
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Expense Amount to Record (ETB) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500 font-bold text-xs flex items-center gap-1">
                  <Coins className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={expenseModalAmount}
                  onChange={(e) => setExpenseModalAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full pl-10 pr-16 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  autoFocus
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                  ETB
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-bold text-slate-400">Quick:</span>
                {[500, 1000, 1500, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setExpenseModalAmount(amt.toString())}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg text-[10px] font-extrabold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    +{amt.toLocaleString()} ETB
                  </button>
                ))}
              </div>
            </div>

            {expenseModalError && (
              <div className="mt-3 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{expenseModalError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeExpenseModal}
                disabled={addingExpense}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmAddToExpense}
                disabled={addingExpense}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {addingExpense ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Adding to Expenses...</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    <span>Confirm & Add to Expense</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
