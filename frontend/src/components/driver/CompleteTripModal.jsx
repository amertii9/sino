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
  Receipt,
  CheckCircle,
  Plus,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Sparkles,
  Gauge,
  Coins,
  AlertCircle
} from 'lucide-react';

export const CompleteTripModal = ({ isOpen, onClose, onSuccess, initialTrip = null }) => {
  const { truck, driver } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successTrip, setSuccessTrip] = useState(null);

  // Active trips list
  const [activeTrips, setActiveTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Form State
  const [receiptNumber, setReceiptNumber] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [quantity, setQuantity] = useState(20);
  const [unit, setUnit] = useState('ton');
  const [pricingMethod, setPricingMethod] = useState('per_ton');
  const [unitPrice, setUnitPrice] = useState(450);
  const [lumpSum, setLumpSum] = useState(0);
  const [notes, setNotes] = useState('');

  // Driver Additional Fees Entries
  const [feeEntries, setFeeEntries] = useState([
    { id: 1, amount: '', name: '', fee_type: 'other' }
  ]);

  // Admin suggestions
  const [adminSuggestions, setAdminSuggestions] = useState([
    { name: 'Modjo Expressway Toll', amount: 150, fee_type: 'toll' },
    { name: 'Adama Expressway Toll', amount: 200, fee_type: 'toll' },
    { name: 'Weighbridge / Scale', amount: 100, fee_type: 'weighbridge' },
    { name: 'Parking / Staging', amount: 50, fee_type: 'parking' },
    { name: 'Gate / Yard Pass', amount: 100, fee_type: 'gate_fee' },
  ]);

  // Smart suggested route price
  const [suggestedPrice, setSuggestedPrice] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setSuccessTrip(null);
    setError('');
    setReceiptNumber('');
    setNotes('');
    setFeeEntries([{ id: 1, amount: '', name: '', fee_type: 'other' }]);

    // Do NOT write the previous odometer reading - the driver should be the one who enters
    setEndOdometer('');

    // Fetch active trips and settings
    Promise.all([
      api.get('/trips?status=in_progress'),
      api.get('/settings').catch(() => null),
    ])
      .then(([tripsRes, settingsRes]) => {
        const inProg = Array.isArray(tripsRes) ? tripsRes : [];
        setActiveTrips(inProg);

        if (initialTrip) {
          setSelectedTrip(initialTrip);
          applyTripDefaults(initialTrip);
        } else if (inProg.length > 0) {
          setSelectedTrip(inProg[0]);
          applyTripDefaults(inProg[0]);
        } else {
          setSelectedTrip(null);
        }

        if (settingsRes?.fee_suggestions?.length > 0) {
          setAdminSuggestions(settingsRes.fee_suggestions);
        }
      })
      .catch(console.error);
  }, [isOpen, initialTrip, truck]);

  const applyTripDefaults = (tripObj) => {
    if (!tripObj) return;
    if (tripObj.unit) setUnit(tripObj.unit);
    if (tripObj.pricing_method) setPricingMethod(tripObj.pricing_method);
    if (tripObj.unit_price > 0) setUnitPrice(tripObj.unit_price);
    if (tripObj.quantity > 0) setQuantity(tripObj.quantity);

    // Fetch smart route price for this trip
    if (tripObj.loading_site_id && tripObj.dumping_site_id) {
      api.get('/trips/smart-price', {
        loading_site_id: tripObj.loading_site_id,
        dumping_site_id: tripObj.dumping_site_id,
        material_id: tripObj.material_id,
      })
        .then(res => {
          if (res?.price > 0) {
            setSuggestedPrice(res);
            if (!tripObj.unit_price) {
              setUnitPrice(res.price);
              if (res.pricing_method) setPricingMethod(res.pricing_method);
            }
          }
        })
        .catch(console.error);
    }
  };

  if (!isOpen) return null;

  // Calculation helpers - closing odometer cannot be less than the trip's starting odometer
  const minEndOdo = selectedTrip?.start_odometer || 0;

  const getConvertedKg = () => {
    const q = parseFloat(quantity) || 0;
    if (unit === 'ton') return q * 1000;
    if (unit === 'quintal') return q * 100;
    return q;
  };

  const calculateTotalRevenue = () => {
    if (pricingMethod === 'lump_sum') {
      return parseFloat(lumpSum) || 0;
    }
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(unitPrice) || 0;
    return q * p;
  };

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
      const last = prev[prev.length - 1];
      if (last && (!last.amount || parseFloat(last.amount) === 0)) {
        return prev.map((item, idx) =>
          idx === prev.length - 1
            ? { ...item, amount: String(sug.amount), name: sug.name, fee_type: sug.fee_type || 'other' }
            : item
        );
      }
      return [
        ...prev,
        { id: Date.now() + Math.random(), amount: String(sug.amount), name: sug.name, fee_type: sug.fee_type || 'other' }
      ];
    });
  };

  const handleCompleteSubmit = async () => {
    if (!receiptNumber.trim()) {
      setError(t('err_enter_receipt', 'Please insert the delivery receipt / ticket number'));
      setStep(1);
      return;
    }

    const endOdoVal = parseFloat(endOdometer);
    if (endOdometer && !isNaN(endOdoVal) && endOdoVal > 0) {
      if (minEndOdo > 0 && endOdoVal < minEndOdo) {
        setError(t('err_end_odo_too_low', `Closing odometer (${formatNumber(endOdoVal)} km) cannot be less than departure or previous reading (${formatNumber(minEndOdo)} km). Mileage must increase as the vehicle travels.`));
        setStep(1);
        return;
      }
    }

    const q = parseFloat(quantity);
    if (!q || q <= 0) {
      setError(t('err_enter_quantity', 'Please enter a valid transported cargo quantity'));
      setStep(2);
      return;
    }

    if (pricingMethod === 'lump_sum' && (!lumpSum || parseFloat(lumpSum) <= 0)) {
      setError(t('err_enter_lump_sum', 'Please enter a valid lump sum trip amount'));
      setStep(3);
      return;
    }

    if (pricingMethod !== 'lump_sum' && (!unitPrice || parseFloat(unitPrice) <= 0)) {
      setError(t('err_enter_unit_price', 'Please enter a valid rate per unit'));
      setStep(3);
      return;
    }

    if (!selectedTrip?.id) {
      setError(t('err_no_trip_selected', 'No active trip selected to complete'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const validFees = getValidFeesList();
      const payload = {
        trip_id: selectedTrip.id,
        receipt_number: receiptNumber.trim(),
        quantity: q,
        unit: unit,
        pricing_method: pricingMethod,
        unit_price: parseFloat(unitPrice) || 0,
        lump_sum: parseFloat(lumpSum) || 0,
        additional_fees: validFees,
        notes: notes.trim(),
        end_odometer: parseFloat(endOdometer) || 0,
      };

      const result = await api.post(`/trips/${selectedTrip.id}/complete`, payload);
      setSuccessTrip(result);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setError(err.message || 'Failed to complete trip');
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
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-sm">
              {step <= 5 ? step : '✓'}
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {step === 1 && t('complete_step1_title', 'Delivery Receipt Number')}
                {step === 2 && t('complete_step2_title', 'Enter Cargo Quantity & Units')}
                {step === 3 && t('complete_step3_title', 'Pricing Rate & Earnings')}
                {step === 4 && t('complete_step4_title', 'Additional Fees & Tolls')}
                {step === 5 && t('complete_step5_title', 'Review & Complete Trip')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('trip_step_of', 'Step')} {step} {t('trip_of_five', 'of 5')} • {t('complete_trip_badge', 'Complete Hauling Run')}
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
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Active Trip Missing Notice */}
          {!selectedTrip && !successTrip && (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto">
                <Truck className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {t('no_active_trip_title', 'No Active Trip In Progress')}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {t('no_active_trip_sub', 'You do not have a trip currently in progress. Start a trip first to log your departure.')}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                {t('close', 'Close')}
              </button>
            </div>
          )}

          {/* Success Screen */}
          {successTrip ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black text-white">{t('trip_completed_title', 'Trip Successfully Completed!')}</h2>
              <p className="text-xs text-slate-400 -mt-1">
                {t('trip_completed_msg', 'Your hauling run has been recorded and financial totals are finalized.')}
              </p>

              <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl text-left space-y-2 max-w-sm mx-auto text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>{t('trip_ref_number', 'Trip Number:')}</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{successTrip.trip_number}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{t('receipt_number', 'Receipt / Ticket #:')}</span>
                  <span className="font-mono font-bold text-slate-100">{successTrip.receipt_number}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{t('material', 'Cargo Material:')}</span>
                  <span className="font-semibold text-slate-200">{successTrip.material_name}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{t('quantity', 'Delivered Quantity:')}</span>
                  <span className="font-semibold text-slate-200">{successTrip.quantity} {successTrip.unit}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{t('route', 'Route:')}</span>
                  <span className="font-semibold text-right text-slate-200">
                    {successTrip.loading_site_name} → {successTrip.dumping_site_name}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                  <span className="text-slate-400">{t('fee_gross_revenue', 'Gross Hauling:')}</span>
                  <span className="font-mono font-bold text-slate-200">
                    {formatCurrency(successTrip.gross_revenue || successTrip.total_revenue)}
                  </span>
                </div>
                {successTrip.total_additional_fees > 0 && (
                  <div className="flex justify-between items-center text-amber-400">
                    <span>{t('step_additional_fees', 'Additional Fees Deducted:')}</span>
                    <span className="font-mono font-bold">- {formatCurrency(successTrip.total_additional_fees)}</span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-slate-700 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-200">{t('fee_net_earnings', 'Total Trip Pay:')}</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {formatCurrency(successTrip.total_revenue || successTrip.net_revenue)}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 touch-btn cursor-pointer"
              >
                {t('done', 'Done')}
              </button>
            </div>
          ) : selectedTrip && (
            <>
              {/* Active Trip Header Badge */}
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 mb-4 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">{selectedTrip.trip_number}</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                      {t('in_progress', 'In Progress')}
                    </span>
                  </div>
                  <div className="font-bold text-slate-200 mt-0.5">
                    {selectedTrip.loading_site_name} → {selectedTrip.dumping_site_name}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Material: <strong className="text-amber-300 font-semibold">{selectedTrip.material_name}</strong>
                    {selectedTrip.start_odometer > 0 && ` • Start: ${formatNumber(selectedTrip.start_odometer)} km`}
                  </div>
                </div>

                {/* Multiple active trips selector if > 1 */}
                {activeTrips.length > 1 && (
                  <select
                    value={selectedTrip.id}
                    onChange={e => {
                      const tObj = activeTrips.find(x => x.id === e.target.value);
                      if (tObj) {
                        setSelectedTrip(tObj);
                        applyTripDefaults(tObj);
                      }
                    }}
                    className="py-1 px-2 bg-slate-900 border border-slate-700 text-xs text-white rounded-lg"
                  >
                    {activeTrips.map(x => (
                      <option key={x.id} value={x.id}>{x.trip_number}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* STEP 1: RECEIPT NUMBER (Requirement: First step to complete trip is to insert receipt number) */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center justify-between">
                      <span>{t('receipt_number_label', 'Insert Delivery Receipt / Waybill Number:')} *</span>
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5" /> {t('ticket_number', 'Ticket Number')}
                      </span>
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. RC-98213 / Ticket #49281"
                        value={receiptNumber}
                        onChange={e => setReceiptNumber(e.target.value)}
                        className="w-full py-4 pl-12 pr-4 bg-slate-800 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl font-mono text-xl font-bold text-emerald-400 focus:outline-none shadow-inner"
                        autoFocus
                      />
                      <Receipt className="w-6 h-6 text-slate-400 absolute left-3.5 top-4 pointer-events-none" />
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {t('receipt_hint', 'Enter the physical receipt or weighbridge delivery ticket number issued at the unloading site.')}
                    </p>
                  </div>

                  {/* Optional End Odometer */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>{t('end_odometer_optional', 'Closing Odometer Reading (km):')}</span>
                      <span className="text-[10px] text-slate-500 font-normal">({t('optional', 'Optional')})</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min={minEndOdo > 0 ? minEndOdo : undefined}
                        placeholder={minEndOdo > 0 ? `Min: ${minEndOdo} km` : 'e.g. 52445'}
                        value={endOdometer}
                        onChange={e => setEndOdometer(e.target.value)}
                        className={`w-full py-2.5 pl-10 pr-3 bg-slate-800 border rounded-xl font-mono text-sm focus:outline-none transition-colors ${
                          minEndOdo > 0 && endOdometer && parseFloat(endOdometer) < minEndOdo
                            ? 'border-red-500 text-red-400 focus:border-red-500'
                            : 'border-slate-700 text-cyan-400 focus:border-cyan-500'
                        }`}
                      />
                      <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>

                    {minEndOdo > 0 && (
                      <div className="mt-1.5 text-[11px] flex items-center justify-between text-slate-400">
                        <span>{t('min_allowed_reading', 'Minimum required (departure/previous):')}</span>
                        <span className="font-mono font-bold text-amber-400">{formatNumber(minEndOdo)} km</span>
                      </div>
                    )}

                    {minEndOdo > 0 && endOdometer && parseFloat(endOdometer) < minEndOdo && (
                      <div className="mt-1.5 p-2 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>
                          {t('err_end_odo_less', 'Cannot be less than previous reading')} ({formatNumber(minEndOdo)} km). {t('odo_must_increase', 'Mileage must increase as the truck travels.')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: QUANTITY & UNITS */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">{t('trip_unit_label', 'Unit of Measure:')}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['ton', 'quintal', 'kg'].map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUnit(u)}
                          className={`py-2.5 rounded-xl font-bold uppercase text-xs border transition-all touch-btn cursor-pointer ${
                            unit === u
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
                      {t('trip_quantity_label', 'Quantity Transported:')} ({unit})
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(p => Math.max(1, p - 1))}
                        className="w-12 h-12 rounded-xl bg-slate-800 text-xl font-bold border border-slate-700 text-slate-200 flex items-center justify-center active:scale-95 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="any"
                        value={quantity}
                        onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                        className="flex-1 text-center py-3 bg-slate-800 border border-slate-700 rounded-xl font-mono text-2xl font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(p => p + 1)}
                        className="w-12 h-12 rounded-xl bg-slate-800 text-xl font-bold border border-slate-700 text-slate-200 flex items-center justify-center active:scale-95 cursor-pointer"
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
                          onClick={() => setQuantity(val)}
                          className="flex-1 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer"
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
                      <span>Total Kilograms:</span>
                      <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg())} kg</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Metric Tons:</span>
                      <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg() / 1000, 2)} tons</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Quintals:</span>
                      <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg() / 100, 1)} quintals</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: PRICING & RATE */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">{t('trip_pricing_method', 'Pricing Calculation Method:')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'per_ton', label: 'Price per Ton' },
                        { id: 'per_quintal', label: 'Price per Quintal' },
                        { id: 'per_kg', label: 'Price per KG' },
                        { id: 'lump_sum', label: t('trip_lump_sum', 'Lump Sum (Fixed Trip Price)') },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPricingMethod(m.id)}
                          className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center touch-btn cursor-pointer ${
                            pricingMethod === m.id
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Smart Price Suggestion banner */}
                  {suggestedPrice?.price > 0 && pricingMethod !== 'lump_sum' && (
                    <div className="p-3 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          {t('trip_suggested_price', 'Suggested Route Price:')}
                        </div>
                        <span className="font-bold text-amber-400 font-mono text-sm">
                          {formatCurrency(suggestedPrice.price)} / {unit}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setUnitPrice(suggestedPrice.price)}
                          className="flex-1 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-sm touch-btn cursor-pointer"
                        >
                          {t('trip_use_price', 'Use Price')} ({suggestedPrice.price} ETB)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Price input */}
                  {pricingMethod === 'lump_sum' ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Total Lump Sum Amount (ETB):
                      </label>
                      <input
                        type="number"
                        value={lumpSum}
                        onChange={e => setLumpSum(parseFloat(e.target.value) || 0)}
                        className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xl font-bold text-emerald-400 focus:outline-none focus:border-amber-500"
                        placeholder="e.g. 15000"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Unit Price (ETB / {unit}):
                      </label>
                      <input
                        type="number"
                        value={unitPrice}
                        onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                        className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xl font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                        placeholder="e.g. 450"
                      />
                    </div>
                  )}

                  {/* Live revenue preview */}
                  <div className="p-3.5 bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">{t('trip_est_revenue', 'Estimated Gross Revenue:')}</div>
                      <div className="text-xl font-black text-emerald-400">
                        {formatCurrency(calculateTotalRevenue())}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {pricingMethod === 'lump_sum'
                        ? 'Lump Sum'
                        : `${quantity} ${unit} × ${unitPrice} ETB`}
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 4: ADDITIONAL FEES & TOLLS */}
              {step === 4 && (
                <div className="space-y-4">
                  {/* Revenue & Deductions Live Banner */}
                  <div className="p-3.5 bg-slate-800/90 rounded-2xl border border-slate-700/80 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Hauling Gross</span>
                      <span className="font-bold text-xs text-slate-200 font-mono">
                        {formatCurrency(calculateTotalRevenue())}
                      </span>
                    </div>
                    <div className="border-x border-slate-700/80">
                      <span className="text-[10px] text-amber-400 block font-medium">Fees Deducted</span>
                      <span className="font-bold text-xs text-amber-400 font-mono">
                        {calculateTotalFees() > 0 ? `- ${formatCurrency(calculateTotalFees())}` : '0 ETB'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400 block font-medium">Total Trip Pay</span>
                      <span className="font-black text-xs text-emerald-400 font-mono">
                        {formatCurrency(calculateNetRevenue())}
                      </span>
                    </div>
                  </div>

                  {/* 1 space to enter the money + add sign to add more */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300">
                        Enter Additional Fee / Toll Amount:
                      </label>
                      <button
                        type="button"
                        onClick={handleAddEntry}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-bold text-xs rounded-xl flex items-center gap-1 transition touch-btn active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add More
                      </button>
                    </div>

                    <div className="space-y-2">
                      {feeEntries.map((entry, index) => (
                        <div key={entry.id} className="flex items-center gap-2">
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

                          <input
                            type="text"
                            placeholder="Note / Ticket (optional)"
                            value={entry.name}
                            onChange={e => handleUpdateEntry(entry.id, 'name', e.target.value)}
                            className="w-32 sm:w-44 py-3 px-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />

                          {feeEntries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEntry(entry.id)}
                              className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition shrink-0 cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddEntry}
                      className="w-full py-2 bg-slate-800/80 hover:bg-slate-750 border border-dashed border-slate-700 rounded-xl text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5 transition touch-btn cursor-pointer"
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
                            className="p-2.5 bg-slate-800 hover:bg-slate-750 active:scale-95 border border-slate-700 hover:border-amber-500/60 rounded-xl text-left transition touch-btn shadow-sm flex items-center justify-between gap-1.5 cursor-pointer"
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

                  {calculateTotalFees() === 0 && (
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="w-full py-2.5 bg-slate-800/90 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/50 rounded-2xl text-xs font-bold text-amber-400 flex items-center justify-center gap-2 transition touch-btn cursor-pointer"
                    >
                      ✓ No Extra Fees (0 ETB) — Continue to Summary →
                    </button>
                  )}
                </div>
              )}

              {/* STEP 5: REVIEW & COMPLETE */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 divide-y divide-slate-700/60 text-xs">
                    <div className="pb-2.5 flex justify-between">
                      <span className="text-slate-400">{t('receipt_number', 'Receipt / Ticket #')}:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">{receiptNumber}</span>
                    </div>

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('step_loading', 'Loading Site')}:</span>
                      <span className="font-bold text-slate-100">{selectedTrip.loading_site_name}</span>
                    </div>

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('step_dumping', 'Dumping Site')}:</span>
                      <span className="font-bold text-emerald-400">{selectedTrip.dumping_site_name}</span>
                    </div>

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('material', 'Material')}:</span>
                      <span className="font-bold text-amber-400">{selectedTrip.material_name}</span>
                    </div>

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('quantity', 'Quantity')}:</span>
                      <span className="font-bold text-slate-100">
                        {quantity} {unit} ({formatNumber(getConvertedKg())} kg)
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('step_price', 'Pricing & Rate')}:</span>
                      <span className="font-bold text-slate-100">
                        {pricingMethod === 'lump_sum'
                          ? 'Lump Sum'
                          : `${unitPrice} ETB / ${unit}`}
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400">{t('fee_gross_revenue', 'Gross Hauling Revenue:')}</span>
                      <span className="font-mono font-bold text-slate-200">
                        {formatCurrency(calculateTotalRevenue())}
                      </span>
                    </div>

                    {calculateTotalFees() > 0 ? (
                      <div className="py-2.5 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-amber-400 font-semibold">{t('step_additional_fees', 'Additional Fees Deducted')}:</span>
                          <span className="font-mono font-bold text-amber-400">
                            - {formatCurrency(calculateTotalFees())}
                          </span>
                        </div>
                        {getValidFeesList().map((f, i) => (
                          <div key={i} className="flex justify-between text-[11px] text-slate-400 pl-2">
                            <span>{f.description}</span>
                            <span className="font-mono text-slate-300">
                              {formatCurrency(f.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-2.5 flex justify-between text-slate-400">
                        <span>{t('step_additional_fees', 'Additional Fees')}:</span>
                        <span className="text-slate-500">None (0 ETB)</span>
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
                    <label className="block text-xs text-slate-400 mb-1">{t('trip_notes_label', 'Notes / Delivery Comments (Optional):')}</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Unloaded at gate 2, signed by site supervisor"
                      className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!successTrip && selectedTrip && (
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

            {step < 5 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && (!receiptNumber.trim() || (minEndOdo > 0 && endOdometer && parseFloat(endOdometer) < minEndOdo))) ||
                  (step === 2 && quantity <= 0)
                }
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 touch-btn shadow-md cursor-pointer"
              >
                {t('next', 'Next')} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading || !receiptNumber.trim()}
                onClick={handleCompleteSubmit}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 text-white font-black text-sm rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-500/25 touch-btn cursor-pointer"
              >
                {loading ? t('completing_trip', 'Completing...') : `✓ ${t('confirm_complete_trip', 'Complete the Trip')}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
