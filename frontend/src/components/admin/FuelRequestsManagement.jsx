import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  Fuel,
  CheckCircle,
  XCircle,
  DollarSign,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  X,
  Save
} from 'lucide-react';

export const FuelRequestsManagement = () => {
  const { t } = useLanguage();
  const [requests, setRequests] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'approved', 'paid', 'all'
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [approveModal, setApproveModal] = useState({ open: false, req: null, amount: 0, note: '' });
  const [rejectModal, setRejectModal] = useState({ open: false, req: null, note: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [adminFuelPresets, setAdminFuelPresets] = useState([50, 80, 100, 150, 200, 300]);
  const [newPresetVal, setNewPresetVal] = useState('');
  const [savingPresets, setSavingPresets] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [fuelFormData, setFuelFormData] = useState({
    truck_id: '',
    truck_plate: '',
    driver_id: '',
    driver_name: '',
    amount_requested: 2000,
    amount_approved: 2000,
    status: 'paid',
    reason: '',
    fuel_station: '',
    admin_note: '',
    requested_at: new Date().toISOString().slice(0, 10),
  });

  const fetchFuelData = async () => {
    try {
      const [reqData, truckData, driverData, settingsData] = await Promise.all([
        api.get('/fuel-requests'),
        api.get('/trucks').catch(() => []),
        api.get('/drivers').catch(() => []),
        api.get('/settings').catch(() => null),
      ]);
      setRequests(reqData || []);
      setTrucks(truckData || []);
      setDrivers(driverData || []);
      if (settingsData?.fuel_liters_presets && settingsData.fuel_liters_presets.length > 0) {
        setAdminFuelPresets(settingsData.fuel_liters_presets);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFuelData();
  }, []);

  const handleApprove = async () => {
    if (!approveModal.amount || approveModal.amount <= 0) {
      alert('Please enter a valid approved amount');
      return;
    }
    try {
      await api.patch(`/fuel-requests/${approveModal.req.id}/approve`, {
        amount_approved: parseFloat(approveModal.amount),
        admin_note: approveModal.note,
      });
      setApproveModal({ open: false, req: null, amount: 0, note: '' });
      fetchFuelData();
    } catch (err) {
      alert('Approval failed: ' + err.message);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.note.trim()) {
      alert('Please enter a rejection reason');
      return;
    }
    try {
      await api.patch(`/fuel-requests/${rejectModal.req.id}/reject`, {
        admin_note: rejectModal.note,
      });
      setRejectModal({ open: false, req: null, note: '' });
      fetchFuelData();
    } catch (err) {
      alert('Rejection failed: ' + err.message);
    }
  };

  const handleMarkPaid = async (reqId) => {
    if (!confirm('Disburse fuel money now? This will automatically create a company fuel expense record.')) return;
    try {
      const res = await api.patch(`/fuel-requests/${reqId}/paid`);
      alert(res.message || 'Marked as paid and operational expense created');
      fetchFuelData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const openCreateModal = () => {
    const firstTruck = trucks[0] || {};
    setEditingRequest(null);
    setFuelFormData({
      truck_id: firstTruck.id || '',
      truck_plate: firstTruck.plate_number || '',
      driver_id: firstTruck.driver_assigned_id || '',
      driver_name: firstTruck.driver_assigned_name || '',
      amount_requested: 2000,
      amount_approved: 2000,
      status: 'paid',
      reason: 'Diesel fuel advance',
      fuel_station: 'TotalEnergies Kality',
      admin_note: 'Approved per operational quota',
      requested_at: new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const openEditModal = (r) => {
    setEditingRequest(r);
    setFuelFormData({
      truck_id: r.truck_id || '',
      truck_plate: r.truck_plate || '',
      driver_id: r.driver_id || '',
      driver_name: r.driver_name || '',
      amount_requested: r.amount_requested || 0,
      amount_approved: r.amount_approved || r.amount_requested || 0,
      status: r.status || 'pending',
      reason: r.reason || '',
      fuel_station: r.fuel_station || '',
      admin_note: r.admin_note || '',
      requested_at: r.requested_at ? r.requested_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const handleSaveFuelForm = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        truck_id: fuelFormData.truck_id,
        truck_plate: fuelFormData.truck_plate,
        driver_id: fuelFormData.driver_id,
        driver_name: fuelFormData.driver_name,
        amount_requested: parseFloat(fuelFormData.amount_requested) || 0,
        amount_approved: parseFloat(fuelFormData.amount_approved) || parseFloat(fuelFormData.amount_requested) || 0,
        status: fuelFormData.status,
        reason: fuelFormData.reason,
        fuel_station: fuelFormData.fuel_station,
        admin_note: fuelFormData.admin_note,
        requested_at: fuelFormData.requested_at ? new Date(fuelFormData.requested_at).toISOString() : undefined,
      };

      if (editingRequest) {
        await api.put(`/fuel-requests/${editingRequest.id}`, payload);
      } else {
        await api.post('/fuel-requests', payload);
      }

      setModalOpen(false);
      setEditingRequest(null);
      fetchFuelData();
    } catch (err) {
      alert('Failed to save fuel information: ' + err.message);
    }
  };

  const handleDeleteFuelRequest = async (r) => {
    if (!confirm(`Are you sure you want to permanently delete Fuel Request #${r.request_number || ''}?`)) return;
    try {
      await api.delete(`/fuel-requests/${r.id}`);
      setModalOpen(false);
      fetchFuelData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab !== 'all' && r.status !== activeTab) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        r.request_number?.toLowerCase().includes(s) ||
        r.driver_name?.toLowerCase().includes(s) ||
        r.truck_plate?.toLowerCase().includes(s) ||
        r.reason?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalFuelPaid = requests
    .filter(r => r.status === 'paid')
    .reduce((acc, r) => acc + (r.amount_approved || r.amount_requested || 0), 0);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Fuel className="w-6 h-6 text-emerald-400" /> {t('fuel_mgmt_title', 'Fuel Management & Advances')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('fuel_mgmt_sub', 'Review driver fuel advance requests, approve disbursements, and track fuel expenses')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setPresetModalOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
            title="Configure quick-select liter presets for drivers"
          >
            <Fuel className="w-4 h-4" /> {t('fuel_quick_amount', 'Quick Presets')}
          </button>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" /> {t('fuel_new_btn', '+ New Fuel Request')}
          </button>
          <button
            onClick={fetchFuelData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] text-slate-400">{t('fuel_kpi_pending', 'Pending Approval')}</div>
          <div className={`text-xl font-black mt-1 ${pendingCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
            {pendingCount}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] text-slate-400">{t('fuel_tab_approved', 'Approved')}</div>
          <div className="text-xl font-black text-blue-400 mt-1">
            {requests.filter(r => r.status === 'approved').length}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] text-slate-400">{t('fuel_kpi_disbursed', 'Total Fuel Disbursed')}</div>
          <div className="text-xl font-black text-emerald-400 mt-1">
            {formatCurrency(totalFuelPaid)}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] text-slate-400">{t('fuel_kpi_total', 'Total Requests')}</div>
          <div className="text-xl font-black text-white mt-1">{requests.length}</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl text-xs w-full sm:w-auto">
          {[
            { id: 'pending', label: `${t('fuel_tab_pending', 'Pending')} (${pendingCount})` },
            { id: 'approved', label: t('fuel_tab_approved', 'Approved') },
            { id: 'paid', label: t('fuel_tab_paid', 'Disbursed/Paid') },
            { id: 'rejected', label: t('cancelled', 'Rejected') },
            { id: 'all', label: t('fuel_tab_all', 'All Requests') },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl font-semibold transition ${
                activeTab === tab.id ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t('search', 'Search fuel requests...')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">{t('fuel_req_number', 'Req #')}</th>
                <th className="py-3 px-3">{t('date', 'Date')}</th>
                <th className="py-3 px-3">{t('driver', 'Driver')}</th>
                <th className="py-3 px-3">{t('truck_plate', 'Truck Plate')}</th>
                <th className="py-3 px-3">{t('fuel_amount_req', 'Amount Requested')}</th>
                <th className="py-3 px-3">{t('fuel_approved_amt', 'Approved Amount')}</th>
                <th className="py-3 px-3">{t('fuel_station_label', 'Reason / Station')}</th>
                <th className="py-3 px-3">{t('status', 'Status')}</th>
                <th className="py-3 px-3 text-right">{t('actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    {t('fuel_no_reqs', 'No fuel requests found.')}
                  </td>
                </tr>
              ) : (
                filteredRequests.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">{r.request_number}</td>
                    <td className="py-3 px-3 text-slate-400">{formatDate(r.requested_at)}</td>
                    <td className="py-3 px-3 font-bold text-slate-200">{r.driver_name}</td>
                    <td className="py-3 px-3 font-semibold text-slate-300">{r.truck_plate}</td>
                    <td className="py-3 px-3 font-bold text-slate-100">{formatCurrency(r.amount_requested)}</td>
                    <td className="py-3 px-3 font-black text-emerald-400">
                      {r.amount_approved > 0 ? formatCurrency(r.amount_approved) : '-'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {r.fuel_source === 'reserve_fuel' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            🛢️ {t('fuel_source_reserve', 'Reserve Fuel')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ⛽ {t('fuel_source_gas', 'Gas Station')}
                          </span>
                        )}
                        {r.liters > 0 && (
                          <span className="text-[10px] font-bold text-slate-200 font-mono">
                            {r.liters} L {r.price_per_liter > 0 ? `@ ${r.price_per_liter} ETB/L` : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-200">{r.reason}</div>
                      {r.odometer_reading > 0 && (
                        <div className="text-[10px] text-amber-400 font-mono">
                          {t('tab_odometer', 'Odometer')}: {r.odometer_reading} km
                        </div>
                      )}
                      {r.fuel_station && <div className="text-[10px] text-slate-400">{t('fuel_station', 'Station')}: {r.fuel_station}</div>}
                      {r.admin_note && <div className="text-[10px] text-amber-400">{t('fuel_admin_note', 'Note')}: {r.admin_note}</div>}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
                          r.status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : r.status === 'approved'
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            : r.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() =>
                              setApproveModal({
                                open: true,
                                req: r,
                                amount: r.amount_requested,
                                note: 'Approved per standard route quota',
                              })
                            }
                            className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg touch-btn"
                          >
                            {t('fuel_btn_approve', 'Approve')}
                          </button>
                          <button
                            onClick={() => setRejectModal({ open: true, req: r, note: '' })}
                            className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-semibold rounded-lg"
                          >
                            {t('fuel_btn_reject', 'Reject')}
                          </button>
                        </>
                      )}

                      {r.status === 'approved' && (
                        <button
                          onClick={() => handleMarkPaid(r.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-sm touch-btn flex items-center gap-1 inline-flex"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> {t('fuel_btn_mark_paid', 'Disburse Cash')}
                        </button>
                      )}

                      {r.status === 'paid' && (
                        <span className="text-[10px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {t('fuel_tab_paid', 'Paid')}
                        </span>
                      )}

                      <button
                        onClick={() => openEditModal(r)}
                        className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-slate-700 inline-flex items-center"
                        title="Edit Fuel Request"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteFuelRequest(r)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 inline-flex items-center"
                        title="Delete Fuel Request"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVE MODAL (Requirement 24: Admin can edit approved amount!) */}
      {approveModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 space-y-4">
            <div className="p-3 bg-slate-800/80 rounded-xl space-y-1.5 text-xs border border-slate-700/60">
              <div className="flex justify-between">
                <span className="text-slate-400">Fuel Source:</span>
                <span className="font-bold text-white">
                  {approveModal.req?.fuel_source === 'reserve_fuel' ? '🛢️ Reserve Fuel' : '⛽ Gas Station'}
                </span>
              </div>
              {approveModal.req?.liters > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume & Rate:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {approveModal.req.liters} L {approveModal.req.price_per_liter > 0 ? `@ ${approveModal.req.price_per_liter} ETB/L` : ''}
                  </span>
                </div>
              )}
              {approveModal.req?.odometer_reading > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Odometer:</span>
                  <span className="font-bold text-slate-200 font-mono">
                    {approveModal.req.odometer_reading} km
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-700">
                <span className="text-slate-400">Total Requested:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {formatCurrency(approveModal.req?.amount_requested)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Approved Amount (ETB):
              </label>
              <input
                type="number"
                value={approveModal.amount}
                onChange={e => setApproveModal({ ...approveModal, amount: e.target.value })}
                className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-emerald-400 font-mono font-bold text-lg"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                You can adjust this amount (e.g. Requested 3,000 → Approve 2,500).
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Admin Note / Voucher Reference:
              </label>
              <input
                type="text"
                value={approveModal.note}
                onChange={e => setApproveModal({ ...approveModal, note: e.target.value })}
                className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                placeholder="e.g. Fuel voucher #982 assigned"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setApproveModal({ open: false, req: null, amount: 0, note: '' })}
                className="px-3 py-1.5 text-xs text-slate-400"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleApprove}
                className="px-5 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md"
              >
                {t('fuel_btn_approve', 'Approve Request')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">{t('fuel_btn_reject', 'Reject Fuel Request')}</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Rejection (Required):
              </label>
              <textarea
                rows="3"
                value={rejectModal.note}
                onChange={e => setRejectModal({ ...rejectModal, note: e.target.value })}
                placeholder="e.g. Truck refueled yesterday, quota exceeded"
                className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModal({ open: false, req: null, note: '' })}
                className="px-3 py-1.5 text-xs text-slate-400"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                onClick={handleReject}
                className="px-5 py-2 bg-red-600 text-white font-bold text-xs rounded-xl"
              >
                {t('fuel_btn_reject', 'Confirm Rejection')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT FUEL REQUEST MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingRequest ? 'Edit Fuel Advance Request' : 'Log New Fuel Advance'}
                  </h3>
                  <span className="font-mono text-xs text-amber-400">
                    {editingRequest ? `#${editingRequest.request_number || editingRequest.id}` : 'Manual entry into fuel register'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFuelForm} className="space-y-3.5 text-xs">
              {/* Truck & Driver Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Assigned Truck *</label>
                  <select
                    value={fuelFormData.truck_id}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const trk = trucks.find(t => String(t.id) === String(selId));
                      if (trk) {
                        setFuelFormData(prev => ({
                          ...prev,
                          truck_id: trk.id,
                          truck_plate: trk.plate_number,
                          driver_id: trk.driver_assigned_id || prev.driver_id,
                          driver_name: trk.driver_assigned_name || prev.driver_name,
                        }));
                      } else {
                        setFuelFormData(prev => ({ ...prev, truck_id: '', truck_plate: '' }));
                      }
                    }}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    required
                  >
                    <option value="">-- Select Truck --</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.plate_number} ({t.model || 'Truck'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Driver</label>
                  <select
                    value={fuelFormData.driver_id}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const drv = drivers.find(d => String(d.id) === String(selId));
                      if (drv) {
                        setFuelFormData(prev => ({
                          ...prev,
                          driver_id: drv.id,
                          driver_name: drv.full_name,
                        }));
                      } else {
                        setFuelFormData(prev => ({ ...prev, driver_id: '', driver_name: '' }));
                      }
                    }}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- Select Driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({d.phone || 'Driver'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount Requested & Approved */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Amount Requested (ETB) *</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={fuelFormData.amount_requested}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFuelFormData(prev => ({
                        ...prev,
                        amount_requested: val,
                        amount_approved: prev.amount_approved === prev.amount_requested ? val : prev.amount_approved,
                      }));
                    }}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Amount Disbursed / Approved (ETB)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={fuelFormData.amount_approved}
                    onChange={(e) => setFuelFormData({ ...fuelFormData, amount_approved: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-emerald-400 font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Status & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Status *</label>
                  <select
                    value={fuelFormData.status}
                    onChange={(e) => setFuelFormData({ ...fuelFormData, status: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Disbursed / Paid (Syncs Expense)</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Date</label>
                  <input
                    type="date"
                    value={fuelFormData.requested_at}
                    onChange={(e) => setFuelFormData({ ...fuelFormData, requested_at: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Station & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Fuel Station:</label>
                  <input
                    type="text"
                    placeholder="e.g. TotalEnergies Bole"
                    value={fuelFormData.fuel_station}
                    onChange={(e) => setFuelFormData({ ...fuelFormData, fuel_station: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Reason / Purpose *</label>
                  <input
                    type="text"
                    value={fuelFormData.reason}
                    onChange={(e) => setFuelFormData({ ...fuelFormData, reason: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Admin Notes / Voucher #:</label>
                <textarea
                  rows="2"
                  value={fuelFormData.admin_note}
                  onChange={(e) => setFuelFormData({ ...fuelFormData, admin_note: e.target.value })}
                  placeholder="Notes, voucher references..."
                  className="w-full py-2 px-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white resize-none focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                {editingRequest ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteFuelRequest(editingRequest)}
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
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingRequest ? 'Save Changes' : 'Log Fuel Advance'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PRESETS MODAL */}
      {presetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Fuel className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Fuel Quick-Select Presets</h3>
              </div>
              <button
                type="button"
                onClick={() => setPresetModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Configure the 1-tap liter chips that drivers see when requesting fuel (e.g. 50 L, 80 L, 100 L, 150 L, 200 L, 300 L).
            </p>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center min-h-[3rem] p-3 bg-slate-950 rounded-2xl border border-slate-800">
                {adminFuelPresets.map((lit, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-white flex items-center gap-2"
                  >
                    <span className="text-amber-400 font-mono">{lit} L</span>
                    <button
                      type="button"
                      onClick={() => setAdminFuelPresets(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-400 font-bold text-xs cursor-pointer"
                      title="Remove preset"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {adminFuelPresets.length === 0 && (
                  <span className="text-xs text-slate-500 italic">No presets added. Drivers will enter liters manually.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="Enter liters (e.g. 250)"
                  value={newPresetVal}
                  onChange={e => setNewPresetVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = parseFloat(newPresetVal);
                      if (val > 0 && !adminFuelPresets.includes(val)) {
                        setAdminFuelPresets(prev => [...prev, val].sort((a,b) => a-b));
                      }
                      setNewPresetVal('');
                    }
                  }}
                  className="flex-1 py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseFloat(newPresetVal);
                    if (val > 0 && !adminFuelPresets.includes(val)) {
                      setAdminFuelPresets(prev => [...prev, val].sort((a,b) => a-b));
                    }
                    setNewPresetVal('');
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer"
                >
                  + Add
                </button>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdminFuelPresets([50, 80, 100, 150, 200, 300])}
                  className="text-xs text-slate-400 hover:text-amber-400 underline cursor-pointer"
                >
                  Reset Defaults
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPresetModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingPresets}
                    onClick={async () => {
                      setSavingPresets(true);
                      try {
                        const sanitized = adminFuelPresets.map(Number).filter(n => !isNaN(n) && n > 0).sort((a,b) => a-b);
                        await api.put('/settings/fuel-presets', { fuel_liters_presets: sanitized });
                        setAdminFuelPresets(sanitized);
                        setPresetModalOpen(false);
                      } catch (err) {
                        alert('Failed: ' + err.message);
                      } finally {
                        setSavingPresets(false);
                      }
                    }}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer"
                  >
                    {savingPresets ? 'Saving...' : 'Save Presets'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
