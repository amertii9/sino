import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatNumber, formatDate } from '../../utils/formatters';
import {
  Gauge,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight,
  TrendingUp,
  X
} from 'lucide-react';

export const OdometerModal = ({
  isOpen,
  onClose,
  onSuccess,
  truck,
  initialMode = null // 'start' | 'end' | null
}) => {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState(initialMode || 'start'); // 'start' or 'end'
  const [todayData, setTodayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [startReading, setStartReading] = useState('');
  const [startNotes, setStartNotes] = useState('');
  const [endReading, setEndReading] = useState('');
  const [endNotes, setEndNotes] = useState('');

  const fetchTodayData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/odometer/today');
      setTodayData(res);

      if (res?.has_start && res?.reading?.start_reading) {
        setStartReading(res.reading.start_reading.toString());
        setStartNotes(res.reading.start_notes || '');
      } else if (res?.last_reading && res.last_reading > 0) {
        // Pre-fill with last known recorded odometer reading
        setStartReading(res.last_reading.toString());
      } else {
        setStartReading('');
      }

      if (res?.has_end && res?.reading?.end_reading) {
        setEndReading(res.reading.end_reading.toString());
        setEndNotes(res.reading.end_notes || '');
      } else if (res?.last_reading_today && res.last_reading_today > 0) {
        // End of the day reading takes the last reading the driver entered for the day
        setEndReading(res.last_reading_today.toString());
      } else if (res?.last_reading && res.last_reading > 0) {
        setEndReading(res.last_reading.toString());
      } else {
        setEndReading('');
      }

      if (initialMode) {
        setActiveSection(initialMode);
      } else {
        setActiveSection('start');
      }
    } catch (err) {
      console.error('Failed to load odometer data:', err);
      setError('Failed to fetch today\'s odometer information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSuccessMsg('');
      setError('');
      fetchTodayData();
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  // Minimum starting reading calculated strictly from last recorded entry
  const minStartVal = todayData?.last_reading || 0;

  const startVal = todayData?.reading?.start_reading || todayData?.first_reading_today || parseFloat(startReading) || 0;
  const minEndVal = Math.max(
    startVal,
    todayData?.last_reading || 0
  );

  const handleSaveStart = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const val = parseFloat(startReading);
    if (isNaN(val) || val <= 0) {
      setError(t('odo_err_invalid_start', 'Please enter a valid starting odometer reading greater than 0.'));
      return;
    }

    if (minStartVal > 0 && val < minStartVal) {
      setError(t('odo_err_less_than_last', `Starting reading cannot be less than previous recorded reading (${formatNumber(minStartVal)} km). Mileage must increase as the truck travels.`));
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/odometer/start', {
        start_reading: val,
        notes: startNotes,
      });

      setSuccessMsg(t('odo_start_saved', 'Beginning of day odometer reading recorded successfully!'));
      if (onSuccess) onSuccess(res.reading);

      // Refresh today data
      await fetchTodayData();
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (err) {
      setError(err?.message || 'Failed to record starting odometer reading');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEnd = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const val = parseFloat(endReading);
    if (isNaN(val) || val <= 0) {
      setError(t('odo_err_invalid_end', 'Please enter a valid ending odometer reading greater than 0.'));
      return;
    }

    if (!startVal || startVal <= 0) {
      setError(t('odo_req_first_msg', 'You must record the beginning of day reading before entering the end of day reading.'));
      return;
    }

    if (minEndVal > 0 && val < minEndVal) {
      setError(`${t('odo_err_less_than_start', 'Ending reading cannot be less than previous or beginning reading.')} (${formatNumber(val)} km < ${formatNumber(minEndVal)} km). Mileage must increase as the truck travels.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/odometer/end', {
        end_reading: val,
        notes: endNotes,
      });

      setSuccessMsg(`${t('odo_end_saved', 'End of day reading recorded! Total distance today:')} ${formatNumber(res.distance_km)} km`);
      if (onSuccess) onSuccess(res.reading);

      await fetchTodayData();
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1800);
    } catch (err) {
      setError(err?.message || 'Failed to record ending odometer reading');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStart = startVal;
  const currentEnd = parseFloat(endReading) || 0;
  const calculatedDistance = currentEnd >= currentStart && currentStart > 0 ? currentEnd - currentStart : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">{t('odo_modal_title', 'Daily Odometer Reading')}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>{truck?.plate_number || todayData?.truck_plate || t('assigned_truck', 'Assigned Truck')}</span>
                <span>•</span>
                <span>{formatDate(todayData?.today_date || new Date())}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Section Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800/90 border border-slate-700/80 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveSection('start')}
            className={`py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeSection === 'start'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>{t('odo_sec_start', '1. Beginning of Day')}</span>
            {todayData?.has_start && (
              <CheckCircle2 className={`w-3.5 h-3.5 ${activeSection === 'start' ? 'text-slate-950' : 'text-emerald-400'}`} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('end')}
            className={`py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeSection === 'end'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>{t('odo_sec_end', '2. End of Day')}</span>
            {todayData?.has_end && (
              <CheckCircle2 className={`w-3.5 h-3.5 ${activeSection === 'end' ? 'text-slate-950' : 'text-emerald-400'}`} />
            )}
          </button>
        </div>

        {/* SECTION 1: START OF DAY (BEGINNING) */}
        {activeSection === 'start' && (
          <form onSubmit={handleSaveStart} className="space-y-4">
            <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sun className="w-4 h-4" /> {t('odo_start_km', 'Start of Day Reading (km)')}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    todayData?.has_start
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                  }`}
                >
                  {todayData?.has_start ? t('odo_recorded_badge', 'Recorded') : t('odo_req_badge', 'Required to Start Trips')}
                </span>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">
                  {t('odo_mileage_label', 'Odometer Mileage (Kilometers) *')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min={minStartVal > 0 ? minStartVal : undefined}
                    value={startReading}
                    onChange={(e) => setStartReading(e.target.value)}
                    placeholder="e.g. 125400"
                    required
                    className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-lg font-black text-white focus:outline-none transition ${
                      minStartVal > 0 && startReading && parseFloat(startReading) < minStartVal
                        ? 'border-red-500 focus:border-red-500 text-red-400'
                        : 'border-slate-700 focus:border-amber-400'
                    }`}
                  />
                  <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">
                    {t('km', 'KM')}
                  </span>
                </div>
                {minStartVal > 0 && (
                  <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{t('odo_last_reading', 'Minimum allowed reading (last recorded):')}</span>
                    <strong className="text-amber-400 font-mono">{formatNumber(minStartVal)} km</strong>
                  </div>
                )}
                {minStartVal > 0 && startReading && parseFloat(startReading) < minStartVal && (
                  <div className="mt-2 p-2 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Cannot be less than previous reading ({formatNumber(minStartVal)} km). Mileage must increase.</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">
                  {t('odo_start_notes_label', 'Beginning Notes / Yard Location (Optional)')}
                </label>
                <input
                  type="text"
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  placeholder={t('odo_start_notes_ph', 'e.g. Started from Central Depot, Quarry Gate')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              {todayData?.has_start && todayData?.reading?.start_time && (
                <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t('odo_recorded_on', 'Recorded on:')} {new Date(todayData.reading.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-2/3 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{todayData?.has_start ? t('odo_update_start', 'Update Beginning Reading') : t('odo_save_start', 'Save Beginning Reading')}</span>
              </button>
            </div>
          </form>
        )}

        {/* SECTION 2: END OF DAY (CLOSING) */}
        {activeSection === 'end' && (
          <form onSubmit={handleSaveEnd} className="space-y-4">
            {!todayData?.has_start ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  {t('odo_req_first', 'Beginning reading required first!')}
                </div>
                <p className="text-slate-400">
                  {t('odo_req_first_msg', "You must record your vehicle's starting odometer reading for today before entering the end-of-day reading.")}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection('start')}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                >
                  {t('enter_morning_reading', 'Enter Beginning Reading →')}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Moon className="w-4 h-4" /> {t('odo_end_km', 'End of Day Reading (km)')}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      todayData?.has_end
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}
                  >
                    {todayData?.has_end ? t('odo_completed_badge', 'Completed') : t('odo_pending_end_badge', 'Pending End of Shift')}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-400">{t('odo_todays_start', "Today's Start Reading:")}</span>
                  <span className="font-black text-amber-400">
                    {formatNumber(startVal)} km
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    {t('odo_ending_mileage_label', 'Ending Odometer Mileage (Kilometers) *')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min={minEndVal > 0 ? minEndVal : undefined}
                      value={endReading}
                      onChange={(e) => setEndReading(e.target.value)}
                      placeholder={`Min: ${minEndVal} km`}
                      required
                      className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-lg font-black text-white focus:outline-none transition ${
                        minEndVal > 0 && endReading && parseFloat(endReading) < minEndVal
                          ? 'border-red-500 focus:border-red-500 text-red-400'
                          : 'border-slate-700 focus:border-purple-400'
                      }`}
                    />
                    <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">
                      {t('km', 'KM')}
                    </span>
                  </div>
                  {minEndVal > 0 && endReading && parseFloat(endReading) < minEndVal && (
                    <div className="mt-2 p-2 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Cannot be less than previous / start reading ({formatNumber(minEndVal)} km). Mileage must increase.</span>
                    </div>
                  )}
                </div>

                {/* Live Distance Calculation Banner */}
                {calculatedDistance > 0 && (
                  <div className="p-3 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      {t('odo_distance_today', 'Distance Hauled Today:')}
                    </span>
                    <span className="text-base font-black text-emerald-400">
                      +{formatNumber(calculatedDistance)} km
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">
                    {t('odo_end_notes_label', 'End of Shift Notes (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={endNotes}
                    onChange={(e) => setEndNotes(e.target.value)}
                    placeholder={t('odo_end_notes_ph', 'e.g. Parked at Quarry B lot, fuel tank half full')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 transition"
                  />
                </div>

                {todayData?.has_end && todayData?.reading?.end_time && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('odo_recorded_on', 'Recorded on:')} {new Date(todayData.reading.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
              </div>
            )}

            {todayData?.has_start && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{todayData?.has_end ? t('odo_update_end', 'Update End Reading') : t('odo_save_end', 'Save End of Day Reading')}</span>
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
