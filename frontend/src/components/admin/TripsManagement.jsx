import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency, formatNumber, formatDate, formatDateTime, exportToCSV } from '../../utils/formatters';
import {
  ClipboardList,
  Search,
  Download,
  AlertTriangle,
  Ban,
  Filter,
  CheckCircle,
  Eye,
  RefreshCw,
  Edit,
  Trash2,
  MapPin
} from 'lucide-react';

export const TripsManagement = () => {
  const { t } = useLanguage();
  const [trips, setTrips] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loadingSites, setLoadingSites] = useState([]);
  const [dumpingSites, setDumpingSites] = useState([]);
  const [transitionSites, setTransitionSites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDropOff, setSelectedDropOff] = useState('');
  const [selectedPricingMethod, setSelectedPricingMethod] = useState('');

  // Modals
  const [cancelModal, setCancelModal] = useState({ open: false, trip: null, reason: '' });
  const [selectedTripDetail, setSelectedTripDetail] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);
  const [editFormData, setEditFormData] = useState({
    quantity: 0,
    unit: 'quintal',
    pricing_method: 'per_quintal',
    unit_price: 0,
    lump_sum: 0,
    pricing_target: 'destination',
    drop_off_location: 'final_destination',
    transit_notes: '',
    loading_site_id: '',
    loading_site_name: '',
    dumping_site_id: '',
    dumping_site_name: '',
    transition_point_ids: [],
    transition_point_name: '',
    material_id: '',
    material_name: '',
    status: 'completed',
    notes: '',
  });

  const fetchTripsData = async () => {
    try {
      const [tripsData, trucksData, driversData, matsData, loadData, dumpData, transData] = await Promise.all([
        api.get('/trips'),
        api.get('/trucks'),
        api.get('/drivers'),
        api.get('/materials'),
        api.get('/sites?type=loading'),
        api.get('/sites?type=dumping'),
        api.get('/sites?type=transition').catch(() => []),
      ]);
      setTrips(tripsData || []);
      setTrucks(trucksData || []);
      setDrivers(driversData || []);
      setMaterials(matsData || []);
      setLoadingSites(loadData || []);
      setDumpingSites(dumpData || []);
      setTransitionSites(transData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripsData();
  }, []);

  const openEditModal = (trip) => {
    setEditingTrip(trip);
    setEditFormData({
      quantity: trip.quantity || 0,
      unit: trip.unit || 'quintal',
      pricing_method: trip.pricing_method || 'per_quintal',
      unit_price: trip.unit_price || 0,
      lump_sum: trip.lump_sum || 0,
      pricing_target: trip.pricing_target || (trip.drop_off_location === 'intermediate_transit' ? 'transit' : 'destination'),
      drop_off_location: trip.drop_off_location || (trip.pricing_target === 'transit' ? 'intermediate_transit' : 'final_destination'),
      transit_notes: trip.transit_notes || trip.transit_receipt_number || '',
      loading_site_id: trip.loading_site_id || '',
      loading_site_name: trip.loading_site_name || '',
      dumping_site_id: trip.dumping_site_id || '',
      dumping_site_name: trip.dumping_site_name || '',
      transition_point_ids: trip.transition_point_ids || [],
      transition_point_name: trip.transition_point_name || '',
      material_id: trip.material_id || '',
      material_name: trip.material_name || '',
      status: trip.status || 'completed',
      notes: trip.notes || '',
    });
  };

  const handleSaveTripEdit = async (e) => {
    e.preventDefault();
    try {
      const loadSite = loadingSites.find(s => s.id === editFormData.loading_site_id);
      const dumpSite = dumpingSites.find(s => s.id === editFormData.dumping_site_id);
      const transSite = transitionSites.find(s => s.id === (editFormData.transition_point_ids?.[0] || ''));
      const mat = materials.find(m => m.id === editFormData.material_id);

      const payload = {
        ...editingTrip,
        ...editFormData,
        quantity: parseFloat(editFormData.quantity) || 0,
        unit_price: parseFloat(editFormData.unit_price) || 0,
        lump_sum: parseFloat(editFormData.lump_sum) || 0,
        is_split_drop: editFormData.drop_off_location === 'split',
        loading_site_name: loadSite ? loadSite.name : editFormData.loading_site_name,
        dumping_site_name: dumpSite ? dumpSite.name : editFormData.dumping_site_name,
        transition_point_name: transSite ? transSite.name : editFormData.transition_point_name,
        material_name: mat ? mat.name : editFormData.material_name,
      };

      await api.put(`/trips/${editingTrip.id}`, payload);
      setEditingTrip(null);
      fetchTripsData();
    } catch (err) {
      alert('Failed to update trip: ' + err.message);
    }
  };

  const handleDeleteTrip = async (trip) => {
    if (!confirm(t('confirm_delete_trip_msg', 'Are you sure you want to permanently delete this trip? This cannot be undone.'))) {
      return;
    }
    try {
      await api.delete(`/trips/${trip.id}`);
      fetchTripsData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancelTrip = async () => {
    if (!cancelModal.reason.trim()) {
      alert(t('cancellation_reason_required', 'Please enter a cancellation reason'));
      return;
    }

    try {
      await api.patch(`/trips/${cancelModal.trip.id}/cancel`, {
        reason: cancelModal.reason,
      });

      setCancelModal({ open: false, trip: null, reason: '' });
      fetchTripsData();
    } catch (err) {
      alert('Failed to cancel trip: ' + err.message);
    }
  };

  const handleExport = () => {
    const headers = [
      { key: 'trip_number', label: 'Trip #' },
      { key: 'date', label: 'Date', format: val => formatDate(val) },
      { key: 'truck_plate', label: 'Truck Plate' },
      { key: 'driver_name', label: 'Driver' },
      { key: 'loading_site_name', label: 'Loading Site' },
      { key: 'dumping_site_name', label: 'Final Dumping Site' },
      { key: 'transition_point_name', label: t('intermediate_transit_point', 'Intermediate Transit Point') },
      { key: 'drop_off_location', label: 'Drop-Off Destination', format: (val, t) => {
        if (t.is_split_drop || val === 'split') return 'Split Offload (Multi-Drop)';
        if (val === 'intermediate_transit' || t.pricing_target === 'transit') return t('intermediate_transit_point', 'Intermediate Transit Point');
        return 'Final Destination';
      }},
      { key: 'pricing_method', label: 'Payment Method', format: val => val === 'lump_sum' ? 'Fixed Lump-Sum' : 'Per Unit Rate' },
      { key: 'pricing_target', label: 'Applied Rate Level', format: val => val === 'transit' ? 'Intermediate Transit Rate' : 'Final Destination Rate' },
      { key: 'material_name', label: 'Material' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unit', label: 'Unit' },
      { key: 'unit_price', label: 'Unit Rate (ETB)' },
      { key: 'lump_sum', label: 'Lump Sum Amount (ETB)' },
      { key: 'total_revenue', label: 'Gross Revenue (ETB)', format: (val, t) => {
        if (t.is_split_drop) {
          const tVal = t.transit_pricing_method === 'lump_sum' ? (t.transit_lump_sum || t.transit_revenue || 0) : (parseFloat(t.transit_quantity) || 0) * (parseFloat(t.transit_unit_price || t.transit_unit_price_split) || 0);
          const dVal = t.destination_pricing_method === 'lump_sum' ? (t.destination_lump_sum || t.destination_revenue || 0) : (parseFloat(t.destination_quantity) || 0) * (parseFloat(t.destination_unit_price || t.destination_unit_price_split) || 0);
          return tVal + dVal;
        }
        return (t.gross_revenue > 0 ? t.gross_revenue : val);
      }},
      { key: 'total_additional_fees', label: 'Additional Fees (ETB)' },
      { key: 'net_revenue', label: 'Net Revenue (ETB)', format: (val, t) => {
        if (t.is_split_drop) {
          const tVal = t.transit_pricing_method === 'lump_sum' ? (t.transit_lump_sum || t.transit_revenue || 0) : (parseFloat(t.transit_quantity) || 0) * (parseFloat(t.transit_unit_price || t.transit_unit_price_split) || 0);
          const dVal = t.destination_pricing_method === 'lump_sum' ? (t.destination_lump_sum || t.destination_revenue || 0) : (parseFloat(t.destination_quantity) || 0) * (parseFloat(t.destination_unit_price || t.destination_unit_price_split) || 0);
          return (tVal + dVal) - (t.total_additional_fees || 0);
        }
        return val || t.total_revenue;
      }},
      { key: 'transit_notes', label: 'Transit Waybill / Notes' },
      { key: 'status', label: 'Status' },
      { key: 'cancel_reason', label: 'Cancel Reason' },
    ];
    exportToCSV(`hauling_trips_export_${new Date().toISOString().slice(0, 10)}`, filteredTrips, headers);
  };

  const filteredTrips = trips.filter(t => {
    const searchMatch =
      !searchTerm ||
      t.trip_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.truck_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.material_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.loading_site_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.dumping_site_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transition_point_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transit_notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const truckMatch = !selectedTruck || t.truck_id === selectedTruck;
    const driverMatch = !selectedDriver || t.driver_id === selectedDriver;
    const matMatch = !selectedMaterial || t.material_id === selectedMaterial;
    const statusMatch = !selectedStatus || t.status === selectedStatus;

    const dropOffMatch = !selectedDropOff || (
      selectedDropOff === 'intermediate_transit'
        ? (t.drop_off_location === 'intermediate_transit' || t.pricing_target === 'transit')
        : selectedDropOff === 'final_destination'
        ? (t.drop_off_location === 'final_destination' || (!t.drop_off_location && t.pricing_target !== 'transit' && !t.is_split_drop))
        : selectedDropOff === 'split'
        ? (t.is_split_drop || t.drop_off_location === 'split')
        : true
    );

    const methodMatch = !selectedPricingMethod || (
      selectedPricingMethod === 'lump_sum'
        ? (t.pricing_method === 'lump_sum' || t.transit_pricing_method === 'lump_sum' || t.destination_pricing_method === 'lump_sum')
        : (t.pricing_method !== 'lump_sum')
    );

    return searchMatch && truckMatch && driverMatch && matMatch && statusMatch && dropOffMatch && methodMatch;
  });

  const totalFilteredRevenue = filteredTrips
    .filter(t => t.status !== 'cancelled')
    .reduce((acc, t) => {
      if (t.is_split_drop) {
        const tVal = t.transit_pricing_method === 'lump_sum'
          ? (t.transit_lump_sum || t.transit_revenue || 0)
          : (parseFloat(t.transit_quantity) || 0) * (parseFloat(t.transit_unit_price || t.transit_unit_price_split) || 0);
        const dVal = t.destination_pricing_method === 'lump_sum'
          ? (t.destination_lump_sum || t.destination_revenue || 0)
          : (parseFloat(t.destination_quantity) || 0) * (parseFloat(t.destination_unit_price || t.destination_unit_price_split) || 0);
        const splitNet = (tVal + dVal) - (t.total_additional_fees || 0);
        return acc + splitNet;
      }
      return acc + (t.total_revenue || 0);
    }, 0);

  const totalFilteredTons = filteredTrips
    .filter(t => t.status !== 'cancelled')
    .reduce((acc, t) => acc + ((t.quantity_kg || 0) / 1000), 0);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-amber-400" /> {t('trips_title', 'Hauling Trips Operations')}
          </h2>
          <p className="text-xs text-slate-400">{t('trips_sub', 'Complete audit log of all hauling trips recorded across the fleet')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTripsData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
            title={t('refresh', 'Refresh')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/20 touch-btn cursor-pointer"
          >
            <Download className="w-4 h-4" /> {t('export_csv', 'Export CSV / Excel')}
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] text-slate-400">{t('total_trips', 'Total Trips')}</div>
          <div className="text-xl font-black text-white mt-1">{filteredTrips.length}</div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] text-slate-400">{t('active_tons', 'Active Hauled Tons')}</div>
          <div className="text-xl font-black text-amber-400 mt-1">{formatNumber(totalFilteredTons)} {t('tons', 'tons')}</div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] text-slate-400">{t('active_revenue', 'Active Revenue')}</div>
          <div className="text-xl font-black text-emerald-400 mt-1">{formatCurrency(totalFilteredRevenue)}</div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-[11px] text-slate-400">{t('cancelled_voided', 'Cancelled / Voided')}</div>
          <div className="text-xl font-black text-red-400 mt-1">
            {filteredTrips.filter(t => t.status === 'cancelled').length}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('search_trips_placeholder', 'Search trip #, driver, truck, sites, material, slip...')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Truck filter */}
          <select
            value={selectedTruck}
            onChange={e => setSelectedTruck(e.target.value)}
            className="py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
          >
            <option value="">{t('filter_truck', 'All Trucks')}</option>
            {trucks.map(t => (
              <option key={t.id} value={t.id}>{t.plate_number} ({t.model})</option>
            ))}
          </select>

          {/* Driver filter */}
          <select
            value={selectedDriver}
            onChange={e => setSelectedDriver(e.target.value)}
            className="py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
          >
            <option value="">{t('filter_driver', 'All Drivers')}</option>
            {drivers.map(d => (
              <option key={d.id} value={d.user_id}>{d.full_name}</option>
            ))}
          </select>

          {/* Drop-Off Target filter */}
          <select
            value={selectedDropOff}
            onChange={e => setSelectedDropOff(e.target.value)}
            className="py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium"
          >
            <option value="">🎯 All Drop-Off Sites</option>
            <option value="final_destination">🏁 Final Destination Only</option>
            <option value="intermediate_transit">📍 Intermediate Transit Hub Only</option>
            <option value="split">🔀 Split Offload (Multi-Drop)</option>
          </select>

          {/* Payment Method filter */}
          <select
            value={selectedPricingMethod}
            onChange={e => setSelectedPricingMethod(e.target.value)}
            className="py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 font-medium"
          >
            <option value="">💳 All Payment Methods</option>
            <option value="lump_sum">💰 Lump-Sum Only (Fixed)</option>
            <option value="per_unit">⚖️ Per-Unit Rate Only</option>
          </select>

          {/* Material filter */}
          <select
            value={selectedMaterial}
            onChange={e => setSelectedMaterial(e.target.value)}
            className="py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
          >
            <option value="">{t('all_materials_opt', 'All Materials')}</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
          >
            <option value="">{t('all_statuses_opt', 'All Statuses')}</option>
            <option value="completed">{t('completed_tab', 'Completed')}</option>
            <option value="cancelled">{t('cancelled', 'Cancelled')}</option>
          </select>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/90 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">{t('trip_number', 'Trip #')}</th>
                <th className="py-3 px-3">{t('date', 'Date')}</th>
                <th className="py-3 px-3">{t('col_truck_driver', 'Truck / Driver')}</th>
                <th className="py-3 px-3">{t('loading_to_dropoff_header', 'Loading → Drop-Off Site')}</th>
                <th className="py-3 px-3">{t('material_col', 'Material')}</th>
                <th className="py-3 px-3">{t('quantity_col', 'Quantity')}</th>
                <th className="py-3 px-3">{t('pricing_method_header', 'Pricing & Method')}</th>
                <th className="py-3 px-3">{t('total_revenue', 'Total Revenue')}</th>
                <th className="py-3 px-3">{t('status', 'Status')}</th>
                <th className="py-3 px-3 text-right">{t('actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    No trips match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTrips.map(trip => (
                  <tr
                    key={trip.id}
                    className={`hover:bg-slate-800/50 transition ${
                      trip.status === 'cancelled' ? 'bg-red-950/10 opacity-70' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">{trip.trip_number}</td>
                    <td className="py-3 px-3 text-slate-400">{formatDate(trip.date)}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-200">{trip.truck_plate}</div>
                      <div className="text-[11px] text-slate-400">{trip.driver_name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-200 font-semibold">{trip.loading_site_name}</div>

                      {/* Cargo Drop-off Point Distinction */}
                      {trip.is_split_drop || trip.drop_off_location === 'split' ? (
                        <div className="mt-1 space-y-0.5">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold inline-flex items-center gap-1">
                            🔀 Split Offload
                          </span>
                          <div className="text-[10px] text-purple-300">📍 Hub: {trip.transition_point_name}</div>
                          <div className="text-[10px] text-emerald-300">🏁 Site: {trip.dumping_site_name}</div>
                        </div>
                      ) : trip.drop_off_location === 'intermediate_transit' || trip.pricing_target === 'transit' ? (
                        <div className="mt-1 space-y-0.5">
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                            Dropped at Transit Hub: {trip.transition_point_name || trip.intermediate_site_name || 'Intermediate Point'}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            Ended at transit point (Dest: {trip.dumping_site_name})
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          {(trip.has_transition || trip.transition_point_name || trip.intermediate_site_name) && (
                            <div className="text-[10px] text-purple-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                              <span>via {trip.transition_point_name || trip.intermediate_site_name}</span>
                            </div>
                          )}
                          <div className="text-[11px] text-emerald-400 font-semibold">
                            → Delivered to: {trip.dumping_site_name}
                          </div>
                        </div>
                      )}

                      {/* Transit Waybill / Slip Notes */}
                      {trip.transit_notes && (
                        <div className="text-[10px] text-purple-300 font-mono mt-0.5 truncate max-w-[220px]" title={trip.transit_notes}>
                          📝 Slip: {trip.transit_notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{trip.material_name}</td>
                    <td className="py-3 px-3">
                      {trip.is_split_drop ? (
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-100">
                            {trip.quantity} {trip.unit || 't'}
                            {trip.quantity_kg > 0 && trip.unit !== 'ton' && (
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({formatNumber(trip.quantity_kg / 1000, 2)} t)
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-purple-300 font-mono">
                            📍 {trip.transit_quantity} {trip.transit_unit || 't'}
                          </div>
                          <div className="text-[10px] text-cyan-300 font-mono">
                            🏁 {trip.destination_quantity} {trip.destination_unit || 't'}
                          </div>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-100">
                          {trip.quantity} {trip.unit}
                          {trip.quantity_kg > 0 && trip.unit !== 'ton' && (
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              ({formatNumber(trip.quantity_kg / 1000, 2)} t)
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {trip.is_split_drop ? (
                        <div className="text-[10px] space-y-0.5 font-mono">
                          <div className="text-purple-300">
                            📍 {trip.transit_pricing_method === 'lump_sum' ? `Lump ${formatCurrency(trip.transit_lump_sum)}` : `${formatCurrency(trip.transit_unit_price)}/${trip.transit_unit || 't'}`}
                          </div>
                          <div className="text-cyan-300">
                            🏁 {trip.destination_pricing_method === 'lump_sum' ? `Lump ${formatCurrency(trip.destination_lump_sum)}` : `${formatCurrency(trip.destination_unit_price)}/${trip.destination_unit || 't'}`}
                          </div>
                        </div>
                      ) : trip.pricing_method === 'lump_sum' ? (
                        <div>
                          <div className="font-bold text-emerald-400 font-mono text-xs">
                            💰 Lump-Sum: {formatCurrency(trip.lump_sum || trip.total_revenue)}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Fixed Total ({trip.drop_off_location === 'intermediate_transit' || trip.pricing_target === 'transit' ? 'Transit Drop' : 'Final Delivery'})
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-200 font-mono">
                            {formatCurrency(trip.unit_price)} / {trip.unit}
                          </div>
                          <div className="text-[9px]">
                            {trip.pricing_target === 'transit' || trip.drop_off_location === 'intermediate_transit' ? (
                              <span className="text-purple-300 font-semibold">📍 Intermediate Rate</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold">🏁 Destination Rate</span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {(() => {
                        const tVal = trip.transit_pricing_method === 'lump_sum'
                          ? (trip.transit_lump_sum || trip.transit_revenue || 0)
                          : (parseFloat(trip.transit_quantity) || 0) * (parseFloat(trip.transit_unit_price || trip.transit_unit_price_split) || 0);
                        const dVal = trip.destination_pricing_method === 'lump_sum'
                          ? (trip.destination_lump_sum || trip.destination_revenue || 0)
                          : (parseFloat(trip.destination_quantity) || 0) * (parseFloat(trip.destination_unit_price || trip.destination_unit_price_split) || 0);
                        const calculatedNet = trip.is_split_drop
                          ? ((tVal + dVal) - (trip.total_additional_fees || 0))
                          : trip.total_revenue;
                        const displayTotal = trip.is_split_drop
                          ? calculatedNet
                          : trip.total_revenue;

                        return (
                          <>
                            <div className="font-black text-emerald-400 text-sm">
                              {formatCurrency(displayTotal)}
                            </div>
                            {trip.is_split_drop && (
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                <div className="text-purple-300">T: {formatCurrency(tVal)}</div>
                                <div className="text-cyan-300">D: {formatCurrency(dVal)}</div>
                              </div>
                            )}
                            {trip.total_additional_fees > 0 && (
                              <div className="text-[10px] text-amber-400 font-mono">
                                fees: -{formatCurrency(trip.total_additional_fees)}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          trip.status === 'cancelled'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {trip.status}
                        </span>
                        {trip.status === 'completed' && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            trip.payment_status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                          }`}>
                            {trip.payment_status === 'paid' ? '✓ Paid' : '⏳ Pending Pay'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedTripDetail(trip)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg inline-block"
                        title={t('view_details', 'View Details')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => openEditModal(trip)}
                        className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-slate-700 inline-block"
                        title={t('view_edit', 'Edit / Correct Trip')}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {trip.status !== 'cancelled' && (
                        <button
                          onClick={() => setCancelModal({ open: true, trip, reason: '' })}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 inline-block"
                          title={t('void_cancel_trip', 'Void / Cancel Trip')}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteTrip(trip)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 inline-block"
                        title={t('delete_permanently_btn', 'Delete Trip Permanently')}
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

      {/* CANCEL / VOID TRIP MODAL (Requirement 46) */}
      {cancelModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">{t('void_cancel_trip', 'Void / Cancel Trip')}</h3>
                <p className="text-xs text-red-300 font-mono">{cancelModal.trip?.trip_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {t('void_trip_audit_notice', 'In accordance with financial accountability rules, this transaction will NOT be deleted. It will be marked as Cancelled, and your name and timestamp will be permanently logged.')}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('cancel_reason_required_label', 'Reason for Cancellation (Required):')}
              </label>
              <textarea
                rows="3"
                value={cancelModal.reason}
                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                placeholder={t('ph_cancel_trip_reason', 'e.g. Duplicate entry by driver, rejected by quarry weigh-scale')}
                className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModal({ open: false, trip: null, reason: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleCancelTrip}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/25"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {selectedTripDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">{t('hauling_trip_inspection', 'Hauling Trip Inspection')}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs text-amber-400">{selectedTripDetail.trip_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedTripDetail.status === 'cancelled'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {selectedTripDetail.status}
                  </span>
                  {selectedTripDetail.pricing_method === 'lump_sum' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      💰 Lump-Sum
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                      ⚖️ Per Unit
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedTripDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">{t('truck_plate', 'Truck Plate')}</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.truck_plate}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">{t('driver', 'Driver')}</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.driver_name}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 col-span-2">
                <span className="text-slate-400 block text-[10px]">{t('loading_site', 'Loading Site')}</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.loading_site_name}</span>
              </div>

              {/* CARGO DROP-OFF DESTINATION STATUS */}
              {selectedTripDetail.is_split_drop || selectedTripDetail.drop_off_location === 'split' ? (
                <div className="p-3 bg-purple-950/30 border border-purple-500/40 rounded-xl col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-purple-400" />
                      {t('multipoint_cargo_offload_split', 'Multi-Point Cargo Offload (Split Drop)')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                      2-Stage Haul
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2.5 bg-slate-900/90 rounded-lg space-y-0.5 border border-purple-500/20">
                      <div className="font-bold text-purple-300">📍 Transit Hub: {selectedTripDetail.transition_point_name || selectedTripDetail.intermediate_site_name || 'Waypoint'}</div>
                      <div className="text-slate-300">{t('unloaded_colon', 'Unloaded:')} <strong>{selectedTripDetail.transit_quantity} {selectedTripDetail.transit_unit || 't'}</strong></div>
                      <div className="text-slate-400">Rate: {selectedTripDetail.transit_pricing_method === 'lump_sum' ? `Lump Sum ${formatCurrency(selectedTripDetail.transit_lump_sum)}` : `${formatCurrency(selectedTripDetail.transit_unit_price)} / ${selectedTripDetail.transit_unit || 't'}`}</div>
                      <div className="font-black text-emerald-400">
                        Leg 1 Pay (T): {formatCurrency(
                          selectedTripDetail.transit_pricing_method === 'lump_sum'
                            ? (selectedTripDetail.transit_lump_sum || selectedTripDetail.transit_revenue || 0)
                            : (parseFloat(selectedTripDetail.transit_quantity) || 0) * (parseFloat(selectedTripDetail.transit_unit_price || selectedTripDetail.transit_unit_price_split) || 0)
                        )}
                      </div>
                      {selectedTripDetail.transit_receipt_number && <div className="text-[10px] text-slate-500 font-mono">Slip: {selectedTripDetail.transit_receipt_number}</div>}
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-lg space-y-0.5 border border-emerald-500/20">
                      <div className="font-bold text-emerald-300">🏁 Final Destination: {selectedTripDetail.dumping_site_name || 'Site'}</div>
                      <div className="text-slate-300">{t('unloaded_colon', 'Unloaded:')} <strong>{selectedTripDetail.destination_quantity} {selectedTripDetail.destination_unit || 't'}</strong></div>
                      <div className="text-slate-400">Rate: {selectedTripDetail.destination_pricing_method === 'lump_sum' ? `Lump Sum ${formatCurrency(selectedTripDetail.destination_lump_sum)}` : `${formatCurrency(selectedTripDetail.destination_unit_price || selectedTripDetail.destination_unit_price_split)} / ${selectedTripDetail.destination_unit || 't'}`}</div>
                      <div className="font-black text-emerald-400">
                        Leg 2 Pay (D): {formatCurrency(
                          selectedTripDetail.destination_pricing_method === 'lump_sum'
                            ? (selectedTripDetail.destination_lump_sum || selectedTripDetail.destination_revenue || 0)
                            : (parseFloat(selectedTripDetail.destination_quantity) || 0) * (parseFloat(selectedTripDetail.destination_unit_price || selectedTripDetail.destination_unit_price_split) || 0)
                        )}
                      </div>
                      {selectedTripDetail.destination_receipt_number && <div className="text-[10px] text-slate-500 font-mono">Slip: {selectedTripDetail.destination_receipt_number}</div>}
                    </div>
                  </div>
                </div>
              ) : selectedTripDetail.drop_off_location === 'intermediate_transit' || selectedTripDetail.pricing_target === 'transit' ? (
                <div className="p-3 bg-purple-950/40 border border-purple-500/50 rounded-xl col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-purple-400" />
                      Cargo Dropped at Intermediate Transit Hub / Dumping Site
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                      Transit Drop
                    </span>
                  </div>
                  <div className="text-slate-200 text-xs">
                    Actual Drop-off Site: <strong className="text-purple-300">{selectedTripDetail.transition_point_name || selectedTripDetail.intermediate_site_name || 'Intermediate Point'}</strong>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Originally Scheduled Final Destination: {selectedTripDetail.dumping_site_name}
                  </div>
                  {(selectedTripDetail.transit_notes || selectedTripDetail.transit_receipt_number) && (
                    <div className="p-2 bg-slate-900/90 rounded-lg border border-purple-500/30 text-[11px] text-purple-200 font-mono">
                      📋 Scale Ticket / Transit Waybill Slip: <strong>{selectedTripDetail.transit_notes || selectedTripDetail.transit_receipt_number}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      Delivered to Final Destination Site
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      Final Delivery
                    </span>
                  </div>
                  <div className="text-slate-200 text-xs">
                    Destination Dumping Site: <strong className="text-emerald-300">{selectedTripDetail.dumping_site_name}</strong>
                  </div>
                  {(selectedTripDetail.has_transition || selectedTripDetail.transition_point_name || selectedTripDetail.intermediate_site_name) && (
                    <div className="text-slate-400 text-[11px]">
                      Waypoint En-Route: {selectedTripDetail.transition_point_name || selectedTripDetail.intermediate_site_name}
                    </div>
                  )}
                  {(selectedTripDetail.transit_notes || selectedTripDetail.transit_receipt_number) && (
                    <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-700 text-[11px] text-slate-300 font-mono">
                      📋 Waypoint Slip / Transit Notes: <strong>{selectedTripDetail.transit_notes || selectedTripDetail.transit_receipt_number}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">{t('material_hauled_label', 'Material Hauled')}</span>
                <span className="font-bold text-amber-400">{selectedTripDetail.material_name}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">{t('total_quantity_label', 'Total Quantity')}</span>
                <span className="font-bold text-slate-100">
                  {selectedTripDetail.quantity} {selectedTripDetail.unit}
                  {selectedTripDetail.quantity_kg > 0 && (
                    <span className="text-xs text-slate-400 font-normal ml-1.5">
                      ({formatNumber(selectedTripDetail.quantity_kg / 1000, 2)} tons / {formatNumber(selectedTripDetail.quantity_kg)} kg)
                    </span>
                  )}
                </span>
              </div>

              {/* SETTLEMENT & PRICING RATE CARD */}
              <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 block text-[10px]">Applied Pricing & Settlement Method</span>
                  {selectedTripDetail.pricing_method === 'lump_sum' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      Fixed Lump-Sum
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                      Unit-Based ({selectedTripDetail.pricing_method || 'per_ton'})
                    </span>
                  )}
                </div>

                {selectedTripDetail.pricing_method === 'lump_sum' ? (
                  <div>
                    <div className="text-base font-black text-emerald-400 font-mono">
                      💰 Lump-Sum: {formatCurrency(selectedTripDetail.lump_sum || selectedTripDetail.total_revenue)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Agreed fixed total payout without per-unit weight calculation ({selectedTripDetail.drop_off_location === 'intermediate_transit' || selectedTripDetail.pricing_target === 'transit' ? 'Intermediate Transit Hub Rate' : 'Final Destination Rate'})
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-bold text-slate-100 font-mono">
                      ⚖️ {formatCurrency(selectedTripDetail.unit_price)} / {selectedTripDetail.unit || 'ton'}
                    </div>
                    <div className="text-[11px]">
                      {selectedTripDetail.pricing_target === 'transit' || selectedTripDetail.drop_off_location === 'intermediate_transit' ? (
                        <span className="text-purple-300 font-semibold">📍 {t('intermediate_transit_rate_applied', 'Intermediate Transit Point Rate Applied')}</span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">🏁 {t('final_destination_rate_applied', 'Final Destination Rate Applied')}</span>
                      )}
                    </div>
                  </div>
                )}

                {(selectedTripDetail.destination_unit_price > 0 && selectedTripDetail.transit_unit_price > 0) && (
                  <div className="mt-2 pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="text-slate-400">
                      Destination Benchmark: <span className="font-mono text-slate-200">{formatCurrency(selectedTripDetail.destination_unit_price)}</span>
                    </div>
                    <div className="text-slate-400">
                      Intermediate Benchmark: <span className="font-mono text-purple-300">{formatCurrency(selectedTripDetail.transit_unit_price)}</span>
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const tPay = selectedTripDetail.transit_pricing_method === 'lump_sum'
                  ? (selectedTripDetail.transit_lump_sum || selectedTripDetail.transit_revenue || 0)
                  : (parseFloat(selectedTripDetail.transit_quantity) || 0) * (parseFloat(selectedTripDetail.transit_unit_price || selectedTripDetail.transit_unit_price_split) || 0);
                const dPay = selectedTripDetail.destination_pricing_method === 'lump_sum'
                  ? (selectedTripDetail.destination_lump_sum || selectedTripDetail.destination_revenue || 0)
                  : (parseFloat(selectedTripDetail.destination_quantity) || 0) * (parseFloat(selectedTripDetail.destination_unit_price || selectedTripDetail.destination_unit_price_split) || 0);
                const grossPay = selectedTripDetail.is_split_drop
                  ? (tPay + dPay)
                  : (selectedTripDetail.gross_revenue > 0
                    ? selectedTripDetail.gross_revenue
                    : (selectedTripDetail.pricing_method === 'lump_sum'
                      ? (selectedTripDetail.lump_sum || selectedTripDetail.total_revenue)
                      : (parseFloat(selectedTripDetail.quantity) || 0) * (parseFloat(selectedTripDetail.unit_price) || 0)));
                const netPay = grossPay - (selectedTripDetail.total_additional_fees || 0);

                return (
                  <>
                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">{t('fee_gross_revenue', 'Gross Revenue')}</span>
                      <span className="font-bold text-slate-100 text-sm">{formatCurrency(grossPay)}</span>
                    </div>
                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                      <span className="text-amber-400 block text-[10px]">{t('additional_fees_label', 'Additional Fees')}</span>
                      <span className="font-bold text-amber-400 text-sm">
                        {selectedTripDetail.total_additional_fees > 0
                          ? `- ${formatCurrency(selectedTripDetail.total_additional_fees)}`
                          : '0 ETB'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 col-span-2">
                      <span className="text-emerald-400 block text-[10px]">{t('net_trip_revenue_col_header', 'Net Trip Revenue')}</span>
                      <span className="font-black text-emerald-400 text-base">
                        {formatCurrency(netPay)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            {selectedTripDetail.additional_fees && selectedTripDetail.additional_fees.length > 0 && (
              <div className="p-3 bg-slate-800/90 border border-slate-700 rounded-xl text-xs space-y-1.5">
                <strong className="text-amber-400 block mb-1">Additional Fees & Tolls Breakdown:</strong>
                {selectedTripDetail.additional_fees.map((fee, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-300">
                    <span className="capitalize text-slate-400">
                      • {fee.fee_type === 'toll' ? '🛣️ Toll' : fee.fee_type === 'weighbridge' ? '⚖️ Scale' : fee.fee_type === 'parking' ? '🅿️ Parking' : fee.fee_type === 'gate_fee' ? '🚧 Gate' : '📝 Extra'}
                      {fee.description ? ` (${fee.description})` : ''}
                    </span>
                    <span className="font-mono font-bold text-amber-400">{formatCurrency(fee.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedTripDetail.notes && (
              <div className="p-3 bg-slate-800 rounded-xl text-xs text-slate-300">
                <strong className="text-slate-400 block mb-0.5">{t('notes_colon', 'Notes:')}</strong>
                {selectedTripDetail.notes}
              </div>
            )}

            {selectedTripDetail.status === 'cancelled' && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 space-y-1">
                <strong className="text-red-400 block">{t('cancellation_record', 'Cancellation Record:')}</strong>
                <div>Reason: {selectedTripDetail.cancel_reason}</div>
                <div>Voided by: {selectedTripDetail.cancelled_by} at {formatDateTime(selectedTripDetail.cancelled_at)}</div>
              </div>
            )}

            <button
              onClick={() => setSelectedTripDetail(null)}
              className="w-full py-2.5 bg-slate-800 text-slate-200 font-bold rounded-xl hover:bg-slate-750"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* EDIT / CORRECT TRIP MODAL */}
      {editingTrip && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Edit & Correct Hauling Trip</h3>
                <span className="font-mono text-xs text-amber-400">{editingTrip.trip_number}</span>
              </div>
              <button
                onClick={() => setEditingTrip(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-750"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTripEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('loading_site_field_colon', 'Loading Site:')}</label>
                  <select
                    value={editFormData.loading_site_id}
                    onChange={e => {
                      const sel = loadingSites.find(s => s.id === e.target.value);
                      setEditFormData({
                        ...editFormData,
                        loading_site_id: e.target.value,
                        loading_site_name: sel ? sel.name : editFormData.loading_site_name,
                      });
                    }}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">{editFormData.loading_site_name || 'Select loading site'}</option>
                    {loadingSites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('final_destination_site_colon', 'Final Destination Site:')}</label>
                  <select
                    value={editFormData.dumping_site_id}
                    onChange={e => {
                      const sel = dumpingSites.find(s => s.id === e.target.value);
                      setEditFormData({
                        ...editFormData,
                        dumping_site_id: e.target.value,
                        dumping_site_name: sel ? sel.name : editFormData.dumping_site_name,
                      });
                    }}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">{editFormData.dumping_site_name || 'Select dumping site'}</option>
                    {dumpingSites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DROP-OFF TARGET & TRANSIT SITE CONTROLS */}
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">{t('cargo_drop_off_colon', 'Cargo Drop-Off Location:')}</label>
                    <select
                      value={editFormData.drop_off_location}
                      onChange={e => {
                        const val = e.target.value;
                        setEditFormData({
                          ...editFormData,
                          drop_off_location: val,
                          pricing_target: val === 'intermediate_transit' ? 'transit' : 'destination',
                        });
                      }}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium"
                    >
                      <option value="final_destination">🏁 Final Destination Delivery</option>
                      <option value="intermediate_transit">📍 Intermediate Transit Drop</option>
                      <option value="split">🔀 Split Offload (Multi-Point)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">{t('intermediate_transit_colon', 'Intermediate Transit Hub:')}</label>
                    <select
                      value={editFormData.transition_point_ids?.[0] || ''}
                      onChange={e => {
                        const sel = transitionSites.find(s => s.id === e.target.value);
                        setEditFormData({
                          ...editFormData,
                          transition_point_ids: e.target.value ? [e.target.value] : [],
                          transition_point_name: sel ? sel.name : '',
                        });
                      }}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="">{t('none_intermediate_site', 'None / No Intermediate Site')}</option>
                      {transitionSites.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">{t('rate_level_target_colon', 'Rate Level Target:')}</label>
                    <select
                      value={editFormData.pricing_target}
                      onChange={e => setEditFormData({ ...editFormData, pricing_target: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="destination">🏁 Final Destination Rate</option>
                      <option value="transit">📍 Intermediate Transit Rate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Transit Slip / Waybill #:</label>
                    <input
                      type="text"
                      value={editFormData.transit_notes}
                      onChange={e => setEditFormData({ ...editFormData, transit_notes: e.target.value })}
                      placeholder={t('ph_scale_slip_ref', 'e.g. Scale slip #, TR-4821')}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('material_colon', 'Material:')}</label>
                  <select
                    value={editFormData.material_id}
                    onChange={e => {
                      const sel = materials.find(m => m.id === e.target.value);
                      setEditFormData({
                        ...editFormData,
                        material_id: e.target.value,
                        material_name: sel ? sel.name : editFormData.material_name,
                      });
                    }}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">{editFormData.material_name || 'Select material'}</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('status_field_colon', 'Status:')}</label>
                  <select
                    value={editFormData.status}
                    onChange={e => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="completed">{t('completed_tab', 'Completed')}</option>
                    <option value="cancelled">{t('cancelled', 'Cancelled')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('quantity_hauled_colon', 'Quantity Hauled:')}</label>
                  <input
                    type="number"
                    step="any"
                    value={editFormData.quantity}
                    onChange={e => setEditFormData({ ...editFormData, quantity: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('measure_unit_field_colon', 'Measurement Unit:')}</label>
                  <select
                    value={editFormData.unit}
                    onChange={e => setEditFormData({ ...editFormData, unit: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="ton">{t('unit_ton_display', 'Ton')}</option>
                    <option value="quintal">{t('unit_quintal_display', 'Quintal')}</option>
                    <option value="kg">{t('unit_kg_display', 'Kilogram')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('payment_method_label', 'Payment Method:')}</label>
                  <select
                    value={editFormData.pricing_method}
                    onChange={e => setEditFormData({ ...editFormData, pricing_method: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium"
                  >
                    <option value="per_ton">⚖️ Per Ton</option>
                    <option value="per_quintal">⚖️ Per Quintal</option>
                    <option value="per_kg">⚖️ Per KG</option>
                    <option value="lump_sum">💰 Fixed Lump Sum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    {editFormData.pricing_method === 'lump_sum' ? '💰 Lump Sum Total (ETB):' : '⚖️ Unit Price (ETB):'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editFormData.pricing_method === 'lump_sum' ? editFormData.lump_sum : editFormData.unit_price}
                    onChange={e => {
                      if (editFormData.pricing_method === 'lump_sum') {
                        setEditFormData({ ...editFormData, lump_sum: e.target.value });
                      } else {
                        setEditFormData({ ...editFormData, unit_price: e.target.value });
                      }
                    }}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('notes_correction_colon', 'Notes / Correction Rationale:')}</label>
                <textarea
                  rows="2"
                  value={editFormData.notes}
                  onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder={t('ph_correction_reason', 'Reason for adjustment, scale ticket number...')}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTrip(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                >
                  Save Corrections
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
