import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Search,
  Calendar,
  DollarSign,
  Check,
  RotateCcw,
  FileText,
  Building,
  Truck,
  User,
  MapPin,
  Package,
  Download,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Eye,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  CheckSquare,
  Square
} from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'cbe', label: 'CBE (Commercial Bank of Ethiopia)', short: 'CBE', icon: '🏦' },
  { id: 'telebirr', label: 'Telebirr', short: 'Telebirr', icon: '📱' },
  { id: 'awash_bank', label: 'Awash Bank', short: 'Awash', icon: '🏛️' },
  { id: 'dashen_bank', label: 'Dashen Bank', short: 'Dashen', icon: '🏛️' },
  { id: 'cash', label: 'Cash on Delivery / Yard', short: 'Cash', icon: '💵' },
  { id: 'check', label: 'Bank Check / Cheque', short: 'Check', icon: '📝' },
  { id: 'bank_transfer', label: 'Other Bank Transfer', short: 'Wire', icon: '💳' },
  { id: 'other', label: 'Other Payment Method', short: 'Other', icon: '🏷️' },
];

export const PaymentsManagement = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  // Data states
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({
    total_pending_amount: 0,
    total_pending_count: 0,
    total_paid_amount: 0,
    total_paid_count: 0,
    total_amount: 0,
    total_count: 0,
    collection_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'paid'
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all'); // 'all' | 'today' | 'this_week' | 'this_month' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected trips for batch actions
  const [selectedTripIds, setSelectedTripIds] = useState([]);

  // Modals
  const [approveModalTrip, setApproveModalTrip] = useState(null);
  const [viewModalTrip, setViewModalTrip] = useState(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState(null);

  // Form states for approval
  const [approvalForm, setApprovalForm] = useState({
    payment_method: 'cbe',
    payment_ref: '',
    payer_name: '',
    paid_amount: 0,
    paid_at: new Date().toISOString().slice(0, 10),
    payment_notes: '',
  });

  // Batch Form
  const [batchForm, setBatchForm] = useState({
    payment_method: 'cbe',
    payment_ref: '',
    payer_name: '',
    paid_at: new Date().toISOString().slice(0, 10),
    payment_notes: '',
  });

  const fetchPayments = async () => {
    try {
      setRefreshing(true);
      let query = `/payments?status=${activeTab}&period=${period}`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
      if (period === 'custom' && startDate && endDate) {
        query += `&start_date=${startDate}&end_date=${endDate}`;
      }

      const res = await api.get(query);
      if (res) {
        setPayments(res.payments || []);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [activeTab, period, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    fetchPayments();
  };

  const showNotification = (msg) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  // Open Approval Modal
  const openApproveModal = (trip) => {
    setApproveModalTrip(trip);
    const grossTotal = (trip.gross_revenue && trip.gross_revenue > 0)
      ? trip.gross_revenue
      : (trip.paid_amount > 0 ? trip.paid_amount : trip.total_revenue);

    setApprovalForm({
      payment_method: trip.payment_method || 'cbe',
      payment_ref: trip.payment_ref || '',
      payer_name: trip.payer_name || trip.dumping_site_name || '',
      paid_amount: grossTotal,
      paid_at: new Date().toISOString().slice(0, 10),
      payment_notes: trip.payment_notes || '',
    });
  };

  // Submit Approval
  const handleConfirmApproval = async (e) => {
    e?.preventDefault();
    if (!approveModalTrip) return;

    try {
      setSubmittingAction(true);
      const res = await api.patch(`/payments/${approveModalTrip.id}/approve`, approvalForm);
      showNotification(`✓ Payment of ${formatCurrency(approvalForm.paid_amount)} approved for Trip ${approveModalTrip.trip_number}. Realized in dashboard!`);
      setApproveModalTrip(null);
      // Remove from selected list if present
      setSelectedTripIds((prev) => prev.filter((id) => id !== approveModalTrip.id));
      await fetchPayments();
    } catch (err) {
      alert(err.message || 'Failed to approve payment');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Quick 1-Click Approve (Default CBE)
  const handleQuickApprove = async (trip) => {
    if (!window.confirm(t('confirm_quick_approve_payment', 'Quick approve payment for this trip?'))) {
      return;
    }

    try {
      setSubmittingAction(true);
      const grossTotal = (trip.gross_revenue && trip.gross_revenue > 0)
        ? trip.gross_revenue
        : trip.total_revenue;

      await api.patch(`/payments/${trip.id}/approve`, {
        payment_method: 'cbe',
        paid_amount: grossTotal,
        paid_at: new Date().toISOString().slice(0, 10),
        payment_notes: 'Quick approved by admin',
      });
      showNotification(`✓ Trip ${trip.trip_number} approved! Now reflected in Main Dashboard revenue.`);
      await fetchPayments();
    } catch (err) {
      alert(err.message || 'Failed to approve payment');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Revert payment back to pending
  const handleRevertPayment = async (trip) => {
    if (!window.confirm(t('confirm_revert_payment_pending', 'Revert payment for this trip back to PENDING? This will remove it from realized dashboard revenue.'))) {
      return;
    }

    try {
      setSubmittingAction(true);
      await api.patch(`/payments/${trip.id}/revert`, {});
      showNotification(`Trip ${trip.trip_number} payment reverted to Pending.`);
      await fetchPayments();
    } catch (err) {
      alert(err.message || 'Failed to revert payment');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Batch Approval
  const handleBatchApproveSubmit = async (e) => {
    e?.preventDefault();
    if (selectedTripIds.length === 0) return;

    try {
      setSubmittingAction(true);
      await api.post('/payments/batch-approve', {
        trip_ids: selectedTripIds,
        payment_method: batchForm.payment_method,
        payment_ref: batchForm.payment_ref,
        payer_name: batchForm.payer_name,
        paid_at: batchForm.paid_at,
        payment_notes: batchForm.payment_notes,
      });

      showNotification(`✓ Successfully approved payments for ${selectedTripIds.length} trips! Revenue now active on Dashboard.`);
      setBatchModalOpen(false);
      setSelectedTripIds([]);
      await fetchPayments();
    } catch (err) {
      alert(err.message || 'Failed to batch approve payments');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle selection
  const toggleSelectTrip = (id) => {
    setSelectedTripIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all pending in view
  const pendingTripsInView = useMemo(() => {
    return payments.filter((p) => p.payment_status !== 'paid');
  }, [payments]);

  const areAllPendingSelected = useMemo(() => {
    if (pendingTripsInView.length === 0) return false;
    return pendingTripsInView.every((p) => selectedTripIds.includes(p.id));
  }, [pendingTripsInView, selectedTripIds]);

  const toggleSelectAllPending = () => {
    if (areAllPendingSelected) {
      setSelectedTripIds([]);
    } else {
      setSelectedTripIds(pendingTripsInView.map((p) => p.id));
    }
  };

  const selectedTotalAmount = useMemo(() => {
    return payments
      .filter((p) => selectedTripIds.includes(p.id))
      .reduce((sum, p) => {
        const gross = (p.gross_revenue && p.gross_revenue > 0) ? p.gross_revenue : (p.total_revenue || 0);
        return sum + gross;
      }, 0);
  }, [payments, selectedTripIds]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-sm">{notificationMsg}</span>
          </div>
          <button
            onClick={() => setNotificationMsg(null)}
            className="text-emerald-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header with Info Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {t('payment_management', 'Payment Control & Hauling Receivables')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                {t('payment_sub', 'Categorize trip receivables: Driver completions stay in Pending until approved when funds are received.')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchPayments}
            disabled={refreshing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>{t('refresh', 'Refresh')}</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-md shadow-amber-500/20 transition"
            >
              <span>{t('view_dashboard', 'View Dashboard')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Collection Card */}
        <div
          onClick={() => setActiveTab('pending')}
          className={`p-5 rounded-3xl border transition cursor-pointer relative overflow-hidden ${
            activeTab === 'pending'
              ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-amber-500/30'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              {t('pending_collection', 'Pending Collection')}
            </span>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {summary.total_pending_count} {t('trips', 'trips')}
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2 font-mono">
            {formatCurrency(summary.total_pending_amount)}
          </div>

          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>{t('awaiting_approval', 'Awaiting company receipt & approval')}</span>
            <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
          </div>
        </div>

        {/* Fully Paid Realized Card */}
        <div
          onClick={() => setActiveTab('paid')}
          className={`p-5 rounded-3xl border transition cursor-pointer relative overflow-hidden ${
            activeTab === 'paid'
              ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900 border-slate-800 hover:border-emerald-500/30'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              {t('fully_paid_revenue', 'Fully Paid (Realized)')}
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {summary.total_paid_count} {t('trips', 'trips')}
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2 font-mono">
            {formatCurrency(summary.total_paid_amount)}
          </div>

          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>{t('on_dashboard', 'Active & reflected on Main Dashboard')}</span>
            <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Total Hauling Billing Card */}
        <div
          onClick={() => setActiveTab('all')}
          className={`p-5 rounded-3xl border transition cursor-pointer relative overflow-hidden ${
            activeTab === 'all'
              ? 'bg-slate-800/80 border-slate-600 shadow-md'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t('total_hauling_billing', 'Total Hauling Invoiced')}
            </span>
            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full text-[10px] font-bold">
              {summary.total_count} {t('trips', 'trips')}
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
            {formatCurrency(summary.total_amount)}
          </div>

          <div className="text-[11px] text-slate-400 mt-2">
            {t('gross_contract_billing', 'All completed trips combined')}
          </div>
        </div>

        {/* Collection Efficiency Rate */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              {t('collection_rate', 'Collection Rate')}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {summary.collection_rate}%
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-2 font-mono">
            {summary.collection_rate}%
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, summary.collection_rate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Tab Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/60 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{t('all_payments', 'All Payments')}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}>
                {summary.total_count}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-amber-400 hover:bg-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t('pending_approval', 'Pending Approval')}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'pending'
                  ? 'bg-slate-950 text-amber-400'
                  : 'bg-amber-500 text-slate-950 animate-pulse'
              }`}>
                {summary.total_pending_count}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('paid')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
                activeTab === 'paid'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('fully_paid', 'Fully Paid')}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'paid'
                  ? 'bg-slate-950 text-emerald-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {summary.total_paid_count}
              </span>
            </button>
          </div>

          {/* Period Dropdown & Date Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl focus:border-amber-500 outline-none cursor-pointer"
            >
              <option value="all">{t('all_time', 'All Time')}</option>
              <option value="today">{t('today', 'Today')}</option>
              <option value="this_week">{t('this_week', 'This Week')}</option>
              <option value="this_month">{t('this_month', 'This Month')}</option>
              <option value="custom">{t('custom_range', 'Custom Date Range')}</option>
            </select>

            {period === 'custom' && (
              <div className="flex items-center space-x-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl outline-none"
                />
                <span className="text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_payments_ph', 'Search trip #, driver, truck plate, sites, customer/payer, receipt #, or payment reference...')}
            className="w-full pl-10 pr-24 py-2.5 bg-slate-800/80 border border-slate-700 text-slate-100 rounded-2xl text-xs outline-none focus:border-amber-500 transition"
          />
          <button
            type="submit"
            className="absolute right-2 top-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
          >
            {t('search', 'Search')}
          </button>
        </form>

        {/* Batch Selection Bar (shown when 1+ trips selected) */}
        {selectedTripIds.length > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 bg-amber-500 text-slate-950 text-xs font-black rounded-lg">
                {selectedTripIds.length} {t('selected', 'selected')}
              </span>
              <span className="text-xs text-slate-200 font-semibold">
                Total Value: <span className="text-amber-400 font-black font-mono">{formatCurrency(selectedTotalAmount)}</span>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setBatchModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('approve_selected', 'Approve Selected')}</span>
              </button>
              <button
                onClick={() => setSelectedTripIds([])}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                {t('deselect_all', 'Deselect All')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Payments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    onClick={toggleSelectAllPending}
                    className="cursor-pointer text-slate-400 hover:text-white"
                    title={areAllPendingSelected ? 'Deselect all pending' : 'Select all pending'}
                  >
                    {areAllPendingSelected ? (
                      <CheckSquare className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">{t('col_trip_date', 'Trip & Date')}</th>
                <th className="py-3 px-4">{t('col_truck_driver', 'Truck / Driver')}</th>
                <th className="py-3 px-4">{t('col_route_material', 'Route & Material')}</th>
                <th className="py-3 px-4 text-right">{t('col_gross_payment', 'Payment to Approve (Gross ETB)')}</th>
                <th className="py-3 px-4">{t('col_payment_status', 'Payment Status')}</th>
                <th className="py-3 px-4">{t('col_payment_details', 'Payment Details')}</th>
                <th className="py-3 px-4 text-right">{t('actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    {t('loading_payments', 'Loading payments data...')}
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <CreditCard className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold">{t('no_payments_found', 'No payments found matching criteria.')}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {activeTab === 'pending'
                        ? 'Great! There are no completed trips awaiting payment approval.'
                        : 'Completed driver trips will appear here for payment control.'}
                    </p>
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isPaid = p.payment_status === 'paid';
                  const isSelected = selectedTripIds.includes(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-800/50 transition ${
                        isSelected ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        {!isPaid && (
                          <button
                            onClick={() => toggleSelectTrip(p.id)}
                            className="cursor-pointer text-slate-400 hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </td>

                      {/* Trip # & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white font-mono text-xs">{p.trip_number}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formatDate(p.date)}
                        </div>
                        {p.receipt_number && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[120px]">
                            Rcpt: {p.receipt_number}
                          </div>
                        )}
                      </td>

                      {/* Truck & Driver */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 font-bold text-slate-200">
                          <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{p.truck_plate}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[130px]">{p.driver_name}</span>
                        </div>
                      </td>

                      {/* Route & Material */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200 truncate max-w-[180px]" title={`${p.loading_site_name} → ${p.dumping_site_name}`}>
                          {p.loading_site_name} → {p.dumping_site_name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1.5">
                          <Package className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="text-cyan-300 font-semibold">{p.material_name}</span>
                          <span>•</span>
                          <span>{p.quantity} {p.unit}</span>
                        </div>
                      </td>

                      {/* Payment to Approve (Gross Amount) */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <div className="font-bold text-sm text-amber-400">
                          {formatCurrency((p.gross_revenue && p.gross_revenue > 0) ? p.gross_revenue : (p.paid_amount || p.total_revenue))}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-semibold">
                          {isPaid ? t('gross_received', 'Gross Received') : t('gross_to_approve', 'Gross To Approve')}
                        </div>
                        {p.total_additional_fees > 0 && (
                          <div className="text-[10px] text-rose-300/90 mt-1 border-t border-slate-700/50 pt-0.5">
                            <span>- {t('expenses_deducted', 'Expenses:')} {formatCurrency(p.total_additional_fees)}</span>
                            <div className="text-slate-400 font-mono">
                              Net: {formatCurrency(p.net_revenue > 0 ? p.net_revenue : (((p.gross_revenue && p.gross_revenue > 0) ? p.gross_revenue : p.total_revenue) - p.total_additional_fees))}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4">
                        {isPaid ? (
                          <div>
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{t('status_paid', 'Fully Paid')}</span>
                            </span>
                            <div className="text-[10px] text-emerald-400/80 mt-1 font-semibold flex items-center gap-1">
                              <span>{t('reflected_on_dashboard', 'Reflected on Dashboard')}</span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{t('status_pending', 'Pending Payment')}</span>
                            </span>
                            <div className="text-[10px] text-amber-400/80 mt-1 font-semibold">
                              Awaiting company receipt
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Payment Details */}
                      <td className="py-3.5 px-4">
                        {isPaid ? (
                          <div className="space-y-0.5 text-[11px]">
                            <div className="font-bold text-slate-200 flex items-center space-x-1">
                              <span className="uppercase text-[10px] px-1.5 py-0.2 bg-slate-800 rounded text-slate-300 font-mono">
                                {p.payment_method || 'CBE'}
                              </span>
                              {p.payment_ref && (
                                <span className="font-mono text-amber-400/90 truncate max-w-[110px]" title={p.payment_ref}>
                                  #{p.payment_ref}
                                </span>
                              )}
                            </div>
                            {p.payer_name && (
                              <div className="text-slate-400 truncate max-w-[130px]" title={p.payer_name}>
                                Payer: {p.payer_name}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500">
                              {p.paid_at ? formatDate(p.paid_at) : 'Paid'} {p.paid_by ? `• by ${p.paid_by}` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic">
                            No payment received yet
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {!isPaid ? (
                            <>
                              <button
                                onClick={() => openApproveModal(p)}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1 cursor-pointer shadow-sm transition"
                                title="Approve and record payment details"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{t('approve', 'Approve')}</span>
                              </button>

                              <button
                                onClick={() => handleQuickApprove(p)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-semibold cursor-pointer transition border border-slate-700"
                                title="Quick approve via CBE"
                              >
                                {t('quick', 'Quick')}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setViewModalTrip(p)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs cursor-pointer transition"
                                title="View Receipt / Payment Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleRevertPayment(p)}
                                className="p-1.5 bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-xl text-xs cursor-pointer transition border border-slate-700/60"
                                title="Revert back to Pending"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
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

      {/* 5. Approve Single Payment Modal */}
      {approveModalTrip && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    {t('approve_hauling_payment', 'Approve Hauling Payment')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Trip #{approveModalTrip.trip_number} • {approveModalTrip.truck_plate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApproveModalTrip(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trip Contract Summary Card */}
            <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{t('route_and_cargo_label', 'Route & Cargo:')}</span>
                <span className="text-white font-semibold">
                  {approveModalTrip.loading_site_name} → {approveModalTrip.dumping_site_name} ({approveModalTrip.material_name})
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{t('driver_and_date_label', 'Driver & Date:')}</span>
                <span className="text-slate-300">
                  {approveModalTrip.driver_name} • {formatDate(approveModalTrip.date)}
                </span>
              </div>
              {/* PRIMARY: Gross Amount */}
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-700/60">
                <span className="text-amber-300 font-bold">{t('gross_billed_amount', 'Gross Customer Billing:')}</span>
                <span className="text-amber-400 font-mono font-black text-sm">
                  {formatCurrency((approveModalTrip.gross_revenue && approveModalTrip.gross_revenue > 0) ? approveModalTrip.gross_revenue : approveModalTrip.total_revenue)}
                </span>
              </div>
              {/* Separate Deductions / Expenses Listed Below */}
              {approveModalTrip.total_additional_fees > 0 && (
                <div className="flex justify-between items-center text-xs text-rose-300/90 pl-2">
                  <span>- {t('additional_fees_expenses', 'Driver Fees & Route Expenses:')}</span>
                  <span className="font-mono font-semibold">
                    -{formatCurrency(approveModalTrip.total_additional_fees)}
                  </span>
                </div>
              )}
              {approveModalTrip.total_additional_fees > 0 && (
                <div className="flex justify-between items-center text-xs text-slate-400 pl-2 pt-0.5 border-t border-slate-700/40">
                  <span>{t('net_receivable_after_fees', 'Net After Driver Expenses:')}</span>
                  <span className="text-slate-300 font-mono font-bold">
                    {formatCurrency(approveModalTrip.total_revenue || approveModalTrip.net_revenue)}
                  </span>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmApproval} className="space-y-4">
              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {t('select_payment_method', 'Payment Method / Destination Bank *')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setApprovalForm({ ...approvalForm, payment_method: m.id })}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition flex items-center space-x-2 ${
                        approvalForm.payment_method === m.id
                          ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-base">{m.icon}</span>
                      <span className="text-[11px] truncate">{m.short}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('gross_paid_amount_etb', 'Gross Amount Received from Customer (ETB) *')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={approvalForm.paid_amount}
                    onChange={(e) => setApprovalForm({ ...approvalForm, paid_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold rounded-xl text-sm outline-none focus:border-amber-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t('gross_approval_note', 'Company receives this full gross amount. Incurred driver expenses and route fees will be deducted.')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('payment_date', 'Payment Received Date *')}
                  </label>
                  <input
                    type="date"
                    value={approvalForm.paid_at}
                    onChange={(e) => setApprovalForm({ ...approvalForm, paid_at: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Reference ID / Slip # */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('payment_ref', 'Transaction Reference / Receipt / Slip #')}
                </label>
                <input
                  type="text"
                  placeholder={t('payment_ref_sample_ph', 'e.g. CBE FT23098321 or Bank Slip # or Check #1002')}
                  value={approvalForm.payment_ref}
                  onChange={(e) => setApprovalForm({ ...approvalForm, payment_ref: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Payer / Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('payer_name', 'Payer / Client Name / Company')}
                </label>
                <input
                  type="text"
                  placeholder={t('payer_company_ph', 'e.g. Midroc Construction, Sur Construction, Client Name')}
                  value={approvalForm.payer_name}
                  onChange={(e) => setApprovalForm({ ...approvalForm, payer_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('payment_notes', 'Payment Notes (Optional)')}
                </label>
                <input
                  type="text"
                  placeholder={t('payment_audit_notes_ph', 'e.g. Fully cleared in branch, checked against bank statement')}
                  value={approvalForm.payment_notes}
                  onChange={(e) => setApprovalForm({ ...approvalForm, payment_notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                />
              </div>

              {/* Info Note */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center space-x-2 text-[11px] text-emerald-300">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {t('approve_reflect_dashboard_note', "Approving this will instantly reflect this trip's revenue in the Main Dashboard (Today & Monthly revenue, net profit, and analytics).")}
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setApproveModalTrip(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingAction ? 'Approving...' : t('confirm_and_approve', 'Confirm & Mark as Paid')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Batch Approve Modal */}
      {batchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    {t('batch_approve_title', 'Batch Approve Trip Payments')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Approve {selectedTripIds.length} selected hauling trips in a single transaction
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBatchModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Highlight */}
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[11px] text-emerald-400 font-bold uppercase">{t('total_batch_revenue', 'Total Batch Revenue')}</div>
                <div className="text-2xl font-black text-white font-mono mt-0.5">
                  {formatCurrency(selectedTotalAmount)}
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs">
                {selectedTripIds.length} {t('menu_trips', 'Trips')}
              </span>
            </div>

            <form onSubmit={handleBatchApproveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  {t('select_payment_method', 'Payment Method *')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setBatchForm({ ...batchForm, payment_method: m.id })}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition flex items-center space-x-2 ${
                        batchForm.payment_method === m.id
                          ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-base">{m.icon}</span>
                      <span className="text-[11px] truncate">{m.short}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {t('payment_ref', 'Transaction Reference / Check #')}
                </label>
                <input
                  type="text"
                  placeholder={t('batch_ref_ph', 'e.g. CBE Batch Transfer Ref #9932')}
                  value={batchForm.payment_ref}
                  onChange={(e) => setBatchForm({ ...batchForm, payment_ref: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('payer_name', 'Payer / Client Name')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('ph_client_company_example', 'e.g. Client Company')}
                    value={batchForm.payer_name}
                    onChange={(e) => setBatchForm({ ...batchForm, payer_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {t('payment_date', 'Payment Date')}
                  </label>
                  <input
                    type="date"
                    value={batchForm.paid_at}
                    onChange={(e) => setBatchForm({ ...batchForm, paid_at: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingAction ? 'Processing...' : `Approve All ${selectedTripIds.length} Trips`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. View Receipt / Payment Details Modal */}
      {viewModalTrip && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{t('payment_receipt_audit', 'Payment Receipt Audit')}</h3>
                  <p className="text-xs text-slate-400 font-mono">{t('trip_prefix', 'Trip')} #{viewModalTrip.trip_number}</p>
                </div>
              </div>
              <button
                onClick={() => setViewModalTrip(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('payment_status_label', 'Payment Status:')}</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('fully_paid_realized', 'Fully Paid & Realized')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('payment_method_label', 'Payment Method:')}</span>
                  <span className="text-white font-bold uppercase">{viewModalTrip.payment_method || 'CBE'}</span>
                </div>
                {viewModalTrip.payment_ref && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('transaction_ref_label', 'Transaction Ref:')}</span>
                    <span className="text-amber-400 font-mono font-bold">{viewModalTrip.payment_ref}</span>
                  </div>
                )}
                {viewModalTrip.payer_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('payer_name_label', 'Payer Name:')}</span>
                    <span className="text-white font-semibold">{viewModalTrip.payer_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('amount_paid_label', 'Gross Amount Received:')}</span>
                  <span className="text-emerald-400 font-mono font-black text-sm">
                    {formatCurrency(viewModalTrip.paid_amount || viewModalTrip.gross_revenue || viewModalTrip.total_revenue)}
                  </span>
                </div>
                {viewModalTrip.total_additional_fees > 0 && (
                  <div className="flex justify-between text-xs text-rose-300">
                    <span>{t('additional_fees_expenses', 'Driver Fees & Route Expenses Deducted:')}</span>
                    <span className="font-mono font-bold">-{formatCurrency(viewModalTrip.total_additional_fees)}</span>
                  </div>
                )}
                {viewModalTrip.total_additional_fees > 0 && (
                  <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-700/60">
                    <span>{t('net_receivable_after_fees', 'Net Company Revenue:')}</span>
                    <span className="text-white font-mono font-bold">
                      {formatCurrency(viewModalTrip.net_revenue > 0 ? viewModalTrip.net_revenue : ((viewModalTrip.paid_amount || viewModalTrip.gross_revenue || viewModalTrip.total_revenue) - viewModalTrip.total_additional_fees))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('payment_date_label', 'Payment Date:')}</span>
                  <span className="text-slate-300">
                    {viewModalTrip.paid_at ? formatDate(viewModalTrip.paid_at) : 'N/A'}
                  </span>
                </div>
                {viewModalTrip.paid_by && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('approved_by_label', 'Approved By:')}</span>
                    <span className="text-slate-200 font-semibold">{viewModalTrip.paid_by}</span>
                  </div>
                )}
                {viewModalTrip.payment_notes && (
                  <div className="pt-2 border-t border-slate-700/60 text-slate-400 italic">
                    "{viewModalTrip.payment_notes}"
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('truck_plate_field_label', 'Truck Plate:')}</span>
                  <span className="text-slate-300 font-semibold">{viewModalTrip.truck_plate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('driver_field_colon', 'Driver:')}</span>
                  <span className="text-slate-300">{viewModalTrip.driver_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('route_col', 'Route')}:</span>
                  <span className="text-slate-300">{viewModalTrip.loading_site_name} → {viewModalTrip.dumping_site_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('material_col', 'Material')}:</span>
                  <span className="text-slate-300">{viewModalTrip.material_name} ({viewModalTrip.quantity} {viewModalTrip.unit})</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setViewModalTrip(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {t('close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
