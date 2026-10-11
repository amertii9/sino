import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatNumber } from '../../utils/formatters';
import {
  X,
  Wrench,
  CheckCircle,
  AlertCircle,
  Gauge,
  Truck,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

export const MaintenanceRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { user, driver, truck } = useAuth();
  const { t } = useLanguage();

  const DEFAULT_MAINT_TYPES = [
    { id: 'oil_change', label: 'Engine Oil & Filter', icon: '🛢️' },
    { id: 'tire_replacement', label: 'Tire Repair / Change', icon: '🛞' },
    { id: 'brake_repair', label: 'Brakes & Air System', icon: '🛑' },
    { id: 'engine_repair', label: 'Engine / Overheating', icon: '⚙️' },
    { id: 'electrical_repair', label: 'Battery & Lights', icon: '⚡' },
    { id: 'general_service', label: 'General Service', icon: '🔧' },
    { id: 'other', label: 'Other Work / Breakdown', icon: '⚠️' },
  ];

  const priorities = [
    { id: 'normal', label: t('priority_normal_opt', 'Routine / Normal') },
    { id: 'high', label: t('priority_high_opt', 'High Priority') },
    { id: 'urgent', label: t('priority_urgent_opt', 'Urgent / Breakdown') },
  ];

  const [maintTypes, setMaintTypes] = useState(DEFAULT_MAINT_TYPES);
  const [maintenanceType, setMaintenanceType] = useState('oil_change');
  const [priority, setPriority] = useState('normal');
  const [odometerReading, setOdometerReading] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successReq, setSuccessReq] = useState(null);

  // Load custom maintenance suggestions from system settings
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const settings = await api.get('/settings');
        if (settings?.maintenance_suggestions?.length > 0) {
          setMaintTypes(settings.maintenance_suggestions);
        }
      } catch (err) {
        // Fallback to DEFAULT_MAINT_TYPES
      }
    };

    fetchSuggestions();
    const handleUpdated = () => fetchSuggestions();
    window.addEventListener('maintenance-suggestions-updated', handleUpdated);
    return () => window.removeEventListener('maintenance-suggestions-updated', handleUpdated);
  }, []);

  const [prevOdo, setPrevOdo] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessReq(null);
      setDescription('');
      setCost('');
      setPriority('normal');
      setMaintenanceType(maintTypes[0]?.id || 'oil_change');
      setOdometerReading('');
      setPrevOdo(0);

      // Fetch last recorded odometer reading strictly from driver/system logs
      api.get('/odometer/today')
        .then(res => {
          const lastReading = res?.last_reading || 0;
          if (lastReading > 0) {
            setPrevOdo(lastReading);
            setOdometerReading(String(lastReading));
          } else {
            setPrevOdo(0);
            setOdometerReading('');
          }
        })
        .catch(() => {
          setPrevOdo(0);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError(t('maint_err_desc', 'Please enter a description of the issue or maintenance required'));
      return;
    }

    const odoVal = parseFloat(odometerReading);
    if (odometerReading && !isNaN(odoVal) && odoVal > 0) {
      if (prevOdo > 0 && odoVal < prevOdo) {
        setError(t('maint_err_odo_too_low', `Odometer reading (${formatNumber(odoVal)} km) cannot be less than previous recorded reading (${formatNumber(prevOdo)} km). Truck mileage must increase as the vehicle travels.`));
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        truck_id: truck?.id || '',
        truck_plate: truck?.plate_number || '',
        maintenance_type: maintenanceType,
        priority: priority,
        mileage: parseFloat(odometerReading) || 0,
        cost: parseFloat(cost) || 0,
        description: description.trim(),
      };

      const res = await api.post('/maintenance-requests', payload);
      setSuccessReq(res);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to submit maintenance request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center shadow-inner">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {t('maint_modal_title', 'Request Maintenance')}
              </h3>
              <p className="text-xs text-slate-400">
                {truck?.plate_number ? `Truck: ${truck.plate_number}` : t('maint_modal_sub', 'Report truck issue or request service')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successReq ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-white">
                  {t('maint_submitted_title', 'Maintenance Request Submitted!')}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {t('maint_submitted_msg', 'Fleet managers have been notified. Your request has been queued for review.')}
                </p>
              </div>

              <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-xs text-left space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('ref_number', 'Request Number')}:</span>
                  <span className="font-mono font-bold text-amber-400">{successReq.maintenance_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('truck', 'Truck')}:</span>
                  <span className="font-bold text-slate-200">{successReq.truck_plate || truck?.plate_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('type', 'Service Type')}:</span>
                  <span className="font-bold text-slate-200 capitalize">{successReq.maintenance_type?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('priority', 'Priority')}:</span>
                  <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-full ${
                    successReq.priority === 'urgent'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : successReq.priority === 'high'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  }`}>
                    {successReq.priority || 'Normal'}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-purple-600/20 transition cursor-pointer"
              >
                {t('done', 'Done')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Truck Plate Info Card */}
              <div className="p-3 bg-slate-800/70 border border-slate-700/80 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t('assigned_truck', 'Vehicle Assigned')}
                    </div>
                    <div className="text-sm font-black text-white">
                      {truck?.plate_number || t('no_truck_assigned', 'No Truck Assigned')}
                    </div>
                  </div>
                </div>
                {truck?.model && (
                  <span className="text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-xl border border-slate-700/50">
                    {truck.model}
                  </span>
                )}
              </div>

              {/* Maintenance / Service Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>{t('maint_issue_type', 'What is the issue / maintenance required?')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{t('tap_to_select_issue', 'Tap to select preset issue')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {maintTypes.map(mt => {
                    const isSelected = maintenanceType === mt.id;
                    return (
                      <button
                        type="button"
                        key={mt.id}
                        onClick={() => {
                          setMaintenanceType(mt.id);
                          if (!description) {
                            setDescription(mt.label);
                          }
                        }}
                        className={`p-2.5 rounded-2xl text-left border transition text-xs flex items-center space-x-2 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-500 font-black shadow-md shadow-purple-500/20'
                            : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-white'
                        }`}
                      >
                        <span className="text-base">{mt.icon || '🔧'}</span>
                        <span className="truncate">{mt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority / Urgency */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>{t('urgency_level', 'Urgency Level')}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{t('select_urgency', 'How critical is the repair?')}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {priorities.map(p => {
                    const isSelected = priority === p.id;
                    let style = '';
                    if (p.id === 'urgent') {
                      style = isSelected
                        ? 'bg-rose-600 text-white border-rose-600 font-black shadow-md shadow-rose-600/30 ring-2 ring-rose-400/50'
                        : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40 font-bold';
                    } else if (p.id === 'high') {
                      style = isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-black shadow-md shadow-amber-500/30 ring-2 ring-amber-300/50'
                        : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40 font-bold';
                    } else {
                      style = isSelected
                        ? 'bg-purple-600 text-white border-purple-600 font-black shadow-md shadow-purple-600/30 ring-2 ring-purple-400/50'
                        : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border-purple-500/40 font-bold';
                    }

                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPriority(p.id)}
                        className={`py-2 px-2 rounded-xl text-center border text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${style}`}
                      >
                        {isSelected && <span className="text-xs font-black">✓</span>}
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mileage & Incurred Cost Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Current Odometer */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t('odometer_km', 'Odometer Reading (km)')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min={prevOdo > 0 ? prevOdo : undefined}
                      value={odometerReading}
                      onChange={e => setOdometerReading(e.target.value)}
                      placeholder={prevOdo > 0 ? `Min: ${prevOdo} km` : 'e.g. 52400'}
                      className={`w-full bg-slate-800 border rounded-2xl py-2.5 px-3 pl-9 text-white font-mono font-bold text-sm focus:outline-none transition-colors ${
                        prevOdo > 0 && odometerReading && parseFloat(odometerReading) < prevOdo
                          ? 'border-red-500 text-red-400 focus:border-red-500'
                          : 'border-slate-700 focus:border-purple-500'
                      }`}
                    />
                    <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                  {prevOdo > 0 && (
                    <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{t('min_allowed', 'Min allowed:')}</span>
                      <span className="font-mono font-bold text-amber-400">{formatNumber(prevOdo)} km</span>
                    </div>
                  )}
                  {prevOdo > 0 && odometerReading && parseFloat(odometerReading) < prevOdo && (
                    <div className="mt-1 text-[11px] text-red-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Cannot be &lt; {formatNumber(prevOdo)} km</span>
                    </div>
                  )}
                </div>

                {/* Incurred Cost (optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t('maint_cost_label', 'Cost Paid (ETB) ')}
                    <span className="text-[10px] text-slate-500 font-normal">({t('optional', 'Optional')})</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={cost}
                      onChange={e => setCost(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-2.5 px-3 text-white font-mono font-bold text-sm focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {t('maint_problem_desc', 'Describe the Issue / Damage')} *
                </label>
                <textarea
                  rows="3"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('maint_desc_placeholder', 'E.g., Brake pedal feels soft and makes squeaking sound; oil pressure indicator flickered on the dashboard...')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-slate-200 text-xs focus:outline-none focus:border-purple-500 transition resize-none leading-relaxed"
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (prevOdo > 0 && odometerReading && parseFloat(odometerReading) < prevOdo)}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-black text-sm rounded-2xl shadow-xl shadow-purple-600/25 flex items-center justify-center space-x-2 transition cursor-pointer touch-btn"
              >
                {loading ? (
                  <span>{t('submitting', 'Submitting...')}</span>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    <span>{t('submit_maint_req', 'Submit Maintenance Request')}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
