import React, { useState, lazy, Suspense, memo, useEffect } from 'react';
import BottomNav from './components/Sidebar';
import { AppContextProvider, useAppContext } from './contexts/AppContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { OperationProvider } from './contexts/OperationContext';
import ConnectionIndicator from './components/ConnectionIndicator';

// Login/Register screens loaded immediately (authentication needed)
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

// Lazy load screens for better performance
const DashboardScreen = lazy(() => import('./screens/DashboardScreen'));
const SalesScreen = lazy(() => import('./screens/SalesScreen'));
const ProductsScreen = lazy(() => import('./screens/ProductsScreen'));
const HistoryScreen = lazy(() => import('./screens/HistoryScreen'));
const CashReportScreen = lazy(() => import('./screens/CashReportScreen'));
const ExpensesScreen = lazy(() => import('./screens/ExpensesScreen'));
const CoworkingScreen = lazy(() => import('./screens/CoworkingScreen'));
const ReportsScreen = lazy(() => import('./screens/ReportsScreen'));
const CustomersScreen = lazy(() => import('./screens/CustomersScreen'));
const AdminScreen = lazy(() => import('./screens/AdminScreen'));

// Loading component for lazy-loaded screens
const ScreenLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full min-h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

export type View = 'dashboard' | 'sales' | 'products' | 'history' | 'cash_report' | 'expenses' | 'coworking' | 'reports' | 'customers' | 'admin';

const MainLayout: React.FC = memo(() => {
  const [currentView, setCurrentView] = useState<View>('sales');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Detect orientation changes for better mobile UX
  useEffect(() => {
    const updateOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  const renderView = () => {
    const screen = (() => {
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
        case 'customers':
          return <CustomersScreen />;
        case 'admin':
          return <AdminScreen />;
        default:
          return <SalesScreen />;
      }
    })();

    return (
      <Suspense fallback={<ScreenLoader />}>
        {screen}
      </Suspense>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100/80 font-sans">
      <ConnectionIndicator />
      {/*
        Mobile-first responsive padding strategy:
        - Mobile (default): minimal padding (p-1), large bottom padding for nav (pb-20)
        - Small phones (sm): slightly more padding (p-2), adjusted bottom (pb-24)
        - Tablets portrait (md): comfortable padding (p-4), more space (pb-28)
        - Tablets landscape/Desktop (lg): generous padding (p-6 lg:p-8), consistent bottom (pb-28)
        - Safe area insets: env(safe-area-inset-*) for notches and rounded corners
      */}
      <main
        className={`
          flex-1 overflow-y-auto overflow-x-hidden
          p-1 pb-20
          sm:p-2 sm:pb-24
          md:p-4 md:pb-28
          lg:p-6 lg:pb-28
          xl:p-8 xl:pb-28
          ${orientation === 'landscape' ? 'pb-16 sm:pb-20' : ''}
          touch-pan-y
        `}
        style={{
          // Safe area support for modern phones with notches
          paddingLeft: 'max(0.25rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.25rem, env(safe-area-inset-right))',
          paddingTop: 'max(0.25rem, env(safe-area-inset-top))',
          // Smooth scrolling on iOS
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="max-w-7xl mx-auto w-full">
          {renderView()}
        </div>
      </main>
      <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
    </div>
  );
});

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
    <OperationProvider>
      <WebSocketProvider>
        <AppContextProvider>
          <AppContent />
        </AppContextProvider>
      </WebSocketProvider>
    </OperationProvider>
  );
};

export default App;