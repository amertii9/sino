import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';
import { AdminSidebar } from './AdminSidebar';
import { AdminDashboard } from './AdminDashboard';
import { TripsManagement } from './TripsManagement';
import { PaymentsManagement } from './PaymentsManagement';
import { OdometerRecordsView } from './OdometerRecordsView';
import { TruckManagement } from './TruckManagement';
import { DriverManagement } from './DriverManagement';
import { SitesManagement } from './SitesManagement';
import { MaterialsManagement } from './MaterialsManagement';
import { RoutesPricing } from './RoutesPricing';
import { FuelRequestsManagement } from './FuelRequestsManagement';
import { ExpensesManagement } from './ExpensesManagement';
import { TollsAndExpensesView } from './TollsAndExpensesView';
import { MaintenanceManagement } from './MaintenanceManagement';
import { ReportsView } from './ReportsView';
import { AuditLogsView } from './AuditLogsView';
import { SettingsView } from './SettingsView';
import { ProfileModal } from '../common/ProfileModal';

export const AdminPortal = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingFuelCount, setPendingFuelCount] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const fetchBadge = async () => {
    try {
      const [fuel, paySummary] = await Promise.all([
        api.get('/fuel-requests?status=pending'),
        api.get('/payments/summary'),
      ]);
      if (Array.isArray(fuel)) {
        setPendingFuelCount(fuel.length);
      }
      if (paySummary && typeof paySummary.pending_count === 'number') {
        setPendingPaymentsCount(paySummary.pending_count);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBadge();
    const interval = setInterval(fetchBadge, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      {/* Sidebar for Desktop */}
      <div className="hidden md:block">
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          pendingFuelCount={pendingFuelCount}
          pendingPaymentsCount={pendingPaymentsCount}
          onOpenProfile={() => setIsProfileOpen(true)}
        />
      </div>

      {/* Mobile Tab Selector */}
      <div className="md:hidden p-2 sm:p-3 bg-slate-900 border-b border-slate-800 overflow-x-auto flex space-x-1.5 scrollbar-none">
        {[
          { id: 'dashboard', label: t('menu_dashboard', 'Dashboard') },
          { id: 'trips', label: t('menu_trips', 'Trips') },
          { id: 'payments', label: `${t('menu_payments', 'Payments')}${pendingPaymentsCount > 0 ? ` (${pendingPaymentsCount})` : ''}` },
          { id: 'odometer', label: t('menu_odometer', 'Odometer') },
          { id: 'trucks', label: t('menu_trucks', 'Trucks') },
          { id: 'drivers', label: t('menu_drivers', 'Drivers') },
          { id: 'fuel', label: `${t('menu_fuel', 'Fuel')} (${pendingFuelCount})` },
          { id: 'tolls', label: t('menu_tolls', 'Tolls & Fees') },
          { id: 'expenses', label: t('menu_expenses', 'Expenses') },
          { id: 'reports', label: t('menu_reports', 'Reports') },
          { id: 'routes', label: t('menu_routes', 'Routes') },
          { id: 'sites', label: t('menu_sites', 'Sites') },
          { id: 'materials', label: t('menu_materials', 'Materials') },
          { id: 'maintenance', label: t('menu_maintenance', 'Maintenance') },
          { id: 'audit', label: t('menu_audit', 'Audit') },
          { id: 'settings', label: t('menu_settings', 'Settings') },
          { id: 'profile', label: t('my_profile', 'My Profile') },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'profile') {
                setIsProfileOpen(true);
              } else {
                setActiveTab(item.id);
              }
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === item.id ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl">
        {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
        {activeTab === 'trips' && <TripsManagement />}
        {activeTab === 'payments' && <PaymentsManagement onNavigate={setActiveTab} />}
        {activeTab === 'odometer' && <OdometerRecordsView />}
        {activeTab === 'trucks' && <TruckManagement />}
        {activeTab === 'drivers' && <DriverManagement />}
        {activeTab === 'sites' && <SitesManagement />}
        {activeTab === 'materials' && <MaterialsManagement />}
        {activeTab === 'routes' && <RoutesPricing />}
        {activeTab === 'fuel' && <FuelRequestsManagement />}
        {activeTab === 'tolls' && <TollsAndExpensesView />}
        {activeTab === 'expenses' && <ExpensesManagement />}
        {activeTab === 'maintenance' && <MaintenanceManagement />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'audit' && <AuditLogsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};
