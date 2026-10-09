import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  Wrench,
  Plus,
  Truck,
  AlertCircle,
  Calendar,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Sparkles,
  Clock,
  Check,
  X,
  Settings,
  Filter
} from 'lucide-react';

const DEFAULT_SUGGESTIONS = [
  { id: 'oil_change', label: 'Engine Oil & Filter', icon: '🛢️' },
  { id: 'tire_replacement', label: 'Tire Repair / Change', icon: '🛞' },
  { id: 'brake_repair', label: 'Brakes & Air System', icon: '🛑' },
  { id: 'engine_repair', label: 'Engine / Overheating', icon: '⚙️' },
  { id: 'electrical_repair', label: 'Battery & Lights', icon: '⚡' },
  { id: 'general_service', label: 'General Service', icon: '🔧' },
  { id: 'other', label: 'Other Work / Breakdown', icon: '⚠️' },
];

const PRESET_ICONS = ['🛢️', '🛞', '🛑', '⚙️', '⚡', '🔧', '⚠️', '🔩', '🚛', '💡', '❄️', '⛽', '🪟', '🔋', '🌡️'];

export const MaintenanceManagement = () => {
  const { t } = useLanguage();
  const [maintenance, setMaintenance] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaint, setEditingMaint] = useState(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  const [newSuggestionLabel, setNewSuggestionLabel] = useState('');
  const [newSuggestionIcon, setNewSuggestionIcon] = useState('🔧');
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [suggestionsSuccessMsg, setSuggestionsSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    truck_id: '',
    maintenance_type: 'oil_change',
    mileage: 50000,
    cost: 3500,
    next_date: '',
    next_mileage: 60000,
    description: '',
    status: 'completed',
    priority: 'normal',
  });

  const loadData = async () => {
    try {
      const [m, t, s] = await Promise.all([
        api.get('/maintenance'),
        api.get('/trucks'),
        api.get('/settings').catch(() => null),
      ]);
      setMaintenance(m || []);
      setTrucks(t || []);
      if (s?.maintenance_suggestions?.length > 0) {
        setSuggestions(s.maintenance_suggestions);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingMaint(null);
    setFormData({
      truck_id: '',
      maintenance_type: suggestions[0]?.id || 'oil_change',
      mileage: 50000,
      cost: 3500,
      next_date: '',
      next_mileage: 60000,
      description: '',
      status: 'completed',
      priority: 'normal',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (m) => {
    setEditingMaint(m);
    setFormData({
      truck_id: m.truck_id || '',
      maintenance_type: m.maintenance_type || 'oil_change',
      mileage: m.mileage || 0,
      cost: m.cost || 0,
      next_date: m.next_date || '',
      next_mileage: m.next_mileage || 0,
      description: m.description || '',
      status: m.status || 'completed',
      priority: m.priority || 'normal',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const trk = trucks.find(t => t.id === formData.truck_id);
      const payload = {
        ...formData,
        truck_plate: trk?.plate_number || (editingMaint ? editingMaint.truck_plate : ''),
        cost: parseFloat(formData.cost) || 0,
        mileage: parseFloat(formData.mileage) || 0,
        next_mileage: parseFloat(formData.next_mileage) || 0,
      };

      if (editingMaint) {
        await api.put(`/maintenance/${editingMaint.id}`, payload);
      } else {
        await api.post('/maintenance', payload);
      }

      setIsModalOpen(false);
      setEditingMaint(null);
      loadData();
    } catch (err) {
      alert((editingMaint ? 'Failed to update maintenance: ' : 'Failed to record maintenance: ') + err.message);
    }
  };

  const handleDelete = async (m) => {
    if (!confirm(`Are you sure you want to permanently delete Maintenance #${m.maintenance_number}?`)) return;
    try {
      await api.delete(`/maintenance/${m.id}`);
      loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleApprove = async (m) => {
    try {
      await api.patch(`/maintenance/${m.id}/approve`);
      await loadData();
    } catch (err) {
      alert('Approval failed: ' + err.message);
    }
  };

  const handleReject = async (m) => {
    if (!confirm(`Reject maintenance request #${m.maintenance_number} for truck ${m.truck_plate}?`)) return;
    try {
      await api.patch(`/maintenance/${m.id}/reject`);
      await loadData();
    } catch (err) {
      alert('Rejection failed: ' + err.message);
    }
  };

  // Suggestion actions
  const handleAddSuggestion = () => {
    if (!newSuggestionLabel.trim()) return;
    const newId = newSuggestionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30) || 'custom_' + Date.now();
    const updated = [
      ...suggestions,
      {
        id: newId,
        label: newSuggestionLabel.trim(),
        icon: newSuggestionIcon || '🔧'
      }
    ];
    setSuggestions(updated);
    setNewSuggestionLabel('');
    setNewSuggestionIcon('🔧');
  };

  const handleRemoveSuggestion = (idx) => {
    if (suggestions.length <= 1) {
      alert('At least one suggestion is required.');
      return;
    }
    const updated = suggestions.filter((_, i) => i !== idx);
    setSuggestions(updated);
  };

  const handleUpdateSuggestionLabel = (idx, newLabel) => {
    const updated = [...suggestions];
    updated[idx].label = newLabel;
    setSuggestions(updated);
  };

  const handleUpdateSuggestionIcon = (idx, newIcon) => {
    const updated = [...suggestions];
    updated[idx].icon = newIcon;
    setSuggestions(updated);
  };

  const handleSaveSuggestions = async () => {
    setSavingSuggestions(true);
    try {
      await api.put('/settings/maintenance-suggestions', { maintenance_suggestions: suggestions });
      window.dispatchEvent(new CustomEvent('maintenance-suggestions-updated'));
      setSuggestionsSuccessMsg('Suggestions updated successfully! Driver view updated.');
      setTimeout(() => {
        setSuggestionsSuccessMsg('');
        setIsSuggestionsModalOpen(false);
      }, 1500);
    } catch (err) {
      alert('Failed to save suggestions: ' + err.message);
    } finally {
      setSavingSuggestions(false);
    }
  };

  const handleResetSuggestionsDefaults = () => {
    if (confirm('Reset suggestions to factory defaults?')) {
      setSuggestions(DEFAULT_SUGGESTIONS);
    }
  };

  // Counts
  const pendingCount = maintenance.filter(m => m.status === 'pending').length;
  const approvedCount = maintenance.filter(m => m.status === 'approved').length;
  const inProgressCount = maintenance.filter(m => m.status === 'in_progress').length;
  const completedCount = maintenance.filter(m => m.status === 'completed').length;

  const filteredMaintenance = maintenance.filter(m => {
    if (statusFilter === 'all') return true;
    return m.status === statusFilter;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-400" /> {t('maintenance_title', 'Fleet Maintenance & Overhauls')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('maintenance_sub', 'Review driver requests, approve repairs, and log preventive service overhauls')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsSuggestionsModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-purple-200 border border-purple-500/30 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
            title="Edit the presets shown to drivers under 'What is the issue / maintenance required?'"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Issue Suggestions</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono font-bold">
              {suggestions.length}
            </span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {t('add_maint_btn', '+ Log Maintenance Work')}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 border-b border-slate-800 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`py-2 px-3 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            statusFilter === 'all'
              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>All Records</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900/40 text-current font-mono">
            {maintenance.length}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('pending')}
          className={`py-2 px-3 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
              : pendingCount > 0
              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30 animate-pulse'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Approval</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
            pendingCount > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
          }`}>
            {pendingCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('approved')}
          className={`py-2 px-3 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            statusFilter === 'approved'
              ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>Approved</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {approvedCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`py-2 px-3 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            statusFilter === 'in_progress'
              ? 'bg-blue-500 text-slate-950 font-black shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Wrench className="w-3.5 h-3.5 text-blue-400" />
          <span>In Progress</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {inProgressCount}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('completed')}
          className={`py-2 px-3 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            statusFilter === 'completed'
              ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>Completed</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {completedCount}
          </span>
        </button>
      </div>

      {/* Grid of Maintenance Cards */}
      {filteredMaintenance.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <Wrench className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p>No maintenance records found for the selected filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaintenance.map(m => {
            const isPending = m.status === 'pending';
            const isApproved = m.status === 'approved';
            const isRejected = m.status === 'rejected';

            return (
              <div
                key={m.id}
                className={`p-5 bg-slate-900 border rounded-3xl flex flex-col justify-between space-y-3 transition ${
                  isPending
                    ? 'border-amber-500/50 shadow-md shadow-amber-500/10'
                    : isApproved
                    ? 'border-emerald-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-amber-400">{m.maintenance_number}</span>
                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          m.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : m.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : m.status === 'in_progress'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : m.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                        }`}>
                          {m.status === 'completed'
                            ? 'Completed'
                            : m.status === 'approved'
                            ? 'Approved'
                            : m.status === 'in_progress'
                            ? 'In Progress'
                            : m.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending Approval'}
                        </span>

                        {m.priority && m.priority !== 'normal' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            m.priority === 'urgent' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {m.priority.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-base text-slate-100 flex items-center gap-2 mt-1">
                        {m.truck_plate}
                        {m.driver_name && (
                          <span className="text-[11px] font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">
                            Driver: {m.driver_name}
                          </span>
                        )}
                      </h3>
                    </div>

                    <span className="text-xs font-black text-red-400 shrink-0">
                      {m.cost > 0 ? formatCurrency(m.cost) : 'Cost Pending'}
                    </span>
                  </div>

                  <div className="p-3 my-3 bg-slate-800/80 rounded-2xl border border-slate-700 text-xs space-y-1">
                    <div className="font-bold text-slate-200 capitalize">
                      {m.maintenance_type?.replace(/_/g, ' ')}
                    </div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      {m.description}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                    <span>Date: {formatDate(m.date)}</span>
                    <span>Odometer: {m.mileage || 0} km</span>
                  </div>

                  {m.next_date && (
                    <div className="text-[11px] text-amber-400 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 flex items-center gap-1.5 mt-2">
                      <Calendar className="w-3.5 h-3.5" /> Next Due: {m.next_date} ({m.next_mileage} km)
                    </div>
                  )}
                </div>

                {/* Approve / Reject Actions for Pending Requests */}
                {isPending && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(m)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition touch-btn"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve Request</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(m)}
                        className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => openEditModal(m)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" /> {isApproved ? 'Start Service / Edit' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDelete(m)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition cursor-pointer"
                    title="Delete maintenance record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL 1: RECORD / EDIT MAINTENANCE WORK ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">
              {editingMaint ? `Edit Maintenance: ${editingMaint.maintenance_number}` : 'Record Maintenance Work'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
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
                  <label className="block text-slate-300 mb-1 font-semibold">Maintenance Type:</label>
                  <select
                    value={formData.maintenance_type}
                    onChange={e => setFormData({ ...formData, maintenance_type: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    {suggestions.map(t => (
                      <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Cost (ETB):</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-red-400 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Current Mileage (km):</label>
                  <input
                    type="number"
                    value={formData.mileage}
                    onChange={e => setFormData({ ...formData, mileage: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Service Description:</label>
                <input
                  type="text"
                  placeholder="e.g. Brake pad relining and air brake tank purge"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Status:</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="pending">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Priority:</label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="normal">Normal / Routine</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent / Breakdown</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Next Service Date:</label>
                  <input
                    type="date"
                    value={formData.next_date}
                    onChange={e => setFormData({ ...formData, next_date: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Next Service km:</label>
                  <input
                    type="number"
                    value={formData.next_mileage}
                    onChange={e => setFormData({ ...formData, next_mileage: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  {editingMaint ? 'Save Changes' : 'Save & Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: MANAGE ISSUE SUGGESTIONS ================= */}
      {isSuggestionsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl my-6">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    Maintenance Issue Suggestions
                  </h3>
                  <p className="text-xs text-slate-400">
                    Options displayed to drivers under "What is the issue / maintenance required?"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSuggestionsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {suggestionsSuccessMsg && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{suggestionsSuccessMsg}</span>
                </div>
              )}

              {/* Suggestions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-400 font-semibold px-1">
                  <span>Current Issue Presets ({suggestions.length})</span>
                  <button
                    type="button"
                    onClick={handleResetSuggestionsDefaults}
                    className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {suggestions.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center gap-2"
                    >
                      {/* Icon selector dropdown */}
                      <select
                        value={item.icon || '🔧'}
                        onChange={e => handleUpdateSuggestionIcon(idx, e.target.value)}
                        className="py-1 px-2 bg-slate-900 border border-slate-700 rounded-xl text-base cursor-pointer shrink-0"
                      >
                        {PRESET_ICONS.map(ic => (
                          <option key={ic} value={ic}>{ic}</option>
                        ))}
                      </select>

                      {/* Label input */}
                      <input
                        type="text"
                        value={item.label}
                        onChange={e => handleUpdateSuggestionLabel(idx, e.target.value)}
                        placeholder="Issue title"
                        className="flex-1 py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-purple-400"
                      />

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleRemoveSuggestion(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/50 transition cursor-pointer shrink-0"
                        title="Remove suggestion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Suggestion Box */}
              <div className="p-3.5 bg-purple-500/10 border border-purple-500/25 rounded-2xl space-y-2.5">
                <span className="font-bold text-purple-300 block text-xs">
                  + Add New Issue Preset
                </span>

                {/* Quick Icon Chips */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] text-slate-400">Choose Icon:</span>
                  {PRESET_ICONS.slice(0, 8).map(ic => (
                    <button
                      type="button"
                      key={ic}
                      onClick={() => setNewSuggestionIcon(ic)}
                      className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center cursor-pointer transition ${
                        newSuggestionIcon === ic
                          ? 'bg-purple-600 ring-2 ring-purple-300'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Transmission Fluid & Clutch / Radiator Hose"
                    value={newSuggestionLabel}
                    onChange={e => setNewSuggestionLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSuggestion();
                      }
                    }}
                    className="flex-1 py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddSuggestion}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition shrink-0"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSuggestionsModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingSuggestions}
                onClick={handleSaveSuggestions}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition touch-btn flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {savingSuggestions ? 'Saving...' : 'Save & Publish Suggestions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
