import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import {
  X,
  Fuel,
  CheckCircle,
  AlertCircle,
  Gauge,
  Calculator,
  Building2,
  Sparkles,
  Info
} from 'lucide-react';

export const FuelRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const { user, driver, truck } = useAuth();
  const { t } = useLanguage();

  // First choice: gas_station vs reserve_fuel
  const [fuelSource, setFuelSource] = useState('gas_station'); // 'gas_station' | 'reserve_fuel'

  // Truck selection fallback if no truck assigned to driver
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [selectedTruckPlate, setSelectedTruckPlate] = useState('');
  const [trucksList, setTrucksList] = useState([]);

  // Form fields
  const [odometerReading, setOdometerReading] = useState('');
  const [liters, setLiters] = useState(100);
  const [pricePerLiter, setPricePerLiter] = useState(100);
  const [reserveDepot, setReserveDepot] = useState('Main Yard Depot (Kality)');
  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successReq, setSuccessReq] = useState(null);

  // Quick select chips (customizable by Admin)
  const [quickLiters, setQuickLiters] = useState([50, 80, 100, 150, 200, 300]);
  const depotPresets = ['Main Base Depot (Kality)', 'Site Yard A Depot', 'Quarry Yard Depot', 'Central Workshop'];
  const [prevOdo, setPrevOdo] = useState(0);

  // Active truck resolution
  const activeTruckId = truck?.id || driver?.assigned_truck_id || selectedTruckId;
  const activeTruckPlate = truck?.plate_number || driver?.assigned_truck_plate || selectedTruckPlate;

  // Fetch benchmark diesel price, trucks and set initial odometer when modal opens
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessReq(null);
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

      // Load trucks for fallback if not assigned
      api.get('/trucks')
        .then(res => {
          if (Array.isArray(res)) {
            setTrucksList(res);
            if (!truck?.id && !driver?.assigned_truck_id && res.length > 0) {
              setSelectedTruckId(res[0].id);
              setSelectedTruckPlate(res[0].plate_number);
            }
          }
        })
        .catch(console.error);

      // Fetch global diesel price benchmark and quick-select presets from settings
      api.get('/settings')
        .then(res => {
          if (res?.diesel_price && res.diesel_price > 0) {
            setPricePerLiter(res.diesel_price);
          }
          if (res?.fuel_liters_presets && Array.isArray(res.fuel_liters_presets) && res.fuel_liters_presets.length > 0) {
            setQuickLiters(res.fuel_liters_presets);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Real-time automatic calculation
  const parsedLiters = parseFloat(liters) || 0;
  const parsedPrice = parseFloat(pricePerLiter) || 0;
  const calculatedTotalPrice = parsedLiters * parsedPrice;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const odoVal = parseFloat(odometerReading);
    if (!odometerReading || isNaN(odoVal) || odoVal < 0) {
      setError(t('fuel_err_odometer', 'Please enter a valid odometer reading (km)'));
      return;
    }

    if (prevOdo > 0 && odoVal < prevOdo) {
      setError(t('fuel_err_odo_too_low', `Odometer reading (${formatNumber(odoVal)} km) cannot be less than previous recorded reading (${formatNumber(prevOdo)} km). Truck mileage must increase as the vehicle travels.`));
      return;
    }

    if (!parsedLiters || parsedLiters <= 0) {
      setError(t('fuel_err_liters', 'Please enter a valid fuel quantity in liters'));
      return;
    }

    if (fuelSource === 'gas_station' && (!parsedPrice || parsedPrice <= 0)) {
      setError(t('fuel_err_price', 'Please enter a valid price per liter'));
      return;
    }

    setLoading(true);

    try {
      const generatedReason = reason.trim() || (
        fuelSource === 'gas_station'
          ? `Commercial gas station diesel refueling (${parsedLiters} L @ ${parsedPrice} ETB/L)`
          : `Company yard reserve fuel dispense (${parsedLiters} L)`
      );

      const payload = {
        truck_id: activeTruckId || '',
        truck_plate: activeTruckPlate || '',
        driver_id: driver?.id || user?.id || '',
        driver_name: driver?.full_name || user?.full_name || '',
        fuel_source: fuelSource,
        odometer_reading: odoVal,
        liters: parsedLiters,
        price_per_liter: parsedPrice,
        amount_requested: calculatedTotalPrice,
        fuel_station: fuelSource === 'gas_station' ? 'Commercial Gas Station' : reserveDepot,
        reason: generatedReason,
        notes: '',
      };

      const res = await api.post('/fuel-requests', payload);
      setSuccessReq(res);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setError(err.message || 'Failed to submit fuel request');
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
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-inner">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {t('fuel_modal_title', 'Request Fuel Money')}
              </h3>
              <p className="text-xs text-slate-400">
                {activeTruckPlate ? `Truck: ${activeTruckPlate}` : t('fuel_modal_sub', 'Instant Fuel Advance Form')}
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

        {/* Body */}
        <div className="p-5 max-h-[80vh] overflow-y-auto">
          {successReq ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {t('fuel_success_title', 'Fuel Request Submitted!')}
              </h3>
              <div className="bg-slate-800 p-4 rounded-2xl text-left space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('fuel_req_number', 'Request Number:')}</span>
                  <span className="font-mono font-bold text-amber-400">{successReq.request_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fuel Source:</span>
                  <span className="font-bold text-white">
                    {successReq.fuel_source === 'reserve_fuel' ? '🛢️ Reserve Fuel (Yard Depot)' : '⛽ Commercial Gas Station'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Quantity / Odometer:</span>
                  <span className="font-bold text-white">
                    {successReq.liters || parsedLiters} Liters • {successReq.odometer_reading || odometerReading} km
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-700/80 pt-1.5">
                  <span className="text-slate-400">Total Price:</span>
                  <span className="font-bold text-emerald-400 text-sm font-mono">
                    {formatCurrency(successReq.amount_requested || calculatedTotalPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('status', 'Status')}:</span>
                  <span className="font-bold uppercase text-amber-400">
                    {t('fuel_pending_approval', 'Pending Admin Approval')}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition cursor-pointer"
              >
                {t('close', 'Close')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Truck Selector if driver has no pre-assigned truck */}
              {(!truck?.plate_number && !driver?.assigned_truck_plate) && trucksList.length > 0 && (
                <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    {t('select_truck', 'Assigned Vehicle / Plate Number *')}
                  </label>
                  <select
                    value={selectedTruckId}
                    onChange={(e) => {
                      const trk = trucksList.find(t => t.id === e.target.value);
                      setSelectedTruckId(e.target.value);
                      setSelectedTruckPlate(trk ? trk.plate_number : '');
                    }}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Select Truck --</option>
                    {trucksList.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.plate_number} {t.truck_number ? `(${t.truck_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 1. FIRST CHOICE: GAS STATION VS RESERVE FUEL */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2">
                  {t('fuel_source_title', 'Choose Fuel Source:')}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Gas Station Option */}
                  <button
                    type="button"
                    onClick={() => setFuelSource('gas_station')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      fuelSource === 'gas_station'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500/50'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl">⛽</span>
                      <div>
                        <div className="text-xs font-black text-white">
                          {t('fuel_source_gas', 'Gas Station')}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                          Commercial Station
                        </div>
                      </div>
                    </div>
                    {fuelSource === 'gas_station' && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </button>

                  {/* Reserve Fuel Option */}
                  <button
                    type="button"
                    onClick={() => setFuelSource('reserve_fuel')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      fuelSource === 'reserve_fuel'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10 ring-1 ring-amber-500/50'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl">🛢️</span>
                      <div>
                        <div className="text-xs font-black text-white">
                          {t('fuel_source_reserve', 'Reserve Fuel')}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                          Company Yard Tank
                        </div>
                      </div>
                    </div>
                    {fuelSource === 'reserve_fuel' && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>

              {/* SECTION: GAS STATION FIELDS */}
              {fuelSource === 'gas_station' && (
                <div className="space-y-4 pt-1">
                  {/* A. ODOMETER READING */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        {t('fuel_odometer_label', 'Truck Odometer Reading (km) *')}
                      </label>
                      {prevOdo > 0 && (
                        <button
                          type="button"
                          onClick={() => setOdometerReading(String(prevOdo))}
                          className="text-[10px] text-amber-400 hover:underline font-mono"
                        >
                          Use Last: {formatNumber(prevOdo)} km
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min={prevOdo > 0 ? prevOdo : undefined}
                        value={odometerReading}
                        onChange={(e) => setOdometerReading(e.target.value)}
                        placeholder="e.g. 45200"
                        className={`w-full py-2.5 px-3 bg-slate-800 border rounded-xl font-mono font-bold text-sm focus:outline-none transition-colors ${
                          prevOdo > 0 && odometerReading && parseFloat(odometerReading) < prevOdo
                            ? 'border-red-500 text-red-400 focus:border-red-500'
                            : 'border-slate-700 text-white focus:border-amber-500'
                        }`}
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">KM</span>
                    </div>
                    {prevOdo > 0 && (
                      <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>{t('odo_min_required', 'Minimum allowed reading (last recorded):')}</span>
                        <span className="font-mono font-bold text-amber-400">{formatNumber(prevOdo)} km</span>
                      </div>
                    )}
                    {prevOdo > 0 && odometerReading && parseFloat(odometerReading) < prevOdo && (
                      <div className="mt-1.5 p-2 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>Cannot be less than previous reading ({formatNumber(prevOdo)} km).</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOdometerReading(String(prevOdo))}
                          className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-lg border border-amber-500/40 text-[11px] whitespace-nowrap cursor-pointer"
                        >
                          Use {formatNumber(prevOdo)} km
                        </button>
                      </div>
                    )}
                  </div>

                  {/* B. FUEL QUANTITY (LITERS) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('fuel_liters_label', 'Fuel Quantity (Liters) *')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={liters}
                        onChange={(e) => setLiters(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:border-amber-500"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">Liters</span>
                    </div>

                    {/* Quick Liter Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {quickLiters.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setLiters(val)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                            parseFloat(liters) === val
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {val} L
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* C. PRICE PER LITER */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('fuel_price_per_liter_label', 'Price per Liter (ETB / L) *')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={pricePerLiter}
                        onChange={(e) => setPricePerLiter(e.target.value)}
                        placeholder="100.00"
                        className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-amber-400 font-mono font-bold text-base focus:outline-none focus:border-amber-500"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">ETB / L</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Standard diesel benchmark benchmark set by admin
                    </span>
                  </div>

                  {/* D. AUTOMATICALLY CALCULATE TOTAL PRICE (Requirement) */}
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1 shadow-inner">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5" />
                        {t('fuel_calculated_total', 'Automatically Calculated Total Price:')}
                      </span>
                      <span className="font-mono text-slate-300 font-semibold normal-case">
                        {parsedLiters} L × {parsedPrice} ETB
                      </span>
                    </div>

                    <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight pt-0.5">
                      {formatCurrency(calculatedTotalPrice)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      This total amount will be submitted to dispatch for approval & payout
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: RESERVE FUEL FIELDS */}
              {fuelSource === 'reserve_fuel' && (
                <div className="space-y-4 pt-1">
                  {/* A. ODOMETER READING */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        {t('fuel_odometer_label', 'Truck Odometer Reading (km) *')}
                      </label>
                      {prevOdo > 0 && (
                        <button
                          type="button"
                          onClick={() => setOdometerReading(String(prevOdo))}
                          className="text-[10px] text-amber-400 hover:underline font-mono"
                        >
                          Use Last: {formatNumber(prevOdo)} km
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min={prevOdo > 0 ? prevOdo : undefined}
                        value={odometerReading}
                        onChange={(e) => setOdometerReading(e.target.value)}
                        placeholder="e.g. 45200"
                        className={`w-full py-2.5 px-3 bg-slate-800 border rounded-xl font-mono font-bold text-sm focus:outline-none transition-colors ${
                          prevOdo > 0 && odometerReading && parseFloat(odometerReading) < prevOdo
                            ? 'border-red-500 text-red-400 focus:border-red-500'
                            : 'border-slate-700 text-white focus:border-amber-500'
                        }`}
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">KM</span>
                    </div>
                    {prevOdo > 0 && (
                      <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>{t('odo_min_required', 'Minimum allowed reading (last recorded):')}</span>
                        <span className="font-mono font-bold text-amber-400">{formatNumber(prevOdo)} km</span>
                      </div>
                    )}
                    {prevOdo > 0 && odometerReading && parseFloat(odometerReading) < prevOdo && (
                      <div className="mt-1.5 p-2 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>Cannot be less than previous reading ({formatNumber(prevOdo)} km).</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOdometerReading(String(prevOdo))}
                          className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-lg border border-amber-500/40 text-[11px] whitespace-nowrap cursor-pointer"
                        >
                          Use {formatNumber(prevOdo)} km
                        </button>
                      </div>
                    )}
                  </div>

                  {/* B. RESERVE LITERS */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t('fuel_liters_label', 'Reserve Fuel Quantity (Liters) *')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={liters}
                        onChange={(e) => setLiters(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:border-amber-500"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">Liters</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {quickLiters.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setLiters(val)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                            parseFloat(liters) === val
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {val} L
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* C. RESERVE DEPOT / YARD LOCATION */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      {t('fuel_reserve_depot_label', 'Reserve Yard Tank / Depot Location')}
                    </label>
                    <input
                      type="text"
                      value={reserveDepot}
                      onChange={(e) => setReserveDepot(e.target.value)}
                      className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100"
                      placeholder="e.g. Main Base Depot (Kality)"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {depotPresets.map((dp) => (
                        <button
                          key={dp}
                          type="button"
                          onClick={() => setReserveDepot(dp)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                            reserveDepot === dp
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          {dp}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* D. RESERVE DISPENSE VALUE INFO BOX */}
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl space-y-1">
                    <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Reserve Yard Fuel Dispense</span>
                    </div>
                    <div className="text-xl font-black text-blue-300 font-mono">
                      {parsedLiters} Liters Requested
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Internal inventory dispense • Valuation: {formatCurrency(calculatedTotalPrice)} (@ {parsedPrice} ETB/L)
                    </div>
                  </div>
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading || (prevOdo > 0 && odometerReading && parseFloat(odometerReading) < prevOdo)}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold rounded-2xl shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <Fuel className="w-4 h-4" />
                <span>
                  {loading
                    ? t('fuel_submitting', 'Submitting...')
                    : fuelSource === 'gas_station'
                    ? `${t('fuel_submit_btn', 'Submit Fuel Request')} (${formatCurrency(calculatedTotalPrice)})`
                    : `Submit Reserve Request (${parsedLiters} Liters)`}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default FuelRequestModal;
