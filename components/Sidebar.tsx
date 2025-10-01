import React from 'react';
import type { View } from '../App';
import { DashboardIcon, SalesIcon, ProductsIcon, HistoryIcon, CashIcon, ExpenseIcon, CoworkingIcon, ReportIcon, UsersIcon, LogoutIcon } from './Icons';
import { useAppContext } from '../contexts/AppContext';

interface BottomNavProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => {
    const baseClasses = "flex flex-col items-center justify-center text-center min-w-0 flex-1 py-1 sm:py-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";
    const activeClasses = "text-white";
    const inactiveClasses = "text-gray-400 hover:text-white";
    
    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
            aria-label={label}
        >
            {icon}
            <span className="text-xs sm:text-xs mt-0.5 leading-tight truncate max-w-full">{label}</span>
        </button>
    );
};


const BottomNav: React.FC<BottomNavProps> = ({ currentView, setCurrentView }) => {
  const { currentUser, logout } = useAppContext();

  const navItems = [
    { id: 'sales', label: 'Ventas', icon: <SalesIcon className="h-5 w-5"/>, show: true },
    { id: 'products', label: 'Productos', icon: <ProductsIcon className="h-5 w-5"/>, show: true },
    { id: 'cash_report', label: 'Caja', icon: <CashIcon className="h-5 w-5"/>, show: true },
    { id: 'coworking', label: 'Cowork', icon: <CoworkingIcon className="h-5 w-5"/>, show: true },
    { id: 'customers', label: 'Clientes', icon: <UsersIcon className="h-5 w-5"/>, show: true },
    { id: 'history', label: 'Historial', icon: <HistoryIcon className="h-5 w-5"/>, show: true },
    { id: 'expenses', label: 'Gastos', icon: <ExpenseIcon className="h-5 w-5"/>, show: true },
    { id: 'reports', label: 'Reportes', icon: <ReportIcon className="h-5 w-5"/>, show: true },
    { id: 'admin', label: 'Admin', icon: <UsersIcon className="h-5 w-5"/>, show: currentUser?.role === 'admin' },
  ];

  const visibleItems = navItems.filter(item => item.show);

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex-shrink-0 h-16 sm:h-20 bg-zinc-900 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] rounded-t-3xl z-50">
        <div className="flex justify-around items-center h-full mx-auto px-1">
            {visibleItems.map((item) => (
                <NavItem
                    key={item.id}
                    label={item.label}
                    icon={item.icon}
                    isActive={currentView === item.id}
                    onClick={() => setCurrentView(item.id as View)}
                />
            ))}
            <NavItem
                key="logout"
                label="Salir"
                icon={<LogoutIcon className="h-6 w-6" />}
                isActive={false}
                onClick={logout}
            />
        </div>
    </nav>
  );
};

export default BottomNav;