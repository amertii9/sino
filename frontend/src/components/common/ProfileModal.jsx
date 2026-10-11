import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  User,
  Phone,
  Lock,
  Shield,
  Truck,
  Award,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  KeyRound,
  FileText,
  Mail,
  Globe
} from 'lucide-react';

export const ProfileModal = ({ isOpen, onClose }) => {
  const { user, driver, truck, role, updateProfile } = useAuth();
  const { t, language, setLanguage, languages } = useLanguage();

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || driver?.phone || '',
    avatar: user?.avatar || '',
    preferred_language: user?.preferred_language || language || 'en',
    license_number: driver?.license_number || '',
    notes: driver?.notes || '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isChangingPassword) {
      if (!formData.new_password) {
        setErrorMsg(t('enter_new_password', 'Please enter a new password'));
        return;
      }
      if (formData.new_password.length < 6) {
        setErrorMsg(t('password_min_length', 'New password must be at least 6 characters'));
        return;
      }
      if (formData.new_password !== formData.confirm_password) {
        setErrorMsg(t('passwords_mismatch', 'New password and confirmation do not match'));
        return;
      }
      if (!formData.current_password) {
        setErrorMsg(t('current_password_required', 'Current password is required to change password'));
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        full_name: formData.full_name,
        phone: formData.phone,
        avatar: formData.avatar,
        license_number: formData.license_number,
        notes: formData.notes,
        preferred_language: formData.preferred_language,
      };

      if (formData.preferred_language !== language) {
        setLanguage(formData.preferred_language, user?.id);
      }

      if (isChangingPassword && formData.new_password) {
        payload.current_password = formData.current_password;
        payload.new_password = formData.new_password;
      }

      await updateProfile(payload);
      setSuccessMsg(t('profile_saved_success', 'Profile updated successfully!'));
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || t('failed_to_update_profile', 'Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black flex items-center justify-center text-lg shadow-md">
              {formData.full_name ? formData.full_name.charAt(0) : 'U'}
            </div>
            <div>
              <h3 className="font-black text-base text-white">{t('profile_title', 'Edit Profile & Account')}</h3>
              <p className="text-xs text-slate-400">
                {role === 'admin' ? t('administrator', 'Administrator Account') : t('driver_account_settings', 'Driver Account Settings')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback messages */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Identity info badges */}
          <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>{t('login_email', 'Login Email:')} <strong className="text-white">{user?.email}</strong></span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase tracking-wider">
              {role === 'admin' ? t('admin', 'Admin') : t('driver', 'Driver')}
            </span>
          </div>

          {/* Assigned truck if driver */}
          {role === 'driver' && (
            <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-700/40 flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <span>{t('assigned_truck', 'Assigned Truck:')}</span>
              </div>
              <span className="font-bold text-slate-100">
                {truck ? `${truck.plate_number} (${truck.model || 'Standard'} - ${truck.capacity}T)` : t('no_truck_assigned', 'Unassigned')}
              </span>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" /> {t('full_name_label', 'Full Name:')}
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                placeholder={t('full_name_ph', 'Your full name')}
                className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" /> {t('phone_number_label', 'Phone Number:')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder={t('phone_number_ph', '+251 911 000 000')}
                className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-400" /> {t('preferred_language_label', 'Preferred Language:')}
              </label>
              <select
                value={formData.preferred_language}
                onChange={e => {
                  setFormData({ ...formData, preferred_language: e.target.value });
                  setLanguage(e.target.value, user?.id);
                }}
                className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-amber-500"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.native} ({lang.label})
                  </option>
                ))}
              </select>
            </div>

            {/* Driver specific info */}
            {role === 'driver' && (
              <>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" /> {t('license_number_label', 'Driving License Number:')}
                  </label>
                  <input
                    type="text"
                    value={formData.license_number}
                    onChange={e => setFormData({ ...formData, license_number: e.target.value })}
                    placeholder={t('license_number_ph', 'DL-AA-123456')}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" /> {t('driver_notes_label', 'Bio / Driver Notes:')}
                  </label>
                  <textarea
                    rows="2"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t('driver_notes_ph', 'Certifications, emergency contact, experience...')}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Change Password Toggle */}
          <div className="border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setIsChangingPassword(!isChangingPassword)}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {isChangingPassword ? t('cancel_password_change', 'Cancel Password Change') : t('change_password', 'Change Password')}
            </button>

            {isChangingPassword && (
              <div className="mt-3 p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2.5">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">{t('current_password', 'Current Password:')}</label>
                  <input
                    type="password"
                    placeholder={t('password_ph', '••••••••')}
                    value={formData.current_password}
                    onChange={e => setFormData({ ...formData, current_password: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">{t('new_password', 'New Password:')}</label>
                    <input
                      type="password"
                      placeholder={t('new_password_ph', 'Min 6 characters')}
                      value={formData.new_password}
                      onChange={e => setFormData({ ...formData, new_password: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">{t('confirm_password', 'Confirm Password:')}</label>
                    <input
                      type="password"
                      placeholder={t('confirm_password_ph', 'Repeat password')}
                      value={formData.confirm_password}
                      onChange={e => setFormData({ ...formData, confirm_password: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? t('saving', 'Saving...') : t('save_changes', 'Save Profile Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
