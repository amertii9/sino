import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Truck, Shield, KeyRound, AlertCircle, ArrowRight, User } from 'lucide-react';

export const LoginPage = () => {
  const { login, quickLogin } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Invalid email/username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDriver = () => {
    setEmail('name@sino.com');
  };

  const handleQuickLogin = async (roleKey) => {
    setLoading(true);
    setError('');
    try {
      await quickLogin(roleKey);
    } catch (err) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-150">
      {/* Background decoration (Dark Mode only) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-slate-950 pointer-events-none hidden dark:block"></div>

      {/* Switchers in top right corner */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1.5 sm:gap-2">
        <ThemeSwitcher variant="login" />
        <LanguageSwitcher variant="login" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
        <div className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-red-500/15 mx-auto">
          <img src="/logo.png" alt="SINO Fleet Logo" className="h-12 sm:h-16 w-auto object-contain filter drop-shadow-[0_4px_16px_rgba(255,28,28,0.3)]" />
        </div>
        <h2 className="mt-3 sm:mt-4 text-xl sm:text-3xl font-black tracking-tight text-white">
          {t('login_title')}
        </h2>
        <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
          {t('login_subtitle')}
        </p>
      </div>

      <div className="mt-4 sm:mt-6 sm:mx-auto sm:w-full sm:max-w-md px-3 sm:px-4 relative z-10">
        <div className="bg-slate-900 border border-slate-800 py-5 sm:py-6 px-4 sm:px-8 shadow-2xl rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-5">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-200 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('login_identifier', 'Email, Username or Phone Number')}
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. name@sino.com or +251 911 555 101"
                className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('login_password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 touch-btn cursor-pointer"
            >
              {loading ? t('login_authenticating') : t('login_btn')}
            </button>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={handleFillDriver}
                className="hover:text-emerald-400 transition inline-flex items-center gap-1.5 cursor-pointer bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/80"
              >
                <span>Driver format:</span>
                <span className="font-mono text-emerald-400 font-bold">name@sino.com</span>
                <span className="text-slate-500 font-sans">(or phone)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
