import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../api/client';
import { ProfileModal } from './ProfileModal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import {
  Truck,
  Bell,
  LogOut,
  User,
  Shield,
  CheckCircle,
  RefreshCw,
  X,
  Search
} from 'lucide-react';

export const Header = () => {
  const { user, role, driver, truck, logout, quickLogin } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const data = await api.get('/notifications');
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const [driversList, setDriversList] = useState([]);

  const fetchDrivers = async () => {
    try {
      const data = await api.get('/drivers');
      if (Array.isArray(data)) {
        setDriversList(data.filter(d => d.status === 'active' || !d.status));
      }
    } catch (err) {
      // In case unauthenticated or offline
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchDrivers();
      const handleDriversUpdated = () => fetchDrivers();
      window.addEventListener('drivers-updated', handleDriversUpdated);
      return () => window.removeEventListener('drivers-updated', handleDriversUpdated);
    } else {
      setDriversList([]);
    }
  }, [role]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-15 sm:h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
          <div className="h-9 sm:h-11 px-2 py-1 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/80 flex items-center justify-center shadow-xs shrink-0">
            <img src="/logo.png" alt="SINO Fleet Logo" className="h-7 sm:h-9 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(255,28,28,0.2)]" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5 sm:gap-2">
              <span className="truncate">{t('brand_title')}</span>
              <span className={`hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${
                role === 'admin' ? 'bg-amber-50 text-amber-600 border border-amber-200/60 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
              }`}>
                {role === 'admin' ? t('admin_portal') : t('driver_app')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate">{t('brand_subtitle')}</p>
          </div>
        </div>

        {/* Search Pill Input matching Reference Design (sample_ui.jpg) */}
        <div className="hidden md:flex items-center flex-1 max-w-sm mx-2 lg:mx-6">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t('search_anything', 'Search anything...')}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-full text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-inner"
            />
            <span className="hidden lg:inline-flex items-center text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 absolute right-2.5 top-1/2 -translate-y-1/2 shadow-xs">
              ⌘K
            </span>
          </div>
        </div>

        {/* Demo Switcher & Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
          {/* Dynamic Role Switcher (Admin-only) */}
          {role === 'admin' && (
            <div className="hidden lg:flex items-center bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl p-1 text-xs">
              <span className="text-slate-400 px-2 font-medium flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> {t('switch_role')}
              </span>
              <button
                onClick={() => quickLogin('admin')}
                className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                  role === 'admin'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/50'
                }`}
                title="soneschool1@gmail.com"
              >
                {t('admin')}
              </button>
              {driversList.map(drv => {
                const isActive = role === 'driver' && user?.email === drv.email;
                const truckLabel = drv.assigned_truck_plate || (drv.assigned_truck_id ? 'Truck' : '');
                return (
                  <button
                    key={drv.id}
                    onClick={() => quickLogin(drv)}
                    className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/50'
                    }`}
                    title={`${drv.full_name} (${drv.email || 'driver'})`}
                  >
                    {drv.full_name.split(' ')[0]} {truckLabel ? `(${truckLabel})` : ''}
                  </button>
                );
              })}
            </div>
          )}

          {/* Theme Switcher */}
          <ThemeSwitcher />

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-amber-500 dark:text-slate-300 dark:hover:text-amber-400 transition flex items-center justify-center cursor-pointer shadow-xs"
              title={t('notifications')}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-72 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-3xl shadow-xl overflow-hidden z-50">
                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" /> {t('notifications')}
                    {unreadCount > 0 && (
                      <span className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold">
                        {unreadCount} {t('unread')}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setShowNotifs(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      {t('no_notifications')}
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={`p-3.5 transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                          !n.is_read ? 'bg-amber-50/40 dark:bg-amber-950/20 border-l-2 border-amber-500' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{n.title}</h4>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{n.message}</p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 block">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center space-x-1 sm:space-x-2 pl-1 sm:pl-2.5 border-l border-slate-200/80 dark:border-slate-800">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center p-1 sm:p-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer group"
              title={t('edit_profile')}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition shrink-0 shadow-xs">
                {user?.full_name ? user.full_name.charAt(0) : 'U'}
              </div>
              <div className="hidden lg:block text-left ml-2">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-amber-500 transition flex items-center gap-1">
                  <span>{user?.full_name}</span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>{role === 'admin' ? t('administrator') : truck ? `${truck.plate_number}` : t('driver')}</span>
                  <span className="text-amber-500 font-bold text-[9px] underline">({t('edit')})</span>
                </div>
              </div>
            </button>

            <button
              onClick={logout}
              title={t('logout')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition flex items-center justify-center cursor-pointer shadow-xs"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </header>
  );
};
