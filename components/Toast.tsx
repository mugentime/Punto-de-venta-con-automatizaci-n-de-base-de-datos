import React, { useEffect } from 'react';

interface ToastProps {
    message: string;
    productName?: string;
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, productName, onClose, duration = 2000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    return (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
            <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3 min-w-[280px]">
                <div className="flex-shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-sm">{message}</p>
                    {productName && <p className="text-xs opacity-90 mt-1">{productName}</p>}
                </div>
            </div>
        </div>
    );
};

export default Toast;
