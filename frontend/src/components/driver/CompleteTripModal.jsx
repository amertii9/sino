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
  AlertCircle,
  Scale,
  Layers
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
  const [unit, setUnit] = useState('quintal');
  const [pricingMethod, setPricingMethod] = useState('per_quintal');
  const [unitPrice, setUnitPrice] = useState(450);
  const [pricingTarget, setPricingTarget] = useState('destination');
  const [dropOffLocation, setDropOffLocation] = useState('final_destination'); // 'final_destination' | 'intermediate_transit' | 'split'
  const [transitNotes, setTransitNotes] = useState('');
  const [transitUnitPrice, setTransitUnitPrice] = useState(0);
  const [destinationUnitPrice, setDestinationUnitPrice] = useState(0);
  const [transitPointName, setTransitPointName] = useState('');
  const [transitLumpSumSingle, setTransitLumpSumSingle] = useState(0);
  const [destinationLumpSumSingle, setDestinationLumpSumSingle] = useState(0);
  const [priceDifference, setPriceDifference] = useState(0);
  const [lumpSum, setLumpSum] = useState(0);
  const [notes, setNotes] = useState('');

  // Multi-Drop / Split Offload State (Transit Drop + Destination Drop)
  const [isSplitDrop, setIsSplitDrop] = useState(false);
  const [transitQuantity, setTransitQuantity] = useState(8);
  const [transitUnit, setTransitUnit] = useState('quintal');
  const [transitPricingMethod, setTransitPricingMethod] = useState('per_quintal'); // 'per_quintal' | 'lump_sum'
  const [transitUnitPriceSplit, setTransitUnitPriceSplit] = useState(350);
  const [transitLumpSum, setTransitLumpSum] = useState(8500);
  const [transitReceiptNumber, setTransitReceiptNumber] = useState('');

  const [destinationQuantity, setDestinationQuantity] = useState(12);
  const [destinationUnit, setDestinationUnit] = useState('quintal');
  const [destinationPricingMethod, setDestinationPricingMethod] = useState('per_quintal'); // 'per_quintal' | 'lump_sum'
  const [destinationUnitPriceSplit, setDestinationUnitPriceSplit] = useState(450);
  const [destinationLumpSum, setDestinationLumpSum] = useState(12000);
  const [destinationReceiptNumber, setDestinationReceiptNumber] = useState('');

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
    setTransitPointName('');
    setTransitReceiptNumber('');
    setDestinationReceiptNumber('');
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
    setIsSplitDrop(Boolean(tripObj.is_split_drop));

    if (tripObj.unit) {
      setUnit(tripObj.unit);
      setTransitUnit(tripObj.unit);
      setDestinationUnit(tripObj.unit);
    }
    if (tripObj.pricing_method) setPricingMethod(tripObj.pricing_method);
    if (tripObj.unit_price > 0) setUnitPrice(tripObj.unit_price);
    if (tripObj.quantity > 0) setQuantity(tripObj.quantity);
    if (tripObj.pricing_target) setPricingTarget(tripObj.pricing_target);
    if (tripObj.transit_unit_price > 0) {
      setTransitUnitPrice(tripObj.transit_unit_price);
      setTransitUnitPriceSplit(tripObj.transit_unit_price);
    }
    if (tripObj.destination_unit_price > 0) {
      setDestinationUnitPrice(tripObj.destination_unit_price);
      setDestinationUnitPriceSplit(tripObj.destination_unit_price);
    }
    if (tripObj.price_difference !== undefined) setPriceDifference(tripObj.price_difference);

    const initialDrop = tripObj.drop_off_location || (tripObj.pricing_target === 'transit' ? 'intermediate_transit' : 'final_destination');
    setDropOffLocation(initialDrop);
    if (tripObj.transition_point_name) setTransitPointName(tripObj.transition_point_name);
    if (tripObj.transit_notes) setTransitNotes(tripObj.transit_notes);
    if (tripObj.lump_sum > 0) setLumpSum(tripObj.lump_sum);
    if (tripObj.transit_lump_sum > 0) setTransitLumpSumSingle(tripObj.transit_lump_sum);
    if (tripObj.destination_lump_sum > 0) setDestinationLumpSumSingle(tripObj.destination_lump_sum);

    // Multi-drop fields
    if (tripObj.transit_quantity > 0) setTransitQuantity(tripObj.transit_quantity);
    if (tripObj.transit_unit) setTransitUnit(tripObj.transit_unit);
    if (tripObj.transit_pricing_method) setTransitPricingMethod(tripObj.transit_pricing_method);
    if (tripObj.transit_lump_sum > 0) setTransitLumpSum(tripObj.transit_lump_sum);
    if (tripObj.transit_receipt_number) setTransitReceiptNumber(tripObj.transit_receipt_number);

    if (tripObj.destination_quantity > 0) setDestinationQuantity(tripObj.destination_quantity);
    if (tripObj.destination_unit) setDestinationUnit(tripObj.destination_unit);
    if (tripObj.destination_pricing_method) setDestinationPricingMethod(tripObj.destination_pricing_method);
    if (tripObj.destination_lump_sum > 0) setDestinationLumpSum(tripObj.destination_lump_sum);
    if (tripObj.destination_receipt_number) setDestinationReceiptNumber(tripObj.destination_receipt_number);

    // Fetch smart route price for this trip
    if (tripObj.loading_site_id && tripObj.dumping_site_id) {
      const transitId = (tripObj.has_transition && tripObj.transition_point_ids?.length > 0)
        ? tripObj.transition_point_ids[0]
        : '';
      api.get('/trips/smart-price', {
        loading_site_id: tripObj.loading_site_id,
        dumping_site_id: tripObj.dumping_site_id,
        transit_point_id: transitId,
        material_id: tripObj.material_id,
      })
        .then(res => {
          if (res?.price > 0 || res?.destination_price > 0 || res?.transit_price > 0) {
            setSuggestedPrice(res);
            const destP = res.destination_price || res.price || 0;
            const transP = res.transit_price || 0;
            setDestinationUnitPrice(prev => prev > 0 ? prev : destP);
            setDestinationUnitPriceSplit(prev => prev > 0 ? prev : destP);
            setTransitUnitPrice(prev => prev > 0 ? prev : transP);
            setTransitUnitPriceSplit(prev => prev > 0 ? prev : transP);
            setPriceDifference(res.price_difference || (destP - transP));

            if (res.transit_lump_sum > 0) {
              setTransitLumpSum(res.transit_lump_sum);
              setTransitLumpSumSingle(res.transit_lump_sum);
            }
            if (res.destination_lump_sum > 0) {
              setDestinationLumpSum(res.destination_lump_sum);
              setDestinationLumpSumSingle(res.destination_lump_sum);
            }

            if (!tripObj.unit_price) {
              const target = tripObj.pricing_target || 'destination';
              const activeP = (target === 'transit' && transP > 0) ? transP : destP;
              setUnitPrice(activeP);
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

  const toKg = (qty, u) => {
    const q = parseFloat(qty) || 0;
    const clean = (u || '').toLowerCase().trim();
    if (clean === 'ton' || clean === 'tons' || clean === 't') return q * 1000;
    if (clean === 'quintal' || clean === 'quintals' || clean === 'q') return q * 100;
    if (clean === 'kg' || clean === 'kilogram' || clean === 'kilograms') return q;
    return q * 1000;
  };

  const getUnitDisplay = (u) => {
    const clean = (u || '').toLowerCase().trim();
    if (clean === 'ton' || clean === 'tons' || clean === 't') return t('unit_ton_display', 'Ton');
    if (clean === 'quintal' || clean === 'quintals' || clean === 'q') return t('unit_quintal_display', 'Quintal');
    if (clean === 'kg' || clean === 'kilogram' || clean === 'kilograms') return t('unit_kg_display', 'KG');
    return u;
  };

  const getCargoSummary = () => {
    if (!isSplitDrop) {
      const q = parseFloat(quantity) || 0;
      const cleanUnit = (unit || 'ton').toLowerCase().trim();
      const kg = toKg(q, cleanUnit);
      const tons = kg / 1000;
      const quintals = kg / 100;
      const normU = (cleanUnit === 'ton' || cleanUnit === 'tons' || cleanUnit === 't')
        ? 'ton'
        : (cleanUnit === 'quintal' || cleanUnit === 'quintals' || cleanUnit === 'q')
        ? 'quintal'
        : 'kg';
      const unitLabel = normU === 'ton' ? t('unit_tons_label', 'tons') : normU === 'quintal' ? t('unit_quintals_label', 'quintals') : t('unit_kg_display', 'kg');
      return {
        totalKg: kg,
        totalTons: tons,
        totalQuintals: quintals,
        primaryQuantity: q,
        primaryUnit: normU,
        primaryLabel: `${formatNumber(q, normU === 'ton' ? 2 : normU === 'quintal' ? 1 : 0)} ${unitLabel}`,
        isSplit: false,
        sameUnit: true,
        breakdownText: `${q} ${unitLabel}`,
      };
    }

    const tQ = parseFloat(transitQuantity) || 0;
    const dQ = parseFloat(destinationQuantity) || 0;
    const tU = (transitUnit || 'ton').toLowerCase().trim();
    const dU = (destinationUnit || 'ton').toLowerCase().trim();

    const tKg = toKg(tQ, tU);
    const dKg = toKg(dQ, dU);
    const totalKg = tKg + dKg;
    const totalTons = totalKg / 1000;
    const totalQuintals = totalKg / 100;

    const normUnit = u => {
      if (u === 'ton' || u === 'tons' || u === 't') return 'ton';
      if (u === 'quintal' || u === 'quintals' || u === 'q') return 'quintal';
      return 'kg';
    };

    const normT = normUnit(tU);
    const normD = normUnit(dU);
    const sameUnit = normT === normD;

    let primaryQuantity = 0;
    let primaryUnit = 'ton';
    let primaryLabel = '';

    if (sameUnit) {
      primaryQuantity = tQ + dQ;
      primaryUnit = normT;
      const unitLabel = normT === 'ton' ? t('unit_tons_label', 'tons') : normT === 'quintal' ? t('unit_quintals_label', 'quintals') : t('unit_kg_display', 'kg');
      primaryLabel = `${formatNumber(primaryQuantity, normT === 'ton' ? 2 : normT === 'quintal' ? 1 : 0)} ${unitLabel}`;
    } else {
      primaryQuantity = totalTons;
      primaryUnit = 'ton';
      primaryLabel = `${formatNumber(totalTons, 2)} ${t('unit_tons_label', 'tons')}`;
    }

    const tLabel = normT === 'ton' ? t('unit_tons_label', 'tons') : normT === 'quintal' ? t('unit_quintals_label', 'quintals') : t('unit_kg_display', 'kg');
    const dLabel = normD === 'ton' ? t('unit_tons_label', 'tons') : normD === 'quintal' ? t('unit_quintals_label', 'quintals') : t('unit_kg_display', 'kg');

    return {
      totalKg,
      totalTons,
      totalQuintals,
      primaryQuantity,
      primaryUnit,
      primaryLabel,
      sameUnit,
      hasMixedUnits: !sameUnit,
      isSplit: true,
      transitKg: tKg,
      destinationKg: dKg,
      breakdownText: `${tQ} ${tLabel} (${formatNumber(tKg / 1000, 2)} ${t('unit_ton_abbr', 't')}) + ${dQ} ${dLabel} (${formatNumber(dKg / 1000, 2)} ${t('unit_ton_abbr', 't')})`,
    };
  };

  const getConvertedKg = () => getCargoSummary().totalKg;

  const computeTransitRevenue = () => {
    if (transitPricingMethod === 'lump_sum') return parseFloat(transitLumpSum) || 0;
    const q = parseFloat(transitQuantity) || 0;
    const p = parseFloat(transitUnitPriceSplit) || 0;
    return q * p;
  };

  const computeDestinationRevenue = () => {
    if (destinationPricingMethod === 'lump_sum') return parseFloat(destinationLumpSum) || 0;
    const q = parseFloat(destinationQuantity) || 0;
    const p = parseFloat(destinationUnitPriceSplit) || 0;
    return q * p;
  };

  const calculateTotalRevenue = () => {
    if (isSplitDrop) {
      return computeTransitRevenue() + computeDestinationRevenue();
    }
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
    const effectiveReceipt = receiptNumber.trim() || [transitReceiptNumber.trim(), destinationReceiptNumber.trim()].filter(Boolean).join(' / ');
    if (!effectiveReceipt) {
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

    if (isSplitDrop) {
      const tQ = parseFloat(transitQuantity) || 0;
      const dQ = parseFloat(destinationQuantity) || 0;
      if (tQ <= 0 && dQ <= 0) {
        setError('Please enter cargo quantity offloaded at transit point or dumping site');
        setStep(2);
        return;
      }
      if (transitPricingMethod === 'lump_sum' && (parseFloat(transitLumpSum) || 0) <= 0) {
        setError('Please enter a valid lump sum amount for transit offload');
        setStep(3);
        return;
      }
      if (destinationPricingMethod === 'lump_sum' && (parseFloat(destinationLumpSum) || 0) <= 0) {
        setError('Please enter a valid lump sum amount for final destination offload');
        setStep(3);
        return;
      }
    } else {
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
    }

    if (!selectedTrip?.id) {
      setError(t('err_no_trip_selected', 'No active trip selected to complete'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const validFees = getValidFeesList();
      const cargoSummary = getCargoSummary();

      const payload = {
        trip_id: selectedTrip.id,
        receipt_number: effectiveReceipt,
        quantity: isSplitDrop ? cargoSummary.primaryQuantity : (parseFloat(quantity) || 0),
        unit: isSplitDrop ? cargoSummary.primaryUnit : unit,
        pricing_method: isSplitDrop ? (destinationPricingMethod || 'per_ton') : pricingMethod,
        unit_price: isSplitDrop ? (parseFloat(destinationUnitPriceSplit) || 0) : (parseFloat(unitPrice) || 0),
        pricing_target: isSplitDrop ? 'split' : pricingTarget,
        drop_off_location: isSplitDrop ? 'split' : dropOffLocation,
        transition_point_name: transitPointName.trim(),
        has_transition: Boolean(transitPointName.trim() || selectedTrip?.has_transition),
        transit_notes: transitNotes || transitReceiptNumber.trim() || '',
        transit_unit_price: isSplitDrop ? (parseFloat(transitUnitPriceSplit) || 0) : (parseFloat(transitUnitPrice) || 0),
        destination_unit_price: isSplitDrop ? (parseFloat(destinationUnitPriceSplit) || 0) : (parseFloat(destinationUnitPrice) || 0),
        price_difference: parseFloat(priceDifference) || 0,
        lump_sum: parseFloat(lumpSum) || 0,
        is_split_drop: isSplitDrop,
        transit_quantity: isSplitDrop ? (parseFloat(transitQuantity) || 0) : 0,
        transit_unit: transitUnit,
        transit_pricing_method: isSplitDrop ? transitPricingMethod : pricingMethod,
        transit_unit_price_split: isSplitDrop ? (parseFloat(transitUnitPriceSplit) || 0) : 0,
        transit_lump_sum: isSplitDrop ? (parseFloat(transitLumpSum) || 0) : 0,
        transit_receipt_number: transitReceiptNumber.trim(),
        destination_quantity: isSplitDrop ? (parseFloat(destinationQuantity) || 0) : 0,
        destination_unit: destinationUnit,
        destination_pricing_method: isSplitDrop ? destinationPricingMethod : pricingMethod,
        destination_unit_price_split: isSplitDrop ? (parseFloat(destinationUnitPriceSplit) || 0) : 0,
        destination_lump_sum: isSplitDrop ? (parseFloat(destinationLumpSum) || 0) : 0,
        destination_receipt_number: destinationReceiptNumber.trim(),
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

              {/* STEP 1: RECEIPT NUMBER */}
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
                        placeholder={t('receipt_ticket_ph', 'e.g. RC-98213 / Ticket #49281')}
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

                  {/* Split Receipts for Multi-Drop */}
                  {isSplitDrop && (
                    <div className="p-3 bg-purple-950/25 border border-purple-500/30 rounded-2xl space-y-2.5">
                      <span className="text-xs font-bold text-purple-300 block">
                        Separate Waybill / Receipt Slips (Multi-Drop)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                            Transit Slip # ({transitPointName || selectedTrip?.transition_point_name || 'Transit'})
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. WB-TR-102"
                            value={transitReceiptNumber}
                            onChange={e => setTransitReceiptNumber(e.target.value)}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                            Destination Ticket # ({selectedTrip?.dumping_site_name || 'Destination'})
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. WB-DEST-904"
                            value={destinationReceiptNumber}
                            onChange={e => setDestinationReceiptNumber(e.target.value)}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manual Transit Checkpoint Entry / Verification */}
                  <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-purple-400" />
                        <span>{t('transit_checkpoint_manual_label', 'Enter Transit Checkpoint / Hub Manually:')}</span>
                      </label>
                      {transitPointName ? (
                        <button
                          type="button"
                          onClick={() => setTransitPointName('')}
                          className="text-[10px] text-red-400 hover:text-red-300 underline font-medium cursor-pointer"
                        >
                          {t('clear', 'Clear')}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">({t('optional', 'Optional')})</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={t('ph_transit_checkpoint_manual', 'Type checkpoint name (e.g. Modjo Kella, Awash Scale, Kality Hub)...')}
                        value={transitPointName}
                        onChange={e => setTransitPointName(e.target.value)}
                        className="w-full py-2.5 pl-9 pr-3 bg-slate-800 border border-slate-700 focus:border-purple-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <MapPin className="w-4 h-4 text-purple-400 absolute left-3 top-2.5 pointer-events-none" />
                    </div>

                    {!isSplitDrop && (transitPointName || selectedTrip?.has_transition || selectedTrip?.transition_point_name || selectedTrip?.intermediate_site_id) && (
                      <div className="pt-1">
                        <label className="text-[10px] text-purple-300 font-semibold block mb-1">
                          {t('transit_slip_notes_label', 'Transit Slip / Notes:')}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. WB-TR-102 / Inspection ticket"
                          value={transitNotes}
                          onChange={e => setTransitNotes(e.target.value)}
                          className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    )}
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

              {/* STEP 2: QUANTITY & UNITS (Supports Split Offload) */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Multi-Drop Toggle Banner */}
                  <div className="p-3 bg-purple-950/30 border border-purple-500/40 rounded-2xl flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-purple-400" />
                        {t('multipoint_cargo_offload_title', 'Multi-Point Cargo Offload (Transit Point + Final Dumping Site)')}
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {t('multipoint_cargo_offload_desc', 'Truck unloads some product at transit point, then moves to the dumping site with the rest')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSplitDrop(p => !p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shrink-0 ${
                        isSplitDrop
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-purple-400'
                      }`}
                    >
                      {isSplitDrop ? t('multi_drop_active', '✓ Multi-Drop Active') : t('enable_split_offload', '+ Enable Split Offload')}
                    </button>
                  </div>

                  {isSplitDrop ? (
                    /* MULTI-DROP SPLIT OFF-LOAD INPUTS */
                    <div className="space-y-3.5">
                      {/* Leg 1: Transit Point Drop */}
                      <div className="p-3.5 bg-slate-800/90 rounded-2xl border border-purple-500/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-purple-400" />
                            {t('unloaded_at_transit_point', '1. Unloaded at Transit Point:')} {transitPointName || selectedTrip?.transition_point_name || t('transit_hub_fallback', 'Intermediate Hub')}
                          </span>
                          <div className="flex gap-1">
                            {['ton', 'quintal', 'kg'].map(u => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => setTransitUnit(u)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                                  transitUnit === u
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-900 text-slate-400'
                                }`}
                              >
                                {getUnitDisplay(u)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                            {t('transit_checkpoint_manual_label', 'Enter Transit Checkpoint / Hub Manually:')}
                          </label>
                          <input
                            type="text"
                            placeholder={t('ph_transit_checkpoint_manual', 'Type checkpoint name (e.g. Modjo Kella, Awash Scale, Kality Hub)...')}
                            value={transitPointName}
                            onChange={e => setTransitPointName(e.target.value)}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 focus:border-purple-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setTransitQuantity(p => Math.max(0, p - 1))}
                            className="w-10 h-10 rounded-xl bg-slate-900 text-lg font-bold border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="any"
                            value={transitQuantity}
                            onChange={e => setTransitQuantity(parseFloat(e.target.value) || 0)}
                            className="flex-1 text-center py-2.5 bg-slate-900 border border-slate-700 rounded-xl font-mono text-xl font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                          />
                          <button
                            type="button"
                            onClick={() => setTransitQuantity(p => p + 1)}
                            className="w-10 h-10 rounded-xl bg-slate-900 text-lg font-bold border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex gap-1.5">
                          {[2, 5, 8, 10, 15].map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setTransitQuantity(v)}
                              className="flex-1 py-1 bg-slate-900 hover:bg-slate-750 text-slate-300 text-[11px] font-semibold rounded-lg border border-slate-700 cursor-pointer"
                            >
                              {v} {getUnitDisplay(transitUnit)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Leg 2: Destination Point Drop */}
                      <div className="p-3.5 bg-slate-800/90 rounded-2xl border border-emerald-500/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            {t('unloaded_at_final_dest', '2. Unloaded at Final Destination:')} {selectedTrip.dumping_site_name || t('dumping_site_fallback', 'Dumping Site')}
                          </span>
                          <div className="flex gap-1">
                            {['ton', 'quintal', 'kg'].map(u => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => setDestinationUnit(u)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                                  destinationUnit === u
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-900 text-slate-400'
                                }`}
                              >
                                {getUnitDisplay(u)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setDestinationQuantity(p => Math.max(0, p - 1))}
                            className="w-10 h-10 rounded-xl bg-slate-900 text-lg font-bold border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="any"
                            value={destinationQuantity}
                            onChange={e => setDestinationQuantity(parseFloat(e.target.value) || 0)}
                            className="flex-1 text-center py-2.5 bg-slate-900 border border-slate-700 rounded-xl font-mono text-xl font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                          />
                          <button
                            type="button"
                            onClick={() => setDestinationQuantity(p => p + 1)}
                            className="w-10 h-10 rounded-xl bg-slate-900 text-lg font-bold border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex gap-1.5">
                          {[5, 10, 12, 16, 20].map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setDestinationQuantity(v)}
                              className="flex-1 py-1 bg-slate-900 hover:bg-slate-750 text-slate-300 text-[11px] font-semibold rounded-lg border border-slate-700 cursor-pointer"
                            >
                              {v} {getUnitDisplay(destinationUnit)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Total Combined Cargo */}
                      {(() => {
                        const summary = getCargoSummary();
                        return (
                          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" /> {t('total_transported_cargo', 'Total Transported Cargo:')}
                              </span>
                              <span className="font-mono font-bold text-white text-sm">
                                {summary.primaryLabel}
                                {summary.primaryUnit !== 'ton' && (
                                  <span className="text-xs text-slate-400 font-normal ml-1.5">
                                    ({formatNumber(summary.totalTons, 2)} {t('unit_tons_label', 'tons')})
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                              <div>
                                <span className="block text-[10px] text-slate-500">{t('metric_equivalent_label', 'Metric Equivalent:')}</span>
                                <span className="font-mono font-bold text-slate-200">
                                  {formatNumber(summary.totalTons, 2)} {t('unit_tons_label', 'tons')} ({formatNumber(summary.totalKg)} {t('unit_kg_display', 'kg')})
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-slate-500">{t('quintals_equivalent_label', 'Quintals Equivalent:')}</span>
                                <span className="font-mono font-bold text-slate-200">
                                  {formatNumber(summary.totalQuintals, 1)} {t('unit_quintals_label', 'quintals')}
                                </span>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-750">
                              <span>📍 {t('transit_summary_tag', 'Transit:')} {transitQuantity} {getUnitDisplay(transitUnit)} ({formatNumber(summary.transitKg / 1000, 2)} {t('unit_ton_abbr', 't')})</span>
                              <span>🏁 {t('dest_summary_tag', 'Dest:')} {destinationQuantity} {getUnitDisplay(destinationUnit)} ({formatNumber(summary.destinationKg / 1000, 2)} {t('unit_ton_abbr', 't')})</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    /* STANDARD SINGLE POINT QUANTITY */
                    <>
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
                              {getUnitDisplay(u)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          {t('trip_quantity_label', 'Quantity Transported:')} ({getUnitDisplay(unit)})
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

                        <div className="flex gap-2 mt-2">
                          {[10, 15, 20, 25, 30].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setQuantity(val)}
                              className="flex-1 py-1.5 bg-slate-800/80 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer"
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-1">
                        <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> {t('trip_converted_equiv', 'Converted Equivalents:')}
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>{t('total_kilograms_label', 'Total Kilograms:')}</span>
                          <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg())} {t('unit_kg_display', 'kg')}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>{t('metric_tons_label', 'Metric Tons:')}</span>
                          <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg() / 1000, 2)} {t('unit_tons_label', 'tons')}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>{t('quintals_label', 'Quintals:')}</span>
                          <span className="font-mono font-bold text-slate-200">{formatNumber(getConvertedKg() / 100, 1)} {t('unit_quintals_label', 'quintals')}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 3: PRICING & RATE (Different payments for Point 1 vs Point 2 + Lump Sum option) */}
              {step === 3 && (
                <div className="space-y-4">
                  {isSplitDrop ? (
                    /* MULTI-DROP SPLIT PRICING INTERFACE */
                    <div className="space-y-3.5">
                      {/* Leg 1: Transit Point Drop Payment */}
                      <div className="p-3.5 bg-slate-800/90 border border-purple-500/40 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-purple-400" />
                            {t('leg1_transit_payment', '1. Transit Payment:')} {transitPointName || selectedTrip?.transition_point_name || t('transit_hub_fallback', 'Transit Waypoint')}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {transitQuantity} {getUnitDisplay(transitUnit)}
                          </span>
                        </div>

                        {/* Payment Method Selector: Unit Price vs Lump Sum */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTransitPricingMethod(transitUnit === 'kg' ? 'per_kg' : transitUnit === 'quintal' ? 'per_quintal' : 'per_ton')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                              transitPricingMethod !== 'lump_sum'
                                ? 'bg-purple-600 text-white border-purple-500 shadow'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            {t('unit_rate_label', 'Unit Rate')} (ETB / {getUnitDisplay(transitUnit)})
                          </button>
                          <button
                            type="button"
                            onClick={() => setTransitPricingMethod('lump_sum')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                              transitPricingMethod === 'lump_sum'
                                ? 'bg-purple-600 text-white border-purple-500 shadow'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            {t('lump_sum_fixed_label', 'Lump Sum (Fixed ETB)')}
                          </button>
                        </div>

                        {transitPricingMethod === 'lump_sum' ? (
                          <div>
                            <label className="text-[10px] text-slate-400 block font-semibold mb-1">{t('transit_fixed_lumpsum_label', 'Transit Fixed Lump Sum (ETB):')}</label>
                            <input
                              type="number"
                              step="any"
                              value={transitLumpSum}
                              onChange={e => setTransitLumpSum(parseFloat(e.target.value) || 0)}
                              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-base font-bold text-emerald-400"
                              placeholder="e.g. 8500"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] text-slate-400 block font-semibold mb-1">{t('transit_rate_label', 'Transit Rate')} (ETB / {getUnitDisplay(transitUnit)}):</label>
                            <input
                              type="number"
                              step="any"
                              value={transitUnitPriceSplit}
                              onChange={e => setTransitUnitPriceSplit(parseFloat(e.target.value) || 0)}
                              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-base font-bold text-purple-300"
                              placeholder="e.g. 350"
                            />
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs text-slate-300 pt-1 border-t border-slate-700/60 font-medium">
                          <span className="text-slate-400">{t('leg1_transit_earnings', 'Leg 1 Transit Earnings:')}</span>
                          <span className="font-mono font-bold text-purple-300">{formatCurrency(computeTransitRevenue())}</span>
                        </div>
                      </div>

                      {/* Leg 2: Destination Drop Payment */}
                      <div className="p-3.5 bg-slate-800/90 border border-emerald-500/40 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            {t('leg2_dest_payment', '2. Destination Payment:')} {selectedTrip.dumping_site_name || t('dumping_site_fallback', 'Dumping Site')}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {destinationQuantity} {getUnitDisplay(destinationUnit)}
                          </span>
                        </div>

                        {/* Payment Method Selector: Unit Price vs Lump Sum */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDestinationPricingMethod(destinationUnit === 'kg' ? 'per_kg' : destinationUnit === 'quintal' ? 'per_quintal' : 'per_ton')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                              destinationPricingMethod !== 'lump_sum'
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            {t('unit_rate_label', 'Unit Rate')} (ETB / {getUnitDisplay(destinationUnit)})
                          </button>
                          <button
                            type="button"
                            onClick={() => setDestinationPricingMethod('lump_sum')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                              destinationPricingMethod === 'lump_sum'
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            {t('lump_sum_fixed_label', 'Lump Sum (Fixed ETB)')}
                          </button>
                        </div>

                        {destinationPricingMethod === 'lump_sum' ? (
                          <div>
                            <label className="text-[10px] text-slate-400 block font-semibold mb-1">{t('dest_fixed_lumpsum_label', 'Destination Fixed Lump Sum (ETB):')}</label>
                            <input
                              type="number"
                              step="any"
                              value={destinationLumpSum}
                              onChange={e => setDestinationLumpSum(parseFloat(e.target.value) || 0)}
                              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-base font-bold text-emerald-400"
                              placeholder="e.g. 12000"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] text-slate-400 block font-semibold mb-1">{t('dest_rate_label', 'Destination Rate')} (ETB / {getUnitDisplay(destinationUnit)}):</label>
                            <input
                              type="number"
                              step="any"
                              value={destinationUnitPriceSplit}
                              onChange={e => setDestinationUnitPriceSplit(parseFloat(e.target.value) || 0)}
                              className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-base font-bold text-emerald-300"
                              placeholder="e.g. 450"
                            />
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs text-slate-300 pt-1 border-t border-slate-700/60 font-medium">
                          <span className="text-slate-400">{t('leg2_dest_earnings', 'Leg 2 Destination Earnings:')}</span>
                          <span className="font-mono font-bold text-emerald-300">{formatCurrency(computeDestinationRevenue())}</span>
                        </div>
                      </div>

                      {/* Total Combined Live Revenue */}
                      <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-slate-800 to-emerald-950/40 rounded-2xl border border-slate-700 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-slate-400">{t('combined_gross_pay', 'Combined Gross Hauling Pay:')}</div>
                          <div className="text-xl font-black text-emerald-400 font-mono">
                            {formatCurrency(calculateTotalRevenue())}
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-slate-400 font-mono">
                          <div>{t('transit_summary_tag', 'Transit:')} {formatCurrency(computeTransitRevenue())}</div>
                          <div>{t('dest_summary_tag', 'Dest:')} {formatCurrency(computeDestinationRevenue())}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* STANDARD SINGLE DROP PRICING */
                    <>
                      {/* Destination vs Intermediate Point Selection if trip has transition point */}
                      {(transitPointName || selectedTrip?.has_transition || selectedTrip?.transition_point_name || selectedTrip?.intermediate_site_id) && (
                        <div className="p-3.5 bg-purple-950/30 border border-purple-500/40 rounded-2xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                              <Scale className="w-3.5 h-3.5 text-purple-400" />
                              Drop-Off Delivery Point
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {dropOffLocation === 'intermediate_transit' ? '📍 Transit Drop' : '🏁 Destination Drop'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-300">
                            Where did the truck finish unloading? Tap to apply the agreed rate:
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {/* Option A: Final Destination */}
                            <button
                              type="button"
                              onClick={() => {
                                setDropOffLocation('final_destination');
                                setPricingTarget('destination');
                                if (pricingMethod !== 'lump_sum') {
                                  setUnitPrice(destinationUnitPrice || 450);
                                } else if (destinationLumpSumSingle > 0) {
                                  setLumpSum(destinationLumpSumSingle);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                dropOffLocation === 'final_destination'
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md ring-1 ring-amber-500/50'
                                  : 'bg-slate-850 border-slate-750 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🏁 Final Destination</span>
                                {dropOffLocation === 'final_destination' && (
                                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">{t('selected_badge', 'Selected')}</span>
                                )}
                              </div>
                              <div className="font-bold text-xs truncate text-white mt-0.5">{selectedTrip.dumping_site_name || t('destination', 'Destination')}</div>
                              <div className="mt-1 flex items-baseline justify-between">
                                <span className="text-sm font-black font-mono text-amber-400">
                                  {formatCurrency(destinationUnitPrice)}
                                  <span className="text-[10px] font-normal text-slate-400"> / {unit}</span>
                                </span>
                                {destinationLumpSumSingle > 0 && (
                                  <span className="text-[10px] font-mono text-emerald-400">
                                    Lump: {formatCurrency(destinationLumpSumSingle)}
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Option B: Transit Point */}
                            <button
                              type="button"
                              onClick={() => {
                                setDropOffLocation('intermediate_transit');
                                setPricingTarget('transit');
                                if (pricingMethod !== 'lump_sum') {
                                  setUnitPrice(transitUnitPrice || (destinationUnitPrice * 0.6) || 350);
                                } else if (transitLumpSumSingle > 0) {
                                  setLumpSum(transitLumpSumSingle);
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                dropOffLocation === 'intermediate_transit'
                                  ? 'bg-purple-500/25 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-500/50'
                                  : 'bg-slate-850 border-slate-750 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📍 Intermediate Hub Drop</span>
                                {dropOffLocation === 'intermediate_transit' && (
                                  <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">{t('selected_badge', 'Selected')}</span>
                                )}
                              </div>
                              <div className="font-bold text-xs truncate text-purple-300 mt-0.5">{transitPointName || selectedTrip?.transition_point_name || 'Intermediate Hub'}</div>
                              <div className="mt-1 flex items-baseline justify-between">
                                <span className="text-sm font-black font-mono text-purple-400">
                                  {formatCurrency(transitUnitPrice || (destinationUnitPrice * 0.6) || 0)}
                                  <span className="text-[10px] font-normal text-slate-400"> / {unit}</span>
                                </span>
                                {transitLumpSumSingle > 0 && (
                                  <span className="text-[10px] font-mono text-purple-300">
                                    Lump: {formatCurrency(transitLumpSumSingle)}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-300 font-medium">
                            <span className="text-slate-400">{t('rate_difference_label', 'Rate Difference:')}</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {formatCurrency(Math.abs(destinationUnitPrice - transitUnitPrice))} / {unit}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Payment Method Selector */}
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-2">{t('trip_pricing_method', 'Payment & Pricing Method:')}</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: 'per_ton', label: t('price_per_ton_opt', 'Price per Ton') },
                            { id: 'per_quintal', label: t('price_per_quintal_opt', 'Price per Quintal') },
                            { id: 'per_kg', label: t('price_per_kg_opt', 'Price per KG') },
                            { id: 'lump_sum', label: t('lump_sum_fixed_opt', '💰 Lump Sum (Fixed)') },
                          ].map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setPricingMethod(m.id);
                                if (m.id === 'lump_sum' && (!lumpSum || lumpSum === 0)) {
                                  const autoLump = dropOffLocation === 'intermediate_transit'
                                    ? (transitLumpSumSingle || 8500)
                                    : (destinationLumpSumSingle || 12000);
                                  setLumpSum(autoLump);
                                }
                              }}
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

                      {pricingMethod === 'lump_sum' ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-emerald-400 mb-1 flex items-center justify-between">
                              <span>{t('total_lumpsum_amount_label', 'Total Lump Sum Amount (ETB):')}</span>
                              <span className="text-[10px] text-slate-400 font-normal">{t('fixed_trip_pay_sub', 'Fixed total trip pay')}</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={lumpSum}
                              onChange={e => setLumpSum(parseFloat(e.target.value) || 0)}
                              className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-2xl font-bold text-emerald-400 focus:outline-none focus:border-amber-500 shadow-inner"
                              placeholder="e.g. 15000"
                            />
                          </div>

                          {/* Quick Lump Sum preset chips */}
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                              Quick Presets:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {transitLumpSumSingle > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLumpSum(transitLumpSumSingle);
                                    setDropOffLocation('intermediate_transit');
                                    setPricingTarget('transit');
                                  }}
                                  className="py-1 px-2.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold rounded-lg cursor-pointer"
                                >
                                  📍 Transit Lump: {formatCurrency(transitLumpSumSingle)}
                                </button>
                              )}
                              {destinationLumpSumSingle > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLumpSum(destinationLumpSumSingle);
                                    setDropOffLocation('final_destination');
                                    setPricingTarget('destination');
                                  }}
                                  className="py-1 px-2.5 bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold rounded-lg cursor-pointer"
                                >
                                  🏁 Dest Lump: {formatCurrency(destinationLumpSumSingle)}
                                </button>
                              )}
                              {[5000, 8000, 10000, 15000, 20000].map(val => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setLumpSum(val)}
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
                            Unit Price (ETB / {unit}):
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={unitPrice}
                            onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)}
                            className="w-full py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl font-mono text-xl font-bold text-amber-400 focus:outline-none focus:border-amber-500 shadow-inner"
                            placeholder="e.g. 450"
                          />
                        </div>
                      )}

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
                    </>
                  )}
                </div>
              )}

              {/* STEP 4: ADDITIONAL FEES & TOLLS */}
              {step === 4 && (
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
                            placeholder={t('note_ticket_ph', 'Note / Ticket (optional)')}
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

                    {/* Drop-Off Location Badge */}
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-400">{t('cargo_dropoff_site_label', 'Cargo Drop-Off Site:')}</span>
                      {isSplitDrop ? (
                        <span className="font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">
                          🔀 Multi-Drop (Transit + Final Destination)
                        </span>
                      ) : dropOffLocation === 'intermediate_transit' || pricingTarget === 'transit' ? (
                        <span className="font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-lg border border-purple-500/30">
                          📍 Intermediate Hub ({transitPointName || selectedTrip?.transition_point_name || 'Intermediate Point'})
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                          🏁 Final Destination ({selectedTrip.dumping_site_name})
                        </span>
                      )}
                    </div>

                    {transitNotes && (
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">{t('transit_slip_notes_label', 'Transit Slip / Notes:')}</span>
                        <span className="font-mono text-purple-300 font-semibold">{transitNotes}</span>
                      </div>
                    )}

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('step_dumping', 'Destination / Site')}:</span>
                      <span className="font-bold text-emerald-400">{selectedTrip.dumping_site_name}</span>
                    </div>

                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">{t('material', 'Material')}:</span>
                      <span className="font-bold text-amber-400">{selectedTrip.material_name}</span>
                    </div>

                    {isSplitDrop ? (
                      (() => {
                        const summary = getCargoSummary();
                        return (
                          <>
                            <div className="py-2.5 space-y-1.5">
                              <div className="flex justify-between items-center font-bold text-slate-200">
                                <span>{t('total_delivered_cargo_label', 'Total Delivered Cargo:')}</span>
                                <span className="font-mono text-sm text-amber-300">
                                  {summary.primaryLabel}
                                  {summary.primaryUnit !== 'ton' && (
                                    <span className="text-xs text-slate-400 font-normal ml-1.5">
                                      ({formatNumber(summary.totalTons, 2)} t / {formatNumber(summary.totalKg)} kg)
                                    </span>
                                  )}
                                  {summary.primaryUnit === 'ton' && (
                                    <span className="text-xs text-slate-400 font-normal ml-1.5">
                                      ({formatNumber(summary.totalKg)} kg)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="p-2.5 bg-slate-900 rounded-xl space-y-1 text-[11px]">
                                <div className="flex justify-between text-purple-300">
                                  <span>📍 {t('transit_summary_tag', 'Transit:')} ({transitPointName || selectedTrip?.transition_point_name || t('transit_hub_fallback', 'Waypoint')}):</span>
                                  <span className="font-mono font-bold">
                                    {transitQuantity} {getUnitDisplay(transitUnit)} • {transitPricingMethod === 'lump_sum' ? `${t('lump_sum_type_badge', 'Lump Sum')} ${formatCurrency(transitLumpSum)}` : `${formatCurrency(transitUnitPriceSplit)}/${getUnitDisplay(transitUnit)}`} = {formatCurrency(computeTransitRevenue())}
                                  </span>
                                </div>
                                <div className="flex justify-between text-emerald-300">
                                  <span>🏁 {t('dest_summary_tag', 'Dest:')} ({selectedTrip.dumping_site_name || t('dumping_site_fallback', 'Site')}):</span>
                                  <span className="font-mono font-bold">
                                    {destinationQuantity} {getUnitDisplay(destinationUnit)} • {destinationPricingMethod === 'lump_sum' ? `${t('lump_sum_type_badge', 'Lump Sum')} ${formatCurrency(destinationLumpSum)}` : `${formatCurrency(destinationUnitPriceSplit)}/${getUnitDisplay(destinationUnit)}`} = {formatCurrency(computeDestinationRevenue())}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="py-2.5 flex justify-between items-center">
                              <span className="text-slate-400">{t('fee_gross_revenue', 'Gross Hauling Revenue:')}</span>
                              <span className="font-mono font-bold text-slate-100">
                                {formatCurrency(calculateTotalRevenue())}
                              </span>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <>
                        <div className="py-2.5 flex justify-between">
                          <span className="text-slate-400">{t('quantity', 'Quantity')}:</span>
                          <span className="font-bold text-slate-100">
                            {quantity} {getUnitDisplay(unit)} ({formatNumber(getConvertedKg())} {t('unit_kg_display', 'kg')})
                          </span>
                        </div>

                        <div className="py-2.5 flex justify-between items-center">
                          <span className="text-slate-400">{t('step_price', 'Pricing & Rate')}:</span>
                          <span className="font-bold text-slate-100">
                            {pricingMethod === 'lump_sum' ? (
                              <span className="text-emerald-400 font-mono">
                                💰 Fixed Lump-Sum: {formatCurrency(lumpSum)}
                              </span>
                            ) : (
                              <span>
                                {unitPrice} ETB / {unit}{' '}
                                <span className="text-[10px] text-slate-400">
                                  ({pricingTarget === 'transit' ? 'Transit Rate' : 'Destination Rate'})
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
                      </>
                    )}

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
                    <label className="block text-xs text-slate-400 mb-1">{t('trip_notes_label', 'Notes / Delivery Comments (Optional):')}</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={t('unloaded_notes_ph', 'e.g. Unloaded at gate 2, signed by site supervisor')}
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
                  (step === 2 && (isSplitDrop ? (transitQuantity <= 0 && destinationQuantity <= 0) : quantity <= 0))
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
