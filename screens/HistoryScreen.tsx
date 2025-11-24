import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TrashIcon } from '../components/Icons';
import type { Order } from '../types';

const OrderDetailsModal: React.FC<{ order: Order, onClose: () => void }> = ({ order, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg">
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Detalles de la Orden</h2>
                        <p className="text-sm text-slate-500 font-mono mt-1">ID: {order.id}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-800 -mt-2 -mr-2 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <p className="text-sm text-slate-500 mb-4">Fecha: {new Date(order.date).toLocaleString()}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-2xl">
                    <div>Cliente: <span className="font-medium text-slate-700 block">{order.clientName || 'N/A'}</span></div>
                    <div>Servicio: <span className="font-medium text-slate-700 block">{order.serviceType}</span></div>
                    <div>Pago: <span className="font-medium text-slate-700 block">{order.paymentMethod}</span></div>
                </div>

                <div className="border-t border-b py-2 my-4 space-y-2 max-h-48 overflow-y-auto">
                    {order.items.map(item => (
                        <div key={item.id} className="flex justify-between items-center text-sm pr-2">
                            <div>
                                <p className="font-medium text-slate-800">{item.name}</p>
                                <p className="text-slate-500">{item.quantity} x ${item.price.toFixed(2)}</p>
                            </div>
                            <p className="text-slate-700 font-medium">${(item.quantity * item.price).toFixed(2)}</p>
                        </div>
                    ))}
                </div>

                <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Subtotal:</span> <span className="text-slate-700">${order.subtotal.toFixed(2)}</span></div>
                    {order.discount && order.discount > 0 && (
                        <div className="flex justify-between text-green-600"><span>Descuento:</span> <span>-${order.discount.toFixed(2)}</span></div>
                    )}
                    {order.tip && order.tip > 0 && (
                        <div className="flex justify-between"><span className="text-slate-600">Propina:</span> <span className="text-slate-700">+${order.tip.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-2 border-t mt-2"><span className="text-slate-800">Total:</span> <span>${order.total.toFixed(2)}</span></div>
                </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end rounded-b-3xl">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-zinc-900 border border-transparent rounded-xl text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500">Cerrar</button>
            </div>
        </div>
    </div>
);

const HistoryScreen: React.FC = () => {
    const { orders, deleteOrder, refetchOrders } = useAppContext();
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // ✅ SINGLE useEffect with combined logic to prevent re-render cycles
    useEffect(() => {
        console.log('📊 HistoryScreen mounted - initial fetch');

        // Initial fetch on mount
        refetchOrders();

        // Set up polling interval (only when tab is visible)
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                console.log('🔄 Polling: Refetching orders...');
                refetchOrders();
            }
        }, 30000); // 30 seconds

        // Set up visibility change handler
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('👁️ Tab focused - refetching orders...');
                refetchOrders();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency - only run on mount

    const handleDelete = async (orderId: string) => {
        if (confirm('¿Estás seguro de que deseas eliminar esta orden? Esta acción no se puede deshacer.')) {
            try {
                await deleteOrder(orderId);
                alert('Orden eliminada exitosamente');
            } catch (error) {
                console.error('Error deleting order:', error);
            }
        }
    };

    return (
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6">Historial de Órdenes</h1>
            <div className="bg-white shadow-md rounded-3xl overflow-hidden">
                {/* Desktop Table View */}
                <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-4 text-sm font-semibold text-slate-600">Hora</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Cliente</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Servicio</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Consumo</th>
                                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Total</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Tipo de Pago</th>
                                <th className="p-4 text-sm font-semibold text-slate-600 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map(order => {
                                const orderDate = new Date(order.date);
                                const timeString = orderDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                                const isCoworking = order.items.some(item => item.id === 'COWORK_SERVICE' || item.name.includes('Coworking'));
                                const serviceType = isCoworking ? 'Coworking' : 'Cafetería';
                                const serviceColor = isCoworking ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800';
                                const productsList = order.items
                                    .filter(item => item.id !== 'COWORK_SERVICE')
                                    .map(item => `${item.name} (${item.quantity})`)
                                    .join(', ') || 'Servicio';

                                return (
                                    <tr key={order.id} className="border-b hover:bg-slate-50">
                                        <td className="p-4 text-sm text-slate-800 font-medium">{timeString}</td>
                                        <td className="p-4 text-sm text-slate-800">{order.clientName || 'Cliente general'}</td>
                                        <td className="p-4 text-sm">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${serviceColor}`}>
                                                {serviceType}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={productsList}>
                                            {productsList}
                                        </td>
                                        <td className="p-4 text-sm text-slate-800 font-bold text-right">${order.total.toFixed(2)}</td>
                                        <td className="p-4 text-sm">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                order.paymentMethod === 'Efectivo'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : order.paymentMethod === 'Tarjeta'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {order.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-center">
                                            <div className="flex justify-center items-center space-x-2">
                                                <button onClick={() => setSelectedOrder(order)} className="text-zinc-700 hover:underline font-medium">Ver</button>
                                                <button
                                                    onClick={() => handleDelete(order.id)}
                                                    className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors"
                                                    title="Eliminar orden"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden">
                    {orders.map(order => {
                        const orderDate = new Date(order.date);
                        const timeString = orderDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                        const isCoworking = order.items.some(item => item.id === 'COWORK_SERVICE' || item.name.includes('Coworking'));
                        const serviceType = isCoworking ? 'Coworking' : 'Cafetería';
                        const serviceColor = isCoworking ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800';
                        const productsList = order.items
                            .filter(item => item.id !== 'COWORK_SERVICE')
                            .map(item => `${item.name} (${item.quantity})`)
                            .join(', ') || 'Servicio';

                        return (
                            <div key={order.id} className="border-b p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-800 font-semibold">{order.clientName || 'Cliente general'}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{timeString}</p>
                                    </div>
                                    <p className="text-lg font-bold text-slate-800">${order.total.toFixed(2)}</p>
                                </div>
                                <div className="mb-2">
                                    <p className="text-xs text-slate-500 mb-1">Consumo:</p>
                                    <p className="text-sm text-slate-700 line-clamp-2">{productsList}</p>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${serviceColor}`}>
                                        {serviceType}
                                    </span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        order.paymentMethod === 'Efectivo'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : order.paymentMethod === 'Tarjeta'
                                            ? 'bg-purple-100 text-purple-800'
                                            : 'bg-amber-100 text-amber-800'
                                    }`}>
                                        {order.paymentMethod}
                                    </span>
                                </div>
                                <div className="flex justify-end items-center space-x-2">
                                    <button onClick={() => setSelectedOrder(order)} className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-200">Ver Detalles</button>
                                    <button
                                        onClick={() => handleDelete(order.id)}
                                        className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors"
                                        title="Eliminar orden"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                 {orders.length === 0 && (
                    <p className="text-center text-slate-500 py-8">No hay órdenes registradas.</p>
                )}
            </div>
            {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
        </div>
    );
};

export default HistoryScreen;