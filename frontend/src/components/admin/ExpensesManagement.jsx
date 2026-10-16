import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatDate, exportToCSV } from '../../utils/formatters';
import {
  Receipt,
  Plus,
  Download,
  Ban,
  AlertTriangle,
  RefreshCw,
  Edit,
  Trash2,
  Shield,
  Play,
  Pause,
  Calendar,
  Clock,
  CheckCircle2,
  Sliders,
  ChevronRight
} from 'lucide-react';

const EXPENSE_TYPES = [
  { id: 'fuel', label: '⛽ Fuel' },
  { id: 'tire', label: '🛞 Tires & Replacement' },
  { id: 'maintenance', label: '🔧 Maintenance & Servicing' },
  { id: 'repair', label: '🛠️ Repairs & Spare Parts' },
  { id: 'oil', label: '🛢️ Oil & Lubricants' },
  { id: 'toll', label: '🛣️ Toll Fee' },
  { id: 'weighbridge', label: '⚖️ Weighbridge / Scale' },
  { id: 'parking', label: '🅿️ Parking & Staging' },
  { id: 'gate_fee', label: '🚪 Gate & Port Fee' },
  { id: 'insurance', label: '🛡️ Insurance & Liability' },
  { id: 'rent', label: '🏢 Office & Yard Rent' },
  { id: 'software', label: '🛰️ GPS & Software Subscriptions' },
  { id: 'fine', label: '⚠️ Traffic Penalty / Fine' },
  { id: 'other', label: '📦 Other Operational Overhead' },
];

export const ExpensesManagement = () => {
  const expenseTypes = EXPENSE_TYPES;
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [cancelModal, setCancelModal] = useState({ open: false, exp: null, reason: '' });
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'fuel', 'toll', 'maintenance', 'other'
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'trips', 'fleet'
  const [searchTerm, setSearchTerm] = useState('');

  // Recurring Monthly Expenses & Auto-Deductions State
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [recurringActionLoading, setRecurringActionLoading] = useState(false);
  const [recurringModal, setRecurringModal] = useState({ open: false, mode: 'create', item: null });
  const [recurringForm, setRecurringForm] = useState({
    title: '',
    category: 'rent',
    sub_description: 'Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports.',
    monthly_amount: 50000,
    total_months: 0,
    deduction_day: 1,
    status: 'active',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    paid_months: 0,
  });

  // Legacy EIC compatibility state
  const [eicData, setEicData] = useState(null);
  const [eicModalOpen, setEicModalOpen] = useState(false);
  const [eicActionLoading, setEicActionLoading] = useState(false);
  const [eicForm, setEicForm] = useState({
    enabled: true,
    monthly_amount: 150000,
    total_months: 24,
    deduction_day: 1,
    status: 'active',
    description: 'Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports.',
  });

  const [formData, setFormData] = useState({
    truck_id: '',
    driver_id: '',
    expense_type: 'tire',
    amount: 1500,
    description: '',
    receipt_number: '',
    trip_id: '',
    trip_number: '',
    status: 'active',
  });

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'insurance':
        return '🛡️';
      case 'rent':
        return '🏢';
      case 'software':
      case 'gps':
        return '🛰️';
      case 'maintenance':
        return '🔧';
      case 'security':
        return '🔒';
      case 'loan':
        return '🏦';
      case 'fuel':
        return '⛽';
      default:
        return '📦';
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'insurance':
        return 'from-blue-950/70 via-indigo-950/60 to-slate-900 border-blue-500/30';
      case 'rent':
        return 'from-purple-950/70 via-slate-900 to-slate-900 border-purple-500/30';
      case 'maintenance':
        return 'from-amber-950/70 via-slate-900 to-slate-900 border-amber-500/30';
      case 'software':
      case 'gps':
        return 'from-cyan-950/70 via-slate-900 to-slate-900 border-cyan-500/30';
      case 'security':
        return 'from-emerald-950/70 via-slate-900 to-slate-900 border-emerald-500/30';
      default:
        return 'from-slate-900 via-slate-900 to-slate-900 border-slate-700/60';
    }
  };

  const loadRecurringData = async () => {
    try {
      const res = await api.get('/expenses/recurring');
      if (res && Array.isArray(res)) {
        setRecurringExpenses(res);
        const eic = res.find(r => r.id === 'eic_insurance') || res[0];
        if (eic) {
          setEicData(eic);
          setEicForm({
            enabled: eic.enabled ?? true,
            monthly_amount: eic.monthly_amount || 150000,
            total_months: eic.total_months || 24,
            deduction_day: eic.deduction_day || 1,
            status: eic.status || 'active',
            description: eic.sub_description || 'Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports.',
            start_date: eic.start_date || '2026-10-01',
            end_date: eic.end_date || '2028-10-01',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load recurring expenses:', err);
    }
  };

  const loadEicData = loadRecurringData;

  const handleToggleRecurring = async (item) => {
    setRecurringActionLoading(true);
    try {
      const res = await api.post(`/expenses/recurring/${item.id}/toggle`);
      await Promise.all([loadData(), loadRecurringData()]);
      alert(res.message || `${item.title} schedule toggled.`);
    } catch (err) {
      alert('Failed to toggle schedule: ' + err.message);
    } finally {
      setRecurringActionLoading(false);
    }
  };

  const handleDeductRecurringNow = async (item) => {
    if (!confirm(t('confirm_exec_recurring_deduction', `Execute monthly deduction of ${formatCurrency(item.monthly_amount)} for "${item.title}" now?`))) return;
    setRecurringActionLoading(true);
    try {
      const res = await api.post(`/expenses/recurring/${item.id}/deduct-now`);
      await Promise.all([loadData(), loadRecurringData()]);
      alert(res.message || `${item.title} deduction recorded successfully!`);
    } catch (err) {
      alert(err.message);
    } finally {
      setRecurringActionLoading(false);
    }
  };

  const openAddRecurringModal = () => {
    setRecurringForm({
      title: '',
      category: 'rent',
      sub_description: 'Automatic monthly deduction on the 1st day of the month. Automatically debited into operational expenses and financial reports.',
      monthly_amount: 50000,
      total_months: 0,
      deduction_day: 1,
      status: 'active',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      paid_months: 0,
    });
    setRecurringModal({ open: true, mode: 'create', item: null });
  };

  const openEditRecurringModal = (item) => {
    setRecurringForm({
      id: item.id,
      title: item.title || '',
      category: item.category || 'other',
      sub_description: item.sub_description || 'Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports.',
      monthly_amount: item.monthly_amount || 0,
      total_months: item.total_months ?? 0,
      deduction_day: item.deduction_day || 1,
      status: item.status || 'active',
      start_date: item.start_date || new Date().toISOString().slice(0, 10),
      end_date: item.end_date || '',
      paid_months: item.paid_months || 0,
    });
    setRecurringModal({ open: true, mode: 'edit', item });
  };

  const handleSaveRecurring = async (e) => {
    e.preventDefault();
    setRecurringActionLoading(true);
    try {
      const payload = {
        title: recurringForm.title,
        category: recurringForm.category,
        sub_description: recurringForm.sub_description,
        monthly_amount: parseFloat(recurringForm.monthly_amount) || 0,
        total_months: parseInt(recurringForm.total_months, 10) || 0,
        deduction_day: parseInt(recurringForm.deduction_day, 10) || 1,
        status: recurringForm.status,
        start_date: recurringForm.start_date,
        end_date: recurringForm.end_date,
      };

      if (recurringModal.mode === 'edit' && recurringModal.item) {
        payload.paid_months = parseInt(recurringForm.paid_months, 10) || 0;
        await api.put(`/expenses/recurring/${recurringModal.item.id}`, payload);
        alert('Recurring expense schedule updated successfully.');
      } else {
        await api.post('/expenses/recurring', payload);
        alert('New recurring monthly expense added successfully.');
      }

      await Promise.all([loadData(), loadRecurringData()]);
      setRecurringModal({ open: false, mode: 'create', item: null });
    } catch (err) {
      alert('Failed to save recurring expense: ' + err.message);
    } finally {
      setRecurringActionLoading(false);
    }
  };

  const handleDeleteRecurring = async (item) => {
    if (!confirm(`Are you sure you want to permanently delete the recurring expense schedule for "${item.title}"?`)) return;
    setRecurringActionLoading(true);
    try {
      await api.delete(`/expenses/recurring/${item.id}`);
      await Promise.all([loadData(), loadRecurringData()]);
      alert('Recurring expense schedule deleted successfully.');
    } catch (err) {
      alert('Failed to delete recurring expense: ' + err.message);
    } finally {
      setRecurringActionLoading(false);
    }
  };

  const handleToggleEic = async () => {
    const eic = recurringExpenses.find(r => r.id === 'eic_insurance');
    if (eic) return handleToggleRecurring(eic);
    setEicActionLoading(true);
    try {
      const res = await api.post('/expenses/recurring/eic/toggle');
      await Promise.all([loadData(), loadRecurringData()]);
      alert(res.message || 'EIC auto-payment schedule toggled.');
    } catch (err) {
      alert('Failed to toggle EIC schedule: ' + err.message);
    } finally {
      setEicActionLoading(false);
    }
  };

  const handleDeductEicNow = async () => {
    const eic = recurringExpenses.find(r => r.id === 'eic_insurance');
    if (eic) return handleDeductRecurringNow(eic);
    if (!confirm(t('confirm_exec_eic_deduction', 'Execute monthly EIC insurance deduction now?'))) return;
    setEicActionLoading(true);
    try {
      const res = await api.post('/expenses/recurring/eic/deduct-now');
      await Promise.all([loadData(), loadRecurringData()]);
      alert(res.message || t('eic_deducted_success', 'EIC insurance expense successfully deducted and recorded!'));
    } catch (err) {
      alert(err.message);
    } finally {
      setEicActionLoading(false);
    }
  };

  const handleSaveEicSettings = async (e) => {
    e.preventDefault();
    setEicActionLoading(true);
    try {
      await api.put('/expenses/recurring/eic', {
        ...eicForm,
        monthly_amount: parseFloat(eicForm.monthly_amount) || 150000,
        total_months: parseInt(eicForm.total_months, 10) || 24,
        deduction_day: parseInt(eicForm.deduction_day, 10) || 1,
      });
      await loadRecurringData();
      alert('EIC auto-deduction settings updated successfully.');
      setEicModalOpen(false);
    } catch (err) {
      alert('Failed to update EIC settings: ' + err.message);
    } finally {
      setEicActionLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [e, t, d] = await Promise.all([
        api.get('/expenses'),
        api.get('/trucks'),
        api.get('/drivers'),
      ]);
      setExpenses(e || []);
      setTrucks(t || []);
      setDrivers(d || []);
      loadRecurringData();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    loadRecurringData();
  }, []);

  const openAddModal = () => {
    setEditingExpense(null);
    setFormData({
      truck_id: '',
      driver_id: '',
      expense_type: 'tire',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      description: '',
      receipt_number: '',
      trip_id: '',
      trip_number: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setFormData({
      truck_id: exp.truck_id === 'fleet' ? '' : exp.truck_id || '',
      driver_id: exp.driver_id || '',
      expense_type: exp.expense_type || 'tire',
      amount: exp.amount ?? '',
      date: exp.date ? exp.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: exp.description || '',
      receipt_number: exp.receipt_number || '',
      trip_id: exp.trip_id || '',
      trip_number: exp.trip_number || '',
      status: exp.status || 'active',
    });
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    try {
      const isFleet = !formData.truck_id || formData.truck_id === 'fleet';
      const trk = !isFleet ? trucks.find(t => t.id === formData.truck_id) : null;
      const drv = drivers.find(d => d.user_id === formData.driver_id);

      const payload = {
        ...formData,
        truck_id: isFleet ? 'fleet' : formData.truck_id,
        truck_plate: trk?.plate_number || (isFleet ? 'All Fleet / Overhead' : editingExpense?.truck_plate || 'All Fleet / Overhead'),
        driver_id: formData.driver_id || '',
        driver_name: drv?.full_name || editingExpense?.driver_name || '',
        amount: parseFloat(formData.amount) || 0,
        date: formData.date || new Date().toISOString().slice(0, 10),
        trip_id: editingExpense?.trip_id || formData.trip_id || '',
        trip_number: editingExpense?.trip_number || formData.trip_number || '',
        status: editingExpense?.status || formData.status || 'active',
      };

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }

      setIsModalOpen(false);
      setEditingExpense(null);
      loadData();
    } catch (err) {
      alert((editingExpense ? 'Failed to update expense: ' : 'Failed to record expense: ') + err.message);
    }
  };

  const handleDeleteExpense = async (exp) => {
    if (!confirm(t('confirm_delete_expense_msg', 'Are you sure you want to permanently delete this expense?'))) return;
    try {
      await api.delete(`/expenses/${exp.id}`);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancelExpense = async () => {
    if (!cancelModal.reason.trim()) return;
    try {
      await api.patch(`/expenses/${cancelModal.exp.id}/cancel`, {
        reason: cancelModal.reason,
      });
      setCancelModal({ open: false, exp: null, reason: '' });
      loadData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleExport = () => {
    const headers = [
      { key: 'expense_number', label: 'Expense #' },
      { key: 'date', label: 'Date', format: val => formatDate(val) },
      { key: 'expense_type', label: 'Expense Category' },
      { key: 'truck_plate', label: 'Truck Plate' },
      { key: 'driver_name', label: 'Driver' },
      { key: 'amount', label: 'Amount (ETB)' },
      { key: 'description', label: 'Description' },
      { key: 'receipt_number', label: 'Receipt #' },
      { key: 'status', label: 'Status' },
    ];
    exportToCSV(`expenses_export_${new Date().toISOString().slice(0, 10)}`, expenses, headers);
  };

  const isTripExpense = (e) => Boolean(
    e.trip_id ||
    e.trip_number ||
    (e.receipt_number && typeof e.receipt_number === 'string' && e.receipt_number.startsWith('TRIP-'))
  );

  const activeExpenses = expenses.filter(e => e.status !== 'cancelled');

  // Categorized expense collections - strictly mutually exclusive
  const fuelExpenses = activeExpenses.filter(e => e.expense_type === 'fuel');
  const tollExpenses = activeExpenses.filter(e => ['toll', 'weighbridge', 'gate_fee'].includes(e.expense_type));
  const maintExpenses = activeExpenses.filter(e => ['maintenance', 'repair'].includes(e.expense_type));
  const otherExpenses = activeExpenses.filter(
    e => !['fuel', 'toll', 'weighbridge', 'gate_fee', 'maintenance', 'repair'].includes(e.expense_type)
  );

  // Totals per category
  const totalActiveExpenses = activeExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalFuel = fuelExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalTolls = tollExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalMaint = maintExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalOther = otherExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  const totalTripFees = activeExpenses
    .filter(isTripExpense)
    .reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalTripFeesCount = activeExpenses.filter(isTripExpense).length;
  const totalFleetOverhead = totalActiveExpenses - totalTripFees;
  const totalFleetOverheadCount = activeExpenses.length - totalTripFeesCount;

  const filteredExpenses = expenses.filter(e => {
    // 1. Strict Category Tab Filter
    if (filterTab === 'fuel' && e.expense_type !== 'fuel') return false;
    if (filterTab === 'toll' && !['toll', 'weighbridge', 'gate_fee'].includes(e.expense_type)) return false;
    if (filterTab === 'maintenance' && !['maintenance', 'repair'].includes(e.expense_type)) return false;
    if (filterTab === 'other' && ['fuel', 'toll', 'weighbridge', 'gate_fee', 'maintenance', 'repair'].includes(e.expense_type)) return false;

    // 2. Origin / Source Filter (orthogonal)
    if (sourceFilter === 'trips' && !isTripExpense(e)) return false;
    if (sourceFilter === 'fleet' && isTripExpense(e)) return false;

    // 3. Search Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const expNum = (e.expense_number || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      const plate = (e.truck_plate || '').toLowerCase();
      const driver = (e.driver_name || '').toLowerCase();
      const tripNum = (e.trip_number || '').toLowerCase();
      const receipt = (e.receipt_number || '').toLowerCase();
      if (
        !expNum.includes(term) &&
        !desc.includes(term) &&
        !plate.includes(term) &&
        !driver.includes(term) &&
        !tripNum.includes(term) &&
        !receipt.includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-red-400" /> {t('expenses_title', 'Operational & Fleet Expenses')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('expenses_sub', 'Track fuel, tires, maintenance, toll, weighbridge, and driver trip fees')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Recurring Auto-Deductions Header Button */}
          <button
            onClick={() => {
              const eic = recurringExpenses.find(r => r.id === 'eic_insurance') || recurringExpenses[0];
              if (eic) openEditRecurringModal(eic);
              else openAddRecurringModal();
            }}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-blue-900/30 border border-blue-500/40 touch-btn cursor-pointer transition"
            title="Recurring Auto-Deduction Schedules & Settings"
          >
            <Shield className="w-4 h-4 text-blue-300" />
            <span className="hidden sm:inline">Recurring Schedules:</span>
            <span className="font-mono text-blue-200">
              {formatCurrency(recurringExpenses.reduce((sum, r) => sum + (r.monthly_amount || 0), 0))}/mo
            </span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                recurringExpenses.some(r => r.status === 'active') ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </button>

          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-700"
          >
            <Download className="w-4 h-4" /> {t('export_csv', 'Export CSV')}
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn"
          >
            <Plus className="w-4 h-4" /> {t('add_expense_btn', '+ Record Expense')}
          </button>
        </div>
      </div>

      {/* Category Breakdown KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Expenses Card */}
        <div
          onClick={() => setFilterTab('all')}
          className={`p-4 bg-slate-900 border rounded-3xl cursor-pointer transition hover:border-slate-600 ${
            filterTab === 'all' ? 'border-red-500 ring-2 ring-red-500/20 shadow-lg shadow-red-500/10' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{t('todays_expenses', 'Total Expenses')}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
              100%
            </span>
          </div>
          <div className="text-2xl font-black text-red-400 mt-1">{formatCurrency(totalActiveExpenses)}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{activeExpenses.length} total records</span>
        </div>

        {/* 1. Fuel Card */}
        <div
          onClick={() => setFilterTab(filterTab === 'fuel' ? 'all' : 'fuel')}
          className={`p-4 bg-slate-900 border rounded-3xl cursor-pointer transition hover:border-red-500/50 ${
            filterTab === 'fuel' ? 'border-red-500 ring-2 ring-red-500/20 shadow-lg shadow-red-500/10' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
              ⛽ {t('fuel_expenses', 'Fuel')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 font-bold">
              {totalActiveExpenses > 0 ? ((totalFuel / totalActiveExpenses) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div className="text-2xl font-black text-white mt-1">{formatCurrency(totalFuel)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {fuelExpenses.length} fuel transactions
          </span>
        </div>

        {/* 2. Toll & Road Fees Card */}
        <div
          onClick={() => setFilterTab(filterTab === 'toll' ? 'all' : 'toll')}
          className={`p-4 bg-slate-900 border rounded-3xl cursor-pointer transition hover:border-amber-500/50 ${
            filterTab === 'toll' ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg shadow-amber-500/10' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              🛣️ {t('toll_fees_label', 'Toll & Road Fees')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
              {totalActiveExpenses > 0 ? ((totalTolls / totalActiveExpenses) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">{formatCurrency(totalTolls)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {tollExpenses.length} tolls & weighbridges
          </span>
        </div>

        {/* 3. Maintenance & Repairs Card */}
        <div
          onClick={() => setFilterTab(filterTab === 'maintenance' ? 'all' : 'maintenance')}
          className={`p-4 bg-slate-900 border rounded-3xl cursor-pointer transition hover:border-blue-500/50 ${
            filterTab === 'maintenance' ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
              🔧 {t('maintenance_repairs_label', 'Maintenance')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-bold">
              {totalActiveExpenses > 0 ? ((totalMaint / totalActiveExpenses) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div className="text-2xl font-black text-blue-300 mt-1">{formatCurrency(totalMaint)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {maintExpenses.length} service & repairs
          </span>
        </div>

        {/* 4. Other Things Card */}
        <div
          onClick={() => setFilterTab(filterTab === 'other' ? 'all' : 'other')}
          className={`p-4 bg-slate-900 border rounded-3xl cursor-pointer transition hover:border-purple-500/50 ${
            filterTab === 'other' ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-lg shadow-purple-500/10' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
              📦 {t('other_expenses_tab', 'Other Things')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
              {totalActiveExpenses > 0 ? ((totalOther / totalActiveExpenses) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div className="text-2xl font-black text-purple-300 mt-1">{formatCurrency(totalOther)}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {otherExpenses.length} tires, oil, parts & misc
          </span>
        </div>
      </div>

      {/* Recurring Monthly Expenses & Auto-Deductions Management Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{t('recurring_expenses_title', 'Monthly Recurring Expenses & Auto-Deductions')}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                {recurringExpenses.length} {recurringExpenses.length === 1 ? 'Schedule' : 'Schedules'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {t('recurring_expenses_sub', 'Pre-configured overhead expenses automatically deducted on their assigned day of the month.')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openAddRecurringModal}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {t('add_recurring_btn', '+ Add Monthly Expense')}
            </button>
            <button
              onClick={loadRecurringData}
              title="Refresh recurring schedules"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* List of Recurring Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {recurringExpenses.map((item) => {
            const isEic = item.id === 'eic_insurance';
            const isOngoing = !item.total_months || item.total_months === 0;
            const progressPct = !isOngoing
              ? Math.min(100, Math.round(((item.paid_months || 0) / item.total_months) * 100))
              : 0;

            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 bg-gradient-to-r ${getCategoryColor(item.category)} rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between gap-3 border`}
              >
                <div className="space-y-2">
                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/20 flex items-center gap-1">
                        <span>{getCategoryIcon(item.category)}</span>
                        <span>{item.category.toUpperCase()}</span>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          item.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {item.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                      {item.deducted_this_month && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Current Month Deducted
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-800">
                      Day {item.deduction_day} of month
                    </span>
                  </div>

                  {/* Title and Amount */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span>{item.title}</span>
                    </h3>
                    <span className="text-blue-300 font-mono text-base font-black shrink-0">
                      {formatCurrency(item.monthly_amount)} / Month
                    </span>
                  </div>

                  {/* User-Requested Editable Subtitle Note */}
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <p className="text-xs text-slate-300 font-normal leading-relaxed">
                      {item.sub_description ||
                        'Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports.'}
                    </p>
                  </div>

                  {/* Progress / Duration Display */}
                  <div className="pt-1 space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-300">
                      <span>
                        {!isOngoing ? (
                          <>
                            Progress: <strong className="text-blue-300 font-mono">Month {item.paid_months || 0} of {item.total_months} Paid</strong>
                          </>
                        ) : (
                          <>
                            Ongoing: <strong className="text-emerald-300 font-mono">{item.paid_months || 0} Months Deducted</strong>
                          </>
                        )}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {formatCurrency(item.total_paid_so_far || 0)} paid {!isOngoing && `· ${formatCurrency(item.remaining_balance || 0)} remaining`}
                      </span>
                    </div>

                    {!isOngoing && (
                      <div className="w-full bg-slate-800/90 rounded-full h-2 overflow-hidden border border-slate-700/60">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-400 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                  <div className="text-[11px] text-slate-400 font-mono">
                    Next: <strong className="text-slate-300">{item.next_deduction_date}</strong>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleToggleRecurring(item)}
                      disabled={recurringActionLoading}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer border ${
                        item.status === 'active'
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {item.status === 'active' ? (
                        <>
                          <Pause className="w-3 h-3" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" /> Resume
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeductRecurringNow(item)}
                      disabled={recurringActionLoading}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition shadow-sm cursor-pointer"
                      title="Force deduction now for current month"
                    >
                      <Clock className="w-3 h-3" /> Deduct Now
                    </button>

                    <button
                      onClick={() => openEditRecurringModal(item)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-200 font-bold text-xs rounded-xl flex items-center gap-1 transition border border-slate-700 cursor-pointer"
                      title="Edit deduction note, monthly amount, duration, and view history"
                    >
                      <Sliders className="w-3 h-3" /> Edit & History
                    </button>

                    {!isEic && (
                      <button
                        onClick={() => handleDeleteRecurring(item)}
                        disabled={recurringActionLoading}
                        className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition border border-red-500/30 cursor-pointer"
                        title="Delete recurring schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col lg:flex-row gap-3 justify-between items-center">
        {/* Category Filter Tabs (Mutually Exclusive) */}
        <div className="flex flex-wrap bg-slate-800/80 p-1 rounded-2xl border border-slate-700 w-full lg:w-auto gap-1">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('exp_tab_all', 'All')} ({activeExpenses.length})
          </button>
          <button
            onClick={() => setFilterTab('fuel')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              filterTab === 'fuel'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-red-400 hover:text-red-300'
            }`}
          >
            ⛽ Fuel ({fuelExpenses.length})
          </button>
          <button
            onClick={() => setFilterTab('toll')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              filterTab === 'toll'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            🛣️ Toll & Road ({tollExpenses.length})
          </button>
          <button
            onClick={() => setFilterTab('maintenance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              filterTab === 'maintenance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            🔧 Maintenance ({maintExpenses.length})
          </button>
          <button
            onClick={() => setFilterTab('other')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              filterTab === 'other'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-purple-400 hover:text-purple-300'
            }`}
          >
            📦 Other Things ({otherExpenses.length})
          </button>
        </div>

        {/* Right Controls: Source / Origin Filter & Search */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
          {/* Origin / Source Filter Toggle */}
          <div className="flex bg-slate-800/80 p-0.5 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer text-[11px] ${
                sourceFilter === 'all'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Show expenses from all sources"
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter('trips')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[11px] ${
                sourceFilter === 'trips'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-400/90 hover:text-emerald-300'
              }`}
              title="Expenses incurred directly on trip routes"
            >
              🚛 Trips ({totalTripFeesCount})
            </button>
            <button
              onClick={() => setSourceFilter('fleet')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[11px] ${
                sourceFilter === 'fleet'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-300 hover:text-white'
              }`}
              title="Fixed general fleet overhead (office, yard, subscriptions)"
            >
              🏢 Fleet ({totalFleetOverheadCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="w-full sm:w-60">
            <input
              type="text"
              placeholder={t('ph_search_expenses', 'Search expense #, plate, trip, notes...')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">{t('expense_hash', 'Expense #')}</th>
                <th className="py-3 px-3">{t('date', 'Date')}</th>
                <th className="py-3 px-3">{t('col_category', 'Category')}</th>
                <th className="py-3 px-3">{t('odo_col_truck', 'Truck Plate')}</th>
                <th className="py-3 px-3">{t('col_amount', 'Amount')}</th>
                <th className="py-3 px-3">{t('col_description', 'Description')}</th>
                <th className="py-3 px-3">{t('receipt_ref_col_header', 'Receipt #')}</th>
                <th className="py-3 px-3">{t('status', 'Status')}</th>
                <th className="py-3 px-3 text-right">{t('actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    {t('no_expense_records_match', 'No expense records found matching current filter.')}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(e => {
                  const tripLinked = isTripExpense(e);
                  const tripNum = e.trip_number || (e.receipt_number?.startsWith('TRIP-') ? e.receipt_number.replace('TRIP-', '') : null);
                  return (
                    <tr key={e.id} className={`hover:bg-slate-800/50 ${e.status === 'cancelled' ? 'opacity-60 bg-red-950/10' : ''}`}>
                      <td className="py-3 px-3 font-mono font-bold text-amber-400">
                        <div>{e.expense_number}</div>
                        {tripLinked && (
                          <span className="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                            🚛 Trip #{tripNum || 'Linked'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{formatDate(e.date)}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700 capitalize">
                          {e.expense_type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-200">{e.truck_plate || '-'}</td>
                      <td className="py-3 px-3">
                        <div className="font-black text-red-400">{formatCurrency(e.amount)}</div>
                        {tripLinked && (
                          <span className="text-[10px] text-amber-400 font-medium block">{t('deducted_from_trip', 'Deducted from Trip')}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{e.description}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{e.receipt_number || '-'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          e.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(e)}
                          className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-slate-700 inline-block"
                          title={t('view_edit', 'Edit Expense')}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {e.status !== 'cancelled' && (
                          <button
                            onClick={() => setCancelModal({ open: true, exp: e, reason: '' })}
                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg inline-block"
                            title={t('void_cancel_expense', 'Void / Cancel Expense')}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteExpense(e)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 inline-block"
                          title={t('delete_permanently_btn', 'Delete Expense Permanently')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">
              {editingExpense ? `Edit Expense: ${editingExpense.expense_number}` : 'Record Operational Expense'}
            </h3>

            {editingExpense && isTripExpense(editingExpense) && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-300">
                  <span className="font-bold block">
                    Linked to Trip #{editingExpense.trip_number || (editingExpense.receipt_number?.startsWith('TRIP-') ? editingExpense.receipt_number.replace('TRIP-', '') : 'Active')}
                  </span>
                  Editing this fee amount will automatically recalculate the parent hauling trip total revenue and net driver earnings.
                </div>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('expense_category_field', 'Expense Category:')}</label>
                  <select
                    value={formData.expense_type}
                    onChange={e => setFormData({ ...formData, expense_type: e.target.value })}
                    className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white cursor-pointer"
                  >
                    {expenseTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('amount_etb_field', 'Amount (ETB):')}</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="e.g. 2500"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-red-400 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('date', 'Date:')}</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('truck_field_label', 'Truck:')}</label>
                  <select
                    value={formData.truck_id}
                    onChange={e => setFormData({ ...formData, truck_id: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white cursor-pointer"
                  >
                    <option value="">🏢 General Fleet / All Trucks</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>{t.plate_number} ({t.model})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('driver_optional_field', 'Driver (Optional):')}</label>
                  <select
                    value={formData.driver_id}
                    onChange={e => setFormData({ ...formData, driver_id: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white cursor-pointer"
                  >
                    <option value="">{t('company_wide_opt', 'None / Company Wide')}</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.user_id}>{d.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('description_field_label', 'Description:')}</label>
                <input
                  type="text"
                  placeholder={t('tire_expense_sample_ph', 'e.g. 2 new front drive tires (Michelin 315/80R22.5)')}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('receipt_ref_col_header', 'Receipt / Reference #:')}</label>
                <input
                  type="text"
                  placeholder={t('ph_receipt_ref_example', 'e.g. RCP-49182')}
                  value={formData.receipt_number}
                  onChange={e => setFormData({ ...formData, receipt_number: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer rounded-xl hover:bg-slate-800 transition"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {editingExpense ? t('save_changes', 'Save Changes') : t('btn_record_expense', 'Record Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">{t('void_cancel_expense', 'Void / Cancel Expense')}</h3>
            <p className="text-xs text-slate-300">
              {t('void_expense_audit_notice', 'Transaction will be marked as cancelled and preserved for financial audit.')}
            </p>
            <textarea
              rows="3"
              placeholder={t('cancellation_reason_ph', 'Reason for cancellation')}
              value={cancelModal.reason}
              onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
              className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white resize-none"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancelModal({ open: false, exp: null, reason: '' })}
                className="px-3 py-1.5 text-xs text-slate-400"
              >
                Back
              </button>
              <button
                onClick={handleCancelExpense}
                className="px-4 py-1.5 bg-red-600 text-white font-bold text-xs rounded-xl"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Expense Add / Edit / Settings Modal */}
      {recurringModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white">
                    {recurringModal.mode === 'create'
                      ? 'Add Recurring Monthly Expense'
                      : `Edit Schedule: ${recurringModal.item?.title || ''}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {recurringModal.mode === 'create'
                      ? 'Set up an automatic monthly deduction for overhead, rent, IT, insurance or other expenses.'
                      : 'Customize deduction note, installment parameters, and monthly amount.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRecurringModal({ open: false, mode: 'create', item: null })}
                className="text-slate-400 hover:text-white font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Metrics for Existing Item */}
            {recurringModal.mode === 'edit' && recurringModal.item && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Monthly Amount</span>
                  <span className="text-sm font-black text-blue-300 font-mono">
                    {formatCurrency(recurringModal.item.monthly_amount || 0)}
                  </span>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Deducted Months</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {recurringModal.item.paid_months || 0} {!recurringModal.item.total_months ? 'Months' : `/ ${recurringModal.item.total_months}`}
                  </span>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Paid</span>
                  <span className="text-sm font-black text-white font-mono">
                    {formatCurrency(recurringModal.item.total_paid_so_far || 0)}
                  </span>
                </div>
                <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Remaining</span>
                  <span className="text-sm font-black text-amber-300 font-mono">
                    {recurringModal.item.total_months > 0 ? formatCurrency(recurringModal.item.remaining_balance || 0) : 'Ongoing'}
                  </span>
                </div>
              </div>
            )}

            {/* Settings Form */}
            <form onSubmit={handleSaveRecurring} className="space-y-4 text-xs">
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" /> Deduction Schedule Parameters
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Expense Title / Vendor:</label>
                    <input
                      type="text"
                      required
                      value={recurringForm.title}
                      onChange={e => setRecurringForm({ ...recurringForm, title: e.target.value })}
                      placeholder="e.g. Office & Compound Rent"
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Category:</label>
                    <select
                      value={recurringForm.category}
                      onChange={e => setRecurringForm({ ...recurringForm, category: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="insurance">🛡️ Fleet Insurance (EIC)</option>
                      <option value="rent">🏢 Office / Compound Rent</option>
                      <option value="software">🛰️ GPS & Fleet Software</option>
                      <option value="maintenance">🔧 Scheduled Fleet Maintenance</option>
                      <option value="security">🔒 Compound Security Service</option>
                      <option value="loan">🏦 Equipment / Truck Loan Repayment</option>
                      <option value="other">📦 Other Monthly Overhead</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Monthly Deduction (ETB):</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={recurringForm.monthly_amount}
                      onChange={e => setRecurringForm({ ...recurringForm, monthly_amount: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Total Duration (Months):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={recurringForm.total_months}
                      onChange={e => setRecurringForm({ ...recurringForm, total_months: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400">
                      Enter 0 for ongoing / indefinite, or number of months (e.g. 24 = 2 Years).
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Deduction Day of Month:</label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      required
                      value={recurringForm.deduction_day}
                      onChange={e => setRecurringForm({ ...recurringForm, deduction_day: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400">Day 1 to 28 (e.g. 1 = 1st day of month)</span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Schedule Status:</label>
                    <select
                      value={recurringForm.status}
                      onChange={e => setRecurringForm({ ...recurringForm, status: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="active">Active (Auto-deduct each month)</option>
                      <option value="paused">Paused (Hold auto-deductions)</option>
                    </select>
                  </div>
                </div>

                {/* The Editable Note / Subtitle (User Request) */}
                <div className="pt-2 border-t border-slate-700/60">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-200 font-bold">
                      Recurring Deduction Subtitle / Note (Editable):
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setRecurringForm({
                          ...recurringForm,
                          sub_description:
                            'Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports.',
                        })
                      }
                      className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                    >
                      Reset to Default Note
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={recurringForm.sub_description}
                    onChange={e => setRecurringForm({ ...recurringForm, sub_description: e.target.value })}
                    placeholder="Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports."
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-sans leading-relaxed focus:ring-2 focus:ring-amber-500/50"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    This note is shown to admins on the dashboard and financial cards.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {recurringModal.mode === 'edit' && recurringModal.item && (
                  <button
                    type="button"
                    onClick={() => handleDeductRecurringNow(recurringModal.item)}
                    disabled={recurringActionLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" /> Deduct Now for Current Month
                  </button>
                )}

                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setRecurringModal({ open: false, mode: 'create', item: null })}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recurringActionLoading}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    {recurringModal.mode === 'create' ? 'Create Monthly Schedule' : 'Save Schedule Settings'}
                  </button>
                </div>
              </div>
            </form>

            {/* Deduction History for this Item */}
            {recurringModal.mode === 'edit' && recurringModal.item && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="font-bold text-slate-200 text-xs flex items-center justify-between">
                  <span>
                    Deduction History ({recurringModal.item?.history?.length || 0} Transactions)
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Next: {recurringModal.item?.next_deduction_date}
                  </span>
                </h4>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {(!recurringModal.item?.history || recurringModal.item.history.length === 0) ? (
                    <p className="text-slate-500 text-xs italic py-2">No deduction history recorded yet.</p>
                  ) : (
                    recurringModal.item.history.map(hist => (
                      <div
                        key={hist.id}
                        className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{hist.description}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>Ref: <strong className="text-slate-300 font-mono">{hist.receipt_number}</strong></span>
                            <span>·</span>
                            <span>Date: {formatDate(hist.date)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-red-400 font-mono text-sm block">
                            -{formatCurrency(hist.amount)}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-400 uppercase">
                            {hist.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
