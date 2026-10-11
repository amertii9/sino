import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { formatCurrency } from '../../utils/formatters';
import { Package, Plus, Edit, Trash2 } from 'lucide-react';

export const MaterialsManagement = () => {
  const { t } = useLanguage();
  const [materials, setMaterials] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    default_unit: 'ton',
    default_price: 450,
    description: '',
  });

  const fetchMaterials = async () => {
    try {
      const data = await api.get('/materials');
      setMaterials(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const openAddModal = () => {
    setEditingMaterial(null);
    setFormData({ name: '', default_unit: 'ton', default_price: 450, description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name || '',
      default_unit: material.default_unit || 'ton',
      default_price: material.default_price || 0,
      description: material.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        default_price: parseFloat(formData.default_price) || 0,
      };

      if (editingMaterial) {
        await api.put(`/materials/${editingMaterial.id}`, payload);
      } else {
        await api.post('/materials', payload);
      }
      setIsModalOpen(false);
      setEditingMaterial(null);
      setFormData({ name: '', default_unit: 'ton', default_price: 450, description: '' });
      fetchMaterials();
    } catch (err) {
      alert('Failed to save material: ' + err.message);
    }
  };

  const handleDelete = async (material) => {
    if (!confirm(t('confirm_delete_material', 'Are you sure you want to delete this material?'))) return;
    try {
      await api.delete(`/materials/${material.id}`);
      fetchMaterials();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-400" /> {t('materials_title', 'Hauling Materials Catalog')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('materials_sub', 'Define material classes, measurement units (Ton, Quintal, KG), and default base pricing')}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md touch-btn self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> {t('add_material_btn', '+ Add Material')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map(m => (
          <div
            key={m.id}
            className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between space-y-3 hover:border-slate-700 transition"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-100">{m.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">{t('trip_unit_label', 'Unit')}: {m.default_unit}</span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  Active
                </span>
              </div>

              <div className="p-3 mt-3 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex justify-between items-center text-xs">
                <span className="text-slate-400">{t('mat_default_price', 'Standard Base Price')}:</span>
                <span className="font-black text-amber-400 text-sm">
                  {formatCurrency(m.default_price)} / {m.default_unit}
                </span>
              </div>

              {m.description && (
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  {m.description}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={() => openEditModal(m)}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
              >
                <Edit className="w-3.5 h-3.5" /> {t('edit', 'Edit')}
              </button>
              <button
                onClick={() => handleDelete(m)}
                className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition"
                title="Delete material"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-base text-white">
              {editingMaterial ? `Edit Material: ${editingMaterial.name}` : 'Add New Hauling Material'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('material_name_field_label', 'Material Name:')}</label>
                <input
                  type="text"
                  placeholder={t('ph_material_name_example', 'e.g. River Sand, Concrete Aggregate')}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('default_unit_field_label', 'Default Unit:')}</label>
                  <select
                    value={formData.default_unit}
                    onChange={e => setFormData({ ...formData, default_unit: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="ton">{t('unit_ton_display', 'Ton')}</option>
                    <option value="quintal">{t('unit_quintal_display', 'Quintal')}</option>
                    <option value="kg">{t('unit_kg_display', 'Kilogram')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('base_price_etb_field', 'Base Price (ETB):')}</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.default_price}
                    onChange={e => setFormData({ ...formData, default_price: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">{t('description_field_label', 'Description:')}</label>
                <textarea
                  rows="2"
                  placeholder={t('ph_gravel_desc_example', 'e.g. Sifted gravel aggregate for road surface')}
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
                  {editingMaterial ? 'Save Changes' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
