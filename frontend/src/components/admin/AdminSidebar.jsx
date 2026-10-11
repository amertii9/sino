import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  LayoutDashboard,
  Truck,
  Users,
  MapPin,
  Package,
  Route,
  Fuel,
  Receipt,
  Wrench,
  BarChart3,
  ShieldCheck,
  Settings,
  ClipboardList,
  User,
  Edit,
  Coins,
  Gauge,
  CreditCard,
  HelpCircle,
  LogOut,
  PlusCircle,
  Sparkles
} from 'lucide-react';

export const AdminSidebar = ({ activeTab, onSelectTab, pendingFuelCount = 0, pendingPaymentsCount = 0, onOpenProfile }) => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const menuItems = [
    { id: 'dashboard', label: t('menu_dashboard', 'Dashboard'), icon: LayoutDashboard },
    { id: 'trips', label: t('menu_trips', 'All Trips'), icon: ClipboardList },
    { id: 'payments', label: t('menu_payments', 'Payments'), icon: CreditCard, badge: pendingPaymentsCount },
    { id: 'odometer', label: t('menu_odometer', 'Odometer Records'), icon: Gauge },
    { id: 'trucks', label: t('menu_trucks', 'Truck Fleet'), icon: Truck },
    { id: 'drivers', label: t('menu_drivers', 'Drivers'), icon: Users },
    { id: 'sites', label: t('menu_sites', 'Sites & Locations'), icon: MapPin },
    { id: 'materials', label: t('menu_materials', 'Materials'), icon: Package },
    { id: 'routes', label: t('menu_routes', 'Routes & Pricing'), icon: Route },
    { id: 'fuel', label: t('menu_fuel', 'Fuel Requests'), icon: Fuel, badge: pendingFuelCount },
    { id: 'tolls', label: t('menu_tolls', 'Tolls & Other Expense'), icon: Coins },
    { id: 'expenses', label: t('menu_expenses', 'Other Expenses'), icon: Receipt },
    { id: 'maintenance', label: t('menu_maintenance', 'Maintenance'), icon: Wrench },
    { id: 'reports', label: t('menu_reports', 'Reports & Analytics'), icon: BarChart3 },
    { id: 'audit', label: t('menu_audit', 'Audit Logs'), icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-4 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] shadow-[2px_0_12px_rgba(0,0,0,0.02)] transition-colors duration-150">
      {/* Brand Header */}
      <div className="mb-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-2xl flex items-center gap-2.5">
        <div className="h-9 px-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-xs">
          <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-xs text-slate-900 dark:text-white tracking-wider truncate">{t('app_name', 'SINO FLEET')}</div>
          <div className="text-[10px] text-amber-500 font-semibold tracking-wider uppercase">{t('management_brand', 'Management')}</div>
        </div>
      </div>

      {/* "+ Create New Dispatch / Trip" Capsule Pill Button (Matching sample_ui_2.jpg) */}
      <button
        type="button"
        onClick={() => onSelectTab('trips')}
        className="w-full mb-4 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-full font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
      >
        <PlusCircle className="w-4 h-4 text-white" />
        <span>{t('create_new_trip', '+ Create New Trip')}</span>
      </button>

      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-3">
        {t('fleet_operations', 'Fleet Operations')}
      </div>

      {/* Navigation Links */}
      <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400 dark:text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge > 0 && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-slate-950 text-amber-400'
                      : 'bg-amber-500 text-slate-950 animate-pulse'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Fleet Pro Status Card (Matching Go Pro Card in sample_ui_2.jpg) */}
      <div className="my-3 p-3.5 bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-950/40 dark:to-slate-800/80 border border-indigo-200/60 dark:border-indigo-500/30 rounded-2xl relative overflow-hidden shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Fleet Telemetry Pro</span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-2.5">
          Real-time tracking, live fuel estimation & instant dispatch sync.
        </p>
        <button
          type="button"
          onClick={() => onSelectTab('reports')}
          className="w-full py-1.5 px-3 bg-white dark:bg-indigo-600 hover:bg-slate-50 dark:hover:bg-indigo-500 text-indigo-600 dark:text-white rounded-xl text-[11px] font-bold shadow-xs transition text-center cursor-pointer"
        >
          {t('open_analytics', 'Open Analytics')}
        </button>
      </div>

      {/* Pinned Bottom Items matching Reference UI (sample_ui.jpg: Help Center, Setting, Logout) */}
      <div className="pt-2 mt-auto border-t border-slate-100 dark:border-slate-800 space-y-1">
        <button
          onClick={() => onSelectTab('reports')}
          className="w-full flex items-center space-x-3 px-3.5 py-2 rounded-2xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80 transition cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>{t('help_center', 'Help Center')}</span>
        </button>
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center space-x-3 px-3.5 py-2 rounded-2xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80'
          }`}
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>{t('menu_settings', 'Settings')}</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-3.5 py-2 rounded-2xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/20 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-slate-400 hover:text-rose-500" />
          <span>{t('logout', 'Logout')}</span>
        </button>
      </div>

      {/* Admin Profile Box */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/80 mt-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 truncate">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
            {user?.full_name ? user.full_name.charAt(0) : 'A'}
          </div>
          <div className="truncate">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{user?.full_name}</div>
            <div className="text-[10px] text-slate-400">{t('administrator', 'Administrator')}</div>
          </div>
        </div>
        <button
          onClick={onOpenProfile}
          className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-amber-500 border border-slate-200/70 dark:border-transparent rounded-xl text-xs font-semibold shrink-0 cursor-pointer shadow-xs"
          title={t('edit_profile', 'Edit Profile')}
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
