import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Route,
  Plus,
  ArrowRight,
  Sparkles,
  MapPin,
  Edit,
  Trash2,
  Package,
  Layers,
  Navigation,
  CheckCircle2,
  Zap,
  RefreshCw,
  Search,
  Building,
  Scale
} from 'lucide-react';

export const RoutesPricing = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('routes'); // 'routes', 'loading', 'dumping', 'materials', 'transition'

  // Master Data States
  const [routes, setRoutes] = useState([]);
  const [loadingSites, setLoadingSites] = useState([]);
  const [dumpingSites, setDumpingSites] = useState([]);
  const [transitionPoints, setTransitionPoints] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Route Pricing Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [formData, setFormData] = useState({
    loading_site_id: '',
    dumping_site_id: '',
    transition_point_ids: [],
    material_id: '',
    default_price: 450,
    pricing_method: 'per_quintal',
  });

  // Inline Quick Suggestion Loggers in Route Modal
  const [inlineLoading, setInlineLoading] = useState({ open: false, name: '', location: '' });
  const [inlineDumping, setInlineDumping] = useState({ open: false, name: '', location: '' });
  const [inlineTransit, setInlineTransit] = useState({ open: false, name: '', location: '' });
  const [inlineMaterial, setInlineMaterial] = useState({ open: false, name: '', default_unit: 'quintal', default_price: 450 });

  // Suggestion Modal States (Sites & Materials)
  const [siteModal, setSiteModal] = useState({
    open: false,
    type: 'loading', // 'loading', 'dumping', 'transition'
    site: null,
    form: { name: '', location: '', description: '' },
  });

  const [materialModal, setMaterialModal] = useState({
    open: false,
    material: null,
    form: { name: '', default_unit: 'quintal', default_price: 450, description: '' },
  });

  // Presets for Quick 1-Click Logging
  const loadingPresets = [
    { name: 'Quarry A (Awash River Basin)', location: 'Awash Basin Mile 42' },
    { name: 'Mojo Sand Extraction Pit', location: 'Mojo River Road km 8' },
    { name: 'Modjo Stone Crushing Plant', location: 'Modjo Industrial Gate 3' },
    { name: 'Oromia Aggregate Quarry', location: 'Dukem Quarry Zone' },
    { name: 'Dukem Basalt Quarry', location: 'Dukem Mile 12' },
  ];

  const dumpingPresets = [
    { name: 'Bole Lemi Industrial Park Project', location: 'Bole Lemi Phase 2, Addis Ababa' },
    { name: 'Addis Ababa Ring Road Corridor', location: 'Gotera to Kality Section' },
    { name: 'Commercial Bank HQ Site', location: 'Ras Desta Damtew St, Addis Ababa' },
    { name: 'Kality Depot & Staging Yard', location: 'Kality Ring Road' },
    { name: 'Adama Expressway Project', location: 'Adama Outer Ring' },
  ];

  const materialPresets = [
    { name: 'River Sand', default_unit: 'ton', default_price: 450 },
    { name: 'Crushed Aggregate (02)', default_unit: 'ton', default_price: 580 },
    { name: 'Selected Sub-base Soil', default_unit: 'ton', default_price: 380 },
    { name: 'Round Gravel', default_unit: 'ton', default_price: 520 },
    { name: 'Cement Bags (PPC 42.5)', default_unit: 'quintal', default_price: 1100 },
  ];

  const transitPresets = [
    { name: 'Kality Weigh Station & Hub', location: 'Kality Axle Scale Checkpoint' },
    { name: 'Modjo Expressway Toll Plaza', location: 'Modjo Toll Gate km 0' },
    { name: 'Dukem Weighbridge Scale', location: 'Dukem Checkpoint' },
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, l, d, t, m] = await Promise.all([
        api.get('/routes'),
        api.get('/sites?type=loading'),
        api.get('/sites?type=dumping'),
        api.get('/sites?type=transition'),
        api.get('/materials'),
      ]);
      setRoutes(r || []);
      setLoadingSites(l || []);
      setDumpingSites(d || []);
      setTransitionPoints(t || []);
      setMaterials(m || []);
    } catch (err) {
      console.error('Failed to load routes and suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick 1-click Preset Adder
  const handleQuickAddSite = async (type, item) => {
    try {
      await api.post('/sites', {
        name: item.name,
        location: item.location || '',
        type,
        description: 'Logged from suggested standard presets',
      });
      await loadData();
    } catch (err) {
      alert('Failed to log suggestion: ' + err.message);
    }
  };

  const handleQuickAddMaterial = async (item) => {
    try {
      await api.post('/materials', {
        name: item.name,
        default_unit: item.default_unit || 'ton',
        default_price: item.default_price || 0,
        description: 'Logged from suggested material presets',
      });
      await loadData();
    } catch (err) {
      alert('Failed to log material: ' + err.message);
    }
  };

  const handleQuickSetupAll = async () => {
    if (!confirm(t('confirm_populate_hauling_suggestions', 'Populate standard recommended hauling suggestions (Quarries, Sites & Materials) with 1 click?'))) return;
    try {
      for (const p of loadingPresets.slice(0, 3)) {
        await api.post('/sites', { ...p, type: 'loading' });
      }
      for (const p of dumpingPresets.slice(0, 3)) {
        await api.post('/sites', ...[ { ...p, type: 'dumping' } ]);
      }
      for (const p of transitPresets.slice(0, 1)) {
        await api.post('/sites', { ...p, type: 'transition' });
      }
      for (const p of materialPresets.slice(0, 4)) {
        await api.post('/materials', p);
      }
      await loadData();
      alert(t('hauling_suggestions_logged_success', 'Standard hauling suggestions successfully logged!'));
    } catch (err) {
      alert(err.message);
    }
  };

  // Route Modal Openers
  const openAddModal = () => {
    setEditingRoute(null);
    setFormData({
      loading_site_id: loadingSites[0]?.id || '',
      dumping_site_id: dumpingSites[0]?.id || '',
      transition_point_ids: [],
      material_id: materials[0]?.id || '',
      default_price: 450,
      pricing_method: 'per_quintal',
    });
    setInlineLoading({ open: false, name: '', location: '' });
    setInlineDumping({ open: false, name: '', location: '' });
    setInlineTransit({ open: false, name: '', location: '' });
    setInlineMaterial({ open: false, name: '', default_unit: 'quintal', default_price: 450 });
    setIsModalOpen(true);
  };

  const openEditModal = (route) => {
    setEditingRoute(route);
    setFormData({
      loading_site_id: route.loading_site_id || '',
      dumping_site_id: route.dumping_site_id || '',
      transition_point_ids: route.transition_point_ids || [],
      material_id: route.material_id || '',
      default_price: route.default_price || 0,
      pricing_method: route.pricing_method || 'per_quintal',
    });
    setInlineLoading({ open: false, name: '', location: '' });
    setInlineDumping({ open: false, name: '', location: '' });
    setInlineTransit({ open: false, name: '', location: '' });
    setInlineMaterial({ open: false, name: '', default_unit: 'quintal', default_price: 450 });
    setIsModalOpen(true);
  };

  // Route Save Handler (Supports Inline Suggestion Creation)
  const handleSaveRoute = async (e) => {
    e.preventDefault();
    try {
      let finalLoadingId = formData.loading_site_id;
      let finalLoadingName = '';
      let finalDumpingId = formData.dumping_site_id;
      let finalDumpingName = '';
      let finalTransitIds = [...formData.transition_point_ids];
      let finalTransitName = '';
      let finalMaterialId = formData.material_id;
      let finalMaterialName = '';

      // Check if inline new loading site was entered
      if (inlineLoading.open && inlineLoading.name.trim()) {
        const newSite = await api.post('/sites', {
          name: inlineLoading.name.trim(),
          location: inlineLoading.location.trim() || 'Logged via Route Matrix',
          type: 'loading',
        });
        finalLoadingId = newSite.id;
        finalLoadingName = newSite.name;
      } else {
        const s = loadingSites.find(item => item.id === finalLoadingId);
        finalLoadingName = s?.name || '';
      }

      // Check if inline new dumping site was entered
      if (inlineDumping.open && inlineDumping.name.trim()) {
        const newSite = await api.post('/sites', {
          name: inlineDumping.name.trim(),
          location: inlineDumping.location.trim() || 'Logged via Route Matrix',
          type: 'dumping',
        });
        finalDumpingId = newSite.id;
        finalDumpingName = newSite.name;
      } else {
        const s = dumpingSites.find(item => item.id === finalDumpingId);
        finalDumpingName = s?.name || '';
      }

      // Check if inline new transit point was entered
      if (inlineTransit.open && inlineTransit.name.trim()) {
        const newSite = await api.post('/sites', {
          name: inlineTransit.name.trim(),
          location: inlineTransit.location.trim() || 'Weighbridge Checkpoint',
          type: 'transition',
        });
        finalTransitIds = [newSite.id];
        finalTransitName = newSite.name;
      } else if (finalTransitIds.length > 0) {
        const s = transitionPoints.find(item => item.id === finalTransitIds[0]);
        finalTransitName = s?.name || '';
      }

      // Check if inline new material was entered
      if (inlineMaterial.open && inlineMaterial.name.trim()) {
        const newMat = await api.post('/materials', {
          name: inlineMaterial.name.trim(),
          default_unit: inlineMaterial.default_unit || 'ton',
          default_price: parseFloat(inlineMaterial.default_price) || 0,
        });
        finalMaterialId = newMat.id;
        finalMaterialName = newMat.name;
      } else {
        const m = materials.find(item => item.id === finalMaterialId);
        finalMaterialName = m?.name || '';
      }

      if (!finalLoadingId || !finalDumpingId || !finalMaterialId) {
        alert(t('select_valid_loading_dumping_material', 'Please select or log a valid loading site, dumping site, and material.'));
        return;
      }

      const payload = {
        loading_site_id: finalLoadingId,
        loading_site_name: finalLoadingName,
        dumping_site_id: finalDumpingId,
        dumping_site_name: finalDumpingName,
        transition_point_ids: finalTransitIds,
        transition_point_name: finalTransitName,
        material_id: finalMaterialId,
        material_name: finalMaterialName,
        default_price: parseFloat(formData.default_price) || 0,
        pricing_method: formData.pricing_method || 'per_ton',
      };

      if (editingRoute) {
        await api.put(`/routes/${editingRoute.id}`, payload);
      } else {
        await api.post('/routes', payload);
      }

      setIsModalOpen(false);
      setEditingRoute(null);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRoute = async (route) => {
    if (!confirm(t('confirm_delete_route', 'Are you sure you want to delete this route?'))) return;
    try {
      await api.delete(`/routes/${route.id}`);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Site Modal Handlers (for logging/editing suggestions)
  const openAddSiteModal = (type) => {
    setSiteModal({
      open: true,
      type,
      site: null,
      form: { name: '', location: '', description: '' },
    });
  };

  const openEditSiteModal = (site) => {
    setSiteModal({
      open: true,
      type: site.type || 'loading',
      site,
      form: { name: site.name || '', location: site.location || '', description: site.description || '' },
    });
  };

  const handleSaveSiteModal = async (e) => {
    e.preventDefault();
    try {
      if (siteModal.site) {
        await api.put(`/sites/${siteModal.site.id}`, {
          ...siteModal.form,
          type: siteModal.type,
        });
      } else {
        await api.post('/sites', {
          ...siteModal.form,
          type: siteModal.type,
        });
      }
      setSiteModal({ open: false, type: 'loading', site: null, form: { name: '', location: '', description: '' } });
      await loadData();
    } catch (err) {
      alert('Failed to save site suggestion: ' + err.message);
    }
  };

  const handleDeleteSite = async (site) => {
    if (!confirm(`Delete suggestion "${site.name}"?`)) return;
    try {
      await api.delete(`/sites/${site.id}`);
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Material Modal Handlers
  const openAddMaterialModal = () => {
    setMaterialModal({
      open: true,
      material: null,
      form: { name: '', default_unit: 'quintal', default_price: 450, description: '' },
    });
  };

  const openEditMaterialModal = (mat) => {
    setMaterialModal({
      open: true,
      material: mat,
      form: {
        name: mat.name || '',
        default_unit: mat.default_unit || 'quintal',
        default_price: mat.default_price || 0,
        description: mat.description || '',
      },
    });
  };

  const handleSaveMaterialModal = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...materialModal.form,
        default_price: parseFloat(materialModal.form.default_price) || 0,
      };
      if (materialModal.material) {
        await api.put(`/materials/${materialModal.material.id}`, payload);
      } else {
        await api.post('/materials', payload);
      }
      setMaterialModal({ open: false, material: null, form: { name: '', default_unit: 'quintal', default_price: 450, description: '' } });
      await loadData();
    } catch (err) {
      alert('Failed to save material suggestion: ' + err.message);
    }
  };

  const handleDeleteMaterial = async (mat) => {
    if (!confirm(`Delete material suggestion "${mat.name}"?`)) return;
    try {
      await api.delete(`/materials/${mat.id}`);
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Route className="w-6 h-6 text-amber-400" />
            <span>Routes & Hauling Suggestions</span>
          </h2>
          <p className="text-xs text-slate-400">
            Log suggestions for loading sites, destination dumping projects, materials, and configure standard route prices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {activeTab === 'routes' && (
            <button
              onClick={openAddModal}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn cursor-pointer"
            >
              <Plus className="w-4 h-4" /> + Set Standard Route Price
            </button>
          )}

          {activeTab === 'loading' && (
            <button
              onClick={() => openAddSiteModal('loading')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn cursor-pointer"
            >
              <Plus className="w-4 h-4" /> + Log Loading Site Suggestion
            </button>
          )}

          {activeTab === 'dumping' && (
            <button
              onClick={() => openAddSiteModal('dumping')}
              className="px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn cursor-pointer"
            >
              <Plus className="w-4 h-4" /> + Log Dumping Site Suggestion
            </button>
          )}

          {activeTab === 'materials' && (
            <button
              onClick={openAddMaterialModal}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn cursor-pointer"
            >
              <Plus className="w-4 h-4" /> + Log Material Suggestion
            </button>
          )}

          {activeTab === 'transition' && (
            <button
              onClick={() => openAddSiteModal('transition')}
              className="px-4 py-2.5 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn cursor-pointer"
            >
              <Plus className="w-4 h-4" /> + Log Transit Checkpoint
            </button>
          )}
        </div>
      </div>

      {/* Suggestion Navigation Tabs */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto gap-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('routes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'routes'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          <span>{t('route_price_matrix')}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'routes' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
            {routes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('loading')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'loading'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('loading_sites_suggestions')}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'loading' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
            {loadingSites.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dumping')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'dumping'
              ? 'bg-blue-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-3.5 h-3.5 text-blue-400" />
          <span>{t('dumping_sites_suggestions')}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'dumping' ? 'bg-slate-950 text-blue-400' : 'bg-slate-800 text-slate-300'}`}>
            {dumpingSites.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'materials'
              ? 'bg-emerald-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Package className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('materials_suggestions')}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'materials' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>
            {materials.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('transition')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'transition'
              ? 'bg-purple-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Scale className="w-3.5 h-3.5 text-purple-400" />
          <span>{t('transit_checkpoints_tab')}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'transition' ? 'bg-slate-950 text-purple-400' : 'bg-slate-800 text-slate-300'}`}>
            {transitionPoints.length}
          </span>
        </button>
      </div>

      {/* Quick Setup Starter Banner (Shown when items are zero) */}
      {(loadingSites.length === 0 || dumpingSites.length === 0 || materials.length === 0) && (
        <div className="p-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> {t('fast_start_hauling_suggestions')}
            </h4>
            <p className="text-xs text-slate-300">
              {t('fast_start_hauling_desc')}
            </p>
          </div>
          <button
            onClick={handleQuickSetupAll}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer whitespace-nowrap shrink-0"
          >
            {t('log_recommended_suggestions_presets')}
          </button>
        </div>
      )}

      {/* TAB 1: ROUTES PRICE MATRIX */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          {routes.length === 0 ? (
            <div className="p-10 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 bg-slate-800 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                <Route className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">{t('no_standard_routes_configured')}</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {t('configure_route_pricing_desc')}
              </p>
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer"
              >
                {t('configure_first_route_price')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routes.map(r => (
                <div
                  key={r.id}
                  className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between space-y-3 hover:border-slate-700 transition shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> {t('auto_suggested_route_rate')}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        {t('active')}
                      </span>
                    </div>

                    <div className="p-3 my-3 bg-slate-800/80 rounded-2xl border border-slate-700/60 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                        <span>{r.loading_site_name}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{r.dumping_site_name}</span>
                      </div>
                      {r.transition_point_name && (
                        <div className="text-[11px] text-purple-400 flex items-center gap-1">
                          <Scale className="w-3 h-3" />
                          <span>{t('via_checkpoint')} {r.transition_point_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">{t('material_colon')}</span>
                        <strong className="text-slate-200">{r.material_name}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">{t('standard_price_label')}</span>
                        <strong className="text-emerald-400 font-black text-sm">
                          {formatCurrency(r.default_price)} / {r.pricing_method?.replace('per_', '')}
                        </strong>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          ({(r.pricing_method === 'per_ton' ? (r.default_price / 1000) : r.pricing_method === 'per_quintal' ? (r.default_price / 100) : r.default_price).toFixed(3)} ETB/kg)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => openEditModal(r)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" /> {t('edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteRoute(r)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition cursor-pointer"
                      title="Delete route"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOADING SITES SUGGESTIONS */}
      {activeTab === 'loading' && (
        <div className="space-y-4">
          {/* Quick Presets Chips */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              1-Click Recommended Quarry Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              {loadingPresets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAddSite('loading', p)}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {loadingSites.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
              <MapPin className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">{t('no_loading_sites_yet')}</h3>
              <p className="text-xs text-slate-400">{t('click_log_loading_site_or_presets')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {loadingSites.map(s => (
                <div key={s.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs">{s.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold">
                        Quarry
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" /> {s.location || 'No location address'}
                    </p>
                    {s.description && (
                      <p className="text-[10px] text-slate-500 mt-1 italic">{s.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => openEditSiteModal(s)}
                      className="px-2.5 py-1 text-slate-300 hover:text-amber-400 text-xs font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSite(s)}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DUMPING SITES SUGGESTIONS */}
      {activeTab === 'dumping' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              1-Click Recommended Destination Project Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              {dumpingPresets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAddSite('dumping', p)}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-blue-500/20 hover:text-blue-300 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-blue-400" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {dumpingSites.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
              <Building className="w-8 h-8 text-blue-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">{t('no_dumping_sites_yet')}</h3>
              <p className="text-xs text-slate-400">{t('click_log_dumping_site_or_presets')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dumpingSites.map(s => (
                <div key={s.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs">{s.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold">
                        Destination
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Building className="w-3 h-3 text-slate-500" /> {s.location || 'No location address'}
                    </p>
                    {s.description && (
                      <p className="text-[10px] text-slate-500 mt-1 italic">{s.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => openEditSiteModal(s)}
                      className="px-2.5 py-1 text-slate-300 hover:text-blue-400 text-xs font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSite(s)}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MATERIALS SUGGESTIONS */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              1-Click Recommended Material Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              {materialPresets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAddMaterial(p)}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-emerald-500/20 hover:text-emerald-300 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-emerald-400" />
                  <span>{p.name} ({formatCurrency(p.default_price)}/{p.default_unit})</span>
                </button>
              ))}
            </div>
          </div>

          {materials.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
              <Package className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">{t('no_materials_yet')}</h3>
              <p className="text-xs text-slate-400">{t('click_log_material_or_presets')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {materials.map(m => (
                <div key={m.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs">{m.name}</h4>
                      <span className="text-xs font-mono font-black text-emerald-400">
                        {formatCurrency(m.default_price)} / {m.default_unit}
                      </span>
                    </div>
                    {m.description && (
                      <p className="text-[10px] text-slate-500 mt-1 italic">{m.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => openEditMaterialModal(m)}
                      className="px-2.5 py-1 text-slate-300 hover:text-emerald-400 text-xs font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMaterial(m)}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: TRANSIT / CHECKPOINTS */}
      {activeTab === 'transition' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              1-Click Weighbridge & Toll Gate Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              {transitPresets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAddSite('transition', p)}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-purple-500/20 hover:text-purple-300 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-purple-400" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {transitionPoints.length === 0 ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-2">
              <Scale className="w-8 h-8 text-purple-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">{t('no_transit_checkpoints_logged')}</h3>
              <p className="text-xs text-slate-400">{t('log_weighbridges_sub')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {transitionPoints.map(s => (
                <div key={s.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs">{s.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-semibold">
                        Weighbridge
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" /> {s.location || 'Axle Scale Hub'}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => openEditSiteModal(s)}
                      className="px-2.5 py-1 text-slate-300 hover:text-purple-400 text-xs font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSite(s)}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFIGURE ROUTE PRICING MODAL (Supports inline logging of new suggestions) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Route className="w-5 h-5 text-amber-400" />
                {editingRoute ? 'Edit Standard Route Rate' : 'Configure Route Pricing'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoute} className="space-y-3.5 text-xs">
              {/* 1. Loading Site Field + Inline Logger */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">{t('loading_site_quarry_label')}</label>
                  <button
                    type="button"
                    onClick={() => setInlineLoading({ ...inlineLoading, open: !inlineLoading.open })}
                    className="text-[11px] text-amber-400 hover:underline font-bold cursor-pointer"
                  >
                    {inlineLoading.open ? t('select_existing_opt') : t('log_new_site_opt')}
                  </button>
                </div>

                {inlineLoading.open ? (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                    <input
                      type="text"
                      placeholder={t('ph_new_quarry_name')}
                      value={inlineLoading.name}
                      onChange={e => setInlineLoading({ ...inlineLoading, name: e.target.value })}
                      className="w-full py-1.5 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder={t('ph_quarry_loc_example')}
                      value={inlineLoading.location}
                      onChange={e => setInlineLoading({ ...inlineLoading, location: e.target.value })}
                      className="w-full py-1.5 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                ) : (
                  <select
                    value={formData.loading_site_id}
                    onChange={e => setFormData({ ...formData, loading_site_id: e.target.value })}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  >
                    <option value="">{t('select_loading_quarry')}</option>
                    {loadingSites.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.location || 'Local'})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Destination Dumping Site Field + Inline Logger */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">{t('destination_dumping_site_label')}</label>
                  <button
                    type="button"
                    onClick={() => setInlineDumping({ ...inlineDumping, open: !inlineDumping.open })}
                    className="text-[11px] text-blue-400 hover:underline font-bold cursor-pointer"
                  >
                    {inlineDumping.open ? t('select_existing_opt') : t('log_new_destination_opt')}
                  </button>
                </div>

                {inlineDumping.open ? (
                  <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
                    <input
                      type="text"
                      placeholder={t('ph_enter_dest_project_name')}
                      value={inlineDumping.name}
                      onChange={e => setInlineDumping({ ...inlineDumping, name: e.target.value })}
                      className="w-full py-1.5 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder={t('site_loc_ph')}
                      value={inlineDumping.location}
                      onChange={e => setInlineDumping({ ...inlineDumping, location: e.target.value })}
                      className="w-full py-1.5 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                ) : (
                  <select
                    value={formData.dumping_site_id}
                    onChange={e => setFormData({ ...formData, dumping_site_id: e.target.value })}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  >
                    <option value="">{t('select_destination_project')}</option>
                    {dumpingSites.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.location || 'Local'})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 3. Material Field + Inline Logger */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">{t('material_transported_label')}</label>
                  <button
                    type="button"
                    onClick={() => setInlineMaterial({ ...inlineMaterial, open: !inlineMaterial.open })}
                    className="text-[11px] text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    {inlineMaterial.open ? t('select_existing_opt') : t('log_new_material_opt')}
                  </button>
                </div>

                {inlineMaterial.open ? (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                    <input
                      type="text"
                      placeholder={t('material_name_ph')}
                      value={inlineMaterial.name}
                      onChange={e => setInlineMaterial({ ...inlineMaterial, name: e.target.value })}
                      className="w-full py-1.5 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={inlineMaterial.default_unit}
                        onChange={e => setInlineMaterial({ ...inlineMaterial, default_unit: e.target.value })}
                        className="w-full py-1.5 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      >
                        <option value="ton">{t('unit_ton_display')}</option>
                        <option value="quintal">{t('unit_quintal_display')}</option>
                        <option value="m3">{t('cubic_meter_unit') || 'Cubic Meter (m³)'}</option>
                        <option value="trip">{t('unit_trip_load')}</option>
                      </select>
                      <input
                        type="number"
                        placeholder={t('ph_default_price')}
                        value={inlineMaterial.default_price}
                        onChange={e => setInlineMaterial({ ...inlineMaterial, default_price: e.target.value })}
                        className="w-full py-1.5 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <select
                    value={formData.material_id}
                    onChange={e => setFormData({ ...formData, material_id: e.target.value })}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  >
                    <option value="">{t('select_material')}</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({formatCurrency(m.default_price)} / {m.default_unit})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 4. Transit Point (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">{t('transit_weighbridge_checkpoint_label')}</label>
                  <button
                    type="button"
                    onClick={() => setInlineTransit({ ...inlineTransit, open: !inlineTransit.open })}
                    className="text-[11px] text-purple-400 hover:underline font-bold cursor-pointer"
                  >
                    {inlineTransit.open ? t('select_existing_opt') : t('log_new_checkpoint_opt')}
                  </button>
                </div>

                {inlineTransit.open ? (
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2">
                    <input
                      type="text"
                      placeholder={t('ph_checkpoint_name_example')}
                      value={inlineTransit.name}
                      onChange={e => setInlineTransit({ ...inlineTransit, name: e.target.value })}
                      className="w-full py-1.5 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required
                    />
                  </div>
                ) : (
                  <select
                    value={formData.transition_point_ids[0] || ''}
                    onChange={e => setFormData({ ...formData, transition_point_ids: e.target.value ? [e.target.value] : [] })}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">{t('none_direct_hauling')}</option>
                    {transitionPoints.map(tPoint => (
                      <option key={tPoint.id} value={tPoint.id}>{tPoint.name} ({tPoint.location || 'Checkpoint'})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 5. Pricing Method and Rate */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('pricing_unit_label')}</label>
                  <select
                    value={formData.pricing_method}
                    onChange={e => setFormData({ ...formData, pricing_method: e.target.value })}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
                  >
                    <option value="per_ton">{t('per_ton_opt')}</option>
                    <option value="per_quintal">{t('per_quintal_opt')}</option>
                    <option value="per_kg">{t('per_kg_opt')}</option>
                    <option value="lump_sum">{t('lump_sum_per_trip_opt')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('standard_rate_etb_label')}</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.default_price}
                    onChange={e => setFormData({ ...formData, default_price: e.target.value })}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-black text-amber-400"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  {editingRoute ? 'Save Route Changes' : 'Save Standard Route Price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG OR EDIT SITE SUGGESTION (Loading, Dumping, Transit) */}
      {siteModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">
              {siteModal.site ? t('edit_site_suggestion') : t('log_new_site_suggestion')}
            </h3>

            <form onSubmit={handleSaveSiteModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('site_quarry_name_label')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('site_quarry_ph')}
                  value={siteModal.form.name}
                  onChange={e => setSiteModal({ ...siteModal, form: { ...siteModal.form, name: e.target.value } })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('loc_address_label')}</label>
                <input
                  type="text"
                  placeholder={t('ph_awash_basin_example')}
                  value={siteModal.form.location}
                  onChange={e => setSiteModal({ ...siteModal, form: { ...siteModal.form, location: e.target.value } })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('desc_notes_label')}</label>
                <textarea
                  rows="2"
                  placeholder={t('ph_route_access_details')}
                  value={siteModal.form.description}
                  onChange={e => setSiteModal({ ...siteModal, form: { ...siteModal.form, description: e.target.value } })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSiteModal({ open: false, type: 'loading', site: null, form: { name: '', location: '', description: '' } })}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  {t('save_suggestion')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG OR EDIT MATERIAL SUGGESTION */}
      {materialModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">
              {materialModal.material ? t('edit_material_suggestion') : t('log_new_material_suggestion')}
            </h3>

            <form onSubmit={handleSaveMaterialModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('material_name_field_label')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('ph_material_name_example')}
                  value={materialModal.form.name}
                  onChange={e => setMaterialModal({ ...materialModal, form: { ...materialModal.form, name: e.target.value } })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('default_unit_field_label')}</label>
                  <select
                    value={materialModal.form.default_unit}
                    onChange={e => setMaterialModal({ ...materialModal, form: { ...materialModal.form, default_unit: e.target.value } })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="ton">{t('unit_ton_display')}</option>
                    <option value="quintal">{t('unit_quintal_display')}</option>
                    <option value="m3">{t('cubic_meter_unit') || 'Cubic Meter (m³)'}</option>
                    <option value="trip">{t('unit_trip_load')}</option>
                    <option value="kg">{t('unit_kg') || 'KG'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('default_price_etb_label')}</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={materialModal.form.default_price}
                    onChange={e => setMaterialModal({ ...materialModal, form: { ...materialModal.form, default_price: e.target.value } })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('description_field_label')}</label>
                <textarea
                  rows="2"
                  placeholder={t('description_specs_ph')}
                  value={materialModal.form.description}
                  onChange={e => setMaterialModal({ ...materialModal, form: { ...materialModal.form, description: e.target.value } })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMaterialModal({ open: false, material: null, form: { name: '', default_unit: 'ton', default_price: 450, description: '' } })}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  {t('save_suggestion')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
