import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { MapPin, Plus, Layers, Navigation, Edit, Trash2 } from 'lucide-react';

export const SitesManagement = () => {
  const { t } = useLanguage();
  const [sites, setSites] = useState([]);
  const [activeTab, setActiveTab] = useState('loading'); // 'loading', 'dumping', 'transition'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [formData, setFormData] = useState({ name: '', location: '', description: '' });

  const fetchSites = async () => {
    try {
      const data = await api.get('/sites');
      setSites(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const openAddModal = () => {
    setEditingSite(null);
    setFormData({ name: '', location: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (site) => {
    setEditingSite(site);
    setFormData({
      name: site.name || '',
      location: site.location || '',
      description: site.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingSite) {
        await api.put(`/sites/${editingSite.id}`, {
          ...formData,
          type: editingSite.type || activeTab,
        });
      } else {
        await api.post('/sites', {
          ...formData,
          type: activeTab,
        });
      }
      setIsModalOpen(false);
      setEditingSite(null);
      setFormData({ name: '', location: '', description: '' });
      fetchSites();
    } catch (err) {
      alert('Failed to save site: ' + err.message);
    }
  };

  const handleDelete = async (site) => {
    if (!confirm(`Are you sure you want to delete "${site.name}"?`)) return;
    try {
      await api.delete(`/sites/${site.id}`);
      fetchSites();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const filtered = sites.filter(s => s.type === activeTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-400" /> {t('sites_title', 'Hauling Sites & Transit Network')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('sites_sub', 'Define loading quarries, destination dumping sites, and intermediary transit checkpoints')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> {t('add_site_btn', '+ Add Site')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl text-xs w-full sm:w-auto self-start">
        {[
          { id: 'loading', label: t('sites_tab_loading', 'Loading Sites (Quarries)'), icon: MapPin },
          { id: 'dumping', label: t('sites_tab_dumping', 'Dumping Sites (Projects)'), icon: Navigation },
          { id: 'transition', label: t('sites_tab_transition', 'Transition Points (Weigh-bridges)'), icon: Layers },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${
              activeTab === tab.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div
            key={s.id}
            className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between space-y-3 hover:border-slate-700 transition"
          >
            <div>
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-sm text-slate-100">{s.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  Active
                </span>
              </div>
              <p className="text-xs text-amber-400/90 font-medium flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {s.location || 'Location not specified'}
              </p>
              {s.description && (
                <p className="text-xs text-slate-400 pt-2 mt-2 leading-relaxed border-t border-slate-800">
                  {s.description}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={() => openEditModal(s)}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => handleDelete(s)}
                className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition"
                title="Delete site"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">
              {editingSite ? `Edit Site: ${editingSite.name}` : `Add New ${activeTab === 'loading' ? 'Loading Quarry/Site' : activeTab === 'dumping' ? 'Dumping/Delivery Site' : 'Transition Point'}`}
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Site Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Quarry A (Awash River Basin)"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Location / Address:</label>
                <input
                  type="text"
                  placeholder="e.g. Mile 42 Awash Basin"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Description / Notes:</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Clean river sand source with automatic hopper loader"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md"
                >
                  {editingSite ? 'Save Changes' : 'Save Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
