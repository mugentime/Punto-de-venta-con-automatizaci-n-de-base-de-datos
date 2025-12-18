import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TrashIcon } from '../components/Icons';
import Toast from '../components/Toast';
import RefreshButton from '../components/RefreshButton';
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
    const { cart, cartTotal, createOrder, clearCart, customers, refetchAll } = useAppContext();
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [customClientName, setCustomClientName] = useState('');
    const [serviceType, setServiceType] = useState<'Mesa' | 'Para llevar'>('Mesa');
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Crédito'>('Efectivo');
    const [tip, setTip] = useState<number>(0);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [checkoutToast, setCheckoutToast] = useState<{ message: string; productName: string } | null>(null);

    // Get selected customer
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

    // Calculate discount
    const discount = selectedCustomer ? (cartTotal * selectedCustomer.discountPercentage / 100) : 0;
    const finalTotal = cartTotal - discount + tip;

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!isCheckingOut) {
            setIsCheckingOut(true);
            return;
        }

        // Determine client name and customer ID
        const clientName = selectedCustomerId === 'other' ? customClientName : (selectedCustomer?.name || 'Cliente');
        const customerId = selectedCustomer ? selectedCustomer.id : undefined;

        setIsProcessing(true);
        try {
            await createOrder({ clientName, serviceType, paymentMethod, customerId, tip });
            // Cart is already cleared by createOrder on success

            // 🚀 PERF FIX: Show non-blocking toast instead of alert
            setCheckoutToast({
                message: `✅ Venta guardada`,
                productName: `${clientName} - $${finalTotal.toFixed(2)}`
            });

            setIsCheckingOut(false);
            setSelectedCustomerId('');
            setCustomClientName('');
            setServiceType('Mesa');
            setPaymentMethod('Efectivo');
            setTip(0);
        } catch (error) {
            // Show error toast instead of alert
            console.error('Checkout failed:', error);
            setCheckoutToast({
                message: '❌ Error al guardar',
                productName: 'Intente de nuevo'
            });
            setIsCheckingOut(false);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelCheckout = () => {
        setIsCheckingOut(false);
    }

    return (
        <div className={`bg-white rounded-xl sm:rounded-3xl shadow-md flex flex-col ${isCheckingOut ? 'h-[calc(100vh-8rem)]' : 'h-64'} sm:h-80 lg:h-full`}>
            {checkoutToast && (
                <Toast
                    message={checkoutToast.message}
                    productName={checkoutToast.productName}
                    onClose={() => setCheckoutToast(null)}
                />
            )}
            <div className="p-2 sm:p-4 border-b flex-shrink-0">
                <h2 className="text-base sm:text-xl font-bold text-slate-800">Orden Actual</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 min-h-0">
                {cart.length > 0 ? (
                    cart.map(item => <CartItemRow key={item.id} item={item} />)
                ) : (
                    <p className="text-center text-slate-500 mt-8 text-sm">El carrito está vacío.</p>
                )}
            </div>

            {isCheckingOut && (
                <div className="p-2 sm:p-4 border-t flex-shrink-0 max-h-[60vh] sm:max-h-none overflow-y-auto">
                    <h3 className="text-sm sm:text-md font-semibold text-slate-700 mb-2 sm:mb-3">Detalles de la Orden</h3>
                    <div className="space-y-2 sm:space-y-3">
                        <div>
                            <label htmlFor="customerSelect" className="block text-[10px] sm:text-xs font-medium text-slate-600 mb-0.5">Cliente</label>
                            <select
                                name="customerSelect"
                                id="customerSelect"
                                value={selectedCustomerId}
                                onChange={(e) => {
                                    setSelectedCustomerId(e.target.value);
                                    if (e.target.value !== 'other') {
                                        setCustomClientName('');
                                    }
                                }}
                                className="mt-0.5 block w-full border border-slate-300 rounded-lg sm:rounded-xl shadow-sm py-1 sm:py-1.5 px-1.5 sm:px-2 text-xs sm:text-sm"
                            >
                                <option value="">Seleccionar cliente...</option>
                                {customers.map(customer => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name} {customer.discountPercentage > 0 ? `(${customer.discountPercentage}% desc.)` : ''}
                                    </option>
                                ))}
                                <option value="other">Otro (nombre personalizado)</option>
                            </select>
                        </div>

                        {selectedCustomerId === 'other' && (
                            <div>
                                <label htmlFor="customClientName" className="block text-[10px] sm:text-xs font-medium text-slate-600 mb-0.5">Nombre del Cliente</label>
                                <input
                                    type="text"
                                    name="customClientName"
                                    id="customClientName"
                                    value={customClientName}
                                    onChange={(e) => setCustomClientName(e.target.value)}
                                    className="mt-0.5 block w-full border border-slate-300 rounded-lg sm:rounded-xl shadow-sm py-1 sm:py-1.5 px-1.5 sm:px-2 text-xs sm:text-sm"
                                    placeholder="Escribe el nombre..."
                                />
                            </div>
                        )}

                        {selectedCustomer && selectedCustomer.discountPercentage > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-1.5 sm:p-2">
                                <p className="text-[10px] sm:text-xs text-green-700">
                                    <span className="font-semibold">Descuento:</span> {selectedCustomer.discountPercentage}% (-${discount.toFixed(2)})
                                </p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="serviceType" className="block text-[10px] sm:text-xs font-medium text-slate-600 mb-0.5">Tipo de Servicio</label>
                            <select name="serviceType" id="serviceType" value={serviceType} onChange={(e) => setServiceType(e.target.value as any)} className="mt-0.5 block w-full border border-slate-300 rounded-lg sm:rounded-xl shadow-sm py-1 sm:py-1.5 px-1.5 sm:px-2 text-xs sm:text-sm">
                                <option>Mesa</option>
                                <option>Para llevar</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="paymentMethod" className="block text-[10px] sm:text-xs font-medium text-slate-600 mb-0.5">Método de Pago</label>
                             <select name="paymentMethod" id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="mt-0.5 block w-full border border-slate-300 rounded-lg sm:rounded-xl shadow-sm py-1 sm:py-1.5 px-1.5 sm:px-2 text-xs sm:text-sm">
                                <option>Efectivo</option>
                                <option>Tarjeta</option>
                                {selectedCustomer && <option>Crédito</option>}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="tipAmount" className="block text-[10px] sm:text-xs font-medium text-slate-600 mb-0.5">Propina (opcional)</label>
                            <input
                                type="number"
                                name="tipAmount"
                                id="tipAmount"
                                value={tip}
                                onChange={(e) => setTip(parseFloat(e.target.value) || 0)}
                                className="mt-0.5 block w-full border border-slate-300 rounded-lg sm:rounded-xl shadow-sm py-1 sm:py-1.5 px-1.5 sm:px-2 text-xs sm:text-sm"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>

                        {paymentMethod === 'Crédito' && selectedCustomer && (
                            <div className={`border rounded-lg p-1.5 sm:p-2 ${selectedCustomer.currentCredit + finalTotal > selectedCustomer.creditLimit ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                                <p className="text-[10px] sm:text-xs">
                                    <span className="font-semibold">Crédito actual:</span> ${selectedCustomer.currentCredit.toFixed(2)}
                                </p>
                                <p className="text-[10px] sm:text-xs">
                                    <span className="font-semibold">Nuevo crédito:</span> ${(selectedCustomer.currentCredit + finalTotal).toFixed(2)}
                                </p>
                                <p className="text-[10px] sm:text-xs">
                                    <span className="font-semibold">Límite:</span> ${selectedCustomer.creditLimit.toFixed(2)}
                                </p>
                                {selectedCustomer.currentCredit + finalTotal > selectedCustomer.creditLimit && (
                                    <p className="text-[10px] sm:text-xs text-red-600 font-semibold mt-0.5 sm:mt-1">⚠️ Excede límite</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="p-2 sm:p-4 pb-4 sm:pb-6 lg:pb-4 border-t bg-slate-50 rounded-b-3xl flex-shrink-0">
                 <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm mb-2 sm:mb-4">
                     {discount > 0 && (
                         <>
                             <div className="flex justify-between text-xs sm:text-sm text-slate-600">
                                <span>Subtotal:</span>
                                <span>${cartTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm text-green-600">
                                <span>Desc. ({selectedCustomer?.discountPercentage}%):</span>
                                <span>-${discount.toFixed(2)}</span>
                            </div>
                         </>
                     )}
                     {tip > 0 && (
                         <div className="flex justify-between text-xs sm:text-sm text-slate-600">
                            <span>Propina:</span>
                            <span>+${tip.toFixed(2)}</span>
                        </div>
                     )}
                     <div className="flex justify-between text-base sm:text-lg font-bold">
                        <span className="text-slate-900">Total:</span>
                        <span>${finalTotal.toFixed(2)}</span>
                    </div>
                </div>
                <div className="flex space-x-1.5 sm:space-x-2">
                     <button onClick={isCheckingOut ? handleCancelCheckout : clearCart} disabled={isProcessing} className="w-full py-2 sm:py-3 px-2 sm:px-4 bg-white border border-slate-300 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isCheckingOut ? 'Cancelar' : 'Limpiar'}
                    </button>
                    <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing} className="w-full py-2 sm:py-3 px-2 sm:px-4 bg-zinc-900 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed">
                        {isProcessing ? '⏳...' : (isCheckingOut ? `Pagar $${finalTotal.toFixed(2)}` : 'Cobrar')}
                    </button>
                </div>
            </div>
        </div>
    );
}

const SalesScreen: React.FC = () => {
    const { products, addToCart, refetchAll } = useAppContext();
    const [toastMessage, setToastMessage] = useState<{ message: string; productName: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleAddToCart = (product: Product) => {
        addToCart(product);
        setToastMessage({
            message: 'Agregado al carrito',
            productName: product.name
        });
    };

    // Filter products based on search query
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groupedProducts = filteredProducts.reduce((acc, product) => {
        const category = product.category || 'Sin categoría';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(product);
        return acc;
    }, {} as Record<string, Product[]>);
  
    return (
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-6 h-full">
            {toastMessage && (
                <Toast
                    message={toastMessage.message}
                    productName={toastMessage.productName}
                    onClose={() => setToastMessage(null)}
                />
            )}
            <div className="flex-1 lg:col-span-2 lg:overflow-y-auto lg:pr-2 min-h-0">
                <div className="mb-4 sm:mb-6">
                    <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Punto de Venta</h1>
                        <RefreshButton onRefresh={refetchAll} size="md" />
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar productos por nombre, categoría o descripción..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 border border-slate-300 rounded-xl sm:rounded-2xl shadow-sm focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 text-sm sm:text-base transition-all"
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-slate-400 hover:text-slate-600"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Results counter */}
                    {searchQuery && (
                        <p className="mt-2 text-xs sm:text-sm text-slate-500">
                            {filteredProducts.length} {filteredProducts.length === 1 ? 'producto encontrado' : 'productos encontrados'}
                        </p>
                    )}
                </div>

                {filteredProducts.length === 0 ? (
                    <div className="text-center py-12">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-slate-500 text-lg font-medium">No se encontraron productos</p>
                        <p className="text-slate-400 text-sm mt-2">Intenta con otro término de búsqueda</p>
                    </div>
                ) : (
                    Object.entries(groupedProducts).map(([category, productsInCategory]) => (
                        <div key={category} className="mb-8">
                            <h2 className="text-xl font-semibold text-slate-700 mb-4 border-b pb-2">{category}</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
                                {productsInCategory.map(product => (
                                    <ProductCard key={product.id} product={product} onClick={() => handleAddToCart(product)} />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="flex-shrink-0 mt-4 lg:mt-0 lg:col-span-1 lg:h-full">
                <Cart />
            </div>
        </div>
    );
};

export default SalesScreen;