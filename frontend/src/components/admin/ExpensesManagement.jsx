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

export const ExpensesManagement = () => {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [cancelModal, setCancelModal] = useState({ open: false, exp: null, reason: '' });
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'trips', 'fleet'
  const [searchTerm, setSearchTerm] = useState('');

  // EIC 2-Year Auto-Deduction State
  const [eicData, setEicData] = useState(null);
  const [eicModalOpen, setEicModalOpen] = useState(false);
  const [eicActionLoading, setEicActionLoading] = useState(false);
  const [eicForm, setEicForm] = useState({
    enabled: true,
    monthly_amount: 150000,
    total_months: 24,
    deduction_day: 1,
    status: 'active',
    description: 'EIC (Ethiopian Insurance Corporation) Monthly Fleet Insurance Premium',
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

  const isTripExpense = (e) => {
    return !!(
      e.trip_id ||
      e.trip_number ||
      (e.receipt_number && e.receipt_number.startsWith('TRIP-')) ||
      ['toll', 'weighbridge', 'gate_fee'].includes(e.expense_type)
    );
  };

  const expenseTypes = [
    { id: 'insurance', label: '🛡️ Fleet Insurance (EIC)' },
    { id: 'fuel', label: 'Fuel' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'tire', label: 'Tires' },
    { id: 'oil', label: 'Engine Oil / Lubricants' },
    { id: 'spare_parts', label: 'Spare Parts' },
    { id: 'driver_advance', label: 'Driver Advance' },
    { id: 'washing', label: 'Truck Washing' },
    { id: 'parking', label: 'Parking Fees' },
    { id: 'toll', label: 'Expressway Toll' },
    { id: 'weighbridge', label: 'Weighbridge / Scale' },
    { id: 'gate_fee', label: 'Gate / Yard Pass' },
    { id: 'repair', label: 'Emergency Repair' },
    { id: 'other', label: 'Other' },
  ];

  const loadEicData = async () => {
    try {
      const res = await api.get('/expenses/recurring/eic');
      if (res) {
        setEicData(res);
        if (res.config) {
          setEicForm({
            enabled: res.config.enabled ?? true,
            monthly_amount: res.config.monthly_amount || 150000,
            total_months: res.config.total_months || 24,
            deduction_day: res.config.deduction_day || 1,
            status: res.config.status || 'active',
            description: res.config.description || 'EIC (Ethiopian Insurance Corporation) Monthly Fleet Insurance Premium',
            start_date: res.config.start_date || '2026-10-01',
            end_date: res.config.end_date || '2028-10-01',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load EIC recurring schedule:', err);
    }
  };

  const handleToggleEic = async () => {
    setEicActionLoading(true);
    try {
      const res = await api.post('/expenses/recurring/eic/toggle');
      await Promise.all([loadData(), loadEicData()]);
      alert(res.message || 'EIC auto-payment schedule toggled.');
    } catch (err) {
      alert('Failed to toggle EIC schedule: ' + err.message);
    } finally {
      setEicActionLoading(false);
    }
  };

  const handleDeductEicNow = async () => {
    if (!confirm('Execute monthly EIC insurance deduction of ' + formatCurrency(eicData?.monthly_amount || 150000) + ' now?')) return;
    setEicActionLoading(true);
    try {
      const res = await api.post('/expenses/recurring/eic/deduct-now');
      await Promise.all([loadData(), loadEicData()]);
      alert(res.message || 'EIC insurance expense successfully deducted and recorded!');
    } catch (err) {
      alert('Failed to execute deduction: ' + err.message);
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
      await loadEicData();
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
      loadEicData();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    loadEicData();
  }, []);

  const openAddModal = () => {
    setEditingExpense(null);
    setFormData({
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
    setIsModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setFormData({
      truck_id: exp.truck_id || '',
      driver_id: exp.driver_id || '',
      expense_type: exp.expense_type || 'tire',
      amount: exp.amount || 0,
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
      const trk = trucks.find(t => t.id === formData.truck_id);
      const drv = drivers.find(d => d.user_id === formData.driver_id);

      const payload = {
        ...formData,
        truck_plate: trk?.plate_number || editingExpense?.truck_plate || '',
        driver_name: drv?.full_name || editingExpense?.driver_name || '',
        amount: parseFloat(formData.amount) || 0,
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
    if (!confirm(`Are you sure you want to permanently delete Expense #${exp.expense_number}?`)) return;
    try {
      await api.delete(`/expenses/${exp.id}`);
      loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
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

  const filteredExpenses = expenses.filter(e => {
    if (filterTab === 'trips' && !isTripExpense(e)) return false;
    if (filterTab === 'fleet' && isTripExpense(e)) return false;
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

  const totalActiveExpenses = expenses
    .filter(e => e.status !== 'cancelled')
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const totalTripFees = expenses
    .filter(e => e.status !== 'cancelled' && isTripExpense(e))
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const totalTripFeesCount = expenses
    .filter(e => e.status !== 'cancelled' && isTripExpense(e)).length;

  const totalFleetOverhead = totalActiveExpenses - totalTripFees;

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
          {/* EIC 2-Year Auto-Deduction Control Button */}
          <button
            onClick={() => setEicModalOpen(true)}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-blue-900/30 border border-blue-500/40 touch-btn cursor-pointer transition"
            title="EIC 2-Year Recurring Auto-Deduction Controls"
          >
            <Shield className="w-4 h-4 text-blue-300" />
            <span className="hidden sm:inline">EIC Auto-Payment:</span>
            <span className="font-mono text-blue-200">{formatCurrency(eicData?.monthly_amount || 150000)}/mo</span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                eicData?.config?.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
          <span className="text-xs text-slate-400">{t('todays_expenses', 'Total Active Expenses')}</span>
          <div className="text-2xl font-black text-red-400">{formatCurrency(totalActiveExpenses)}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{expenses.length} Total records audited</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
          <span className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
            🚛 {t('tolls_recorded_tab', 'Trip Tolls & Fees')}
          </span>
          <div className="text-2xl font-black text-amber-400">{formatCurrency(totalTripFees)}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{totalTripFeesCount} Trip fee records deducted from revenue</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl">
          <span className="text-xs text-slate-400">{t('exp_tab_fleet', 'Fleet Operations Overhead')}</span>
          <div className="text-2xl font-black text-slate-200">{formatCurrency(totalFleetOverhead)}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Tires, maintenance, oil, advance, etc.</span>
        </div>
      </div>

      {/* EIC 2-Year Recurring Auto-Payment Control Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950/70 via-indigo-950/60 to-slate-900 border border-blue-500/30 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" /> EIC Insurance 2-Year Auto-Deduction Schedule
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  eicData?.config?.status === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${eicData?.config?.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {eicData?.config?.status === 'active' ? 'Active (Auto-Deducting)' : 'Paused'}
              </span>
              {eicData?.deducted_this_month && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Deducted for Current Month
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>Ethiopian Insurance Corporation (EIC)</span>
              <span className="text-blue-400 font-mono text-sm sm:text-base font-bold">
                {formatCurrency(eicData?.monthly_amount || 150000)} / Month
              </span>
            </h3>

            <p className="text-xs text-slate-300 max-w-2xl">
              Automatic monthly deduction on the 1st day of the month for 2 years (24 installments). Automatically debited into operational expenses and financial reports.
            </p>

            {/* Progress Bar & Counter */}
            <div className="pt-2 max-w-xl space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>
                  Progress: <strong className="text-blue-300 font-mono">Month {eicData?.paid_months || 0} of {eicData?.total_months || 24} Paid</strong>
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {formatCurrency(eicData?.total_paid_so_far || 0)} paid · {formatCurrency(eicData?.remaining_balance || 0)} remaining
                </span>
              </div>
              <div className="w-full bg-slate-800/90 rounded-full h-2.5 overflow-hidden border border-slate-700/60">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-400 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round(((eicData?.paid_months || 0) / (eicData?.total_months || 24)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons Right on Card */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 lg:pt-0 shrink-0">
            <button
              onClick={handleToggleEic}
              disabled={eicActionLoading}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer border ${
                eicData?.config?.status === 'active'
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {eicData?.config?.status === 'active' ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause Auto-Deduct
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Resume Auto-Deduct
                </>
              )}
            </button>

            <button
              onClick={handleDeductEicNow}
              disabled={eicActionLoading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              title="Force or execute monthly deduction now"
            >
              <Clock className="w-3.5 h-3.5" /> Deduct Now
            </button>

            <button
              onClick={() => setEicModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-blue-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" /> Manage & History
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col sm:flex-row gap-3 justify-between items-center">
        {/* Filter Tabs */}
        <div className="flex bg-slate-800/80 p-1 rounded-2xl border border-slate-700 w-full sm:w-auto">
          <button
            onClick={() => setFilterTab('all')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('exp_tab_all', 'All Expenses')} ({expenses.length})
          </button>
          <button
            onClick={() => setFilterTab('trips')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              filterTab === 'trips'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-amber-400/90 hover:text-amber-300'
            }`}
          >
            🚛 {t('exp_tab_trips', 'Trip Expenses')} ({expenses.filter(isTripExpense).length})
          </button>
          <button
            onClick={() => setFilterTab('fleet')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterTab === 'fleet'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('exp_tab_fleet', 'Fleet Operations')} ({expenses.filter(e => !isTripExpense(e)).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search expense #, plate, trip, notes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">Expense #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Truck Plate</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Receipt #</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No expense records found matching current filter.
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
                          <span className="text-[10px] text-amber-400 font-medium block">Deducted from Trip</span>
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
                          title="Edit Expense"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {e.status !== 'cancelled' && (
                          <button
                            onClick={() => setCancelModal({ open: true, exp: e, reason: '' })}
                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg inline-block"
                            title="Void / Cancel Expense"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteExpense(e)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 inline-block"
                          title="Delete Expense Permanently"
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

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Expense Category:</label>
                  <select
                    value={formData.expense_type}
                    onChange={e => setFormData({ ...formData, expense_type: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    {expenseTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Amount (ETB):</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-red-400 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Truck:</label>
                  <select
                    value={formData.truck_id}
                    onChange={e => setFormData({ ...formData, truck_id: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  >
                    <option value="">Select Truck</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>{t.plate_number} ({t.model})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Driver (Optional):</label>
                  <select
                    value={formData.driver_id}
                    onChange={e => setFormData({ ...formData, driver_id: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">None / Company Wide</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.user_id}>{d.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Description:</label>
                <input
                  type="text"
                  placeholder="e.g. 2 new front drive tires (Michelin 315/80R22.5)"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Receipt / Reference #:</label>
                <input
                  type="text"
                  placeholder="e.g. RCP-49182"
                  value={formData.receipt_number}
                  onChange={e => setFormData({ ...formData, receipt_number: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  {editingExpense ? 'Save Changes' : 'Record Expense'}
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
            <h3 className="font-bold text-base text-white">Void / Cancel Expense</h3>
            <p className="text-xs text-slate-300">
              Transaction will be marked as cancelled and preserved for financial audit.
            </p>
            <textarea
              rows="3"
              placeholder="Reason for cancellation"
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

      {/* EIC Control & Settings Modal */}
      {eicModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white">
                    EIC Fleet Insurance Recurring Control
                  </h3>
                  <p className="text-xs text-slate-400">
                    2-Year Auto-Deduction Schedule (150,000 Birr/Month)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEicModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-semibold">Monthly Amount</span>
                <span className="text-sm sm:text-base font-black text-blue-300 font-mono">
                  {formatCurrency(eicData?.monthly_amount || 150000)}
                </span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-semibold">Installments</span>
                <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                  {eicData?.paid_months || 0} / {eicData?.total_months || 24}
                </span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Paid</span>
                <span className="text-sm sm:text-base font-black text-white font-mono">
                  {formatCurrency(eicData?.total_paid_so_far || 0)}
                </span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-semibold">Remaining</span>
                <span className="text-sm sm:text-base font-black text-amber-300 font-mono">
                  {formatCurrency(eicData?.remaining_balance || 0)}
                </span>
              </div>
            </div>

            {/* Settings Form */}
            <form onSubmit={handleSaveEicSettings} className="space-y-4 text-xs">
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60 space-y-3">
                <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" /> Deduction Schedule Parameters
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Monthly Deduction (ETB):</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={eicForm.monthly_amount}
                      onChange={e => setEicForm({ ...eicForm, monthly_amount: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Total Duration (Months):</label>
                    <input
                      type="number"
                      required
                      value={eicForm.total_months}
                      onChange={e => setEicForm({ ...eicForm, total_months: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400">24 months = 2 Years</span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Deduction Day of Month:</label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      required
                      value={eicForm.deduction_day}
                      onChange={e => setEicForm({ ...eicForm, deduction_day: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                    />
                    <span className="text-[10px] text-slate-400">Set to 1 (first day of the month)</span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Schedule Status:</label>
                    <select
                      value={eicForm.status}
                      onChange={e => setEicForm({ ...eicForm, status: e.target.value, enabled: e.target.value === 'active' })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="active">Active (Auto-deduct every month)</option>
                      <option value="paused">Paused (Hold auto-deduction)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Description / Label:</label>
                  <input
                    type="text"
                    value={eicForm.description}
                    onChange={e => setEicForm({ ...eicForm, description: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDeductEicNow}
                  disabled={eicActionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" /> Deduct Now for Current Month
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEicModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={eicActionLoading}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    Save EIC Settings
                  </button>
                </div>
              </div>
            </form>

            {/* Deductions History Table */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="font-bold text-slate-200 text-xs flex items-center justify-between">
                <span>Deduction History ({eicData?.history?.length || 0} Transactions)</span>
                <span className="text-[11px] text-slate-400 font-normal">Next: {eicData?.next_deduction_date}</span>
              </h4>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {(!eicData?.history || eicData.history.length === 0) ? (
                  <p className="text-slate-500 text-xs italic py-2">No deduction history recorded yet.</p>
                ) : (
                  eicData.history.map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{item.description}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>Ref: <strong className="text-slate-300 font-mono">{item.receipt_number}</strong></span>
                          <span>·</span>
                          <span>Date: {formatDate(item.date)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-red-400 font-mono text-sm block">
                          -{formatCurrency(item.amount)}
                        </span>
                        <span className="text-[9px] font-bold text-emerald-400 uppercase">
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
