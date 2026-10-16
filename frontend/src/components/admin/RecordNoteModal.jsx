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
  Check
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

export const RecordNoteModal = ({ isOpen, onClose, onNoteSaved }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'history'

  // Data lists
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [summary, setSummary] = useState({
    total_notes: 0,
    total_allowance_amount: 0,
    allowance_count: 0,
    operational_count: 0
  });

  // Form state
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

  // Load drivers & trucks on mount
  useEffect(() => {
    if (!isOpen) return;

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

    loadMasterData();
    fetchNotesHistory();
  }, [isOpen]);

  // Fetch notes history
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

  // When driver is selected, auto-select their assigned truck
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

  // When truck is selected
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

  // Quick preset title selection
  const handlePresetClick = (presetTitle) => {
    setTitle(presetTitle);
  };

  // Quick amount adder
  const handleQuickAmount = (val) => {
    setAmount((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + val).toString();
    });
  };

  // Reset form
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
      if (onNoteSaved) onNoteSaved();

      setTimeout(() => {
        resetForm();
        setSuccessMsg('');
        setActiveTab('history');
      }, 1200);
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
      if (onNoteSaved) onNoteSaved();
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

  // Delete note
  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this recorded note? If linked to an expense, the expense ledger entry will also be removed.')) {
      return;
    }

    setDeletingId(noteId);
    try {
      await api.delete(`/notes/${noteId}`);
      await fetchNotesHistory();
      if (onNoteSaved) onNoteSaved();
    } catch (err) {
      alert('Failed to delete note: ' + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered notes for history tab
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // Category filter
      if (historyCategory !== 'all' && n.category !== historyCategory) {
        return false;
      }

      // Period filter
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

      // Search query
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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden transition-all duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-transparent to-indigo-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t('record_note_title', 'Operational Notes & Driver Allowances')}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('record_note_sub', 'Record driver per diem allowances, fleet dispatch remarks, road delays, and maintenance notes.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={() => setActiveTab('record')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'record'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('tab_record_note', '✍️ Record New Note')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              fetchNotesHistory();
            }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('tab_notes_history', '📋 Notes & Allowances History')}</span>
            {notes.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold">
                {notes.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* TAB 1: RECORD NEW NOTE */}
          {activeTab === 'record' && (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(parseFloat(amount) > 0); }} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 animate-shake">
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
                  {t('select_note_category', 'Note Category / Purpose:')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        className={`p-2.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 ring-2 ring-amber-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
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
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1">
                            {cat.id === 'driver_allowance' ? 'Per diem & cash' : cat.shortLabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Driver & Truck Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                {/* Driver select */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('driver_concerned', 'Driver (Optional / Allowance Recipient):')}</span>
                  </label>
                  <select
                    value={driverId}
                    onChange={(e) => handleDriverChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="">{t('select_driver_none', '-- None / General Note --')}</option>
                    {drivers.map((d) => (
                      <option key={d.id || d._id} value={d.id || d._id}>
                        {d.full_name} {d.assigned_truck_plate ? `(${d.assigned_truck_plate})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Truck select */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{t('truck_concerned', 'Truck Vehicle (Optional):')}</span>
                  </label>
                  <select
                    value={truckId}
                    onChange={(e) => handleTruckChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="">{t('select_truck_none', '-- Not Truck Specific --')}</option>
                    <option value="fleet">{t('all_fleet_option', '🏢 All Fleet / Fleet Overhead')}</option>
                    {trucks.map((tr) => (
                      <option key={tr.id || tr._id} value={tr.id || tr._id}>
                        {tr.plate_number} {tr.model ? `(${tr.model})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Driver Allowance Amount & Quick Presets (Highlighted when driver_allowance) */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                category === 'driver_allowance'
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Coins className={`w-4 h-4 ${category === 'driver_allowance' ? 'text-emerald-500' : 'text-slate-400'}`} />
                    <span>
                      {category === 'driver_allowance'
                        ? t('allowance_amount_etb', 'Allowance Amount (ETB) - Required for Stipends:')
                        : t('optional_amount_etb', 'Associated Amount (ETB) - Optional:')}
                    </span>
                  </label>

                  {/* Quick amount adder buttons */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">{t('quick_add', 'Quick Add:')}</span>
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
                    {amount && (
                      <button
                        type="button"
                        onClick={() => setAmount('')}
                        className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00 ETB"
                    className="w-full pl-3 pr-16 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                    ETB
                  </span>
                </div>

                {/* Ledger Sync Checkbox */}
                {parseFloat(amount) > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="syncExpenseCheck"
                      checked={syncExpense}
                      onChange={(e) => setSyncExpense(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <label htmlFor="syncExpenseCheck" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                      <span className="font-bold text-slate-800 dark:text-white">
                        {t('sync_expense_label', '✅ Also record in Company Operational Expenses (Financial Reports)')}
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {t('sync_expense_help', 'Automatically debits this allowance under "Driver Advance / Allowance" so financial & profit reports accurately deduct the disbursement.')}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* 4. Title & Purpose Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>{t('note_title_purpose', 'Title / Reason / Purpose:')} *</span>
                  <span className="text-[10px] text-slate-400">{t('click_preset_to_fill', 'Click a quick preset to auto-fill')}</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    category === 'driver_allowance'
                      ? 'e.g. Overnight Food & Lodging Allowance - Modjo to Awash'
                      : 'e.g. Tire Pressure and Rim Check Notice'
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />

                {/* Preset Chips */}
                {PRESETS_BY_CATEGORY[category] && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PRESETS_BY_CATEGORY[category].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                          title === preset
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Date & Priority Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('date', 'Date:')}</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('priority', 'Priority Level:')}</span>
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="normal">{t('priority_normal', '🟢 Normal Priority')}</option>
                    <option value="high">{t('priority_high', '🟡 High Priority')}</option>
                    <option value="urgent">{t('priority_urgent', '🔴 Urgent Attention')}</option>
                  </select>
                </div>
              </div>

              {/* 6. Detailed Notes / Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('detailed_notes', 'Note Details & Administrative Remarks:')}
                </label>
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    category === 'driver_allowance'
                      ? 'Add any details like route destination, hotel stipend, trip number, approval note, or special instructions...'
                      : 'Record detailed operational remarks, conditions observed, responsible personnel...'
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-normal text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                />
              </div>

              {/* Action Buttons: Cancel, Record Note (Save Note Only), Optional Manual Add to Expense */}
              <div className="pt-2 space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {t('cancel', 'Cancel')}
                  </button>

                  {parseFloat(amount) > 0 && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSave(true)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      <span>💳 Manually Add {parseFloat(amount).toLocaleString()} ETB to Expense</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSave(false)}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center font-medium">
                  Recorded notes are kept for administrative records and are <strong>not added to expenses by default</strong>. They are only added to expenses when added manually or submitted by the driver.
                </p>
              </div>
            </form>
          )}

          {/* TAB 2: NOTES & ALLOWANCES HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('total_notes', 'Total Notes')}</div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">{summary.total_notes}</div>
                </div>

                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {t('total_allowances_paid', 'Allowances Paid')}
                  </div>
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(summary.total_allowance_amount)}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    {t('allowances_count', 'Allowance Records')}
                  </div>
                  <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{summary.allowance_count}</div>
                </div>

                <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                  <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    {t('operational_count', 'Operational Remarks')}
                  </div>
                  <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">{summary.operational_count}</div>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search_notes_ph', 'Search note #, driver, truck, or description...')}
                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* Category filter */}
                <select
                  value={historyCategory}
                  onChange={(e) => setHistoryCategory(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  <option value="all">{t('all_time', 'All Time')}</option>
                  <option value="today">{t('today', 'Today')}</option>
                  <option value="yesterday">{t('yesterday', 'Yesterday')}</option>
                </select>

                <button
                  type="button"
                  onClick={fetchNotesHistory}
                  disabled={loadingHistory}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Refresh Notes"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Notes List */}
              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Loading recorded notes...</span>
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {notes.length === 0 ? 'No operational notes or driver allowances recorded yet.' : 'No notes match your active search / filters.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('record')}
                    className="mt-3 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 text-xs font-extrabold transition-all cursor-pointer"
                  >
                    + Record First Note
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredNotes.map((note) => {
                    const catObj = CATEGORIES.find((c) => c.id === note.category) || CATEGORIES[1];
                    const CatIcon = catObj.icon;
                    const isDeleting = deletingId === (note.id || note._id);

                    return (
                      <div
                        key={note.id || note._id}
                        className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {/* Category Icon */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${catObj.badgeClass}`}>
                              <CatIcon className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
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

                              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                                {note.title}
                              </h3>

                              {note.content && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">
                                  {note.content}
                                </p>
                              )}

                              {/* Details tags */}
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
                                    <span>Synced to Expenses</span>
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

                          {/* Right Amount & Actions */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {note.amount > 0 && (
                              <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-extrabold flex items-center gap-1.5">
                                <Coins className="w-3.5 h-3.5" />
                                <span>{formatCurrency(note.amount)}</span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => openExpenseModalForNote(note)}
                              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap"
                              title="Add this note to company operational expenses"
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>Add to Expense</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id || note._id)}
                              disabled={isDeleting}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Add To Expense Modal for Recorded Notes in Modal */}
      {expenseModalNote && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
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
