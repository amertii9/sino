import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/common/Header';
import { LoginPage } from './components/common/LoginPage';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { AdminPortal } from './components/admin/AdminPortal';
import { Truck } from 'lucide-react';

const AppContent = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="px-6 py-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center animate-pulse shadow-2xl shadow-red-500/20">
          <img src="/logo.png" alt="SINO Fleet Logo" className="h-14 sm:h-16 w-auto object-contain filter drop-shadow-[0_4px_16px_rgba(255,28,28,0.3)]" />
        </div>
        <div className="text-sm font-bold text-slate-300">{t('loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col transition-colors duration-150">
      <Header />
      <div className="flex-1">
        {role === 'admin' ? <AdminPortal /> : <DriverDashboard />}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
