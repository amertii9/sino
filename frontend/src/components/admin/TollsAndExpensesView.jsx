import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  Coins,
  Plus,
  Trash2,
  Edit,
  Save,
  CheckCircle2,
  Smartphone,
  Receipt,
  Scale,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Info,
  Car,
  FileText,
  RotateCcw
} from 'lucide-react';

const CATEGORY_META = {
  toll: { label: 'Toll Expressway', icon: '🛣️', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  weighbridge: { label: 'Weighbridge / Scale', icon: '⚖️', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  gate_fee: { label: 'Gate / Yard Pass', icon: '🚪', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  gate_pass: { label: 'Gate / Yard Pass', icon: '🚪', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  parking: { label: 'Parking / Staging', icon: '🅿️', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  escort: { label: 'Escort / Security', icon: '🛡️', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  other: { label: 'Other Fee', icon: '🏷️', color: 'bg-slate-700/50 text-slate-300 border-slate-600' },
};

const DEFAULT_PRESETS = [
  { name: 'Modjo Expressway Toll', amount: 150, fee_type: 'toll' },
  { name: 'Adama Expressway Toll', amount: 200, fee_type: 'toll' },
  { name: 'Awash Toll Gate', amount: 220, fee_type: 'toll' },
  { name: 'Weighbridge / Scale', amount: 100, fee_type: 'weighbridge' },
  { name: 'Parking / Staging', amount: 50, fee_type: 'parking' },
  { name: 'Gate / Yard Pass', amount: 100, fee_type: 'gate_fee' },
];

export const TollsAndExpensesView = () => {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('suggestions'); // 'suggestions' | 'recorded'
  const [suggestions, setSuggestions] = useState([]);
  const [recordedExpenses, setRecordedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Add / Edit Modal state
  const [editModal, setEditModal] = useState({
    isOpen: false,
    index: null, // null for new, number for edit
    name: '',
    amount: '',
    fee_type: 'toll',
  });

  // Simulated mobile testing input
  const [simulatedDriverAmount, setSimulatedDriverAmount] = useState('');
  const [simulatedDriverFees, setSimulatedDriverFees] = useState([]);

  // Fetch settings & expenses
  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [settingsRes, expRes] = await Promise.all([
        api.get('/settings'),
        api.get('/expenses').catch(() => []),
      ]);

      if (settingsRes?.fee_suggestions && Array.isArray(settingsRes.fee_suggestions) && settingsRes.fee_suggestions.length > 0) {
        setSuggestions(settingsRes.fee_suggestions);
      } else {
        setSuggestions(DEFAULT_PRESETS);
      }

      // Filter trip expenses
      const tripFees = (expRes || []).filter(e => 
        e.trip_id || e.trip_number || ['toll', 'weighbridge', 'gate_fee', 'parking'].includes(e.expense_type)
      );
      setRecordedExpenses(tripFees);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load data: ' + (err.message || 'Server error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save suggestions to backend
  const handleSaveToDriverApp = async (newList) => {
    const listToSave = newList || suggestions;
    setSaving(true);
    setErrorMsg('');
    setSavedSuccess(false);

    try {
      const sanitized = listToSave
        .filter(s => s.name && s.name.trim() !== '' && parseFloat(s.amount) > 0)
        .map(s => ({
          name: s.name.trim(),
          amount: parseFloat(s.amount) || 0,
          fee_type: s.fee_type || 'other',
        }));

      // Update backend via dedicated fee-suggestions endpoint or settings
      try {
        await api.put('/settings/fee-suggestions', { fee_suggestions: sanitized });
      } catch (patchErr) {
        // Fallback to /settings
        await api.put('/settings', { fee_suggestions: sanitized });
      }

      setSuggestions(sanitized);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error saving suggestions: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditModal({
      isOpen: true,
      index: null,
      name: '',
      amount: '',
      fee_type: 'toll',
    });
  };

  // Open modal for editing
  const handleOpenEdit = (index) => {
    const item = suggestions[index];
    if (!item) return;
    setEditModal({
      isOpen: true,
      index,
      name: item.name,
      amount: item.amount,
      fee_type: item.fee_type || 'toll',
    });
  };

  // Save single item from modal
  const handleSaveModalItem = (e) => {
    e.preventDefault();
    if (!editModal.name.trim() || !editModal.amount || parseFloat(editModal.amount) <= 0) {
      alert(t('enter_valid_suggestion_amount', 'Please enter a valid suggestion name and amount.'));
      return;
    }

    const newItem = {
      name: editModal.name.trim(),
      amount: parseFloat(editModal.amount),
      fee_type: editModal.fee_type,
    };

    let updated = [...suggestions];
    if (editModal.index !== null) {
      updated[editModal.index] = newItem;
    } else {
      updated.push(newItem);
    }

    setSuggestions(updated);
    setEditModal({ isOpen: false, index: null, name: '', amount: '', fee_type: 'toll' });
    handleSaveToDriverApp(updated);
  };

  // Remove a suggestion
  const handleRemove = (index) => {
    const item = suggestions[index];
    if (window.confirm(t('remove_suggestion', 'Remove suggestion') + `?`)) {
      const updated = suggestions.filter((_, i) => i !== index);
      setSuggestions(updated);
      handleSaveToDriverApp(updated);
    }
  };

  // Move suggestion up/down
  const handleMove = (index, direction) => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= suggestions.length) return;
    const copy = [...suggestions];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;
    setSuggestions(copy);
    handleSaveToDriverApp(copy);
  };

  // Restore defaults
  const handleResetDefaults = () => {
    if (window.confirm(t('reset_suggestions_factory', 'Reset suggestions to system default presets?'))) {
      setSuggestions(DEFAULT_PRESETS);
      handleSaveToDriverApp(DEFAULT_PRESETS);
    }
  };

  // Driver Simulation: simulate clicking suggestion
  const handleSimulateClick = (sug) => {
    if (!simulatedDriverAmount || parseFloat(simulatedDriverAmount) === 0) {
      setSimulatedDriverAmount(sug.amount);
      setSimulatedDriverFees([{ name: sug.name, amount: sug.amount }]);
    } else {
      setSimulatedDriverFees(prev => [...prev, { name: sug.name, amount: sug.amount }]);
    }
  };

  const simulatedTotalFees = simulatedDriverFees.reduce((acc, f) => acc + (parseFloat(f.amount) || 0), 0) + (parseFloat(simulatedDriverAmount) || 0);

  // Stats calculation
  const tollCount = suggestions.filter(s => s.fee_type === 'toll').length;
  const weighbridgeCount = suggestions.filter(s => s.fee_type === 'weighbridge').length;
  const otherCount = suggestions.length - tollCount - weighbridgeCount;
  const totalRecordedAmount = recordedExpenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 shadow-inner">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                {t('tolls_title', 'Tolls & Driver Expense Suggestions')}
              </h1>
              <p className="text-xs text-slate-400">
                {t('tolls_sub', 'Configure 1-tap fee suggestions for drivers during trip logging (tolls, weighbridges, gate passes) & monitor trip expenses')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Reload Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t('tolls_add_btn', '+ Add Suggestion')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('tolls_active_sug', 'Active Suggestions')}</div>
          <div className="text-2xl font-black text-white mt-1">{suggestions.length}</div>
          <div className="text-[11px] text-amber-400 font-semibold mt-0.5">{t('live_on_driver_app', 'Live on Driver App')}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('tolls_expressway', 'Expressway Tolls')}</div>
          <div className="text-2xl font-black text-blue-400 mt-1">{tollCount}</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">{t('ph_tolls_cities_example', 'Modjo, Adama, Awash')}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('tolls_weighbridge_gates', 'Weighbridge & Gates')}</div>
          <div className="text-2xl font-black text-purple-400 mt-1">{weighbridgeCount + otherCount}</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">{t('scales_passes_sub', 'Scales & Yard Passes')}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('tolls_trip_fees_rec', 'Trip Fees Recorded')}</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{formatCurrency(totalRecordedAmount)}</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">{recordedExpenses.length} {t('trip_fee_entries', 'trip fee entries')}</div>
        </div>
      </div>

      {/* Success / Error Banners */}
      {savedSuccess && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs rounded-2xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-bold">{t('suggestions_saved_success', 'Suggestions saved successfully! Drivers will immediately see these presets on their trip entry screen.')}</span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full font-bold">{t('live_synced', 'Live Synced')}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs rounded-2xl flex items-center space-x-2">
          <Info className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-800 space-x-6">
        <button
          onClick={() => setActiveSubTab('suggestions')}
          className={`pb-3 text-xs font-bold transition flex items-center space-x-2 ${
            activeSubTab === 'suggestions'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('tolls_driver_sug_tab', 'Driver Fee Suggestions')} ({suggestions.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('recorded')}
          className={`pb-3 text-xs font-bold transition flex items-center space-x-2 ${
            activeSubTab === 'recorded'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{t('tolls_recorded_tab', 'Recorded Trip Tolls & Expenses')} ({recordedExpenses.length})</span>
        </button>
      </div>

      {/* TAB 1: SUGGESTIONS MANAGER */}
      {activeSubTab === 'suggestions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Suggestion List & Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Manage Driver Suggestions
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Add, edit, reorder or remove the suggestions that appear on the driver's phone
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleResetDefaults}
                    className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold border border-slate-700 transition"
                    title="Reset to default presets"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t('defaults_badge', 'Defaults')}</span>
                  </button>
                  <button
                    onClick={() => handleSaveToDriverApp()}
                    disabled={saving}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? t('saving', 'Saving...') : t('save_all', 'Save All')}</span>
                  </button>
                </div>
              </div>

              {/* Suggestions Cards List */}
              <div className="space-y-2.5">
                {suggestions.map((sug, index) => {
                  const meta = CATEGORY_META[sug.fee_type] || CATEGORY_META.other;
                  return (
                    <div
                      key={index}
                      className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex items-center justify-between hover:border-amber-500/40 transition group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Drag / Move Handles */}
                        <div className="flex flex-col space-y-0.5 text-slate-600">
                          <button
                            onClick={() => handleMove(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-slate-600 cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMove(index, 'down')}
                            disabled={index === suggestions.length - 1}
                            className="p-0.5 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-slate-600 cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Category Icon */}
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0">
                          {meta.icon}
                        </div>

                        {/* Info */}
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white truncate">{sug.name}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-amber-400 font-bold mt-0.5">
                            {formatCurrency(sug.amount)}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(index)}
                          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition cursor-pointer"
                          title="Edit suggestion"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemove(index)}
                          className="p-2 bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-medium transition cursor-pointer"
                          title="Delete suggestion"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {suggestions.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No suggestions configured yet. Click "+ Add Suggestion" or "Defaults" above to add presets.
                  </div>
                )}
              </div>

              {/* Bottom Quick Add trigger */}
              <button
                onClick={handleOpenAdd}
                className="w-full py-2.5 border border-dashed border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/5 text-slate-400 hover:text-amber-400 rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('add_another_suggestion', 'Add Another Driver Suggestion')}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Driver Phone Simulation (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 sticky top-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">{t('driver_phone_simulation', 'Driver Phone Simulation')}</h3>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  {t('step_7_additional_fees', 'Step 7: Additional Fees')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t('interactive_preview_sub', 'Interactive preview showing exactly how the driver experiences this step on mobile. Tap any suggestion below to test it!')}
              </p>

              {/* Simulated Phone Screen */}
              <div className="bg-slate-800/80 border-2 border-slate-700/80 rounded-2xl p-4 space-y-4 shadow-lg">
                {/* Header calculation preview */}
                <div className="p-3 bg-slate-900 border border-slate-700/80 rounded-xl text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>{t('gross_hauling_colon', 'Gross Hauling:')}</span>
                    <span className="font-bold text-white">10,000.00 ETB</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>{t('fees_deducted_colon', 'Fees Deducted:')}</span>
                    <span className="font-bold">- {formatCurrency(simulatedTotalFees)}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-700/80 flex justify-between font-bold text-amber-400">
                    <span>{t('driver_net_pay_label', 'Driver Net Pay:')}</span>
                    <span>{formatCurrency(Math.max(0, 10000 - simulatedTotalFees))}</span>
                  </div>
                </div>

                {/* 1 Single Money Space */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Enter Additional Fee Amount (ETB):
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        placeholder="0.00 ETB"
                        value={simulatedDriverAmount}
                        onChange={(e) => setSimulatedDriverAmount(e.target.value)}
                        className="w-full py-2.5 px-3 bg-slate-900 border border-amber-500/40 rounded-xl text-white font-black text-sm"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (simulatedDriverAmount) {
                          setSimulatedDriverFees(prev => [...prev, { name: 'Extra Fee', amount: simulatedDriverAmount }]);
                          setSimulatedDriverAmount('');
                        }
                      }}
                      className="px-3 py-2.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                      title="Add more fee lines"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{t('add', 'Add')}</span>
                    </button>
                  </div>
                </div>

                {/* Suggestions Below the Space */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-amber-400/90 tracking-wider mb-2 flex items-center justify-between">
                    <span>💡 Suggestions Set by Admin (Tap to Add):</span>
                    {simulatedDriverFees.length > 0 && (
                      <button
                        onClick={() => { setSimulatedDriverAmount(''); setSimulatedDriverFees([]); }}
                        className="text-slate-500 hover:text-slate-300 normal-case font-normal"
                      >
                        Reset Demo
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((sug, i) => {
                      const meta = CATEGORY_META[sug.fee_type] || CATEGORY_META.other;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSimulateClick(sug)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 rounded-xl text-[11px] font-semibold text-slate-200 hover:text-white transition flex items-center space-x-1.5 active:scale-95 cursor-pointer shadow-sm"
                        >
                          <span>{meta.icon}</span>
                          <span>{sug.name}</span>
                          <span className="text-amber-400 font-bold">+{sug.amount} ETB</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-300/90 leading-relaxed">
                <strong>{t('why_simple_drivers', 'Why this is simple for drivers:')}</strong>
                <p className="mt-1 text-slate-300">
                  {t('driver_preset_simplicity_desc', 'Drivers tap any suggestion preset to populate the amount in 1 touch without typing. All submitted fees are automatically deducted from their trip pay and sent to the admin dashboard under Other Expenses.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECORDED TRIP TOLLS & EXPENSES */}
      {activeSubTab === 'recorded' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              {t('recorded_trip_tolls_fees', 'Recorded Trip Tolls & Additional Fees')}
            </h3>
            <p className="text-[11px] text-slate-400">
              {t('audit_log_fees_sub', 'Audit log of all additional fees and expressway tolls entered by drivers across all completed hauling trips')}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-700/80">
                <tr>
                  <th className="py-3 px-4 font-bold">{t('date_field_colon', 'Date')}</th>
                  <th className="py-3 px-4 font-bold">{t('trip_no_col_header', 'Trip No.')}</th>
                  <th className="py-3 px-4 font-bold">{t('truck_plate_field_label', 'Truck Plate')}</th>
                  <th className="py-3 px-4 font-bold">{t('driver_field_colon', 'Driver')}</th>
                  <th className="py-3 px-4 font-bold">{t('fee_type_col_header', 'Fee Type')}</th>
                  <th className="py-3 px-4 font-bold">{t('receipt_ref_col_header', 'Receipt / Ref')}</th>
                  <th className="py-3 px-4 font-bold text-right">{t('amount_etb_field', 'Amount (ETB)')}</th>
                  <th className="py-3 px-4 font-bold text-center">{t('status', 'Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recordedExpenses.map((exp, idx) => {
                  const meta = CATEGORY_META[exp.expense_type] || CATEGORY_META.other;
                  return (
                    <tr key={exp.id || idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-300">{formatDate(exp.date)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {exp.trip_number || 'Direct Fee'}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">{exp.truck_plate || '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{exp.driver_name || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {exp.receipt_number || exp.reference_number || exp.notes || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white text-right">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          exp.status === 'cancelled' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {exp.status || 'active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {recordedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                      No trip fees or tolls recorded yet. Once drivers submit hauling trips with fees, they will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SUGGESTION */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                {editModal.index !== null ? 'Edit Driver Fee Suggestion' : 'Add New Fee Suggestion'}
              </h3>
              <button
                onClick={() => setEditModal({ isOpen: false, index: null, name: '', amount: '', fee_type: 'toll' })}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModalItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Preset Name / Station: *
                </label>
                <input
                  type="text"
                  placeholder={t('fee_name_ph', 'e.g. Modjo Expressway Toll, Awash Scale')}
                  value={editModal.name}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  {t('default_amount_etb', 'Default Amount (ETB): *')}
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={editModal.amount}
                  onChange={(e) => setEditModal({ ...editModal, amount: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-sm"
                  min="1"
                  step="any"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  {t('fee_category_label', 'Fee Category:')}
                </label>
                <select
                  value={editModal.fee_type}
                  onChange={(e) => setEditModal({ ...editModal, fee_type: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                >
                  <option value="toll">🛣️ {t('toll_expressway_opt', 'Toll Expressway')}</option>
                  <option value="weighbridge">⚖️ {t('weighbridge_scale_opt', 'Weighbridge / Scale')}</option>
                  <option value="gate_fee">🚪 {t('gate_yard_pass_opt', 'Gate / Yard Pass')}</option>
                  <option value="parking">🅿️ {t('parking_staging_opt', 'Parking / Staging')}</option>
                  <option value="escort">🛡️ {t('escort_security_opt', 'Escort / Security')}</option>
                  <option value="other">🏷️ {t('other_fee_opt', 'Other Fee')}</option>
                </select>
              </div>

              {/* Preview */}
              <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">{t('preview_as_driver_btn', 'Preview as Driver Button:')}</span>
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-900 border border-amber-500/50 rounded-xl text-[11px] font-bold text-slate-100">
                  <span>{(CATEGORY_META[editModal.fee_type] || CATEGORY_META.other).icon}</span>
                  <span>{editModal.name || 'Sample Fee'}</span>
                  <span className="text-amber-400">+{editModal.amount || 0} ETB</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModal({ isOpen: false, index: null, name: '', amount: '', fee_type: 'toll' })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20"
                >
                  {editModal.index !== null ? 'Save Changes' : 'Add Suggestion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default TollsAndExpensesView;
