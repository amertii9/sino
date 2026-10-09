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
  Trash2
} from 'lucide-react';

export const TripsManagement = () => {
  const { t } = useLanguage();
  const [trips, setTrips] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loadingSites, setLoadingSites] = useState([]);
  const [dumpingSites, setDumpingSites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [cancelModal, setCancelModal] = useState({ open: false, trip: null, reason: '' });
  const [selectedTripDetail, setSelectedTripDetail] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);
  const [editFormData, setEditFormData] = useState({
    quantity: 0,
    unit: 'ton',
    pricing_method: 'per_ton',
    unit_price: 0,
    lump_sum: 0,
    loading_site_id: '',
    loading_site_name: '',
    dumping_site_id: '',
    dumping_site_name: '',
    material_id: '',
    material_name: '',
    status: 'completed',
    notes: '',
  });

  const fetchTripsData = async () => {
    try {
      const [tripsData, trucksData, driversData, matsData, loadData, dumpData] = await Promise.all([
        api.get('/trips'),
        api.get('/trucks'),
        api.get('/drivers'),
        api.get('/materials'),
        api.get('/sites?type=loading'),
        api.get('/sites?type=dumping'),
      ]);
      setTrips(tripsData || []);
      setTrucks(trucksData || []);
      setDrivers(driversData || []);
      setMaterials(matsData || []);
      setLoadingSites(loadData || []);
      setDumpingSites(dumpData || []);
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
      unit: trip.unit || 'ton',
      pricing_method: trip.pricing_method || 'per_ton',
      unit_price: trip.unit_price || 0,
      lump_sum: trip.lump_sum || 0,
      loading_site_id: trip.loading_site_id || '',
      loading_site_name: trip.loading_site_name || '',
      dumping_site_id: trip.dumping_site_id || '',
      dumping_site_name: trip.dumping_site_name || '',
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
      const mat = materials.find(m => m.id === editFormData.material_id);

      const payload = {
        ...editingTrip,
        ...editFormData,
        quantity: parseFloat(editFormData.quantity) || 0,
        unit_price: parseFloat(editFormData.unit_price) || 0,
        lump_sum: parseFloat(editFormData.lump_sum) || 0,
        loading_site_name: loadSite ? loadSite.name : editFormData.loading_site_name,
        dumping_site_name: dumpSite ? dumpSite.name : editFormData.dumping_site_name,
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
    if (!confirm(`Are you sure you want to permanently delete Trip #${trip.trip_number}? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/trips/${trip.id}`);
      fetchTripsData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleCancelTrip = async () => {
    if (!cancelModal.reason.trim()) {
      alert('Please enter a cancellation reason');
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
      { key: 'dumping_site_name', label: 'Dumping Site' },
      { key: 'transition_point_name', label: 'Transit Point' },
      { key: 'material_name', label: 'Material' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unit', label: 'Unit' },
      { key: 'total_revenue', label: 'Gross Revenue (ETB)' },
      { key: 'total_additional_fees', label: 'Additional Fees (ETB)' },
      { key: 'net_revenue', label: 'Net Revenue (ETB)' },
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
      t.dumping_site_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const truckMatch = !selectedTruck || t.truck_id === selectedTruck;
    const driverMatch = !selectedDriver || t.driver_id === selectedDriver;
    const matMatch = !selectedMaterial || t.material_id === selectedMaterial;
    const statusMatch = !selectedStatus || t.status === selectedStatus;

    return searchMatch && truckMatch && driverMatch && matMatch && statusMatch;
  });

  const totalFilteredRevenue = filteredTrips
    .filter(t => t.status !== 'cancelled')
    .reduce((acc, t) => acc + (t.total_revenue || 0), 0);

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
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('search_trips_placeholder', 'Search by trip #, driver, truck plate, site, or material...')}
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

          {/* Material filter */}
          <select
            value={selectedMaterial}
            onChange={e => setSelectedMaterial(e.target.value)}
            className="py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200"
          >
            <option value="">All Materials</option>
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
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/90 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3">Trip #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Truck / Driver</th>
                <th className="py-3 px-3">Loading → Dumping Site</th>
                <th className="py-3 px-3">Material</th>
                <th className="py-3 px-3">Quantity</th>
                <th className="py-3 px-3">Pricing Rate</th>
                <th className="py-3 px-3">Total Revenue</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
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
                      {trip.has_transition && (
                        <div className="text-[10px] text-purple-400">via {trip.transition_point_name}</div>
                      )}
                      <div className="text-[11px] text-emerald-400">→ {trip.dumping_site_name}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">{trip.material_name}</td>
                    <td className="py-3 px-3 font-bold text-slate-100">
                      {trip.quantity} {trip.unit}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {trip.pricing_method === 'lump_sum'
                        ? 'Lump Sum'
                        : `${formatCurrency(trip.unit_price)} / ${trip.unit}`}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-black text-emerald-400 text-sm">
                        {formatCurrency(trip.total_revenue)}
                      </div>
                      {trip.total_additional_fees > 0 && (
                        <div className="text-[10px] text-amber-400 font-mono">
                          fees: -{formatCurrency(trip.total_additional_fees)}
                        </div>
                      )}
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
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => openEditModal(trip)}
                        className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-slate-700 inline-block"
                        title="Edit / Correct Trip"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {trip.status !== 'cancelled' && (
                        <button
                          onClick={() => setCancelModal({ open: true, trip, reason: '' })}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 inline-block"
                          title="Void / Cancel Trip"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteTrip(trip)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 inline-block"
                        title="Delete Trip Permanently"
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
                <h3 className="font-bold text-base text-white">Void / Cancel Trip</h3>
                <p className="text-xs text-red-300 font-mono">{cancelModal.trip?.trip_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              In accordance with financial accountability rules, this transaction will <strong>NOT</strong> be deleted.
              It will be marked as <strong>Cancelled</strong>, and your name and timestamp will be permanently logged.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Cancellation (Required):
              </label>
              <textarea
                rows="3"
                value={cancelModal.reason}
                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                placeholder="e.g. Duplicate entry by driver, rejected by quarry weigh-scale"
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
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Hauling Trip Inspection</h3>
                <span className="font-mono text-xs text-amber-400">{selectedTripDetail.trip_number}</span>
              </div>
              <button
                onClick={() => setSelectedTripDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Truck Plate</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.truck_plate}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Driver</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.driver_name}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 col-span-2">
                <span className="text-slate-400 block text-[10px]">Loading Site</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.loading_site_name}</span>
              </div>
              {selectedTripDetail.has_transition && (
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 col-span-2">
                  <span className="text-purple-400 block text-[10px]">Transit Point</span>
                  <span className="font-bold text-slate-100">{selectedTripDetail.transition_point_name}</span>
                </div>
              )}
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 col-span-2">
                <span className="text-emerald-400 block text-[10px]">Dumping Site</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.dumping_site_name}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Material</span>
                <span className="font-bold text-amber-400">{selectedTripDetail.material_name}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Quantity</span>
                <span className="font-bold text-slate-100">{selectedTripDetail.quantity} {selectedTripDetail.unit}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Unit Rate</span>
                <span className="font-bold text-slate-100">{formatCurrency(selectedTripDetail.unit_price)}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Gross Revenue</span>
                <span className="font-bold text-slate-100 text-sm">{formatCurrency(selectedTripDetail.total_revenue)}</span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-amber-400 block text-[10px]">Additional Fees</span>
                <span className="font-bold text-amber-400 text-sm">
                  {selectedTripDetail.total_additional_fees > 0
                    ? `- ${formatCurrency(selectedTripDetail.total_additional_fees)}`
                    : '0 ETB'}
                </span>
              </div>
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 col-span-2">
                <span className="text-emerald-400 block text-[10px]">Net Trip Revenue</span>
                <span className="font-black text-emerald-400 text-base">
                  {formatCurrency(selectedTripDetail.net_revenue || (selectedTripDetail.total_revenue - (selectedTripDetail.total_additional_fees || 0)))}
                </span>
              </div>
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
                <strong className="text-slate-400 block mb-0.5">Notes:</strong>
                {selectedTripDetail.notes}
              </div>
            )}

            {selectedTripDetail.status === 'cancelled' && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 space-y-1">
                <strong className="text-red-400 block">Cancellation Record:</strong>
                <div>Reason: {selectedTripDetail.cancel_reason}</div>
                <div>Voided by: {selectedTripDetail.cancelled_by} at {formatDateTime(selectedTripDetail.cancelled_at)}</div>
              </div>
            )}

            <button
              onClick={() => setSelectedTripDetail(null)}
              className="w-full py-2.5 bg-slate-800 text-slate-200 font-bold rounded-xl"
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
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTripEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Loading Site:</label>
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
                  <label className="block text-slate-300 mb-1 font-semibold">Dumping Site:</label>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Material:</label>
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
                  <label className="block text-slate-300 mb-1 font-semibold">Status:</label>
                  <select
                    value={editFormData.status}
                    onChange={e => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Quantity Hauled:</label>
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
                  <label className="block text-slate-300 mb-1 font-semibold">Measurement Unit:</label>
                  <select
                    value={editFormData.unit}
                    onChange={e => setEditFormData({ ...editFormData, unit: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="ton">Ton</option>
                    <option value="quintal">Quintal</option>
                    <option value="kg">Kilogram</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Pricing Method:</label>
                  <select
                    value={editFormData.pricing_method}
                    onChange={e => setEditFormData({ ...editFormData, pricing_method: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="per_ton">Per Ton</option>
                    <option value="per_quintal">Per Quintal</option>
                    <option value="per_kg">Per KG</option>
                    <option value="lump_sum">Lump Sum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    {editFormData.pricing_method === 'lump_sum' ? 'Lump Sum Amount (ETB):' : 'Unit Price (ETB):'}
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
                <label className="block text-slate-300 mb-1 font-semibold">Notes / Correction Rationale:</label>
                <textarea
                  rows="2"
                  value={editFormData.notes}
                  onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Reason for adjustment, ticket number..."
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
