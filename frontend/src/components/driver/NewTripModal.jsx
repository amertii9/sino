import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../api/client';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import {
  X,
  MapPin,
  Truck,
  Package,
  Layers,
  DollarSign,
  CheckCircle,
  Plus,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Receipt,
  Trash2,
  Coins,
  Scale
} from 'lucide-react';

export const NewTripModal = ({ isOpen, onClose, onSuccess, initialTripData = null }) => {
  const { truck, driver } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successTrip, setSuccessTrip] = useState(null);

  // Lookups
  const [loadingSites, setLoadingSites] = useState([]);
  const [dumpingSites, setDumpingSites] = useState([]);
  const [transitionPoints, setTransitionPoints] = useState([]);
  const [materials, setMaterials] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    loading_site_id: '',
    loading_site_name: '',
    dumping_site_id: '',
    dumping_site_name: '',
    has_transition: false,
    transition_point_ids: [],
    transition_point_name: '',
    drop_off_location: 'final_destination', // 'final_destination' | 'intermediate_transit'
    transit_notes: '',
    material_id: '',
    material_name: '',
    quantity: 20,
    unit: 'quintal',
    pricing_method: 'per_quintal',
    unit_price: 450,
    pricing_target: 'destination',
    transit_unit_price: 0,
    destination_unit_price: 0,
    transit_lump_sum: 0,
    destination_lump_sum: 0,
    price_difference: 0,
    price_difference_lump_sum: 0,
    lump_sum: 0,
    additional_fees: [],
    notes: '',
  });

  // Driver Additional Fees Entries (starts with 1 clean space for money)
  const [feeEntries, setFeeEntries] = useState([
    { id: 1, amount: '', name: '', fee_type: 'other' }
  ]);

  // Suggestions set by admin
  const [adminSuggestions, setAdminSuggestions] = useState([
    { name: 'Modjo Expressway Toll', amount: 150, fee_type: 'toll' },
    { name: 'Adama Expressway Toll', amount: 200, fee_type: 'toll' },
    { name: 'Weighbridge / Scale', amount: 100, fee_type: 'weighbridge' },
    { name: 'Parking / Staging', amount: 50, fee_type: 'parking' },
    { name: 'Gate / Yard Pass', amount: 100, fee_type: 'gate_fee' },
  ]);

  // Smart suggestions
  const [suggestedPrice, setSuggestedPrice] = useState(null);
  const [customSiteModal, setCustomSiteModal] = useState({ open: false, type: 'loading', name: '', location: '', loading: false, error: '' });
  const [customMaterialModal, setCustomMaterialModal] = useState({ open: false, name: '', default_unit: 'ton', default_price: 450, error: '', loading: false });

  // Load master data & admin settings
  useEffect(() => {
    if (!isOpen) return;

    const standardMaterials = [
      { id: 'mat-sand', name: 'River Sand', default_unit: 'ton', default_price: 450 },
      { id: 'mat-agg02', name: 'Crushed Aggregate (02)', default_unit: 'ton', default_price: 580 },
      { id: 'mat-gravel', name: 'Round Gravel', default_unit: 'ton', default_price: 520 },
      { id: 'mat-subbase', name: 'Selected Sub-base Soil', default_unit: 'ton', default_price: 380 },
      { id: 'mat-cement', name: 'Cement Bags (PPC 42.5)', default_unit: 'quintal', default_price: 1100 },
      { id: 'mat-basalt', name: 'Basalt Stone', default_unit: 'ton', default_price: 480 },
      { id: 'mat-redash', name: 'Red Ash / Scoria', default_unit: 'ton', default_price: 350 },
    ];

    Promise.all([
      api.get('/sites?type=loading'),
      api.get('/sites?type=dumping'),
      api.get('/sites?type=transition'),
      api.get('/materials'),
      api.get('/settings').catch(() => null),
    ])
      .then(([load, dump, trans, mats, settings]) => {
        setLoadingSites(load || []);
        setDumpingSites(dump || []);
        setTransitionPoints(trans || []);
        setMaterials((mats && mats.length > 0) ? mats : standardMaterials);
        if (settings?.fee_suggestions?.length > 0) {
          setAdminSuggestions(settings.fee_suggestions);
        }
      })
      .catch(console.error);

    // If prefilling from "Repeat Previous Trip"
    if (initialTripData) {
      setFormData({
        loading_site_id: initialTripData.loading_site_id || '',
        loading_site_name: initialTripData.loading_site_name || '',
        dumping_site_id: initialTripData.dumping_site_id || '',
        dumping_site_name: initialTripData.dumping_site_name || '',
        has_transition: initialTripData.has_transition || false,
        transition_point_ids: initialTripData.transition_point_ids || [],
        transition_point_name: initialTripData.transition_point_name || '',
        drop_off_location: initialTripData.drop_off_location || (initialTripData.pricing_target === 'transit' ? 'intermediate_transit' : 'final_destination'),
        transit_notes: initialTripData.transit_notes || '',
        material_id: initialTripData.material_id || '',
        material_name: initialTripData.material_name || '',
        quantity: initialTripData.quantity || 20,
        unit: initialTripData.unit || 'quintal',
        pricing_method: initialTripData.pricing_method || 'per_quintal',
        unit_price: initialTripData.unit_price || 450,
        pricing_target: initialTripData.pricing_target || 'destination',
        transit_unit_price: initialTripData.transit_unit_price || 0,
        destination_unit_price: initialTripData.destination_unit_price || 0,
        transit_lump_sum: initialTripData.transit_lump_sum || 0,
        destination_lump_sum: initialTripData.destination_lump_sum || 0,
        price_difference: initialTripData.price_difference || 0,
        price_difference_lump_sum: 0,
        lump_sum: initialTripData.lump_sum || 0,
        additional_fees: [],
        notes: initialTripData.notes || '',
      });

      const fees = initialTripData.additional_fees || [];
      if (fees.length > 0) {
        setFeeEntries(
          fees.map((f, i) => ({
            id: Date.now() + i,
            amount: f.amount ? String(f.amount) : '',
            name: f.description || '',
            fee_type: f.fee_type || 'other',
          }))
        );
      } else {
        setFeeEntries([{ id: 1, amount: '', name: '', fee_type: 'other' }]);
      }

      setStep(5); // Jump straight to Quantity verification
    } else {
      setFeeEntries([{ id: 1, amount: '', name: '', fee_type: 'other' }]);
      setStep(1);
      setSuccessTrip(null);
      setError('');
    }
  }, [isOpen, initialTripData]);

  // Check for smart route price suggestion whenever sites, material, or transit point change
  useEffect(() => {
    if (formData.loading_site_id && formData.dumping_site_id) {
      const transitId = (formData.has_transition && formData.transition_point_ids?.length > 0)
        ? formData.transition_point_ids[0]
        : '';
      api.get('/trips/smart-price', {
        loading_site_id: formData.loading_site_id,
        dumping_site_id: formData.dumping_site_id,
        transit_point_id: transitId,
        material_id: formData.material_id,
      })
        .then(res => {
          if (res?.price > 0 || res?.destination_price > 0 || res?.transit_price > 0) {
            setSuggestedPrice(res);
            const destP = res.destination_price || res.price || 0;
            const transP = res.transit_price || 0;
            const destLump = res.destination_lump_sum || 0;
            const transLump = res.transit_lump_sum || 0;
            setFormData(prev => {
              const target = prev.pricing_target || 'destination';
              const activeP = (target === 'transit' && transP > 0) ? transP : destP;
              const activeLump = (target === 'transit' && transLump > 0) ? transLump : destLump;
              return {
                ...prev,
                destination_unit_price: destP,
                transit_unit_price: transP,
                destination_lump_sum: destLump,
                transit_lump_sum: transLump,
                price_difference: res.price_difference || (destP - transP),
                price_difference_lump_sum: res.price_difference_lump_sum || (destLump - transLump),
                unit_price: (!initialTripData && prev.unit_price === 450) ? activeP : prev.unit_price,
                lump_sum: (prev.lump_sum === 0 && activeLump > 0) ? activeLump : prev.lump_sum,
                pricing_method: res.pricing_method || prev.pricing_method,
              };
            });
          }
        })
        .catch(console.error);
    }
  }, [formData.loading_site_id, formData.dumping_site_id, formData.material_id, formData.has_transition, formData.transition_point_ids]);

  if (!isOpen) return null;

  // Calculation helpers
  const getConvertedKg = () => {
    const q = parseFloat(formData.quantity) || 0;
    if (formData.unit === 'ton') return q * 1000;
    if (formData.unit === 'quintal') return q * 100;
    return q;
  };

  const calculateTotalRevenue = () => {
    if (formData.pricing_method === 'lump_sum') {
      return parseFloat(formData.lump_sum) || 0;
    }
    const q = parseFloat(formData.quantity) || 0;
    const p = parseFloat(formData.unit_price) || 0;
    return q * p;
  };

  const FEE_CATEGORIES = [
    { id: 'toll', label: t('fee_toll', 'Toll Fee'), icon: '🛣️', placeholder: t('fee_desc_placeholder', 'e.g. Modjo Expressway Toll ticket') },
    { id: 'weighbridge', label: t('fee_weighbridge', 'Weighbridge / Scale'), icon: '⚖️', placeholder: 'e.g. Kality Weigh Station ticket' },
    { id: 'parking', label: t('fee_parking', 'Parking / Staging'), icon: '🅿️', placeholder: 'e.g. Depot staging / overnight parking' },
    { id: 'gate_fee', label: t('fee_gate', 'Gate / Yard Pass'), icon: '🚧', placeholder: 'e.g. Quarry access pass' },
    { id: 'other', label: t('fee_other', 'Other Extra Fee'), icon: '📝', placeholder: 'e.g. Loading / transit fee' },
  ];

  const calculateTotalFees = () => {
    return feeEntries.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const calculateNetRevenue = () => {
    return calculateTotalRevenue() - calculateTotalFees();
  };

  const getValidFeesList = () => {
    return feeEntries
      .filter(item => parseFloat(item.amount) > 0)
      .map(item => ({
        fee_type: item.fee_type || 'other',
        amount: parseFloat(item.amount),
        description: item.name || (item.fee_type === 'toll' ? 'Toll Fee' : item.fee_type === 'weighbridge' ? 'Weighbridge Fee' : 'Additional Fee'),
      }));
  };

  const handleAddEntry = () => {
    setFeeEntries(prev => [
      ...prev,
      { id: Date.now() + Math.random(), amount: '', name: '', fee_type: 'other' }
    ]);
  };

  const handleUpdateEntry = (id, field, value) => {
    setFeeEntries(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveEntry = (id) => {
    setFeeEntries(prev => {
      const filtered = prev.filter(item => item.id !== id);
      return filtered.length > 0 ? filtered : [{ id: 1, amount: '', name: '', fee_type: 'other' }];
    });
  };

  const handleApplySuggestion = (sug) => {
    setFeeEntries(prev => {
      // If the last entry has no amount or is 0, fill it
      const last = prev[prev.length - 1];
      if (last && (!last.amount || parseFloat(last.amount) === 0)) {
        return prev.map((item, idx) =>
          idx === prev.length - 1
            ? { ...item, amount: String(sug.amount), name: sug.name, fee_type: sug.fee_type || 'other' }
            : item
        );
      }
      // Otherwise append new space with this suggestion
      return [
        ...prev,
        { id: Date.now() + Math.random(), amount: String(sug.amount), name: sug.name, fee_type: sug.fee_type || 'other' }
      ];
    });
  };

  const handleCreateSite = async () => {
    if (!customSiteModal.name.trim()) {
      setCustomSiteModal(prev => ({ ...prev, error: 'Please enter site name' }));
      return;
    }
    setCustomSiteModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const newSite = await api.post('/sites', {
        name: customSiteModal.name.trim(),
        location: customSiteModal.location.trim() || 'Local Site',
        type: customSiteModal.type,
      });

      if (customSiteModal.type === 'loading') {
        setLoadingSites(prev => [...prev, newSite]);
        setFormData(prev => ({ ...prev, loading_site_id: newSite.id, loading_site_name: newSite.name }));
      } else if (customSiteModal.type === 'dumping') {
        setDumpingSites(prev => [...prev, newSite]);
        setFormData(prev => ({ ...prev, dumping_site_id: newSite.id, dumping_site_name: newSite.name }));
      } else if (customSiteModal.type === 'transition') {
        setTransitionPoints(prev => [...prev, newSite]);
        setFormData(prev => ({
          ...prev,
          transition_point_ids: [newSite.id],
          transition_point_name: newSite.name,
          has_transition: true,
        }));
      }

      setCustomSiteModal({ open: false, type: 'loading', name: '', location: '', loading: false, error: '' });
    } catch (err) {
      setCustomSiteModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to create site' }));
    }
  };

  const handleCreateMaterial = async () => {
    if (!customMaterialModal.name.trim()) {
      setCustomMaterialModal(prev => ({ ...prev, error: 'Please enter material name' }));
      return;
    }
    setCustomMaterialModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const newMat = await api.post('/materials', {
        name: customMaterialModal.name.trim(),
        default_unit: customMaterialModal.default_unit || 'ton',
        default_price: parseFloat(customMaterialModal.default_price) || 450,
      });
      const matId = newMat.id || newMat._id || newMat.name;
      setMaterials(prev => [...prev, newMat]);
      setFormData(prev => ({
        ...prev,
        material_id: matId,
        material_name: newMat.name,
        unit: newMat.default_unit || 'ton',
        unit_price: newMat.default_price || 450,
      }));
      setCustomMaterialModal({ open: false, name: '', default_unit: 'ton', default_price: 450, error: '', loading: false });
    } catch (err) {
      setCustomMaterialModal(prev => ({ ...prev, loading: false, error: err.message || 'Failed to create material' }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const validFees = getValidFeesList();
      const totalFees = calculateTotalFees();
      const totalRev = calculateTotalRevenue();
      const netRev = totalRev - totalFees;

      const payload = {
        ...formData,
        truck_id: truck?.id || driver?.assigned_truck_id || '',
        truck_plate: truck?.plate_number || driver?.assigned_truck_plate || '',
        quantity: parseFloat(formData.quantity),
        unit_price: parseFloat(formData.unit_price) || 0,
        lump_sum: parseFloat(formData.lump_sum) || 0,
        drop_off_location: formData.drop_off_location || (formData.pricing_target === 'transit' ? 'intermediate_transit' : 'final_destination'),
        pricing_target: formData.pricing_target || 'destination',
        transit_notes: formData.transit_notes || '',
        transit_unit_price: parseFloat(formData.transit_unit_price) || 0,
        destination_unit_price: parseFloat(formData.destination_unit_price) || 0,
        transit_lump_sum: parseFloat(formData.transit_lump_sum) || 0,
        destination_lump_sum: parseFloat(formData.destination_lump_sum) || 0,
        additional_fees: validFees,
        total_additional_fees: totalFees,
        net_revenue: netRev,
        is_split_drop: false,
      };

      const result = await api.post('/trips', payload);
      setSuccessTrip(result);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setError(err.message || 'Failed to submit trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-sm">
              {step <= 7 ? step : '✓'}
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {step === 1 && t('trip_step1_title', 'Where did you load material?')}
                {step === 2 && t('trip_step2_title', 'Where did you dump/deliver?')}
                {step === 3 && t('trip_step3_title', 'What material are you hauling?')}
                {step === 4 && t('trip_step4_title', 'Transit / Transition points?')}
                {step === 5 && t('trip_step5_title', 'Enter Quantity & Units')}
                {step === 6 && t('trip_step6_title', 'Pricing & Confirmation')}
                {step === 7 && t('trip_step7_title', 'Additional Fees & Tolls (Optional)')}
                {step === 8 && t('trip_step8_title', 'Review Trip Summary')}
              </h3>
              <p className="text-xs text-slate-400">{t('trip_step_of', 'Step')} {step} {t('trip_of_eight', 'of 8')} • {t('trip_fast_entry', 'Fast Driver Entry')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 text-red-200 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Success Screen */}
          {successTrip ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black text-white">{t('trip_success_title', 'Trip Successfully Recorded!')}</h2>
              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl text-left space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{t('trip_ref_number', 'Reference Number:')}</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{successTrip.trip_number}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{t('material', 'Material:')}</span>
                  <span className="font-semibold">{successTrip.material_name}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{t('quantity', 'Quantity:')}</span>
                  <span className="font-semibold">{successTrip.quantity} {successTrip.unit}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{t('route', 'Route:')}</span>
                  <span className="font-semibold text-right">{successTrip.loading_site_name} → {successTrip.dumping_site_name}</span>
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-300">{t('fee_gross_revenue', 'Gross Revenue:')}</span>
                  <span className="text-sm font-bold text-slate-200 font-mono">
                    {formatCurrency(successTrip.gross_revenue || (successTrip.total_revenue + (successTrip.total_additional_fees || 0)))}
                  </span>
                </div>
                {successTrip.total_additional_fees > 0 && (
                  <div className="flex justify-between items-center text-xs text-amber-400">
                    <span>{t('step_additional_fees', 'Additional Fees Deducted:')}</span>
                    <span className="font-mono font-bold">- {formatCurrency(successTrip.total_additional_fees)}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-slate-750 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-200">{t('fee_net_earnings', 'Total Trip Pay:')}</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {formatCurrency(successTrip.total_revenue)}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl shadow-lg shadow-amber-500/25 touch-btn"
              >
                {t('close', 'Done')}
              </button>
            </div>
          ) : (
            <>
              {/* STEP 1: Loading Site */}
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-medium">{t('trip_select_loading', 'Select previously used loading site or quarry:')}</p>
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
                          setStep(2);
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
                    className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl text-slate-400 hover:text-amber-400 text-xs font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Plus className="w-4 h-4" /> {t('trip_or_add_site', '+ Add New Custom Site')}
                  </button>
                </div>
              )}

              {/* STEP 2: Dumping Site */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="text-xs text-amber-400 font-semibold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {t('step_loading', 'Loading Site')}: {formData.loading_site_name}
                  </div>

                  <p className="text-xs text-slate-400 font-medium">{t('trip_select_dumping', 'Where did you deliver / dump the load?')}</p>
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
                          setStep(3);
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
                    className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-2xl text-slate-400 hover:text-amber-400 text-xs font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Plus className="w-4 h-4" /> {t('trip_or_add_site', '+ Add New Custom Site')}
                  </button>
                </div>
              )}

              {/* STEP 3: Material */}
              {step === 3 && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-medium">{t('trip_select_material', 'Select hauling material:')}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {materials.map(m => {
                      const mId = m.id || m._id || m.name;
                      const isSelected = formData.material_id === mId || formData.material_name === m.name;
                      return (
                        <button
                          key={mId}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              material_id: mId,
                              material_name: m.name,
                              unit_price: m.default_price || prev.unit_price || 450,
                              unit: m.default_unit || prev.unit || 'ton',
                            }));
                            setStep(4);
                          }}
                          className={`p-4 text-center rounded-2xl border transition-all touch-btn cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/25 border-amber-500 text-amber-300 shadow-md font-bold scale-[1.02]'
                              : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <Package className="w-6 h-6 mx-auto mb-2 text-amber-400" />
                          <div className="font-bold text-sm truncate">{m.name}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {formatCurrency(m.default_price || 450)}/{m.default_unit || 'ton'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCustomMaterialModal({ open: true, name: '', default_unit: 'ton', default_price: 450, error: '', loading: false })}
                    className="w-full py-2.5 border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl text-slate-400 hover:text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> {t('add_custom_material', '+ Add New Material / Cargo')}
                  </button>
                </div>
              )}

              {/* STEP 4: Transition Points */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-200">
                    {t('trip_has_transition_q', 'Does this trip have a transition / transit point?')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {t('trip_has_transition_hint', '(e.g., Weigh Station, Inspection Checkpoint, Intermediate Storage)')}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          has_transition: false,
                          transition_point_ids: [],
                          transition_point_name: '',
                        }));
                        setStep(5);
                      }}
                      className="py-4 px-4 bg-slate-800/80 border border-slate-700 hover:border-slate-500 rounded-2xl font-bold text-slate-300 touch-btn"
                    >
                      {t('trip_no_transition', 'No Transition')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, has_transition: true }))}
                      className={`py-4 px-4 border rounded-2xl font-bold touch-btn ${
                        formData.has_transition
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/25'
                          : 'bg-slate-800/80 border-slate-700 text-slate-200'
                      }`}
                    >
                      {t('trip_yes_transition', 'Yes, Transit Point')}
                    </button>
                  </div>

                  {formData.has_transition && (
                    <div className="space-y-3 p-3.5 bg-slate-800/90 rounded-2xl border border-purple-500/30">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-purple-400" />
                            {t('transit_checkpoint_manual_label', 'Enter Transit Checkpoint / Hub Manually:')}
                          </label>
                          {formData.transition_point_name && (
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({
                                ...p,
                                transition_point_name: '',
                                transition_point_ids: []
                              }))}
                              className="text-[10px] text-red-400 hover:text-red-300 underline font-medium cursor-pointer"
                            >
                              {t('clear', 'Clear')}
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={t('ph_transit_checkpoint_manual', 'Type checkpoint name (e.g. Modjo Kella, Awash Scale, Kality Hub)...')}
                            value={formData.transition_point_name}
                            onChange={e => {
                              const val = e.target.value;
                              const matched = transitionPoints.find(tp => tp.name.toLowerCase() === val.trim().toLowerCase());
                              setFormData(p => ({
                                ...p,
                                has_transition: true,
                                transition_point_name: val,
                                transition_point_ids: matched ? [matched.id] : []
                              }));
                            }}
                            className="w-full py-2.5 pl-9 pr-3 bg-slate-900 border border-purple-500/40 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/40 shadow-inner"
                          />
                          <MapPin className="w-4 h-4 text-purple-400 absolute left-3 top-2.5 pointer-events-none" />
                        </div>
                      </div>

                      {/* Preset Checkpoint Suggestions */}
                      {transitionPoints.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            {t('or_select_saved_transit', 'Or quick-select saved checkpoint:')}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {transitionPoints.map(tPoint => {
                              const isSelected = formData.transition_point_ids.includes(tPoint.id) || formData.transition_point_name === tPoint.name;
                              return (
                                <button
                                  key={tPoint.id}
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      has_transition: true,
                                      transition_point_ids: [tPoint.id],
                                      transition_point_name: tPoint.name,
                                    }));
                                  }}
                                  className={`p-2.5 text-left text-xs rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-purple-500/25 border-purple-400 text-purple-200 font-bold shadow-xs ring-1 ring-purple-400/30'
                                      : 'bg-slate-900/80 border-slate-700/80 text-slate-200 hover:bg-slate-900 hover:border-slate-600'
                                  }`}
                                >
                                  <div className="truncate">
                                    <div className="font-semibold">{tPoint.name}</div>
                                    {tPoint.location && <div className="text-[10px] text-slate-400 truncate">{tPoint.location}</div>}
                                  </div>
                                  {isSelected && <span className="text-purple-400 font-bold text-xs">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setCustomSiteModal({ open: true, type: 'transition', name: '', location: '' })}
                        className="w-full py-2 border-2 border-dashed border-slate-700 hover:border-purple-500/60 rounded-xl text-slate-400 hover:text-purple-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> {t('trip_or_add_site', '+ Add New Custom Site')}
                      </button>

                      {formData.transition_point_name && (
                        <div className="p-3 bg-purple-950/30 border border-purple-500/40 rounded-2xl space-y-2 mt-2">
                          <label className="text-[11px] font-bold text-purple-300 flex items-center justify-between">
                            <span>📝 {t('transit_slip_notes_label', 'Transit Slip / Notes:')}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{t('optional', 'Optional')}</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Weigh Scale Ticket #WB-9012, Gate Pass OK"
                            value={formData.transit_notes}
                            onChange={e => setFormData(prev => ({ ...prev, transit_notes: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                          />
                          <button
                            type="button"
                            onClick={() => setStep(5)}
                            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {t('proceed', 'Proceed')} → ({formData.transition_point_name})
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: Quantity & Units */}
              {step === 5 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">{t('trip_unit_label', 'Unit of Measure:')}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['ton', 'quintal', 'kg'].map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, unit: u }))}
                          className={`py-2.5 rounded-xl font-bold uppercase text-xs border transition-all touch-btn ${
                            formData.unit === u
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {t('trip_quantity_label', 'Quantity Transported:')} ({formData.unit})
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}
                        className="w-12 h-12 rounded-xl bg-slate-800 text-xl font-bold border border-slate-700 text-slate-200 flex items-center justify-center active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="any"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                        className="flex-1 text-center py-3 bg-slate-800 border border-slate-700 rounded-xl font-mono text-2xl font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, quantity: p.quantity + 1 }))}
                        className="w-12 h-12 rounded-xl bg-slate-800 text-xl font-bold border border-slate-700 text-slate-200 flex items-center justify-center active:scale-95"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick quantity chips */}
                    <div className="flex gap-2 mt-2">
                      {[10, 15, 20, 25, 30].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, quantity: val }))}
                          className="flex-1 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700"
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto conversion display */}
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> {t('trip_converted_equiv', 'Converted Equivalents:')}
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{t('total_kilograms_label', 'Total Kilograms:')}</span>
                      <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg())} kg</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{t('metric_tons_label', 'Metric Tons:')}</span>
                      <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg() / 1000, 2)} tons</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>{t('quintals_label', 'Quintals:')}</span>
                      <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg() / 100, 1)} quintals</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: Pricing Method & Smart Suggestion */}
              {step === 6 && (
                <div className="space-y-4">
                  {/* Transit Point Drop-Off Target Selection (when transit point is present) */}
                  {formData.has_transition && formData.transition_point_name && (
                    <div className="p-3.5 bg-purple-950/30 border border-purple-500/40 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-purple-400" />
                          {t('dest_rate_choice', 'Drop-Off Destination & Applied Rate')}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {formData.pricing_target === 'transit' ? t('transit_drop_selected', '📍 Transit Drop Selected') : t('dest_drop_selected', '🏁 Destination Drop Selected')}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300">
                        {t('dropoff_site_question', 'Did you haul all the way to the final destination or drop cargo at the intermediate transit point? Select below:')}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {/* Option A: Final Destination Rate */}
                        <button
                          type="button"
                          onClick={() => {
                            const rate = formData.destination_unit_price || suggestedPrice?.destination_price || suggestedPrice?.price || formData.unit_price;
                            const destLump = formData.destination_lump_sum || suggestedPrice?.destination_lump_sum || 0;
                            setFormData(prev => ({
                              ...prev,
                              pricing_target: 'destination',
                              drop_off_location: 'final_destination',
                              unit_price: rate,
                              lump_sum: prev.pricing_method === 'lump_sum' && destLump > 0 ? destLump : prev.lump_sum,
                            }));
                          }}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            formData.pricing_target === 'destination'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md ring-1 ring-amber-500/50'
                              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🏁 {t('step_destination', 'Final Destination')}</span>
                            {formData.pricing_target === 'destination' && (
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">{t('active_badge', 'Active')}</span>
                            )}
                          </div>
                          <div className="font-bold text-xs truncate text-white mt-0.5">{formData.dumping_site_name || t('step_destination', 'Final Destination')}</div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-sm font-black font-mono text-amber-400">
                              {formatCurrency(formData.destination_unit_price || suggestedPrice?.destination_price || suggestedPrice?.price || 0)}
                              <span className="text-[10px] font-normal text-slate-400"> / {formData.unit}</span>
                            </span>
                            {(formData.destination_lump_sum > 0 || suggestedPrice?.destination_lump_sum > 0) && (
                              <span className="text-[10px] font-mono text-emerald-400">
                                {t('lump_sum', 'Lump')}: {formatCurrency(formData.destination_lump_sum || suggestedPrice?.destination_lump_sum)}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Option B: Transit Point Rate */}
                        <button
                          type="button"
                          onClick={() => {
                            const rate = formData.transit_unit_price || suggestedPrice?.transit_price || ((formData.destination_unit_price || formData.unit_price) * 0.6) || formData.unit_price;
                            const transLump = formData.transit_lump_sum || suggestedPrice?.transit_lump_sum || 0;
                            setFormData(prev => ({
                              ...prev,
                              pricing_target: 'transit',
                              drop_off_location: 'intermediate_transit',
                              unit_price: rate,
                              lump_sum: prev.pricing_method === 'lump_sum' && transLump > 0 ? transLump : prev.lump_sum,
                            }));
                          }}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            formData.pricing_target === 'transit'
                              ? 'bg-purple-500/25 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-500/50'
                              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📍 {t('transit_point_rate', 'Transit Point')}</span>
                            {formData.pricing_target === 'transit' && (
                              <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">{t('active_badge', 'Active')}</span>
                            )}
                          </div>
                          <div className="font-bold text-xs truncate text-purple-300 mt-0.5">{formData.transition_point_name}</div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-sm font-black font-mono text-purple-400">
                              {formatCurrency(formData.transit_unit_price || suggestedPrice?.transit_price || ((formData.destination_unit_price || 0) * 0.6) || 0)}
                              <span className="text-[10px] font-normal text-slate-400"> / {formData.unit}</span>
                            </span>
                            {(formData.transit_lump_sum > 0 || suggestedPrice?.transit_lump_sum > 0) && (
                              <span className="text-[10px] font-mono text-purple-300">
                                {t('lump_sum', 'Lump')}: {formatCurrency(formData.transit_lump_sum || suggestedPrice?.transit_lump_sum)}
                              </span>
                            )}
                          </div>
                        </button>
                      </div>

                      {/* Price Difference Indicator Badge */}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-300 font-medium">
                        <span className="text-slate-400">{t('rate_difference_label', 'Rate Difference:')}</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatCurrency(Math.abs((formData.destination_unit_price || suggestedPrice?.destination_price || 0) - (formData.transit_unit_price || suggestedPrice?.transit_price || 0)))} / {formData.unit}
                          {formData.destination_lump_sum > 0 && formData.transit_lump_sum > 0 && (
                            <span className="text-slate-400 font-normal"> ({t('lump_sum', 'Lump')}: {formatCurrency(Math.abs(formData.destination_lump_sum - formData.transit_lump_sum))})</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">{t('trip_pricing_method', 'Payment & Pricing Method:')}</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'per_ton', label: 'Price per Ton' },
                        { id: 'per_quintal', label: 'Price per Quintal' },
                        { id: 'per_kg', label: 'Price per KG' },
                        { id: 'lump_sum', label: '💰 Lump Sum (Fixed)' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const newMethod = m.id;
                            setFormData(prev => {
                              const destLump = prev.destination_lump_sum || suggestedPrice?.destination_lump_sum || 0;
                              const transLump = prev.transit_lump_sum || suggestedPrice?.transit_lump_sum || 0;
                              let newLump = prev.lump_sum;
                              if (newMethod === 'lump_sum' && prev.lump_sum === 0) {
                                newLump = prev.pricing_target === 'transit' ? (transLump || 8500) : (destLump || 12000);
                              }
                              return {
                                ...prev,
                                pricing_method: newMethod,
                                lump_sum: newLump,
                              };
                            });
                          }}
                          className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center touch-btn cursor-pointer ${
                            formData.pricing_method === m.id
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Standard suggested price when no transition point is configured */}
                  {!formData.has_transition && suggestedPrice?.price > 0 && formData.pricing_method !== 'lump_sum' && (
                    <div className="p-3 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          {t('trip_suggested_price', 'Suggested Route Price:')}
                        </div>
                        <span className="font-bold text-amber-400 font-mono text-sm">
                          {formatCurrency(suggestedPrice.price)} / {formData.unit}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, unit_price: suggestedPrice.price }))}
                          className="flex-1 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm touch-btn cursor-pointer"
                        >
                          {t('trip_use_price', 'Use Price')} ({suggestedPrice.price} ETB)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Price input according to method */}
                  {formData.pricing_method === 'lump_sum' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-emerald-400 mb-1 flex items-center justify-between">
                          <span>{t('agreed_lumpsum_label', 'Agreed Lump Sum Amount (Fixed Payout ETB):')}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{t('fixed_trip_pay_sub', 'Fixed total trip pay')}</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={formData.lump_sum}
                          onChange={e => setFormData({ ...formData, lump_sum: parseFloat(e.target.value) || 0 })}
                          className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-2xl font-bold text-emerald-400 focus:outline-none focus:border-amber-500 shadow-inner"
                          placeholder="e.g. 15000"
                        />
                      </div>

                      {/* Quick Lump Sum Preset Chips */}
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                          {t('quick_presets_suggestions', 'Quick Presets & Suggestions:')}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {formData.has_transition && formData.transit_lump_sum > 0 && (
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, lump_sum: formData.transit_lump_sum, pricing_target: 'transit', drop_off_location: 'intermediate_transit' }))}
                              className="py-1 px-2.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold rounded-lg cursor-pointer"
                            >
                              📍 {t('transit_fixed_lump', 'Transit Lump')}: {formatCurrency(formData.transit_lump_sum)}
                            </button>
                          )}
                          {formData.destination_lump_sum > 0 && (
                            <button
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, lump_sum: formData.destination_lump_sum, pricing_target: 'destination', drop_off_location: 'final_destination' }))}
                              className="py-1 px-2.5 bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold rounded-lg cursor-pointer"
                            >
                              🏁 {t('dest_fixed_lump', 'Dest Lump')}: {formatCurrency(formData.destination_lump_sum)}
                            </button>
                          )}
                          {[5000, 8000, 10000, 15000, 20000].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setFormData(p => ({ ...p, lump_sum: val }))}
                              className="py-1 px-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs font-mono font-semibold rounded-lg cursor-pointer"
                            >
                              {val.toLocaleString()} ETB
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {t('unit_price', 'Unit Price')} (ETB / {formData.unit}):
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.unit_price}
                        onChange={e => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xl font-bold text-amber-400 focus:outline-none focus:border-amber-500 shadow-inner"
                        placeholder="e.g. 450"
                      />
                    </div>
                  )}

                  {/* Optional Waybill / Slip Notes */}
                  {formData.has_transition && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        {t('transit_slip_notes_label', 'Transit Slip / Notes:')}
                      </label>
                      <input
                        type="text"
                        value={formData.transit_notes}
                        onChange={e => setFormData({ ...formData, transit_notes: e.target.value })}
                        placeholder={t('intermediate_supervisor_ph', 'e.g. Offload verified by intermediate yard supervisor')}
                        className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500"
                      />
                    </div>
                  )}

                  {/* Live revenue preview */}
                  <div className="p-3.5 bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">{t('trip_est_revenue', 'Estimated Trip Revenue:')}</div>
                      <div className="text-xl font-black text-emerald-400">
                        {formatCurrency(calculateTotalRevenue())}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {formData.pricing_method === 'lump_sum'
                        ? t('lump_sum_type_badge', 'Fixed Lump-Sum')
                        : `${formData.quantity} ${formData.unit} × ${formData.unit_price} ETB`}
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 7: Additional Fees & Tolls */}
              {step === 7 && (
                <div className="space-y-4">
                  {/* Revenue & Deductions Live Banner */}
                  <div className="p-3.5 bg-slate-800/90 rounded-2xl border border-slate-700/80 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">{t('hauling_gross_stat', 'Hauling Gross')}</span>
                      <span className="font-bold text-xs text-slate-200 font-mono">
                        {formatCurrency(calculateTotalRevenue())}
                      </span>
                    </div>
                    <div className="border-x border-slate-700/80">
                      <span className="text-[10px] text-amber-400 block font-medium">{t('fees_deducted_stat', 'Fees Deducted')}</span>
                      <span className="font-bold text-xs text-amber-400 font-mono">
                        {calculateTotalFees() > 0 ? `- ${formatCurrency(calculateTotalFees())}` : '0 ETB'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 block font-medium">{t('total_trip_pay_stat', 'Total Trip Pay')}</span>
                      <span className="font-black text-xs text-emerald-400 font-mono">
                        {formatCurrency(calculateNetRevenue())}
                      </span>
                    </div>
                  </div>

                  {/* 1 space to enter the money + add sign to add more */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">
                        {t('step_additional_fees', 'Enter Additional Fee / Toll Amount:')}
                      </label>
                      <button
                        type="button"
                        onClick={handleAddEntry}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-bold text-xs rounded-xl flex items-center gap-1 transition touch-btn active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> {t('add_more_btn', 'Add More')}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {feeEntries.map((entry, index) => (
                        <div key={entry.id} className="flex items-center gap-2">
                          {/* Money input space */}
                          <div className="relative flex-1">
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={entry.amount}
                              onChange={e => handleUpdateEntry(entry.id, 'amount', e.target.value)}
                              className="w-full py-2.5 pl-12 pr-4 bg-slate-800 border border-slate-700 rounded-2xl font-mono text-xl font-bold text-emerald-400 focus:outline-none focus:border-amber-500 shadow-inner"
                              autoFocus={index === 0}
                            />
                            <span className="absolute left-4 top-3 text-xs text-slate-400 font-bold">ETB</span>
                          </div>

                          {/* Optional note/label */}
                          <input
                            type="text"
                            placeholder={t('note_ticket_ph', 'Note / Ticket (optional)')}
                            value={entry.name}
                            onChange={e => handleUpdateEntry(entry.id, 'name', e.target.value)}
                            className="w-32 sm:w-44 py-3 px-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />

                          {/* Remove button if > 1 space */}
                          {feeEntries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEntry(entry.id)}
                              className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition shrink-0"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Quick Add sign button */}
                    <button
                      type="button"
                      onClick={handleAddEntry}
                      className="w-full py-2 bg-slate-800/80 hover:bg-slate-750 border border-dashed border-slate-700 rounded-xl text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5 transition touch-btn"
                    >
                      <Plus className="w-4 h-4" /> Add Another Fee Line
                    </button>
                  </div>

                  {/* Suggestions set by the admin */}
                  {adminSuggestions.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        💡 Suggestions Set by Admin (Tap to Add):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {adminSuggestions.map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleApplySuggestion(sug)}
                            className="p-2.5 bg-slate-800 hover:bg-slate-750 active:scale-95 border border-slate-700 hover:border-amber-500/60 rounded-xl text-left transition touch-btn shadow-sm flex items-center justify-between gap-1.5"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-xs">
                                  {sug.fee_type === 'toll' ? '🛣️' : sug.fee_type === 'weighbridge' ? '⚖️' : sug.fee_type === 'gate_fee' ? '🚧' : sug.fee_type === 'parking' ? '🅿️' : '📝'}
                                </span>
                                <span className="text-xs font-bold text-slate-200 truncate block">
                                  {sug.name}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-emerald-400 block pl-4">
                                +{sug.amount} ETB
                              </span>
                            </div>
                            <span className="w-5 h-5 rounded-md bg-slate-700/60 text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
                              +
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 1-Tap Skip Button when no fees incurred */}
                  {calculateTotalFees() === 0 && (
                    <button
                      type="button"
                      onClick={() => setStep(8)}
                      className="w-full py-2.5 bg-slate-800/90 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/50 rounded-2xl text-xs font-bold text-amber-400 flex items-center justify-center gap-2 transition touch-btn"
                    >
                      ✓ No Extra Fees (0 ETB) — Continue to Summary →
                    </button>
                  )}
                </div>
              )}

              {/* STEP 8: Review Summary */}
              {step === 8 && (
                <div className="space-y-4">
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 divide-y divide-slate-700/60 text-xs">
                    <div className="pb-2.5 flex justify-between">
                      <span className="text-slate-400">{t('step_loading', 'Loading Site')}:</span>
                      <span className="font-bold text-slate-100">{formData.loading_site_name}</span>
                    </div>

                    {formData.has_transition && (
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">{t('step_transition', 'Transit Waypoint')}:</span>
                        <span className="font-bold text-purple-400">{formData.transition_point_name}</span>
                      </div>
                    )}

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400">{t('cargo_dropoff_site_label', 'Cargo Drop-Off Site:')}</span>
                      {formData.drop_off_location === 'intermediate_transit' || formData.pricing_target === 'transit' ? (
                        <span className="font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-lg border border-purple-500/30">
                          📍 {t('transit_point_rate', 'Intermediate Hub')} ({formData.transition_point_name})
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                          🏁 {t('step_destination', 'Final Destination')} ({formData.dumping_site_name})
                        </span>
                      )}
                    </div>

                    {formData.transit_notes && (
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">{t('transit_slip_notes_label', 'Transit Slip / Notes:')}</span>
                        <span className="font-mono text-purple-300 font-semibold">{formData.transit_notes}</span>
                      </div>
                    )}

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('material', 'Material')}:</span>
                      <span className="font-bold text-amber-400">{formData.material_name}</span>
                    </div>

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('quantity', 'Quantity')}:</span>
                      <span className="font-bold text-slate-100">
                        {formData.quantity} {formData.unit} ({formatNumber(getConvertedKg())} kg)
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400">{t('step_price', 'Pricing & Rate')}:</span>
                      <span className="font-bold text-slate-100">
                        {formData.pricing_method === 'lump_sum' ? (
                          <span className="text-emerald-400 font-mono">
                            💰 {t('lump_sum_type_badge', 'Fixed Lump-Sum')}: {formatCurrency(formData.lump_sum)}
                          </span>
                        ) : (
                          <span>
                            {formData.unit_price} ETB / {formData.unit}{' '}
                            <span className="text-[10px] text-slate-400">
                              ({formData.pricing_target === 'transit' ? t('transit_point_rate', 'Transit Rate') : t('final_destination_rate', 'Destination Rate')})
                            </span>
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400">{t('fee_gross_revenue', 'Gross Hauling Revenue:')}</span>
                      <span className="font-mono font-bold text-slate-200">
                        {formatCurrency(calculateTotalRevenue())}
                      </span>
                    </div>

                    {/* Additional Fees Breakdown */}
                    {calculateTotalFees() > 0 ? (
                      <div className="py-2.5 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-amber-400 font-semibold">{t('step_additional_fees', 'Additional Fees & Tolls Deducted')}:</span>
                          <span className="font-mono font-bold text-amber-400">
                            - {formatCurrency(calculateTotalFees())}
                          </span>
                        </div>
                        {getValidFeesList().map((f, i) => (
                          <div key={i} className="flex justify-between text-[11px] text-slate-400 pl-2">
                            <span>
                              {f.fee_type === 'toll' ? '🛣️ Expressway Toll' : f.fee_type === 'weighbridge' ? '⚖️ Weighbridge / Scale' : '🅿️ Other Extra Fee'}
                              {f.description ? ` (${f.description})` : ''}
                            </span>
                            <span className="font-mono text-slate-300">
                              {formatCurrency(f.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-2.5 flex justify-between text-slate-400">
                        <span>{t('step_additional_fees', 'Additional Fees & Tolls')}:</span>
                        <span className="text-slate-500">{t('none_zero_etb', 'None (0 ETB)')}</span>
                      </div>
                    )}

                    <div className="pt-3 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-200">{t('fee_net_earnings', 'Total Trip Pay:')}</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        {formatCurrency(calculateNetRevenue())}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{t('trip_notes_label', 'Optional Trip Notes / Delivery Ticket:')}</label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder={t('ph_ticket_signed_engineer', 'e.g. Ticket #49281, signed by engineer')}
                      className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
                    />
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
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-700/60"
              >
                <ChevronLeft className="w-4 h-4" /> {t('back', 'Back')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-400 font-medium text-xs hover:text-white"
              >
                {t('cancel', 'Cancel')}
              </button>
            )}

            {step < 8 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && !formData.loading_site_id) ||
                  (step === 2 && !formData.dumping_site_id) ||
                  (step === 3 && !formData.material_id) ||
                  (step === 5 && formData.quantity <= 0)
                }
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 touch-btn shadow-md"
              >
                {t('next', 'Next')} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-500/25 touch-btn"
              >
                {loading ? t('fuel_submitting', 'Submitting...') : `✓ ${t('submit_trip_btn', 'Confirm & Submit Hauling Trip')}`}
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
            {customSiteModal.error && (
              <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300">
                {customSiteModal.error}
              </div>
            )}
            <input
              type="text"
              autoFocus
              placeholder={t('site_name_ph', 'Site Name (e.g. Quarry B, Ring Road km 4)')}
              value={customSiteModal.name}
              onChange={e => setCustomSiteModal({ ...customSiteModal, name: e.target.value, error: '' })}
              className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder={t('ph_location_address_input', 'Location/Address')}
              value={customSiteModal.location}
              onChange={e => setCustomSiteModal({ ...customSiteModal, location: e.target.value })}
              className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomSiteModal({ open: false, type: 'loading', name: '', location: '', loading: false, error: '' })}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={customSiteModal.loading || !customSiteModal.name.trim()}
                onClick={handleCreateSite}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                {customSiteModal.loading ? 'Saving...' : t('save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Custom Material Modal */}
      {customMaterialModal.open && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-sm space-y-3">
            <h4 className="font-bold text-sm text-slate-100">
              {t('add_custom_material', '+ Add New Material / Cargo')}
            </h4>
            {customMaterialModal.error && (
              <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300">
                {customMaterialModal.error}
              </div>
            )}
            <input
              type="text"
              autoFocus
              placeholder="e.g. Iron Rebar, Gypsum, Concrete Blocks..."
              value={customMaterialModal.name}
              onChange={e => setCustomMaterialModal({ ...customMaterialModal, name: e.target.value, error: '' })}
              className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Standard Unit:</label>
                <select
                  value={customMaterialModal.default_unit}
                  onChange={e => setCustomMaterialModal({ ...customMaterialModal, default_unit: e.target.value })}
                  className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="ton">Ton</option>
                  <option value="quintal">Quintal</option>
                  <option value="kg">KG</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Default Rate (ETB):</label>
                <input
                  type="number"
                  value={customMaterialModal.default_price}
                  onChange={e => setCustomMaterialModal({ ...customMaterialModal, default_price: e.target.value })}
                  className="w-full py-2 px-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomMaterialModal({ open: false, name: '', default_unit: 'ton', default_price: 450, error: '', loading: false })}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={customMaterialModal.loading || !customMaterialModal.name.trim()}
                onClick={handleCreateMaterial}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                {customMaterialModal.loading ? 'Adding...' : t('add', 'Add Material')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
