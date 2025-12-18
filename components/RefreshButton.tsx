import React, { useState } from 'react';

interface RefreshButtonProps {
  onRefresh: () => Promise<void> | void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  label = 'Actualizar',
  size = 'md'
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      // Keep spinning for at least 500ms for visual feedback
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`
        ${sizeClasses[size]}
        flex items-center gap-2
        bg-blue-600 hover:bg-blue-700
        text-white font-medium rounded-lg
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        shadow-sm hover:shadow-md
        active:scale-95
      `}
      aria-label={label}
    >
      <svg
        className={`${iconSize[size]} ${isRefreshing ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default RefreshButton;
