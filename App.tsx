import React, { useState } from 'react';
import BottomNav from './components/Sidebar';
import DashboardScreen from './screens/DashboardScreen';
import SalesScreen from './screens/SalesScreen';
import ProductsScreen from './screens/ProductsScreen';
import HistoryScreen from './screens/HistoryScreen';
import CashReportScreen from './screens/CashReportScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import CoworkingScreen from './screens/CoworkingScreen';
import ReportsScreen from './screens/ReportsScreen';
import { AppContextProvider, useAppContext } from './contexts/AppContext';

// New screen imports
import AdminScreen from './screens/AdminScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

export type View = 'dashboard' | 'sales' | 'products' | 'history' | 'cash_report' | 'expenses' | 'coworking' | 'reports' | 'admin';

const MainLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('sales');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'sales':
        return <SalesScreen />;
      case 'products':
        return <ProductsScreen />;
      case 'history':
        return <HistoryScreen />;
      case 'cash_report':
        return <CashReportScreen />;
      case 'expenses':
        return <ExpensesScreen />;
      case 'coworking':
        return <CoworkingScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'admin':
        return <AdminScreen />;
      default:
        return <SalesScreen />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100/80 font-sans">
      <main className="flex-1 overflow-y-auto p-2 pb-4 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {renderView()}
        </div>
      </main>
      <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { currentUser } = useAppContext();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (!currentUser) {
    if (authMode === 'login') {
      return <LoginScreen onSwitchToRegister={() => setAuthMode('register')} />;
    }
    return <RegisterScreen onSwitchToLogin={() => setAuthMode('login')} />;
  }

  return <MainLayout />;
};


const App: React.FC = () => {
  return (
    <AppContextProvider>
      <AppContent />
    </AppContextProvider>
  );
};

export default App;