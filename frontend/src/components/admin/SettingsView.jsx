import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Settings,
  Save,
  CheckCircle,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  Users,
  Shield,
  Truck,
  Sparkles,
  Coins,
  Fuel,
  Info,
  X,
  Lock,
  Search,
  Edit,
  Phone,
  UserPlus,
  UserCheck,
  AlertCircle,
  Wrench
} from 'lucide-react';

const DEFAULT_FEE_SUGGESTIONS = [
  { name: 'Modjo Expressway Toll', amount: 150, fee_type: 'toll' },
  { name: 'Adama Expressway Toll', amount: 200, fee_type: 'toll' },
  { name: 'Awash Toll Gate', amount: 220, fee_type: 'toll' },
  { name: 'Weighbridge / Scale', amount: 100, fee_type: 'weighbridge' },
  { name: 'Parking / Staging', amount: 50, fee_type: 'parking' },
  { name: 'Gate / Yard Pass', amount: 100, fee_type: 'gate_fee' },
];

const DEFAULT_MAINT_SUGGESTIONS = [
  { id: 'oil_change', label: 'Engine Oil & Filter', icon: '🛢️' },
  { id: 'tire_replacement', label: 'Tire Repair / Change', icon: '🛞' },
  { id: 'brake_repair', label: 'Brakes & Air System', icon: '🛑' },
  { id: 'engine_repair', label: 'Engine / Overheating', icon: '⚙️' },
  { id: 'electrical_repair', label: 'Battery & Lights', icon: '⚡' },
  { id: 'general_service', label: 'General Service', icon: '🔧' },
  { id: 'other', label: 'Other Work / Breakdown', icon: '⚠️' },
];

export const SettingsView = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'drivers' | 'suggestions'

  // General Settings State
  const [formData, setFormData] = useState({
    company_name: 'Horn Logistics & Hauling Fleet PLC',
    currency: 'ETB',
    default_unit: 'ton',
    company_phone: '+251 911 234 567',
    company_email: 'operations@hornfleet.com',
    diesel_price: 100,
  });

  // Suggestions State
  const [feeSuggestions, setFeeSuggestions] = useState(DEFAULT_FEE_SUGGESTIONS);
  const [fuelPresets, setFuelPresets] = useState([50, 80, 100, 150, 200, 300]);
  const [newPresetLiters, setNewPresetLiters] = useState('');
  const [maintSuggestions, setMaintSuggestions] = useState(DEFAULT_MAINT_SUGGESTIONS);
  const [newMaintLabel, setNewMaintLabel] = useState('');

  // Drivers & Password Management State
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({}); // { [driverId]: boolean }
  const [copiedId, setCopiedId] = useState(null);

  // Password Change Modal State
  const [passwordModal, setPasswordModal] = useState({
    open: false,
    driver: null,
    newPassword: '',
    submitting: false,
    error: '',
    success: '',
  });

  // Full Driver Edit / Create Modal State
  const [editDriverModal, setEditDriverModal] = useState({
    open: false,
    isNew: false,
    driver: null,
    full_name: '',
    email: '',
    phone: '',
    password: '',
    license_number: '',
    license_expiry: '',
    assigned_truck_id: '',
    status: 'active',
    notes: '',
    submitting: false,
    error: '',
    success: '',
  });

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load Settings
  const loadSettings = () => {
    api.get('/settings')
      .then(res => {
        if (res?.company_name) setFormData(res);
        if (res?.fee_suggestions && res.fee_suggestions.length > 0) {
          setFeeSuggestions(res.fee_suggestions);
        }
        if (res?.fuel_liters_presets && res.fuel_liters_presets.length > 0) {
          setFuelPresets(res.fuel_liters_presets);
        }
        if (res?.maintenance_suggestions && res.maintenance_suggestions.length > 0) {
          setMaintSuggestions(res.maintenance_suggestions);
        }
      })
      .catch(console.error);
  };

  // Load Drivers & Trucks
  const loadDriversAndTrucks = async () => {
    setLoadingDrivers(true);
    try {
      const [drvs, trks] = await Promise.all([
        api.get('/drivers'),
        api.get('/trucks').catch(() => [])
      ]);
      if (Array.isArray(drvs)) {
        setDrivers(drvs);
      }
      if (Array.isArray(trks)) {
        setTrucks(trks);
      }
    } catch (err) {
      console.error('Failed to load drivers and trucks in settings:', err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadDriversAndTrucks();
  }, []);

  const handleSaveGeneralSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      const validSuggestions = feeSuggestions
        .filter(f => f.name && f.name.trim() && parseFloat(f.amount) > 0)
        .map(f => ({
          name: f.name.trim(),
          amount: parseFloat(f.amount) || 0,
          fee_type: f.fee_type || 'other',
        }));

      const validPresets = fuelPresets
        .map(Number)
        .filter(n => !isNaN(n) && n > 0)
        .sort((a, b) => a - b);

      await api.put('/settings', {
        ...formData,
        fee_suggestions: validSuggestions,
        fuel_liters_presets: validPresets,
        maintenance_suggestions: maintSuggestions,
      });

      window.dispatchEvent(new CustomEvent('maintenance-suggestions-updated'));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPreset = () => {
    const val = parseFloat(newPresetLiters);
    if (!val || val <= 0) return;
    if (!fuelPresets.includes(val)) {
      const updated = [...fuelPresets, val].sort((a, b) => a - b);
      setFuelPresets(updated);
    }
    setNewPresetLiters('');
  };

  const handleCopyPassword = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openChangePasswordModal = (driver) => {
    setPasswordModal({
      open: true,
      driver,
      newPassword: '',
      submitting: false,
      error: '',
      success: '',
    });
  };

  const handleUpdatePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordModal.newPassword || passwordModal.newPassword.length < 4) {
      setPasswordModal(prev => ({ ...prev, error: 'Password must be at least 4 characters long' }));
      return;
    }

    setPasswordModal(prev => ({ ...prev, submitting: true, error: '', success: '' }));

    try {
      const res = await api.put(`/drivers/${passwordModal.driver.id}/password`, {
        new_password: passwordModal.newPassword,
      });

      // Update local state
      setDrivers(prev => prev.map(d => 
        d.id === passwordModal.driver.id 
          ? { ...d, temp_password: passwordModal.newPassword }
          : d
      ));

      // Make visible right away so admin sees it
      setVisiblePasswords(prev => ({ ...prev, [passwordModal.driver.id]: true }));

      // Dispatch event so top role switcher immediately syncs
      window.dispatchEvent(new CustomEvent('drivers-updated'));

      setPasswordModal(prev => ({
        ...prev,
        submitting: false,
        success: `Password for ${prev.driver.full_name} updated successfully to "${prev.newPassword}"!`,
      }));

      setTimeout(() => {
        setPasswordModal(prev => ({ ...prev, open: false }));
      }, 2000);
    } catch (err) {
      setPasswordModal(prev => ({ ...prev, submitting: false, error: err.message || 'Failed to update password' }));
    }
  };

  const openEditDriverModal = (driver) => {
    setEditDriverModal({
      open: true,
      isNew: false,
      driver,
      full_name: driver.full_name || '',
      email: driver.email || '',
      phone: driver.phone || '',
      password: driver.temp_password || 'driver123',
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry || '',
      assigned_truck_id: driver.assigned_truck_id || '',
      status: driver.status || 'active',
      notes: driver.notes || '',
      submitting: false,
      error: '',
      success: '',
    });
  };

  const openAddDriverModal = () => {
    setEditDriverModal({
      open: true,
      isNew: true,
      driver: null,
      full_name: '',
      email: '',
      phone: '',
      password: 'driver123',
      license_number: '',
      license_expiry: '',
      assigned_truck_id: '',
      status: 'active',
      notes: '',
      submitting: false,
      error: '',
      success: '',
    });
  };

  const handleSaveDriverProfile = async (e) => {
    e.preventDefault();
    if (!editDriverModal.full_name.trim()) {
      setEditDriverModal(prev => ({ ...prev, error: 'Full legal name is required' }));
      return;
    }

    setEditDriverModal(prev => ({ ...prev, submitting: true, error: '', success: '' }));

    try {
      let truckPlate = '';
      if (editDriverModal.assigned_truck_id) {
        const found = trucks.find(t => t.id === editDriverModal.assigned_truck_id);
        if (found) truckPlate = found.plate_number;
      }

      let emailVal = editDriverModal.email.trim();
      if (emailVal && !emailVal.includes('@')) {
        emailVal = emailVal + '@sino.com';
      }
      if (!emailVal) {
        emailVal = editDriverModal.full_name.toLowerCase().replace(/\s+/g, '') + '@sino.com';
      }

      if (editDriverModal.isNew) {
        await api.post('/drivers', {
          full_name: editDriverModal.full_name.trim(),
          email: emailVal,
          phone: editDriverModal.phone.trim(),
          password: editDriverModal.password || 'driver123',
          license_number: editDriverModal.license_number.trim(),
          license_expiry: editDriverModal.license_expiry,
          assigned_truck_id: editDriverModal.assigned_truck_id,
          assigned_truck_plate: truckPlate,
          notes: editDriverModal.notes,
        });
      } else {
        await api.put(`/drivers/${editDriverModal.driver.id}`, {
          full_name: editDriverModal.full_name.trim(),
          email: emailVal,
          phone: editDriverModal.phone.trim(),
          password: editDriverModal.password,
          temp_password: editDriverModal.password,
          license_number: editDriverModal.license_number.trim(),
          license_expiry: editDriverModal.license_expiry,
          assigned_truck_id: editDriverModal.assigned_truck_id,
          assigned_truck_plate: truckPlate,
          status: editDriverModal.status,
          notes: editDriverModal.notes,
        });
      }

      await loadDriversAndTrucks();
      window.dispatchEvent(new CustomEvent('drivers-updated'));

      setEditDriverModal(prev => ({
        ...prev,
        submitting: false,
        success: editDriverModal.isNew
          ? `Driver ${editDriverModal.full_name} created successfully!`
          : `Driver ${editDriverModal.full_name} updated successfully!`,
      }));

      setTimeout(() => {
        setEditDriverModal(prev => ({ ...prev, open: false }));
      }, 1500);
    } catch (err) {
      setEditDriverModal(prev => ({ ...prev, submitting: false, error: err.message || 'Failed to save driver information' }));
    }
  };

  const filteredDrivers = drivers.filter(d => {
    const query = driverSearch.toLowerCase();
    return (
      (d.full_name || '').toLowerCase().includes(query) ||
      (d.email || '').toLowerCase().includes(query) ||
      (d.phone || '').toLowerCase().includes(query) ||
      (d.driver_number || '').toLowerCase().includes(query) ||
      (d.assigned_truck_plate || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-400" /> {t('settings_title', 'Fleet System Settings')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('settings_sub', 'Configure global parameters, manage driver passwords & operational presets')}
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-800 space-x-1 sm:space-x-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === 'general'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>General & Company</span>
        </button>

        <button
          onClick={() => setActiveTab('drivers')}
          className={`pb-3 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === 'drivers'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4 text-emerald-400" />
          <span>Driver Accounts & Credentials</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-bold">
            {drivers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('suggestions')}
          className={`pb-3 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === 'suggestions'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Operational Suggestions & Presets</span>
        </button>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> System settings updated successfully!
        </div>
      )}

      {/* ================= TAB 1: GENERAL SETTINGS ================= */}
      {activeTab === 'general' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6">
          <form onSubmit={handleSaveGeneralSettings} className="space-y-4 text-xs">
            {/* Logo Preview */}
            <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center gap-4">
              <div className="h-14 px-3 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 shadow-md">
                <img src="/logo.png" alt="Company Logo" className="h-10 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(255,28,28,0.25)]" />
              </div>
              <div>
                <span className="font-bold text-slate-200 block text-xs">Official Fleet Logo</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Active logo loaded from <span className="font-mono text-amber-400">logo.png</span>, applied across the navigation bar, login screen, and driver portal.</p>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Company / Operator Name:</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Operating Currency:</label>
                <select
                  value={formData.currency}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                >
                  <option value="ETB">ETB (Ethiopian Birr)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="KES">KES (Kenyan Shilling)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Default Measure Unit:</label>
                <select
                  value={formData.default_unit}
                  onChange={e => setFormData({ ...formData, default_unit: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="ton">Metric Ton (1,000 kg)</option>
                  <option value="quintal">Quintal (100 kg)</option>
                  <option value="kg">Kilogram (kg)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Support / Dispatch Phone:</label>
                <input
                  type="text"
                  value={formData.company_phone}
                  onChange={e => setFormData({ ...formData, company_phone: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Operations Email:</label>
                <input
                  type="email"
                  value={formData.company_email}
                  onChange={e => setFormData({ ...formData, company_email: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Diesel Fuel Rate Benchmark ({formData.currency || 'ETB'} / Liter):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={formData.diesel_price || 100}
                  onChange={e => setFormData({ ...formData, diesel_price: parseFloat(e.target.value) || 0 })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-amber-400 font-mono font-bold"
                  required
                />
                <span className="text-slate-400 text-xs shrink-0">Used for auto fuel volume estimation</span>
              </div>
            </div>

            {/* Admin Credentials Info */}
            <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-1">
              <span className="font-bold text-amber-400 block text-xs flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> System Administrator Username
              </span>
              <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-1">
                <span>Admin Login:</span>
                <strong className="text-white font-mono bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">admin@sino.com</strong>
              </div>
            </div>

            {/* Numbering Standards Info */}
            <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-1 text-slate-400">
              <span className="font-bold text-slate-200 block text-xs">Standard Auto-numbering Prefixes:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                <div>Trips: <strong className="text-amber-400 font-mono block">TR-000001</strong></div>
                <div>Fuel Requests: <strong className="text-emerald-400 font-mono block">FR-000001</strong></div>
                <div>Expenses: <strong className="text-red-400 font-mono block">EX-000001</strong></div>
                <div>Maintenance: <strong className="text-blue-400 font-mono block">MT-000001</strong></div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 shadow-md touch-btn cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading ? t('saving', 'Saving...') : t('save', 'Save General Settings')}
            </button>
          </form>
        </div>
      )}

      {/* ================= TAB 2: DRIVER ACCOUNTS & CREDENTIALS ================= */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-emerald-400" /> Driver Accounts & Credentials
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage driver SINO usernames (@sino.com), phone numbers for login, passwords, vehicle assignments & status.
                </p>
              </div>

              {/* Action Buttons & Search Driver */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={openAddDriverModal}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add New Driver</span>
                </button>

                <div className="relative w-full sm:w-60">
                  <input
                    type="text"
                    placeholder="Search name, phone, plate..."
                    value={driverSearch}
                    onChange={e => setDriverSearch(e.target.value)}
                    className="w-full py-2 pl-9 pr-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {loadingDrivers ? (
              <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> Loading drivers...
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No drivers found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredDrivers.map(drv => {
                  const currentPw = drv.temp_password || 'driver123';
                  const isVisible = !!visiblePasswords[drv.id];
                  const sinoUsername = drv.email || `${(drv.full_name || 'driver').toLowerCase().replace(/\s+/g, '')}@sino.com`;

                  return (
                    <div
                      key={drv.id}
                      className="p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl space-y-3 transition"
                    >
                      {/* Driver Info Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                            {drv.full_name?.charAt(0) || 'D'}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              <span>{drv.full_name}</span>
                              <span className="font-mono text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                {drv.driver_number}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5 text-slate-500" />
                                <span>{drv.assigned_truck_plate || 'Unassigned'}</span>
                              </span>
                              {drv.license_number && (
                                <span className="text-slate-500">• Lic: {drv.license_number}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          drv.status === 'active' || !drv.status
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-700/40 text-slate-400 border-slate-600'
                        }`}>
                          {drv.status || 'Active'}
                        </span>
                      </div>

                      {/* Login Credentials Box */}
                      <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/60 space-y-2 text-xs">
                        {/* Username / Email */}
                        <div className="flex justify-between items-center text-slate-300">
                          <span className="text-slate-400 text-[11px]">SINO Username:</span>
                          <span className="font-mono font-bold text-amber-300 select-all">{sinoUsername}</span>
                        </div>

                        {/* Login Phone */}
                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-800/80">
                          <span className="text-slate-400 text-[11px] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-cyan-400" /> Phone Login:
                          </span>
                          {drv.phone ? (
                            <span className="font-mono font-bold text-cyan-300 select-all flex items-center gap-1.5">
                              {drv.phone}
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded border border-emerald-500/30 font-sans">
                                Enabled
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">Not configured</span>
                          )}
                        </div>

                        {/* Password */}
                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-800/80">
                          <span className="text-slate-400 text-[11px] flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-500" /> Password:
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-emerald-400 tracking-wider">
                              {isVisible ? currentPw : '••••••••'}
                            </span>

                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(drv.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                              title={isVisible ? 'Hide password' : 'View password'}
                            >
                              {isVisible ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyPassword(currentPw, drv.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                              title="Copy password to clipboard"
                            >
                              {copiedId === drv.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Actions: Edit Full Info & Change Password */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openEditDriverModal(drv)}
                          className="py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 font-bold text-xs rounded-xl border border-amber-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit Full Info</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openChangePasswordModal(drv)}
                          className="py-2 px-3 bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-600 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Reset Password</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: OPERATIONAL SUGGESTIONS & PRESETS ================= */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveGeneralSettings} className="space-y-4">
            {/* Driver Fee & Toll Suggestions Configuration */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" /> Driver Fee & Toll Suggestions
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    These 1-tap presets appear on the driver's phone during trip completion so drivers can record tolls and expenses without typing.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFeeSuggestions(DEFAULT_FEE_SUGGESTIONS)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeSuggestions(prev => [...prev, { name: '', amount: 100, fee_type: 'toll' }])}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Suggestion
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {feeSuggestions.map((sug, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-800/80 rounded-2xl border border-slate-700/80">
                    <input
                      type="text"
                      placeholder="Fee Name (e.g. Modjo Expressway Toll)"
                      value={sug.name}
                      onChange={e => {
                        const updated = [...feeSuggestions];
                        updated[idx].name = e.target.value;
                        setFeeSuggestions(updated);
                      }}
                      className="flex-1 py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      required
                    />

                    <div className="flex items-center gap-2">
                      <div className="relative w-28">
                        <input
                          type="number"
                          step="any"
                          placeholder="Amount"
                          value={sug.amount}
                          onChange={e => {
                            const updated = [...feeSuggestions];
                            updated[idx].amount = parseFloat(e.target.value) || 0;
                            setFeeSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono font-bold text-right"
                          required
                        />
                      </div>
                      <span className="text-xs text-slate-400 font-bold">{formData.currency || 'ETB'}</span>

                      <select
                        value={sug.fee_type || 'other'}
                        onChange={e => {
                          const updated = [...feeSuggestions];
                          updated[idx].fee_type = e.target.value;
                          setFeeSuggestions(updated);
                        }}
                        className="py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 font-semibold"
                      >
                        <option value="toll">🛣️ Toll Expressway</option>
                        <option value="weighbridge">⚖️ Weighbridge / Scale</option>
                        <option value="parking">🅿️ Parking / Staging</option>
                        <option value="gate_fee">🚧 Gate / Yard Pass</option>
                        <option value="escort">🛡️ Escort / Security</option>
                        <option value="other">📝 Other Expense</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setFeeSuggestions(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-400 hover:text-red-400 font-bold cursor-pointer"
                        title="Remove suggestion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Maintenance Issue Suggestions */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-purple-400" /> Maintenance Issue Suggestions
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure the presets shown to drivers under "What is the issue / maintenance required?" when requesting repairs.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMaintSuggestions(DEFAULT_MAINT_SUGGESTIONS)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              {/* Suggestions List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {maintSuggestions.map((sug, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-slate-800/80 rounded-2xl border border-slate-700/80">
                    <select
                      value={sug.icon || '🔧'}
                      onChange={e => {
                        const updated = [...maintSuggestions];
                        updated[idx].icon = e.target.value;
                        setMaintSuggestions(updated);
                      }}
                      className="py-1 px-2 bg-slate-900 border border-slate-700 rounded-xl text-base cursor-pointer shrink-0"
                    >
                      {['🛢️', '🛞', '🛑', '⚙️', '⚡', '🔧', '⚠️', '🔩', '🚛', '💡', '❄️', '⛽', '🪟', '🔋', '🌡️'].map(ic => (
                        <option key={ic} value={ic}>{ic}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={sug.label}
                      onChange={e => {
                        const updated = [...maintSuggestions];
                        updated[idx].label = e.target.value;
                        setMaintSuggestions(updated);
                      }}
                      className="flex-1 py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-medium"
                      required
                    />

                    <button
                      type="button"
                      onClick={() => setMaintSuggestions(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-400 hover:text-red-400 font-bold cursor-pointer shrink-0"
                      title="Remove suggestion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Suggestion */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="New issue preset (e.g. Steering Alignment / Radiator Hose)"
                  value={newMaintLabel}
                  onChange={e => setNewMaintLabel(e.target.value)}
                  className="flex-1 py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newMaintLabel.trim()) return;
                    const id = newMaintLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
                    setMaintSuggestions(prev => [...prev, { id: id || 'custom_' + Date.now(), label: newMaintLabel.trim(), icon: '🔧' }]);
                    setNewMaintLabel('');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition shrink-0"
                >
                  + Add Issue Preset
                </button>
              </div>
            </div>

            {/* Driver Fuel Quick-Select Liter Presets */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Fuel className="w-5 h-5 text-emerald-400" /> Driver Fuel Quick-Select Liter Presets
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure the 1-tap liter chips available to drivers when requesting fuel advances (e.g. 50 L, 80 L, 100 L, 150 L, 200 L, 300 L).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFuelPresets([50, 80, 100, 150, 200, 300])}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer self-start sm:self-auto"
                >
                  Reset Defaults
                </button>
              </div>

              {/* Chips List with Remove buttons */}
              <div className="flex flex-wrap gap-2.5 items-center">
                {fuelPresets.map((lit, idx) => (
                  <div
                    key={idx}
                    className="px-3.5 py-2 bg-slate-800 border border-emerald-500/40 rounded-xl text-xs font-bold text-white flex items-center gap-2"
                  >
                    <span className="text-emerald-400 font-mono font-black">{lit} L</span>
                    <button
                      type="button"
                      onClick={() => setFuelPresets(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-400 font-bold text-xs cursor-pointer"
                      title="Remove preset"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new preset input */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="Enter liters (e.g. 250)"
                  value={newPresetLiters}
                  onChange={e => setNewPresetLiters(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPreset();
                    }
                  }}
                  className="py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white w-48 font-mono focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleAddPreset}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer"
                >
                  + Add Liter Preset
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/25 flex items-center gap-2 touch-btn cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading ? t('saving', 'Saving...') : 'Save All Suggestions & Presets'}
            </button>
          </form>
        </div>
      )}

      {/* ================= MODAL: CHANGE DRIVER PASSWORD ================= */}
      {passwordModal.open && passwordModal.driver && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Change Password: {passwordModal.driver.full_name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {passwordModal.driver.driver_number} • {passwordModal.driver.email || 'driver'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModal(prev => ({ ...prev, open: false }))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePasswordSubmit} className="p-5 space-y-4">
              {passwordModal.error && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-300 text-xs rounded-xl">
                  {passwordModal.error}
                </div>
              )}

              {passwordModal.success && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {passwordModal.success}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Enter New Password:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Enter new password (min 4 characters)"
                    value={passwordModal.newPassword}
                    onChange={e => setPasswordModal(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full py-2.5 pl-3 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 block">Quick 1-Click Password Options:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModal(prev => ({ ...prev, newPassword: 'driver123' }))}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-xs rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Reset to "driver123"
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const rnd = 'drv' + Math.floor(1000 + Math.random() * 9000);
                      setPasswordModal(prev => ({ ...prev, newPassword: rnd }));
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Generate Random (e.g. drv7429)
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPasswordModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordModal.submitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 touch-btn"
                >
                  <Key className="w-3.5 h-3.5" />
                  {passwordModal.submitting ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT / REGISTER DRIVER PROFILE ================= */}
      {editDriverModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
                  {editDriverModal.isNew ? <UserPlus className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editDriverModal.isNew ? 'Register New Driver Account' : `Edit Driver: ${editDriverModal.full_name}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editDriverModal.isNew 
                      ? 'Create driver credentials with @sino.com username and phone login' 
                      : 'Update credentials, phone number, vehicle assignment, and license'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditDriverModal(prev => ({ ...prev, open: false }))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveDriverProfile} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {editDriverModal.error && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editDriverModal.error}</span>
                </div>
              )}

              {editDriverModal.success && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{editDriverModal.success}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {/* Full Legal Name */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">
                    Full Legal Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abebe Kebede / Driver Name"
                    value={editDriverModal.full_name}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                  />
                </div>

                {/* Username / Email with @sino.com indicator */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    SINO Username / Email <span className="text-amber-400 font-mono text-[11px]">(Named after SINO)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. name@sino.com or name"
                      value={editDriverModal.email}
                      onChange={e => setEditDriverModal(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-amber-300 font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Suffix <strong className="text-amber-400 font-mono">@sino.com</strong> will be automatically added if omitted.
                  </span>
                </div>

                {/* Phone Number (For Phone Login) */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>Phone Number</span>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                      <Phone className="w-3 h-3" /> Login Enabled
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +251 911 555 101 or 0911555101"
                    value={editDriverModal.phone}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Driver can log in using either this phone number or their @sino.com username.
                  </span>
                </div>

                {/* Password / New Password */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">
                    {editDriverModal.isNew ? 'Account Password' : 'Change / Reset Password (leave as is to keep)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. driver123"
                      value={editDriverModal.password}
                      onChange={e => setEditDriverModal(prev => ({ ...prev, password: e.target.value }))}
                      className="flex-1 py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-emerald-400 font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setEditDriverModal(prev => ({ ...prev, password: 'driver123' }))}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 cursor-pointer shrink-0"
                    >
                      "driver123"
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rnd = 'drv' + Math.floor(1000 + Math.random() * 9000);
                        setEditDriverModal(prev => ({ ...prev, password: rnd }));
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs rounded-xl border border-slate-700 cursor-pointer shrink-0"
                    >
                      Random
                    </button>
                  </div>
                </div>

                {/* License Number */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Driver License Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DL-90214-ET"
                    value={editDriverModal.license_number}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, license_number: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* License Expiry */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    License Expiry Date
                  </label>
                  <input
                    type="date"
                    value={editDriverModal.license_expiry}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, license_expiry: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Assigned Truck */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Assigned Fleet Truck
                  </label>
                  <select
                    value={editDriverModal.assigned_truck_id}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, assigned_truck_id: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- No Truck Assigned --</option>
                    {trucks.map(trk => (
                      <option key={trk.id} value={trk.id}>
                        {trk.plate_number} {trk.model ? `(${trk.model})` : ''} - {trk.truck_number || ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={editDriverModal.status}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-semibold"
                  >
                    <option value="active">Active (Can Login & Drive)</option>
                    <option value="inactive">Inactive / Suspended</option>
                  </select>
                </div>

                {/* Internal Notes */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">
                    Notes / Emergency Contact
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Emergency contacts, medical notes, or comments..."
                    value={editDriverModal.notes}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditDriverModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editDriverModal.submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 touch-btn"
                >
                  <Save className="w-4 h-4" />
                  {editDriverModal.submitting ? 'Saving...' : editDriverModal.isNew ? 'Create Driver' : 'Save Driver Information'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
