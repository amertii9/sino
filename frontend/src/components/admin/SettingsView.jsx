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
  Wrench,
  MapPin
} from 'lucide-react';

const DEFAULT_TRANSIT_SUGGESTIONS = [
  { id: 'kality_hub', name: 'Kality Weigh Station & Hub', location: 'Addis Ababa South Gate', suggested_rate_per_ton: 350, suggested_rate_per_quintal: 35, suggested_rate_per_kg: 0.35, suggested_lump_sum: 8500, default_pricing_method: 'per_ton', notes: 'Intermediate weighbridge & staging offload' },
  { id: 'modjo_toll', name: 'Modjo Expressway Toll Plaza', location: 'Modjo Junction', suggested_rate_per_ton: 420, suggested_rate_per_quintal: 42, suggested_rate_per_kg: 0.42, suggested_lump_sum: 11000, default_pricing_method: 'per_ton', notes: 'Expressway interchange distribution point' },
  { id: 'dukem_scale', name: 'Dukem Weighbridge Scale', location: 'Dukem Industrial Zone', suggested_rate_per_ton: 300, suggested_rate_per_quintal: 30, suggested_rate_per_kg: 0.30, suggested_lump_sum: 7500, default_pricing_method: 'per_ton', notes: 'Industrial park partial offload site' },
];

const DEFAULT_DESTINATION_SUGGESTIONS = [
  { id: 'bole_lemi', name: 'Bole Lemi Industrial Park Project', location: 'Bole Lemi Phase 2, Addis Ababa', suggested_rate_per_ton: 480, suggested_rate_per_quintal: 48, suggested_rate_per_kg: 0.48, suggested_lump_sum: 12000, default_pricing_method: 'per_ton', notes: 'Addis Ababa southern industrial cluster' },
  { id: 'ring_road', name: 'Addis Ababa Ring Road Corridor', location: 'Gotera to Kality Section', suggested_rate_per_ton: 520, suggested_rate_per_quintal: 52, suggested_rate_per_kg: 0.52, suggested_lump_sum: 13000, default_pricing_method: 'per_ton', notes: 'Capital ring road infrastructure extension' },
  { id: 'cbe_hq', name: 'Commercial Bank HQ Site', location: 'Ras Desta Damtew St, Addis Ababa', suggested_rate_per_ton: 550, suggested_rate_per_quintal: 55, suggested_rate_per_kg: 0.55, suggested_lump_sum: 14000, default_pricing_method: 'per_ton', notes: 'City center heavy building construction site' },
];

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

const DEFAULT_WELCOME_SUGGESTIONS = [
  {
    id: 'safety_inspection',
    title: '🛡️ Safety & Vehicle Inspection',
    badge: 'Safety Priority',
    message: 'Drive safely! Inspect your truck, check tire pressures, and confirm cargo documentation before departure.',
  },
  {
    id: 'optimal_speed',
    title: '⚡ Optimal Speed & Expressways',
    badge: 'Operations',
    message: 'Welcome to today\'s shift! Maintain optimal speed, drive cautiously on expressways, and report all transit stops promptly.',
  },
  {
    id: 'weather_warning',
    title: '🌧️ Weather & Route Advisory',
    badge: 'Weather Advisory',
    message: 'Caution on wet roads & steep gradients: Ensure your windshield wipers, headlights, and brakes are tested before departing.',
  },
  {
    id: 'motivation_greeting',
    title: '⭐ Fleet Motivation & Gratitude',
    badge: 'Team Motivation',
    message: 'Welcome back, captain! Your hard work and vigilance power our fleet. Let\'s make today safe, productive, and profitable!',
  },
  {
    id: 'fuel_conservation',
    title: '⛽ Smooth Driving & Fuel Conservation',
    badge: 'Efficiency',
    message: 'Good morning! Practice smooth acceleration and minimize idle engine run times to conserve diesel and protect vehicle health.',
  },
];

export const SettingsView = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'drivers' | 'suggestions'

  // General Settings State
  const [formData, setFormData] = useState({
    company_name: 'Horn Logistics & Hauling Fleet PLC',
    currency: 'ETB',
    default_unit: 'quintal',
    company_phone: '+251 911 234 567',
    company_email: 'operations@hornfleet.com',
    diesel_price: 100,
    driver_welcome_message: 'Drive safely! Inspect your truck, check tire pressures, and confirm cargo documentation before departure.',
  });

  const [welcomeSuggestions, setWelcomeSuggestions] = useState(DEFAULT_WELCOME_SUGGESTIONS);
  const [newWelcomeSuggestionText, setNewWelcomeSuggestionText] = useState('');

  // Suggestions State
  const [feeSuggestions, setFeeSuggestions] = useState(DEFAULT_FEE_SUGGESTIONS);
  const [fuelPresets, setFuelPresets] = useState([50, 80, 100, 150, 200, 300]);
  const [newPresetLiters, setNewPresetLiters] = useState('');
  const [maintSuggestions, setMaintSuggestions] = useState(DEFAULT_MAINT_SUGGESTIONS);
  const [newMaintLabel, setNewMaintLabel] = useState('');
  const [transitSuggestions, setTransitSuggestions] = useState(DEFAULT_TRANSIT_SUGGESTIONS);
  const [newTransitForm, setNewTransitForm] = useState({
    name: '',
    location: '',
    suggested_rate_per_ton: '',
    suggested_rate_per_quintal: '',
    suggested_rate_per_kg: '',
    suggested_lump_sum: '',
    default_pricing_method: 'per_quintal',
    notes: '',
  });

  const [destinationSuggestions, setDestinationSuggestions] = useState(DEFAULT_DESTINATION_SUGGESTIONS);
  const [newDestinationForm, setNewDestinationForm] = useState({
    name: '',
    location: '',
    suggested_rate_per_ton: '',
    suggested_rate_per_quintal: '',
    suggested_rate_per_kg: '',
    suggested_lump_sum: '',
    default_pricing_method: 'per_ton',
    notes: '',
  });

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
        if (res?.company_name) {
          setFormData(prev => ({
            ...prev,
            ...res,
            driver_welcome_message: res.driver_welcome_message !== undefined ? res.driver_welcome_message : prev.driver_welcome_message
          }));
        }
        if (res?.welcome_message_suggestions && res.welcome_message_suggestions.length > 0) {
          const mapped = res.welcome_message_suggestions.map((s, i) => {
            if (typeof s === 'object') return s;
            return {
              id: `api_welcome_${i}`,
              title: `Template #${i + 1}`,
              badge: 'Saved Template',
              message: s,
            };
          });
          setWelcomeSuggestions(mapped);
        }
        if (res?.fee_suggestions && res.fee_suggestions.length > 0) {
          setFeeSuggestions(res.fee_suggestions);
        }
        if (res?.fuel_liters_presets && res.fuel_liters_presets.length > 0) {
          setFuelPresets(res.fuel_liters_presets);
        }
        if (res?.maintenance_suggestions && res.maintenance_suggestions.length > 0) {
          setMaintSuggestions(res.maintenance_suggestions);
        }
        if (res?.transit_point_suggestions && res.transit_point_suggestions.length > 0) {
          setTransitSuggestions(res.transit_point_suggestions);
        }
        if (res?.destination_rate_suggestions && res.destination_rate_suggestions.length > 0) {
          setDestinationSuggestions(res.destination_rate_suggestions);
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

      const validTransitSuggestions = transitSuggestions
        .filter(t => t.name && t.name.trim())
        .map(t => {
          const tonRate = parseFloat(t.suggested_rate_per_ton) || 0;
          return {
            id: t.id || t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30),
            name: t.name.trim(),
            location: (t.location || '').trim(),
            suggested_rate_per_ton: tonRate,
            suggested_rate_per_quintal: parseFloat(t.suggested_rate_per_quintal) || (tonRate > 0 ? +(tonRate / 10).toFixed(2) : 0),
            suggested_rate_per_kg: parseFloat(t.suggested_rate_per_kg) || (tonRate > 0 ? +(tonRate / 1000).toFixed(3) : 0),
            suggested_lump_sum: parseFloat(t.suggested_lump_sum) || 0,
            default_pricing_method: t.default_pricing_method || 'per_ton',
            notes: (t.notes || '').trim(),
          };
        });

      const validDestSuggestions = destinationSuggestions
        .filter(d => d.name && d.name.trim())
        .map(d => {
          const tonRate = parseFloat(d.suggested_rate_per_ton) || 0;
          return {
            id: d.id || d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30),
            name: d.name.trim(),
            location: (d.location || '').trim(),
            suggested_rate_per_ton: tonRate,
            suggested_rate_per_quintal: parseFloat(d.suggested_rate_per_quintal) || (tonRate > 0 ? +(tonRate / 10).toFixed(2) : 0),
            suggested_rate_per_kg: parseFloat(d.suggested_rate_per_kg) || (tonRate > 0 ? +(tonRate / 1000).toFixed(3) : 0),
            suggested_lump_sum: parseFloat(d.suggested_lump_sum) || 0,
            default_pricing_method: d.default_pricing_method || 'per_ton',
            notes: (d.notes || '').trim(),
          };
        });

      await api.put('/settings', {
        ...formData,
        fee_suggestions: validSuggestions,
        fuel_liters_presets: validPresets,
        maintenance_suggestions: maintSuggestions,
        transit_point_suggestions: validTransitSuggestions,
        destination_rate_suggestions: validDestSuggestions,
        welcome_message_suggestions: welcomeSuggestions.map(s => typeof s === 'string' ? s : s.message),
      });

      window.dispatchEvent(new CustomEvent('maintenance-suggestions-updated'));
      window.dispatchEvent(new CustomEvent('transit-suggestions-updated'));
      window.dispatchEvent(new CustomEvent('destination-suggestions-updated'));
      window.dispatchEvent(new CustomEvent('welcome-message-updated'));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWelcomeSuggestion = async (indexToDelete) => {
    const updated = welcomeSuggestions.filter((_, idx) => idx !== indexToDelete);
    setWelcomeSuggestions(updated);
    try {
      await api.put('/settings', {
        ...formData,
        fee_suggestions: feeSuggestions.filter(f => f.name && f.name.trim() && parseFloat(f.amount) > 0),
        fuel_liters_presets: fuelPresets,
        maintenance_suggestions: maintSuggestions,
        transit_point_suggestions: transitSuggestions,
        destination_rate_suggestions: destinationSuggestions,
        welcome_message_suggestions: updated.map(s => typeof s === 'string' ? s : s.message),
      });
      window.dispatchEvent(new CustomEvent('welcome-message-updated'));
    } catch (err) {
      console.error('Failed to sync deleted welcome template:', err);
    }
  };

  const handleResetWelcomeSuggestions = async () => {
    setWelcomeSuggestions(DEFAULT_WELCOME_SUGGESTIONS);
    try {
      await api.put('/settings', {
        ...formData,
        fee_suggestions: feeSuggestions.filter(f => f.name && f.name.trim() && parseFloat(f.amount) > 0),
        fuel_liters_presets: fuelPresets,
        maintenance_suggestions: maintSuggestions,
        transit_point_suggestions: transitSuggestions,
        destination_rate_suggestions: destinationSuggestions,
        welcome_message_suggestions: DEFAULT_WELCOME_SUGGESTIONS.map(s => s.message),
      });
      window.dispatchEvent(new CustomEvent('welcome-message-updated'));
    } catch (err) {
      console.error('Failed to reset welcome templates:', err);
    }
  };

  const handleAddWelcomeSuggestion = async (msgText) => {
    const trimmed = (msgText || newWelcomeSuggestionText).trim();
    if (!trimmed) return;
    const newSug = {
      id: `custom_${Date.now()}`,
      title: '📝 Custom Template',
      badge: 'Custom',
      message: trimmed,
    };
    const updated = [...welcomeSuggestions, newSug];
    setWelcomeSuggestions(updated);
    setFormData(prev => ({ ...prev, driver_welcome_message: trimmed }));
    setNewWelcomeSuggestionText('');
    try {
      await api.put('/settings', {
        ...formData,
        driver_welcome_message: trimmed,
        fee_suggestions: feeSuggestions.filter(f => f.name && f.name.trim() && parseFloat(f.amount) > 0),
        fuel_liters_presets: fuelPresets,
        maintenance_suggestions: maintSuggestions,
        transit_point_suggestions: transitSuggestions,
        destination_rate_suggestions: destinationSuggestions,
        welcome_message_suggestions: updated.map(s => typeof s === 'string' ? s : s.message),
      });
      window.dispatchEvent(new CustomEvent('welcome-message-updated'));
    } catch (err) {
      console.error('Failed to sync added welcome template:', err);
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
                <span className="font-bold text-slate-200 block text-xs">{t('official_fleet_logo')}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('active_logo_loaded')} <span className="font-mono text-amber-400">{t('ph_logo_file_example')}</span>, applied across the navigation bar, login screen, and driver portal.</p>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">{t('company_operator_name')}</label>
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
                <label className="block text-slate-300 mb-1 font-semibold">{t('operating_currency')}</label>
                <select
                  value={formData.currency}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                >
                  <option value="ETB">{t('etb_currency_label')}</option>
                  <option value="USD">{t('usd_currency_label')}</option>
                  <option value="EUR">{t('eur_currency_label')}</option>
                  <option value="KES">{t('kes_currency_label')}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('default_measure_unit')}</label>
                <select
                  value={formData.default_unit}
                  onChange={e => setFormData({ ...formData, default_unit: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="ton">{t('metric_ton_label')}</option>
                  <option value="quintal">{t('quintal_label')}</option>
                  <option value="kg">{t('kilogram_label')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('support_phone_label')}</label>
                <input
                  type="text"
                  value={formData.company_phone}
                  onChange={e => setFormData({ ...formData, company_phone: e.target.value })}
                  className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('operations_email_label')}</label>
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
                <span className="text-slate-400 text-xs shrink-0">{t('used_auto_fuel_estimation')}</span>
              </div>
            </div>

            {/* Driver Welcome & Safety Announcement Message */}
            <div className="p-4 sm:p-5 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-700/70">
                <div>
                  <label className="font-bold text-slate-100 block text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" /> {t('driver_welcome_heading', 'Driver Welcome Message & Daily Dispatch Briefing')}
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t('driver_welcome_sub', 'Broadcast a welcome message or safety reminder to drivers when they log into their portal. Select from suggested templates below or compose your own custom announcement.')}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 self-start sm:self-auto shrink-0">
                  {t('driver_ui_live_badge', 'Live on Driver Portal')}
                </span>
              </div>

              {/* Active Message Textarea */}
              <div>
                <textarea
                  rows={3}
                  value={formData.driver_welcome_message || ''}
                  onChange={e => setFormData({ ...formData, driver_welcome_message: e.target.value })}
                  placeholder={t('driver_welcome_ph', 'Write a custom welcome greeting, safety directive, or shift advisory for drivers...')}
                  className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs leading-relaxed focus:outline-none focus:border-amber-400 placeholder:text-slate-500 resize-none font-medium"
                />
              </div>

              {/* Quick Suggestion Templates */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    ⚡ {t('suggested_templates_label', 'Suggested Welcome Message Templates:')}
                    <span className="text-[10px] text-slate-400 font-normal">({welcomeSuggestions.length})</span>
                  </span>
                  <div className="flex items-center gap-2.5 text-[11px]">
                    <button
                      type="button"
                      onClick={handleResetWelcomeSuggestions}
                      className="text-xs text-slate-400 hover:text-amber-400 transition cursor-pointer underline font-medium"
                      title={t('reset_defaults', 'Restore original suggested presets')}
                    >
                      {t('reset_defaults', 'Reset Defaults')}
                    </button>
                    <span className="text-[10px] text-slate-400">
                      • {t('click_to_apply', 'Tap card to apply')}
                    </span>
                  </div>
                </div>

                {welcomeSuggestions.length === 0 ? (
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400">
                    No suggested templates remaining.{' '}
                    <button
                      type="button"
                      onClick={handleResetWelcomeSuggestions}
                      className="text-amber-400 hover:underline font-bold cursor-pointer"
                    >
                      Click here to reset defaults
                    </button>{' '}
                    or type a message below.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {welcomeSuggestions.map((sug, idx) => {
                      const text = typeof sug === 'string' ? sug : sug.message;
                      const title = typeof sug === 'string' ? `Template #${idx + 1}` : sug.title;
                      const badge = typeof sug === 'string' ? 'Suggested' : sug.badge;
                      const isSelected = formData.driver_welcome_message === text;

                      return (
                        <div
                          key={idx}
                          onClick={() => setFormData({ ...formData, driver_welcome_message: text })}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group relative ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500/80 text-white shadow-sm ring-1 ring-amber-500/40'
                              : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-xs text-amber-400 group-hover:text-amber-300 flex items-center gap-1">
                              {title}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                {badge}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWelcomeSuggestion(idx);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                                title={t('delete_template', 'Delete this suggested template')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            "{text}"
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add New Custom Suggested Template */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-700/60">
                <input
                  type="text"
                  placeholder={t('add_custom_welcome_ph', 'Add a new suggested welcome message to the template bank...')}
                  value={newWelcomeSuggestionText}
                  onChange={e => setNewWelcomeSuggestionText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddWelcomeSuggestion();
                    }
                  }}
                  className="flex-1 py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddWelcomeSuggestion()}
                  className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                >
                  + Add Template
                </button>
              </div>

              {/* Live Driver Preview Box */}
              {formData.driver_welcome_message && (
                <div className="pt-2 border-t border-slate-700/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    📱 Live Preview (Driver Dashboard Banner):
                  </span>
                  <div className="p-3 bg-slate-900 rounded-xl border border-amber-500/30 flex items-start gap-2.5 text-xs shadow-inner">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-0.5">
                        Company Dispatch Notice
                      </div>
                      <p className="text-slate-200 leading-relaxed font-medium">
                        {formData.driver_welcome_message}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Credentials Info */}
            <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-1">
              <span className="font-bold text-amber-400 block text-xs flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> System Administrator Username
              </span>
              <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-1">
                <span>{t('admin_login_label')}</span>
                <strong className="text-white font-mono bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">soneschool1@gmail.com</strong>
              </div>
            </div>

            {/* Numbering Standards Info */}
            <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-1 text-slate-400">
              <span className="font-bold text-slate-200 block text-xs">{t('auto_numbering_prefixes')}</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                <div>{t('trips_prefix_label')} <strong className="text-amber-400 font-mono block">{t('ph_trip_number_example')}</strong></div>
                <div>{t('fuel_requests_prefix_label')} <strong className="text-emerald-400 font-mono block">{t('ph_fuel_number_example')}</strong></div>
                <div>{t('expenses_prefix_label')} <strong className="text-red-400 font-mono block">{t('ph_expense_number_example')}</strong></div>
                <div>{t('maintenance_prefix_label')} <strong className="text-blue-400 font-mono block">{t('ph_maint_number_example')}</strong></div>
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
                    placeholder={t('search_name_phone_plate_ph')}
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
                          <span className="text-slate-400 text-[11px]">{t('sino_username_label')}</span>
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
                            <span className="text-slate-500 italic text-[11px]">{t('not_configured')}</span>
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
                          <span>{t('edit_full_info')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openChangePasswordModal(drv)}
                          className="py-2 px-3 bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-600 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{t('reset_password_btn')}</span>
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
                      placeholder={t('toll_modjo_ph')}
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
                          placeholder={t('amount_ph')}
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
                  placeholder={t('new_issue_preset_ph')}
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
                  placeholder={t('enter_liters_ph', 'Enter liters (e.g. 250)')}
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

            {/* Intermediate Transit Points & Multi-Drop Presets */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-amber-400" /> {t('intermediate_transit_points_presets', 'Intermediate Transit Points & Multi-Drop Presets')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('transit_presets_desc', 'Configure transit waypoints, partial offloading hubs, and baseline prices (rate per quintal/ton, lump sum). Drivers and dispatchers will be offered these suggested rates when offloading cargo at transition waypoints.')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTransitSuggestions(DEFAULT_TRANSIT_SUGGESTIONS)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              {/* Transit Points List */}
              <div className="space-y-3">
                {transitSuggestions.map((tp, idx) => (
                  <div key={tp.id || idx} className="p-3.5 bg-slate-850/80 rounded-2xl border border-slate-700/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('waypoint_name_label')}</label>
                          <input
                            type="text"
                            value={tp.name}
                            onChange={e => {
                              const updated = [...transitSuggestions];
                              updated[idx].name = e.target.value;
                              setTransitSuggestions(updated);
                            }}
                            className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold"
                            placeholder={t('waypoint_name_ph')}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('location_interchange_label')}</label>
                          <input
                            type="text"
                            value={tp.location || ''}
                            onChange={e => {
                              const updated = [...transitSuggestions];
                              updated[idx].location = e.target.value;
                              setTransitSuggestions(updated);
                            }}
                            className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                            placeholder={t('location_interchange_ph')}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTransitSuggestions(prev => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer self-end sm:self-center"
                        title="Remove transit point preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('rate_per_ton_label')}</label>
                        <input
                          type="number"
                          step="any"
                          value={tp.suggested_rate_per_ton || ''}
                          onChange={e => {
                            const updated = [...transitSuggestions];
                            const val = parseFloat(e.target.value) || 0;
                            updated[idx].suggested_rate_per_ton = val;
                            if (val > 0) {
                              updated[idx].suggested_rate_per_quintal = +(val / 10).toFixed(2);
                              updated[idx].suggested_rate_per_kg = +(val / 1000).toFixed(3);
                            }
                            setTransitSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono font-bold text-right"
                          placeholder="e.g. 350"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('rate_per_quintal_label')}</label>
                        <input
                          type="number"
                          step="any"
                          value={tp.suggested_rate_per_quintal || ''}
                          onChange={e => {
                            const updated = [...transitSuggestions];
                            updated[idx].suggested_rate_per_quintal = parseFloat(e.target.value) || 0;
                            setTransitSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-300 font-mono font-bold text-right"
                          placeholder={t('ph_number_35_example')}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('rate_per_kg_label')}</label>
                        <input
                          type="number"
                          step="any"
                          value={tp.suggested_rate_per_kg || ''}
                          onChange={e => {
                            const updated = [...transitSuggestions];
                            updated[idx].suggested_rate_per_kg = parseFloat(e.target.value) || 0;
                            setTransitSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-400 font-mono font-bold text-right"
                          placeholder="e.g. 0.35"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-amber-300 block font-semibold mb-0.5">{t('lump_sum_fixed_label')}</label>
                        <input
                          type="number"
                          step="any"
                          value={tp.suggested_lump_sum || ''}
                          onChange={e => {
                            const updated = [...transitSuggestions];
                            updated[idx].suggested_lump_sum = parseFloat(e.target.value) || 0;
                            setTransitSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-mono font-bold text-right"
                          placeholder="e.g. 8500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('calculation_method_label')}</label>
                        <select
                          value={tp.default_pricing_method || 'per_ton'}
                          onChange={e => {
                            const updated = [...transitSuggestions];
                            updated[idx].default_pricing_method = e.target.value;
                            setTransitSuggestions(updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-slate-200 font-bold"
                        >
                          <option value="per_ton">{t('per_ton_opt')}</option>
                          <option value="per_quintal">{t('per_quintal_opt')}</option>
                          <option value="per_kg">{t('per_kg_opt')}</option>
                          <option value="lump_sum">{t('lump_sum_opt')}</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={tp.notes || ''}
                        onChange={e => {
                          const updated = [...transitSuggestions];
                          updated[idx].notes = e.target.value;
                          setTransitSuggestions(updated);
                        }}
                        className="w-full py-1 px-3 bg-slate-900/60 border border-slate-700/60 rounded-xl text-[11px] text-slate-300"
                        placeholder={t('operational_notes_ph')}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Transit Point Preset Form */}
              <div className="p-4 bg-slate-800/60 rounded-2xl border border-dashed border-slate-700 space-y-3">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> {t('add_new_intermediate_transit_point', 'Add New Intermediate Transit Point & Offload Rate')}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder={t('ph_waypoint_name_input')}
                    value={newTransitForm.name}
                    onChange={e => setNewTransitForm(prev => ({ ...prev, name: e.target.value }))}
                    className="py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder={t('ph_waypoint_loc_input')}
                    value={newTransitForm.location}
                    onChange={e => setNewTransitForm(prev => ({ ...prev, location: e.target.value }))}
                    className="py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder={t('rate_ton_ph')}
                    value={newTransitForm.suggested_rate_per_ton}
                    onChange={e => {
                      const v = e.target.value;
                      const num = parseFloat(v) || 0;
                      setNewTransitForm(prev => ({
                        ...prev,
                        suggested_rate_per_ton: v,
                        suggested_rate_per_quintal: num > 0 ? (num / 10).toFixed(2) : prev.suggested_rate_per_quintal,
                        suggested_rate_per_kg: num > 0 ? (num / 1000).toFixed(3) : prev.suggested_rate_per_kg,
                      }));
                    }}
                    className="py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono text-right"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder={t('rate_quintal_ph')}
                    value={newTransitForm.suggested_rate_per_quintal}
                    onChange={e => setNewTransitForm(prev => ({ ...prev, suggested_rate_per_quintal: e.target.value }))}
                    className="py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-300 font-mono text-right"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder={t('rate_kg_ph')}
                    value={newTransitForm.suggested_rate_per_kg}
                    onChange={e => setNewTransitForm(prev => ({ ...prev, suggested_rate_per_kg: e.target.value }))}
                    className="py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-400 font-mono text-right"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder={t('lumpsum_etb_ph')}
                    value={newTransitForm.suggested_lump_sum}
                    onChange={e => setNewTransitForm(prev => ({ ...prev, suggested_lump_sum: e.target.value }))}
                    className="py-2 px-2.5 bg-slate-900 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-mono text-right"
                  />
                  <select
                    value={newTransitForm.default_pricing_method || 'per_quintal'}
                    onChange={e => setNewTransitForm(prev => ({ ...prev, default_pricing_method: e.target.value }))}
                    className="py-2 px-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                  >
                    <option value="per_quintal">{t('per_quintal_opt')}</option>
                    <option value="per_ton">{t('per_ton_opt')}</option>
                    <option value="per_kg">{t('per_kg_opt')}</option>
                    <option value="lump_sum">{t('lump_sum_type_badge')}</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('ph_waypoint_notes_input')}
                    value={newTransitForm.notes}
                    onChange={e => setNewTransitForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="flex-1 py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTransitForm.name.trim()) return;
                      const id = newTransitForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
                      const rateTon = parseFloat(newTransitForm.suggested_rate_per_ton) || 0;
                      setTransitSuggestions(prev => [
                        ...prev,
                        {
                          id: id || 'custom_tp_' + Date.now(),
                          name: newTransitForm.name.trim(),
                          location: newTransitForm.location.trim(),
                          suggested_rate_per_ton: rateTon,
                          suggested_rate_per_quintal: parseFloat(newTransitForm.suggested_rate_per_quintal) || (rateTon > 0 ? +(rateTon / 10).toFixed(2) : 0),
                          suggested_rate_per_kg: parseFloat(newTransitForm.suggested_rate_per_kg) || (rateTon > 0 ? +(rateTon / 1000).toFixed(3) : 0),
                          suggested_lump_sum: parseFloat(newTransitForm.suggested_lump_sum) || 0,
                          default_pricing_method: newTransitForm.default_pricing_method || 'per_quintal',
                          notes: newTransitForm.notes.trim(),
                        }
                      ]);
                      setNewTransitForm({
                        name: '',
                        location: '',
                        suggested_rate_per_ton: '',
                        suggested_rate_per_quintal: '',
                        suggested_rate_per_kg: '',
                        suggested_lump_sum: '',
                        default_pricing_method: 'per_ton',
                        notes: '',
                      });
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer transition shrink-0"
                  >
                    + Add Transit Preset
                  </button>
                </div>
              </div>
            </div>

            {/* Final Destination Delivery Rates (Alongside Intermediate Transit Rates) */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-400" /> Final Destination Delivery Rates
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure standard delivery rates (per ton, quintal, kg, and lump sum) for primary project endpoints. Drivers can compare these alongside intermediate drop-off rates.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDestinationSuggestions(DEFAULT_DESTINATION_SUGGESTIONS)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              {/* Destination Rates List */}
              <div className="space-y-3">
                {destinationSuggestions.map((ds, idx) => (
                  <div key={ds.id || idx} className="p-3.5 bg-slate-850/80 rounded-2xl border border-slate-700/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('destination_project_label')}</label>
                          <input
                            type="text"
                            value={ds.name}
                            onChange={e => {
                              const updated = [...destinationSuggestions];
                              updated[idx].name = e.target.value;
                              setDestinationSuggestions(updated);
                            }}
                            className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold"
                            placeholder={t('destination_project_ph')}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('location_zone_label')}</label>
                          <input
                            type="text"
                            value={ds.location || ''}
                            onChange={e => {
                              const updated = [...destinationSuggestions];
                              updated[idx].location = e.target.value;
                              setDestinationSuggestions(updated);
                            }}
                            className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                            placeholder={t('location_zone_ph')}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDestinationSuggestions(prev => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer self-end sm:self-center"
                        title="Remove destination preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('rate_per_ton_label')}</label>
                        <input
                          type="number"
                          step="any"
                          value={ds.suggested_rate_per_ton || ''}
                          onChange={e => {
                            const updated = [...destinationSuggestions];
                            const val = parseFloat(e.target.value) || 0;
                            updated[idx].suggested_rate_per_ton = val;
                            if (val > 0) {
                              updated[idx].suggested_rate_per_quintal = +(val / 10).toFixed(2);
                              updated[idx].suggested_rate_per_kg = +(val / 1000).toFixed(3);
                            }
                            setDestinationSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono font-bold text-right"
                          placeholder="e.g. 480"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('rate_per_quintal_label')}</label>
                        <input
                          type="number"
                          step="any"
                          value={ds.suggested_rate_per_quintal || ''}
                          onChange={e => {
                            const updated = [...destinationSuggestions];
                            updated[idx].suggested_rate_per_quintal = parseFloat(e.target.value) || 0;
                            setDestinationSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-300 font-mono font-bold text-right"
                          placeholder={t('ph_number_48_example')}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('rate_per_kg_label')}</label>
                        <input
                          type="number"
                          step="any"
                          value={ds.suggested_rate_per_kg || ''}
                          onChange={e => {
                            const updated = [...destinationSuggestions];
                            updated[idx].suggested_rate_per_kg = parseFloat(e.target.value) || 0;
                            setDestinationSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-400 font-mono font-bold text-right"
                          placeholder="e.g. 0.48"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-amber-300 block font-semibold mb-0.5">{t('lump_sum_fixed_label')}</label>
                        <input
                          type="number"
                          step="any"
                          value={ds.suggested_lump_sum || ''}
                          onChange={e => {
                            const updated = [...destinationSuggestions];
                            updated[idx].suggested_lump_sum = parseFloat(e.target.value) || 0;
                            setDestinationSuggestions(updated);
                          }}
                          className="w-full py-1.5 pr-2 pl-3 bg-slate-900 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-mono font-bold text-right"
                          placeholder="e.g. 12000"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold mb-0.5">{t('calculation_method_label')}</label>
                        <select
                          value={ds.default_pricing_method || 'per_ton'}
                          onChange={e => {
                            const updated = [...destinationSuggestions];
                            updated[idx].default_pricing_method = e.target.value;
                            setDestinationSuggestions(updated);
                          }}
                          className="w-full py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-slate-200 font-bold"
                        >
                          <option value="per_ton">{t('per_ton_opt')}</option>
                          <option value="per_quintal">{t('per_quintal_opt')}</option>
                          <option value="per_kg">{t('per_kg_opt')}</option>
                          <option value="lump_sum">{t('lump_sum_opt')}</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={ds.notes || ''}
                        onChange={e => {
                          const updated = [...destinationSuggestions];
                          updated[idx].notes = e.target.value;
                          setDestinationSuggestions(updated);
                        }}
                        className="w-full py-1 px-3 bg-slate-900/60 border border-slate-700/60 rounded-xl text-[11px] text-slate-300"
                        placeholder={t('ph_dest_ops_notes', 'Operational Notes (e.g. Final project offload site)')}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Destination Rate Form */}
              <div className="p-4 bg-slate-800/60 rounded-2xl border border-dashed border-slate-700 space-y-3">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> {t('add_new_final_dest_rate_preset', 'Add New Final Destination Rate Preset')}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder={t('ph_dest_site_name_input', 'Project Site Name (e.g. Hawassa Industrial Park)')}
                    value={newDestinationForm.name}
                    onChange={e => setNewDestinationForm(prev => ({ ...prev, name: e.target.value }))}
                    className="py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder={t('ph_dest_loc_zone_input', 'Location / Zone (e.g. Hawassa South)')}
                    value={newDestinationForm.location}
                    onChange={e => setNewDestinationForm(prev => ({ ...prev, location: e.target.value }))}
                    className="py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder={t('rate_ton_ph', 'Rate / Ton')}
                    value={newDestinationForm.suggested_rate_per_ton}
                    onChange={e => {
                      const v = e.target.value;
                      const num = parseFloat(v) || 0;
                      setNewDestinationForm(prev => ({
                        ...prev,
                        suggested_rate_per_ton: v,
                        suggested_rate_per_quintal: num > 0 ? (num / 10).toFixed(2) : prev.suggested_rate_per_quintal,
                        suggested_rate_per_kg: num > 0 ? (num / 1000).toFixed(3) : prev.suggested_rate_per_kg,
                      }));
                    }}
                    className="py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono text-right"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder={t('rate_quintal_ph', 'Rate / Quintal')}
                    value={newDestinationForm.suggested_rate_per_quintal}
                    onChange={e => setNewDestinationForm(prev => ({ ...prev, suggested_rate_per_quintal: e.target.value }))}
                    className="py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-300 font-mono text-right"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder={t('rate_kg_ph', 'Rate / KG')}
                    value={newDestinationForm.suggested_rate_per_kg}
                    onChange={e => setNewDestinationForm(prev => ({ ...prev, suggested_rate_per_kg: e.target.value }))}
                    className="py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-400 font-mono text-right"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder={t('lumpsum_etb_ph', 'Lump-Sum (ETB)')}
                    value={newDestinationForm.suggested_lump_sum}
                    onChange={e => setNewDestinationForm(prev => ({ ...prev, suggested_lump_sum: e.target.value }))}
                    className="py-2 px-2.5 bg-slate-900 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-mono text-right"
                  />
                  <select
                    value={newDestinationForm.default_pricing_method || 'per_ton'}
                    onChange={e => setNewDestinationForm(prev => ({ ...prev, default_pricing_method: e.target.value }))}
                    className="py-2 px-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                  >
                    <option value="per_ton">{t('per_ton_opt', 'Per Ton')}</option>
                    <option value="per_quintal">{t('per_quintal_opt', 'Per Quintal')}</option>
                    <option value="per_kg">{t('per_kg_opt', 'Per KG')}</option>
                    <option value="lump_sum">{t('lump_sum_type_badge', 'Lump-Sum')}</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('notes_delivery_gate_ph', 'Notes (e.g. Primary delivery gate)')}
                    value={newDestinationForm.notes}
                    onChange={e => setNewDestinationForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="flex-1 py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newDestinationForm.name.trim()) return;
                      const id = newDestinationForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
                      const rateTon = parseFloat(newDestinationForm.suggested_rate_per_ton) || 0;
                      setDestinationSuggestions(prev => [
                        ...prev,
                        {
                          id: id || 'custom_dest_' + Date.now(),
                          name: newDestinationForm.name.trim(),
                          location: newDestinationForm.location.trim(),
                          suggested_rate_per_ton: rateTon,
                          suggested_rate_per_quintal: parseFloat(newDestinationForm.suggested_rate_per_quintal) || (rateTon > 0 ? +(rateTon / 10).toFixed(2) : 0),
                          suggested_rate_per_kg: parseFloat(newDestinationForm.suggested_rate_per_kg) || (rateTon > 0 ? +(rateTon / 1000).toFixed(3) : 0),
                          suggested_lump_sum: parseFloat(newDestinationForm.suggested_lump_sum) || 0,
                          default_pricing_method: newDestinationForm.default_pricing_method || 'per_ton',
                          notes: newDestinationForm.notes.trim(),
                        }
                      ]);
                      setNewDestinationForm({
                        name: '',
                        location: '',
                        suggested_rate_per_ton: '',
                        suggested_rate_per_quintal: '',
                        suggested_rate_per_kg: '',
                        suggested_lump_sum: '',
                        default_pricing_method: 'per_ton',
                        notes: '',
                      });
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition shrink-0"
                  >
                    {t('add_dest_preset_btn', '+ Add Destination Preset')}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/25 flex items-center gap-2 touch-btn cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading ? t('saving', 'Saving...') : t('save_all_suggestions_presets', 'Save All Suggestions & Presets')}
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
                    {t('change_driver_password_title', 'Change Password')}: {passwordModal.driver.full_name}
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
                  {t('enter_new_password_label', 'Enter New Password:')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={t('enter_new_password_ph', 'Enter new password (min 4 characters)')}
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
                <span className="text-[11px] font-semibold text-slate-400 block">{t('quick_password_options', 'Quick 1-Click Password Options:')}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModal(prev => ({ ...prev, newPassword: 'driver123' }))}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-xs rounded-lg border border-slate-700 cursor-pointer"
                  >
                    {t('reset_to_driver123', 'Reset to "driver123"')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const rnd = 'drv' + Math.floor(1000 + Math.random() * 9000);
                      setPasswordModal(prev => ({ ...prev, newPassword: rnd }));
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs rounded-lg border border-slate-700 cursor-pointer"
                  >
                    {t('generate_random_pwd', 'Generate Random (e.g. drv7429)')}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPasswordModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={passwordModal.submitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 touch-btn"
                >
                  <Key className="w-3.5 h-3.5" />
                  {passwordModal.submitting ? t('updating', 'Updating...') : t('save_password_btn', 'Save Password')}
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
                    {editDriverModal.isNew ? t('register_driver_account', 'Register New Driver Account') : `${t('edit_driver', 'Edit Driver')}: ${editDriverModal.full_name}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editDriverModal.isNew 
                      ? t('create_driver_sub', 'Create driver credentials with @sino.com username and phone login')
                      : t('update_driver_sub', 'Update credentials, phone number, vehicle assignment, and license')}
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
                    {t('legal_full_name', 'Full Legal Name')} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('driver_name_sample_ph', 'e.g. Abebe Kebede / Driver Name')}
                    value={editDriverModal.full_name}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                  />
                </div>

                {/* Username / Email with @sino.com indicator */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {t('sino_username_email', 'SINO Username / Email')} <span className="text-amber-400 font-mono text-[11px]">({t('named_after_sino', 'Named after SINO')})</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('driver_email_sample_ph', 'e.g. name@sino.com or name')}
                      value={editDriverModal.email}
                      onChange={e => setEditDriverModal(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-amber-300 font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('sino_suffix_hint', 'Suffix @sino.com will be automatically added if omitted.')}
                  </span>
                </div>

                {/* Phone Number (For Phone Login) */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>{t('phone_number_label', 'Phone Number')}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                      <Phone className="w-3 h-3" /> {t('login_enabled', 'Login Enabled')}
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('phone_sample_ph', 'e.g. +251 911 555 101 or 0911555101')}
                    value={editDriverModal.phone}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {t('driver_phone_login_desc', 'Driver can log in using either this phone number or their @sino.com username.')}
                  </span>
                </div>

                {/* Password / New Password */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">
                    {editDriverModal.isNew ? t('account_password_label', 'Account Password') : t('change_pwd_keep_label', 'Change / Reset Password (leave as is to keep)')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('driver_pwd_sample_ph', 'e.g. driver123')}
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
                      {t('random_pwd_btn', 'Random')}
                    </button>
                  </div>
                </div>

                {/* License Number */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {t('driver_license_num_label', 'Driver License Number')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('license_number_ph', 'DL-AA-123456')}
                    value={editDriverModal.license_number}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, license_number: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* License Expiry */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {t('license_expiry_date_label', 'License Expiry Date')}
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
                    {t('assigned_fleet_truck_label', 'Assigned Fleet Truck')}
                  </label>
                  <select
                    value={editDriverModal.assigned_truck_id}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, assigned_truck_id: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- {t('no_truck_assigned', 'No Truck Assigned')} --</option>
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
                    {t('account_status_label', 'Account Status')}
                  </label>
                  <select
                    value={editDriverModal.status}
                    onChange={e => setEditDriverModal(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-semibold"
                  >
                    <option value="active">{t('active_can_drive_opt', 'Active (Can Login & Drive)')}</option>
                    <option value="inactive">{t('inactive_suspended', 'Inactive / Suspended')}</option>
                  </select>
                </div>

                {/* Internal Notes */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">
                    {t('notes_emergency_contact_label', 'Notes / Emergency Contact')}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('notes_comments_ph', 'Emergency contacts, medical notes, or comments...')}
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
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editDriverModal.submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 touch-btn"
                >
                  <Save className="w-4 h-4" />
                  {editDriverModal.submitting ? t('saving', 'Saving...') : editDriverModal.isNew ? t('create_driver_btn', 'Create Driver') : t('save_driver_info_btn', 'Save Driver Information')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
