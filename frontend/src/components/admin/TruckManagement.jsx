import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { Truck, Plus, UserCheck, ShieldAlert, Calendar, AlertTriangle, Edit, Trash2 } from 'lucide-react';

export const TruckManagement = () => {
  const { t } = useLanguage();
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);

  const [formData, setFormData] = useState({
    plate_number: '',
    type: 'Heavy Dump Tipper',
    model: '',
    capacity: 25,
    driver_assigned_id: '',
    status: 'available',
    registration_expiry: '',
    insurance_expiry: '',
    inspection_expiry: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      const [trucksData, driversData] = await Promise.all([
        api.get('/trucks'),
        api.get('/drivers'),
      ]);
      setTrucks(trucksData || []);
      setDrivers(driversData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      // Find driver name if assigned
      let driverName = '';
      if (formData.driver_assigned_id) {
        const found = drivers.find(d => d.user_id === formData.driver_assigned_id);
        if (found) driverName = found.full_name;
      }

      const payload = {
        ...formData,
        capacity: parseFloat(formData.capacity) || 0,
        driver_assigned_name: driverName,
      };

      if (editingTruck) {
        await api.put(`/trucks/${editingTruck.id}`, payload);
      } else {
        await api.post('/trucks', payload);
      }

      setIsAddModalOpen(false);
      setEditingTruck(null);
      loadData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleDeleteTruck = async (id, plate) => {
    if (!confirm(t('confirm_delete_truck', 'Are you sure you want to permanently delete this truck?'))) return;
    try {
      await api.delete(`/trucks/${id}`);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const openEdit = (t) => {
    setEditingTruck(t);
    setFormData({
      plate_number: t.plate_number || '',
      type: t.type || 'Heavy Dump Tipper',
      model: t.model || '',
      capacity: t.capacity || 20,
      driver_assigned_id: t.driver_assigned_id || '',
      status: t.status || 'available',
      registration_expiry: t.registration_expiry || '',
      insurance_expiry: t.insurance_expiry || '',
      inspection_expiry: t.inspection_expiry || '',
      notes: t.notes || '',
    });
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-400" /> {t('trucks_mgmt_title', 'Truck Fleet Management')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('trucks_mgmt_sub', 'Monitor truck capacities, driver assignments, and inspection/insurance expiries')}
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTruck(null);
            setFormData({
              plate_number: '',
              type: 'Heavy Dump Tipper',
              model: '',
              capacity: 25,
              driver_assigned_id: '',
              status: 'available',
              registration_expiry: '',
              insurance_expiry: '',
              inspection_expiry: '',
              notes: '',
            });
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> {t('add_truck_btn', '+ Add New Truck')}
        </button>
      </div>

      {/* Grid of Trucks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trucks.map(tItem => (
          <div
            key={tItem.id}
            className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">{tItem.plate_number}</h3>
                    <span className="text-xs font-mono text-slate-400">{tItem.truck_number}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border ${
                    tItem.status === 'working'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : tItem.status === 'available'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : tItem.status === 'maintenance'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}
                >
                  {tItem.status}
                </span>
              </div>

              {/* Truck Specs */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                <div>
                  <span className="text-[10px] text-slate-400 block">{t('truck_model', 'Model & Type')}:</span>
                  <strong className="text-slate-200">{tItem.model || 'Standard'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{t('truck_capacity', 'Load Capacity')}:</span>
                  <strong className="text-amber-400">{tItem.capacity} Tons</strong>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-700/50">
                  <span className="text-[10px] text-slate-400 block">{t('truck_assigned_driver', 'Assigned Driver')}:</span>
                  <strong className="text-slate-100 flex items-center gap-1.5 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {tItem.driver_assigned_name || t('truck_unassigned', 'None (Unassigned)')}
                  </strong>
                </div>
              </div>

              {/* Expiry alerts */}
              <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                {tItem.insurance_expiry && (
                  <div className="flex justify-between">
                    <span>{t('truck_insurance_exp', 'Insurance Expiry')}:</span>
                    <span className="font-semibold text-slate-300">{tItem.insurance_expiry}</span>
                  </div>
                )}
                {tItem.inspection_expiry && (
                  <div className="flex justify-between">
                    <span>{t('truck_inspection_exp', 'Inspection Expiry')}:</span>
                    <span className="font-semibold text-slate-300">{tItem.inspection_expiry}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openEdit(tItem)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition"
              >
                <Edit className="w-3.5 h-3.5 text-slate-400" /> {t('truck_edit_assign', 'Edit / Assign')}
              </button>
              <button
                onClick={() => handleDeleteTruck(tItem.id, tItem.plate_number)}
                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition"
                title={t('actions', 'Delete Truck')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ADD / EDIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">
              {editingTruck ? t('edit', 'Update Truck Details') : t('add_truck_btn', 'Add New Truck to Fleet')}
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('truck_plate', 'Plate Number')}:</label>
                <input
                  type="text"
                  placeholder={t('truck_plate_ph', 'e.g. ET-3-99887')}
                  value={formData.plate_number}
                  onChange={e => setFormData({ ...formData, plate_number: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('truck_model', 'Make & Model')}:</label>
                  <input
                    type="text"
                    placeholder={t('truck_model_ph', 'e.g. Sinotruk Howo 371')}
                    value={formData.model}
                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('truck_capacity', 'Capacity (Tons)')}:</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('truck_type', 'Truck Type')}:</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Heavy Dump Tipper">{t('heavy_dump_tipper_opt', 'Heavy Dump Tipper')}</option>
                    <option value="Medium Dump Truck">{t('medium_dump_truck_opt', 'Medium Dump Truck')}</option>
                    <option value="Trailer Flatbed">{t('trailer_flatbed_opt', 'Trailer Flatbed')}</option>
                    <option value="Tanker Truck">{t('tanker_truck_opt', 'Tanker Truck')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('status', 'Status')}:</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="available">{t('active_trucks', 'Available')}</option>
                    <option value="working">{t('status_working_opt', 'Working')}</option>
                    <option value="maintenance">{t('status_maintenance_opt', 'Maintenance')}</option>
                    <option value="inactive">{t('status_inactive_opt', 'Inactive')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('truck_assigned_driver', 'Assign Driver')}:</label>
                <select
                  value={formData.driver_assigned_id}
                  onChange={e => setFormData({ ...formData, driver_assigned_id: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="">{t('truck_unassigned', 'Unassigned')}</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.user_id}>
                      {d.full_name} ({d.driver_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('truck_insurance_exp', 'Insurance Expiry')}:</label>
                  <input
                    type="date"
                    value={formData.insurance_expiry}
                    onChange={e => setFormData({ ...formData, insurance_expiry: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('truck_inspection_exp', 'Inspection Expiry')}:</label>
                  <input
                    type="date"
                    value={formData.inspection_expiry}
                    onChange={e => setFormData({ ...formData, inspection_expiry: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                {editingTruck ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      handleDeleteTruck(editingTruck.id, editingTruck.plate_number);
                    }}
                    className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold text-xs rounded-xl border border-red-500/30 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t('trip_cancel', 'Delete Truck')}
                  </button>
                ) : <div></div>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs text-slate-400"
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                  >
                    {t('truck_save_btn', 'Save Truck')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
