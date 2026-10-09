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
  CreditCard
} from 'lucide-react';

export const AdminSidebar = ({ activeTab, onSelectTab, pendingFuelCount = 0, pendingPaymentsCount = 0, onOpenProfile }) => {
  const { user } = useAuth();
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
    { id: 'settings', label: t('menu_settings', 'System Settings'), icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="mb-3 px-2.5 py-2 bg-slate-800/50 border border-slate-700/60 rounded-2xl flex items-center gap-2.5">
        <div className="h-9 px-1.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
          <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" />
        </div>
        <div className="min-w-0">
          <div className="font-black text-xs text-white tracking-wider truncate">SINO FLEET</div>
          <div className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase">Management</div>
        </div>
      </div>

      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-3">
        {t('fleet_operations', 'Fleet Operations')}
      </div>

      <nav className="space-y-1 flex-1">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
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

      {/* Admin Profile Box */}
      <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 truncate">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
            {user?.full_name ? user.full_name.charAt(0) : 'A'}
          </div>
          <div className="truncate">
            <div className="text-xs font-bold text-slate-100 truncate">{user?.full_name}</div>
            <div className="text-[10px] text-slate-400">{t('administrator', 'Administrator')}</div>
          </div>
        </div>
        <button
          onClick={onOpenProfile}
          className="p-1.5 bg-slate-700 hover:bg-slate-600 text-amber-400 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
          title={t('edit_profile', 'Edit Profile')}
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
