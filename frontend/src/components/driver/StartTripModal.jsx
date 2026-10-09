import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../api/client';
import { formatNumber } from '../../utils/formatters';
import {
  X,
  MapPin,
  Truck,
  Package,
  Layers,
  CheckCircle,
  Plus,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Gauge,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export const StartTripModal = ({ isOpen, onClose, onSuccess, initialTrip = null }) => {
  const { truck, driver } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successTrip, setSuccessTrip] = useState(null);
  const [minAllowedOdo, setMinAllowedOdo] = useState(0);

  // Lookups
  const [loadingSites, setLoadingSites] = useState([]);
  const [dumpingSites, setDumpingSites] = useState([]);
  const [transitionPoints, setTransitionPoints] = useState([]);
  const [materials, setMaterials] = useState([]);

  // Form State (Steps 1 to 4)
  const [formData, setFormData] = useState({
    start_odometer: '',
    loading_site_id: '',
    loading_site_name: '',
    dumping_site_id: '',
    dumping_site_name: '',
    material_id: '',
    material_name: '',
    has_transition: false,
    transition_point_ids: [],
    transition_point_name: '',
  });

  const [customSiteModal, setCustomSiteModal] = useState({ open: false, type: 'loading', name: '', location: '' });

  // Load master data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setSuccessTrip(null);
    setError('');

    // Reset min odometer - calculated strictly from recorded entries
    setMinAllowedOdo(0);

    setFormData({
      start_odometer: '',
      loading_site_id: initialTrip?.loading_site_id || '',
      loading_site_name: initialTrip?.loading_site_name || '',
      dumping_site_id: initialTrip?.dumping_site_id || '',
      dumping_site_name: initialTrip?.dumping_site_name || '',
      material_id: initialTrip?.material_id || '',
      material_name: initialTrip?.material_name || '',
      has_transition: !!initialTrip?.has_transition,
      transition_point_ids: initialTrip?.transition_point_ids || [],
      transition_point_name: initialTrip?.transition_point_name || '',
    });

    Promise.all([
      api.get('/sites?type=loading'),
      api.get('/sites?type=dumping'),
      api.get('/sites?type=transition'),
      api.get('/materials'),
      api.get('/odometer/today').catch(() => null),
    ])
      .then(([load, dump, trans, mats, odoRes]) => {
        setLoadingSites(load || []);
        setDumpingSites(dump || []);
        setTransitionPoints(trans || []);
        setMaterials(mats || []);

        const lastKnown = Math.max(
          odoRes?.last_reading || 0,
          odoRes?.reading?.end_reading || 0,
          odoRes?.reading?.start_reading || 0
        );

        if (lastKnown > 0) {
          setMinAllowedOdo(lastKnown);
        } else {
          setMinAllowedOdo(0);
        }
      })
      .catch(console.error);
  }, [isOpen, truck, initialTrip]);

  if (!isOpen) return null;

  const handleCreateSite = async () => {
    if (!customSiteModal.name.trim()) return;
    try {
      const newSite = await api.post('/sites', {
        name: customSiteModal.name,
        location: customSiteModal.location || 'Local Site',
        type: customSiteModal.type,
      });

      if (customSiteModal.type === 'loading') {
        setLoadingSites(prev => [...prev, newSite]);
        setFormData(prev => ({ ...prev, loading_site_id: newSite.id, loading_site_name: newSite.name }));
        setStep(3); // advance
      } else if (customSiteModal.type === 'dumping') {
        setDumpingSites(prev => [...prev, newSite]);
        setFormData(prev => ({ ...prev, dumping_site_id: newSite.id, dumping_site_name: newSite.name }));
        setStep(4); // advance
      } else if (customSiteModal.type === 'transition') {
        setTransitionPoints(prev => [...prev, newSite]);
        setFormData(prev => ({
          ...prev,
          transition_point_ids: [newSite.id],
          transition_point_name: newSite.name,
          has_transition: true,
        }));
      }

      setCustomSiteModal({ open: false, type: 'loading', name: '', location: '' });
    } catch (err) {
      alert('Failed to create site: ' + err.message);
    }
  };

  const handleStartTripSubmit = async () => {
    const odo = parseFloat(formData.start_odometer);
    if (!odo || odo <= 0) {
      setError(t('err_valid_odometer', 'Please enter a valid starting odometer reading (km)'));
      setStep(1);
      return;
    }

    if (minAllowedOdo > 0 && odo < minAllowedOdo) {
      setError(t('err_start_odo_too_low', `Starting odometer (${formatNumber(odo)} km) cannot be less than previous recorded reading (${formatNumber(minAllowedOdo)} km). Mileage must increase as the vehicle travels.`));
      setStep(1);
      return;
    }

    if (!formData.loading_site_id) {
      setError(t('err_select_loading', 'Please select a loading site'));
      setStep(2);
      return;
    }

    if (!formData.dumping_site_id) {
      setError(t('err_select_dumping', 'Please select a destination/dumping site'));
      setStep(3);
      return;
    }

    if (!formData.material_id) {
      setError(t('err_select_material', 'Please select the cargo material'));
      setStep(4);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        truck_id: truck?.id || driver?.assigned_truck_id || '',
        truck_plate: truck?.plate_number || driver?.assigned_truck_plate || '',
        start_odometer: odo,
        loading_site_id: formData.loading_site_id,
        loading_site_name: formData.loading_site_name,
        dumping_site_id: formData.dumping_site_id,
        dumping_site_name: formData.dumping_site_name,
        material_id: formData.material_id,
        material_name: formData.material_name,
        has_transition: formData.has_transition,
        transition_point_ids: formData.transition_point_ids,
        transition_point_name: formData.transition_point_name,
      };

      const result = await api.post('/trips/start', payload);
      if (onSuccess) onSuccess(result);
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Failed to start trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-sm">
              {step <= 4 ? step : '✓'}
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {step === 1 && t('start_step1_title', 'Vehicle Odometer Reading')}
                {step === 2 && t('start_step2_title', 'Where did you load material?')}
                {step === 3 && t('start_step3_title', 'Where are you delivering / dumping?')}
                {step === 4 && t('start_step4_title', 'Select Cargo Material & Confirm')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('trip_step_of', 'Step')} {step} {t('trip_of_four', 'of 4')} • {t('start_trip_badge', 'Start Trip Departure')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {/* Success Screen */}
          {successTrip ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-amber-500/20 border-2 border-amber-500 text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 animate-pulse">
                <Truck className="w-9 h-9" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{t('trip_started_title', 'Trip Started Successfully!')}</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {t('trip_started_msg', 'Your trip is now active. When you arrive at the delivery site, tap "Complete the Trip" to enter receipt and cargo weight.')}
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl text-left space-y-2.5 max-w-sm mx-auto text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>{t('trip_ref_number', 'Trip Number:')}</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{successTrip.trip_number}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{t('truck', 'Truck:')}</span>
                  <span className="font-bold text-slate-200">{successTrip.truck_plate || truck?.plate_number}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{t('route', 'Route:')}</span>
                  <span className="font-semibold text-right text-slate-200">
                    {successTrip.loading_site_name} → {successTrip.dumping_site_name}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{t('material', 'Cargo Material:')}</span>
                  <span className="font-bold text-amber-400">{successTrip.material_name}</span>
                </div>
                <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-700/80">
                  <span>{t('start_odometer', 'Starting Odometer:')}</span>
                  <span className="font-mono font-bold text-cyan-400">{formatNumber(successTrip.start_odometer)} km</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-700/80">
                  <span>{t('status', 'Status:')}</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
                    In Progress
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/25 touch-btn cursor-pointer"
              >
                {t('done', 'Drive Safely • Done')}
              </button>
            </div>
          ) : (
            <>
              {/* STEP 1: ODOMETER READING (Requirement: First step when starting trip) */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Truck Info Card */}
                  <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {t('assigned_truck', 'Assigned Vehicle')}
                        </div>
                        <div className="text-base font-black text-white">
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

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center justify-between">
                      <span>{t('enter_start_odo_label', 'Enter Starting Odometer Reading (km):')} *</span>
                      <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5" /> {t('departure_mileage', 'Departure Mileage')}
                      </span>
                    </label>

                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min={minAllowedOdo > 0 ? minAllowedOdo : undefined}
                        placeholder="e.g. 52400"
                        value={formData.start_odometer}
                        onChange={e => setFormData({ ...formData, start_odometer: e.target.value })}
                        className={`w-full py-4 pl-12 pr-4 bg-slate-800 border-2 rounded-2xl font-mono text-2xl font-black focus:outline-none shadow-inner transition-colors ${
                          minAllowedOdo > 0 && formData.start_odometer && parseFloat(formData.start_odometer) < minAllowedOdo
                            ? 'border-red-500 text-red-400 focus:border-red-500'
                            : 'border-slate-700 text-amber-400 focus:border-amber-500'
                        }`}
                        autoFocus
                      />
                      <Gauge className="w-6 h-6 text-slate-400 absolute left-3.5 top-4 pointer-events-none" />
                      <span className="absolute right-4 top-4.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                        KM
                      </span>
                    </div>

                    {minAllowedOdo > 0 && (
                      <div className="mt-2 text-xs flex items-center justify-between text-slate-400">
                        <span>{t('odo_min_required', 'Minimum allowed reading (last recorded):')}</span>
                        <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                          {formatNumber(minAllowedOdo)} km
                        </span>
                      </div>
                    )}

                    {minAllowedOdo > 0 && formData.start_odometer && parseFloat(formData.start_odometer) < minAllowedOdo && (
                      <div className="mt-2 p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>
                          {t('err_odo_less_than_prev', 'Odometer cannot be less than previous reading')} ({formatNumber(minAllowedOdo)} km). {t('odo_must_increase', 'Mileage must increase as the truck travels.')}
                        </span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {t('odo_start_hint', 'Check your truck dashboard meter before driving off. This records your departure distance automatically.')}
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: LOADING SITE */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="text-xs text-cyan-300 font-semibold bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/20 flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-cyan-400" /> Start Odometer: {formatNumber(formData.start_odometer)} km
                  </div>

                  <p className="text-xs text-slate-400 font-medium">
                    {t('trip_select_loading', 'Select loading site or quarry:')}
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {loadingSites.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            loading_site_id: s.id,
                            loading_site_name: s.name,
                          }));
                          setStep(3);
                        }}
                        className={`p-3.5 text-left rounded-2xl border transition-all flex items-center justify-between touch-btn ${
                          formData.loading_site_id === s.id
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                            : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
                          <div>
                            <div className="font-bold text-sm">{s.name}</div>
                            <div className="text-xs text-slate-400">{s.location}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCustomSiteModal({ open: true, type: 'loading', name: '', location: '' })}
                    className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl text-slate-400 hover:text-amber-400 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> {t('trip_or_add_site', '+ Add New Custom Site')}
                  </button>
                </div>
              )}

              {/* STEP 3: DUMPING / DESTINATION SITE */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="text-xs text-amber-400 font-semibold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {t('step_loading', 'Loading Site')}: {formData.loading_site_name}
                  </div>

                  <p className="text-xs text-slate-400 font-medium">
                    {t('trip_select_dumping', 'Where will you dump/deliver the load?')}
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {dumpingSites.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            dumping_site_id: s.id,
                            dumping_site_name: s.name,
                          }));
                          setStep(4);
                        }}
                        className={`p-3.5 text-left rounded-2xl border transition-all flex items-center justify-between touch-btn ${
                          formData.dumping_site_id === s.id
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md'
                            : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div>
                            <div className="font-bold text-sm">{s.name}</div>
                            <div className="text-xs text-slate-400">{s.location}</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCustomSiteModal({ open: true, type: 'dumping', name: '', location: '' })}
                    className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl text-slate-400 hover:text-amber-400 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> {t('trip_or_add_site', '+ Add New Custom Site')}
                  </button>
                </div>
              )}

              {/* STEP 4: MATERIAL & FINISH (Completes on Step 4!) */}
              {step === 4 && (
                <div className="space-y-4">
                  {/* Route Summary Pills */}
                  <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{t('route', 'Planned Route')}:</span>
                      <span className="font-bold text-slate-200">
                        {formData.loading_site_name} → {formData.dumping_site_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{t('start_odometer', 'Starting Odometer')}:</span>
                      <span className="font-mono font-bold text-cyan-400">{formatNumber(formData.start_odometer)} km</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-300 font-bold mb-2">
                      {t('trip_select_material', 'Select cargo material:')} *
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {materials.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              material_id: m.id,
                              material_name: m.name,
                            }));
                          }}
                          className={`p-3.5 text-center rounded-2xl border transition-all touch-btn cursor-pointer ${
                            formData.material_id === m.id
                              ? 'bg-amber-500/25 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/15 font-bold scale-[1.02]'
                              : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <Package className="w-6 h-6 mx-auto mb-1.5 text-amber-400" />
                          <div className="font-bold text-sm truncate">{m.name}</div>
                          {m.default_unit && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Standard: {m.default_unit}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transition Points (Optional) */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, has_transition: !p.has_transition }))}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 font-semibold cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span>{formData.has_transition ? '✓ Intermediate Transit Point Added' : '+ Add Intermediate Transit / Weigh Station (Optional)'}</span>
                    </button>

                    {formData.has_transition && (
                      <div className="mt-2 space-y-1.5">
                        {transitionPoints.map(tp => (
                          <button
                            key={tp.id}
                            type="button"
                            onClick={() => setFormData(p => ({
                              ...p,
                              transition_point_ids: [tp.id],
                              transition_point_name: tp.name
                            }))}
                            className={`w-full p-2.5 text-left text-xs rounded-xl border transition ${
                              formData.transition_point_ids.includes(tp.id)
                                ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            {tp.name} ({tp.location})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!successTrip && (
          <div className="p-4 bg-slate-800/90 border-t border-slate-700 flex justify-between items-center gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-700/60 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> {t('back', 'Back')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-400 font-medium text-xs hover:text-white cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
            )}

            {step < 4 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && (!formData.start_odometer || parseFloat(formData.start_odometer) <= 0 || (minAllowedOdo > 0 && parseFloat(formData.start_odometer) < minAllowedOdo))) ||
                  (step === 2 && !formData.loading_site_id) ||
                  (step === 3 && !formData.dumping_site_id)
                }
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 touch-btn shadow-md cursor-pointer"
              >
                {t('next', 'Next')} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading || !formData.material_id}
                onClick={handleStartTripSubmit}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-40 text-slate-950 font-black text-sm rounded-2xl flex items-center gap-2 shadow-xl shadow-amber-500/25 touch-btn cursor-pointer"
              >
                {loading ? t('starting_trip', 'Starting...') : `🚀 ${t('confirm_start_trip', 'Confirm & Start Trip')}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Add Custom Site Modal */}
      {customSiteModal.open && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-3">
            <h4 className="font-bold text-sm text-slate-100">
              {t('trip_or_add_site', '+ Add New Custom Site')}
            </h4>
            <input
              type="text"
              placeholder="Site Name (e.g. Quarry B, Ring Road km 4)"
              value={customSiteModal.name}
              onChange={e => setCustomSiteModal({ ...customSiteModal, name: e.target.value })}
              className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            />
            <input
              type="text"
              placeholder="Location description"
              value={customSiteModal.location}
              onChange={e => setCustomSiteModal({ ...customSiteModal, location: e.target.value })}
              className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomSiteModal({ open: false, type: 'loading', name: '', location: '' })}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateSite}
                className="px-4 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                {t('add', 'Add Site')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
