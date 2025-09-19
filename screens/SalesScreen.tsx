import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TrashIcon } from '../components/Icons';
import type { Product, CartItem } from '../types';

const ProductCard: React.FC<{ product: Product; onClick: () => void; }> = ({ product, onClick }) => (
    <div
        onClick={onClick}
        className="bg-white rounded-xl sm:rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200 group flex flex-col h-full"
    >
        <img src={product.imageUrl} alt={product.name} className="h-24 sm:h-32 md:h-40 w-full object-cover" />
        <div className="p-2 sm:p-3 flex-1 flex flex-col justify-between">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-zinc-700">{product.name}</h3>
            <p className="text-sm sm:text-lg font-bold text-slate-900 mt-1">${product.price.toFixed(2)}</p>
        </div>
    </div>
);

const CartItemRow: React.FC<{ item: CartItem }> = ({ item }) => {
    const { updateCartQuantity, removeFromCart } = useAppContext();
    return (
        <div className="flex items-center justify-between py-3">
            <div className="flex-1">
                <p className="font-medium text-sm text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-500">${item.price.toFixed(2)}</p>
            </div>
            <div className="flex items-center">
                <input 
                    type="number" 
                    value={item.quantity} 
                    onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value))}
                    className="w-14 text-center border-slate-300 rounded-lg shadow-sm py-1 text-sm mx-2"
                    min="1"
                />
            </div>
            <p className="w-16 text-right font-medium text-sm text-slate-900">${(item.price * item.quantity).toFixed(2)}</p>
            <button onClick={() => removeFromCart(item.id)} className="ml-2 p-1 text-slate-500 hover:text-red-600 rounded-full">
                <TrashIcon className="h-4 w-4" />
            </button>
        </div>
    );
};

const Cart: React.FC = () => {
    const { cart, cartTotal, createOrder, clearCart } = useAppContext();
    const [clientName, setClientName] = useState('');
    const [serviceType, setServiceType] = useState<'Mesa' | 'Para llevar'>('Mesa');
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta'>('Efectivo');
    const [isCheckingOut, setIsCheckingOut] = useState(false);


    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!isCheckingOut) {
            setIsCheckingOut(true);
            return;
        }
        createOrder({ clientName, serviceType, paymentMethod });
        setIsCheckingOut(false);
        setClientName('');
        setServiceType('Mesa');
    };

    const handleCancelCheckout = () => {
        setIsCheckingOut(false);
    }

    return (
        <div className="bg-white rounded-xl sm:rounded-3xl shadow-md flex flex-col h-64 sm:h-80 lg:h-full">
            <div className="p-3 sm:p-4 border-b">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">Orden Actual</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                {cart.length > 0 ? (
                    cart.map(item => <CartItemRow key={item.id} item={item} />)
                ) : (
                    <p className="text-center text-slate-500 mt-8">El carrito está vacío.</p>
                )}
            </div>
            
            {isCheckingOut && (
                <div className="p-4 border-t">
                    <h3 className="text-md font-semibold text-slate-700 mb-3">Detalles de la Orden</h3>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="clientName" className="block text-xs font-medium text-slate-600">Nombre del Cliente (Opcional)</label>
                            <input type="text" name="clientName" id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-1.5 px-2 sm:text-sm"/>
                        </div>
                        <div>
                            <label htmlFor="serviceType" className="block text-xs font-medium text-slate-600">Tipo de Servicio</label>
                            <select name="serviceType" id="serviceType" value={serviceType} onChange={(e) => setServiceType(e.target.value as any)} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-1.5 px-2 sm:text-sm">
                                <option>Mesa</option>
                                <option>Para llevar</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="paymentMethod" className="block text-xs font-medium text-slate-600">Método de Pago</label>
                             <select name="paymentMethod" id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-1.5 px-2 sm:text-sm">
                                <option>Efectivo</option>
                                <option>Tarjeta</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 pb-6 lg:pb-4 border-t bg-slate-50 rounded-b-3xl">
                 <div className="space-y-2 text-sm mb-4">
                     <div className="flex justify-between text-lg font-bold">
                        <span className="text-slate-900">Total:</span>
                        <span>${cartTotal.toFixed(2)}</span>
                    </div>
                </div>
                <div className="flex space-x-2">
                     <button onClick={isCheckingOut ? handleCancelCheckout : clearCart} className="w-full py-3 px-4 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                        {isCheckingOut ? 'Cancelar' : 'Limpiar'}
                    </button>
                    <button onClick={handleCheckout} disabled={cart.length === 0} className="w-full py-3 px-4 bg-zinc-900 rounded-xl text-sm font-semibold text-white hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed">
                        {isCheckingOut ? `Pagar $${cartTotal.toFixed(2)}` : 'Cobrar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const SalesScreen: React.FC = () => {
    const { products, addToCart } = useAppContext();

    const groupedProducts = products.reduce((acc, product) => {
        const category = product.category || 'Sin categoría';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(product);
        return acc;
    }, {} as Record<string, Product[]>);
  
    return (
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-6 h-full">
            <div className="flex-1 lg:col-span-2 lg:overflow-y-auto lg:pr-2 min-h-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4 sm:mb-6">Punto de Venta</h1>
                {Object.entries(groupedProducts).map(([category, productsInCategory]) => (
                    <div key={category} className="mb-8">
                        <h2 className="text-xl font-semibold text-slate-700 mb-4 border-b pb-2">{category}</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
                            {productsInCategory.map(product => (
                                <ProductCard key={product.id} product={product} onClick={() => addToCart(product)} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex-shrink-0 mt-4 lg:mt-0 lg:col-span-1 lg:h-full">
                <Cart />
            </div>
        </div>
    );
};

export default SalesScreen;