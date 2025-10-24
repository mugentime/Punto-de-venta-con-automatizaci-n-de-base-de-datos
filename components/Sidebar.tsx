import React, { useState, useRef, useEffect } from 'react';
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
    iconSize?: 'small' | 'medium' | 'large';
}> = ({ icon, label, isActive, onClick, iconSize = 'medium' }) => {
    // Minimum 44x44px touch targets (iOS HIG guidelines)
    const baseClasses = "flex flex-col items-center justify-center text-center min-w-0 flex-1 min-h-[44px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-lg";

    // More prominent active state for mobile
    const activeClasses = "text-white bg-white/10 scale-105";
    const inactiveClasses = "text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/15";

    // Responsive icon sizing
    const iconSizeClasses = {
        small: "h-5 w-5 sm:h-6 sm:w-6",
        medium: "h-6 w-6 md:h-7 md:w-7",
        large: "h-7 w-7 md:h-8 md:w-8"
    };

    // Clone icon with responsive sizing
    const responsiveIcon = React.cloneElement(icon as React.ReactElement, {
        className: iconSizeClasses[iconSize]
    });

    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            data-haptic="light"
            type="button"
        >
            {responsiveIcon}
            <span className="text-[10px] sm:text-xs md:text-sm mt-0.5 leading-tight truncate max-w-full px-1 font-medium">
                {label}
            </span>
        </button>
    );
};


const BottomNav: React.FC<BottomNavProps> = ({ currentView, setCurrentView }) => {
  const { currentUser, logout } = useAppContext();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'sales', label: 'Ventas', icon: <SalesIcon />, show: true, priority: 1 },
    { id: 'products', label: 'Productos', icon: <ProductsIcon />, show: true, priority: 2 },
    { id: 'cash_report', label: 'Caja', icon: <CashIcon />, show: true, priority: 3 },
    { id: 'coworking', label: 'Cowork', icon: <CoworkingIcon />, show: true, priority: 4 },
    { id: 'customers', label: 'Clientes', icon: <UsersIcon />, show: true, priority: 5 },
    { id: 'history', label: 'Historial', icon: <HistoryIcon />, show: true, priority: 6 },
    { id: 'expenses', label: 'Gastos', icon: <ExpenseIcon />, show: true, priority: 7 },
    { id: 'reports', label: 'Reportes', icon: <ReportIcon />, show: true, priority: 8 },
    { id: 'admin', label: 'Admin', icon: <UsersIcon />, show: currentUser?.role === 'admin', priority: 9 },
  ];

  const visibleItems = navItems.filter(item => item.show);

  // Determine if we need overflow handling based on screen size
  // Mobile: show max 5 items + More button, Tablet: show max 7 items, Desktop: show all
  const maxVisibleItems = {
    mobile: 5,  // < 640px
    tablet: 7,  // 640px - 1024px
    desktop: visibleItems.length // > 1024px
  };

  useEffect(() => {
    const checkOverflow = () => {
      const width = window.innerWidth;
      let maxItems = maxVisibleItems.desktop;

      if (width < 640) {
        maxItems = maxVisibleItems.mobile;
      } else if (width < 1024) {
        maxItems = maxVisibleItems.tablet;
      }

      setIsScrollable(visibleItems.length + 1 > maxItems); // +1 for logout button
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [visibleItems.length]);

  const primaryItems = isScrollable
    ? visibleItems.slice(0, window.innerWidth < 640 ? 4 : 6)
    : visibleItems;

  const moreItems = isScrollable
    ? visibleItems.slice(window.innerWidth < 640 ? 4 : 6)
    : [];

  const handleItemClick = (view: View) => {
    setCurrentView(view);
    setShowMoreMenu(false);
  };

  return (
    <>
      {/* More Menu Overlay */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setShowMoreMenu(false)}
          data-haptic="light"
        >
          <div
            className="fixed bottom-20 sm:bottom-24 left-4 right-4 bg-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-1 p-2">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id as View)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl min-h-[80px] transition-all ${
                    currentView === item.id
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white active:bg-white/15'
                  }`}
                  data-haptic="light"
                >
                  {React.cloneElement(item.icon as React.ReactElement, {
                    className: "h-7 w-7 mb-2"
                  })}
                  <span className="text-xs font-medium text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar with safe area insets */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex-shrink-0 bg-zinc-900 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] rounded-t-3xl z-50"
        style={{
          height: 'calc(4rem + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div
          ref={scrollContainerRef}
          className={`flex items-center h-16 sm:h-20 mx-auto ${
            isScrollable
              ? 'justify-start overflow-x-auto scrollbar-hidden scroll-smooth-mobile px-2 gap-1'
              : 'justify-around px-1'
          }`}
        >
          {/* Primary Navigation Items */}
          {primaryItems.map((item) => (
            <NavItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              isActive={currentView === item.id}
              onClick={() => handleItemClick(item.id as View)}
              iconSize={window.innerWidth < 640 ? 'medium' : 'large'}
            />
          ))}

          {/* More Button (only shown when items overflow) */}
          {isScrollable && moreItems.length > 0 && (
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`flex flex-col items-center justify-center text-center min-w-[60px] min-h-[44px] transition-all duration-200 rounded-lg ${
                showMoreMenu
                  ? 'text-white bg-white/10 scale-105'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/15'
              }`}
              aria-label="Más opciones"
              aria-expanded={showMoreMenu}
              data-haptic="light"
              type="button"
            >
              <svg className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
              <span className="text-[10px] sm:text-xs md:text-sm mt-0.5 leading-tight font-medium">Más</span>
            </button>
          )}

          {/* Logout Button - ALWAYS requires confirmation to prevent accidental taps */}
          <NavItem
            key="logout"
            label="Salir"
            icon={<LogoutIcon />}
            isActive={false}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Clear, explicit confirmation message
              const confirmMsg = 'CERRAR SESIÓN\n\n¿Estás seguro de que deseas salir?\n\nSe perderá cualquier trabajo no guardado.';
              if (window.confirm(confirmMsg)) {
                logout();
              }
            }}
            iconSize={window.innerWidth < 640 ? 'medium' : 'large'}
          />
        </div>
      </nav>
    </>
  );
};

export default BottomNav;