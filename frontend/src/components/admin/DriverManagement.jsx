import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency } from '../../utils/formatters';
import { Users, Plus, Phone, Award, Truck, AlertCircle, CheckCircle, Edit, Trash2 } from 'lucide-react';

export const DriverManagement = () => {
  const { t } = useLanguage();
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: 'driver123',
    phone: '',
    license_number: '',
    license_expiry: '',
    assigned_truck_id: '',
    status: 'active',
    notes: '',
  });

  const loadData = async () => {
    try {
      const [driversData, trucksData, perfData] = await Promise.all([
        api.get('/drivers'),
        api.get('/trucks'),
        api.get('/reports/drivers'),
      ]);
      setDrivers(driversData || []);
      setTrucks(trucksData || []);
      setPerformance(perfData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData({
      full_name: '',
      email: '',
      password: 'driver123',
      phone: '',
      license_number: '',
      license_expiry: '',
      assigned_truck_id: '',
      status: 'active',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (driver) => {
    setEditingDriver(driver);
    setFormData({
      full_name: driver.full_name || '',
      email: '', // Not changing email/password in edit unless needed
      password: '',
      phone: driver.phone || '',
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry || '',
      assigned_truck_id: driver.assigned_truck_id || '',
      status: driver.status || 'active',
      notes: driver.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let truckPlate = '';
      if (formData.assigned_truck_id) {
        const found = trucks.find(t => t.id === formData.assigned_truck_id);
        if (found) truckPlate = found.plate_number;
      }

      if (editingDriver) {
        await api.put(`/drivers/${editingDriver.id}`, {
          full_name: formData.full_name,
          phone: formData.phone,
          license_number: formData.license_number,
          license_expiry: formData.license_expiry,
          assigned_truck_id: formData.assigned_truck_id,
          assigned_truck_plate: truckPlate,
          status: formData.status,
          notes: formData.notes,
        });
      } else {
        await api.post('/drivers', {
          ...formData,
          assigned_truck_plate: truckPlate,
        });
      }

      setIsModalOpen(false);
      setEditingDriver(null);
      loadData();
      window.dispatchEvent(new CustomEvent('drivers-updated'));
    } catch (err) {
      alert((editingDriver ? 'Failed to update driver: ' : 'Failed to create driver: ') + err.message);
    }
  };

  const handleDeleteDriver = async (driver) => {
    if (!confirm(`Are you sure you want to permanently delete driver "${driver.full_name}"? This will unassign any linked truck.`)) {
      return;
    }
    try {
      await api.delete(`/drivers/${driver.id}`);
      loadData();
      window.dispatchEvent(new CustomEvent('drivers-updated'));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" /> {t('drivers_mgmt_title', 'Driver Roster & Performance')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('drivers_mgmt_sub', 'Manage driver profiles, licenses, truck assignments, and operational profitability')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> {t('add_driver_btn', '+ Add New Driver')}
        </button>
      </div>

      {/* Driver Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map(d => {
          const perf = performance.find(p => p.driver_id === d.user_id) || {};
          return (
            <div
              key={d.id}
              className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-lg flex items-center justify-center">
                      {d.full_name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{d.full_name}</h3>
                      <span className="text-xs font-mono text-amber-400">{d.driver_number}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                    d.status === 'inactive'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {d.status || 'Active'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{d.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Award className="w-3.5 h-3.5" />
                    <span>{t('driver_license', 'License')}: <strong className="text-slate-200">{d.license_number}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('menu_trucks', 'Truck')}: <strong className="text-slate-100">{d.assigned_truck_plate || t('driver_unassigned', 'Unassigned')}</strong></span>
                  </div>
                </div>

                {/* Financial KPI stats */}
                <div className="mt-4 p-3 bg-slate-800/80 rounded-2xl border border-slate-700 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{t('driver_trips_kpi', 'Trips')}</span>
                    <strong className="text-slate-100">{perf.trips_count || 0}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{t('driver_rev_kpi', 'Revenue')}</span>
                    <strong className="text-emerald-400">{formatCurrency(perf.revenue || 0)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{t('driver_profit_kpi', 'Net Profit')}</span>
                    <strong className="text-amber-400">{formatCurrency(perf.profit || 0)}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit and Delete */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => openEditModal(d)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Edit className="w-3.5 h-3.5" /> {t('edit', 'Edit')}
                </button>
                <button
                  onClick={() => handleDeleteDriver(d)}
                  className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition"
                  title={t('actions', 'Delete driver')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD / EDIT DRIVER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">
              {editingDriver ? `${t('edit', 'Edit Driver')}: ${editingDriver.full_name}` : t('add_driver_btn', 'Register New Driver')}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('full_name_label', 'Full Name')}:</label>
                <input
                  type="text"
                  placeholder={t('ph_driver_name_example', 'e.g. Dawit Tadesse')}
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  required
                />
              </div>

              {!editingDriver && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">{t('login_email', 'Email (Login)')}:</label>
                    <input
                      type="email"
                      placeholder={t('ph_driver_email_example', 'dawit@fleet.com')}
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">{t('login_password', 'Password')}:</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('phone_number_label', 'Phone Number')}:</label>
                  <input
                    type="tel"
                    placeholder={t('phone_number_ph', '+251 911 000 000')}
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('license_number_label', 'License Number')}:</label>
                  <input
                    type="text"
                    placeholder={t('license_number_ph', 'DL-AA-123456')}
                    value={formData.license_number}
                    onChange={e => setFormData({ ...formData, license_number: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('truck_assigned_driver', 'Assign Truck')}:</label>
                  <select
                    value={formData.assigned_truck_id}
                    onChange={e => setFormData({ ...formData, assigned_truck_id: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">{t('driver_unassigned', 'None (Unassigned)')}</option>
                    {trucks.map(tItem => (
                      <option key={tItem.id} value={tItem.id}>
                        {tItem.plate_number} ({tItem.model} - {tItem.capacity}T)
                      </option>
                    ))}
                  </select>
                </div>

                {editingDriver && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">{t('status', 'Status')}:</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="active">{t('active_trucks', 'Active')}</option>
                      <option value="inactive">{t('cancelled', 'Inactive / Suspended')}</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('driver_notes_label', 'Notes')}:</label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('ph_driver_notes_cert', 'Driver notes, certifications...')}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                >
                  {editingDriver ? t('save_changes', 'Save Driver Changes') : t('driver_save_btn', 'Create Driver Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
