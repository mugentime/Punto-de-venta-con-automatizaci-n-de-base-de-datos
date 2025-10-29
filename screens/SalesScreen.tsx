import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { TrashIcon } from '../components/Icons';
import Toast from '../components/Toast';
import type { Product, CartItem } from '../types';

const ProductCard: React.FC<{ product: Product; onClick: () => void; }> = ({ product, onClick }) => (
    <button
        onClick={onClick}
        className="bg-white rounded-xl sm:rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg active:shadow-xl transition-shadow duration-200 group flex flex-col h-full text-left w-full min-h-[44px] touch-manipulation"
        aria-label={`Agregar ${product.name} al carrito`}
    >
        <img src={product.imageUrl} alt={product.name} className="h-28 sm:h-32 md:h-40 w-full object-cover" />
        <div className="p-2 sm:p-3 flex-1 flex flex-col justify-between">
            <h3 className="text-sm sm:text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-zinc-700">{product.name}</h3>
            <p className="text-base sm:text-lg font-bold text-slate-900 mt-1">${product.price.toFixed(2)}</p>
        </div>
    </button>
);

const CartItemRow: React.FC<{ item: CartItem }> = ({ item }) => {
    const { updateCartQuantity, removeFromCart } = useAppContext();
    return (
        <div className="flex items-center justify-between py-3 gap-2">
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-500">${item.price.toFixed(2)}</p>
            </div>
            {/* Large touch-friendly quantity controls */}
            <div className="flex items-center gap-1 sm:gap-2">
                <button
                    onClick={() => updateCartQuantity(item.id, Math.max(1, item.quantity - 1))}
                    className="min-w-[44px] min-h-[44px] w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg font-bold text-slate-700 transition-colors touch-manipulation"
                    aria-label="Disminuir cantidad"
                >
                    −
                </button>
                <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={item.quantity}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1) {
                            updateCartQuantity(item.id, val);
                        }
                    }}
                    className="w-12 sm:w-14 text-center border-slate-300 rounded-lg shadow-sm py-2 sm:py-1 text-base sm:text-sm focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                    style={{ fontSize: '16px' }}
                    min="1"
                />
                <button
                    onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                    className="min-w-[44px] min-h-[44px] w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg font-bold text-slate-700 transition-colors touch-manipulation"
                    aria-label="Aumentar cantidad"
                >
                    +
                </button>
            </div>
            <p className="w-16 sm:w-20 text-right font-medium text-sm text-slate-900">${(item.price * item.quantity).toFixed(2)}</p>
            <button
                onClick={() => removeFromCart(item.id)}
                className="min-w-[44px] min-h-[44px] p-2 sm:p-1 text-slate-500 hover:text-red-600 active:text-red-700 rounded-full transition-colors touch-manipulation"
                aria-label="Eliminar del carrito"
            >
                <TrashIcon className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
        </div>
    );
};

const Cart: React.FC = () => {
    const { cart, cartTotal, createOrder, clearCart, customers } = useAppContext();
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [customClientName, setCustomClientName] = useState('');
    const [serviceType, setServiceType] = useState<'Mesa' | 'Para llevar'>('Mesa');
    // Note: 'Crédito' is handled specially and converted to appropriate payment method in createOrder
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Crédito'>('Efectivo');
    const [tip, setTip] = useState<number>(0);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

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

        // Prevent duplicate submissions
        if (isProcessing) {
            console.log('⚠️ Order already being processed, ignoring duplicate click');
            return;
        }

        // Determine client name and customer ID
        const clientName = selectedCustomerId === 'other' ? customClientName : (selectedCustomer?.name || 'Cliente');
        const customerId = selectedCustomer ? selectedCustomer.id : undefined;

        setIsProcessing(true);
        try {
            // FIX BUG 2: Send actual payment method (don't convert Crédito to Efectivo)
            await createOrder({ clientName, serviceType, paymentMethod, customerId, tip });
            // Cart is already cleared by createOrder on success
            setIsCheckingOut(false);
            setSelectedCustomerId('');
            setCustomClientName('');
            setServiceType('Mesa');
            setPaymentMethod('Efectivo');
            setTip(0);
        } catch (error) {
            // Error already alerted by createOrder, just reset checkout state
            console.error('Checkout failed:', error);
            setIsCheckingOut(false);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelCheckout = () => {
        setIsCheckingOut(false);
    }

    return (
        <div className="bg-white rounded-xl sm:rounded-3xl shadow-md flex flex-col h-64 sm:h-80 lg:h-full">
            <div className="p-3 sm:p-4 border-b">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">Orden Actual</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 overscroll-contain">
                {cart.length > 0 ? (
                    cart.map(item => <CartItemRow key={item.id} item={item} />)
                ) : (
                    <p className="text-center text-slate-500 mt-8">El carrito está vacío.</p>
                )}
            </div>

            {isCheckingOut && (
                <div className="p-3 sm:p-4 border-t max-h-[50vh] overflow-y-auto overscroll-contain">
                    <h3 className="text-base sm:text-md font-semibold text-slate-700 mb-3">Detalles de la Orden</h3>
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="customerSelect" className="block text-sm font-medium text-slate-600 mb-1">Cliente</label>
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
                                className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-3 text-base focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                                style={{ fontSize: '16px' }}
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
                                <label htmlFor="customClientName" className="block text-sm font-medium text-slate-600 mb-1">Nombre del Cliente</label>
                                <input
                                    type="text"
                                    name="customClientName"
                                    id="customClientName"
                                    value={customClientName}
                                    onChange={(e) => setCustomClientName(e.target.value)}
                                    className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-3 text-base focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                                    style={{ fontSize: '16px' }}
                                    placeholder="Escribe el nombre..."
                                />
                            </div>
                        )}

                        {selectedCustomer && selectedCustomer.discountPercentage > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                                <p className="text-xs text-green-700">
                                    <span className="font-semibold">Descuento aplicado:</span> {selectedCustomer.discountPercentage}% (-${discount.toFixed(2)})
                                </p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="serviceType" className="block text-sm font-medium text-slate-600 mb-1">Tipo de Servicio</label>
                            <select
                                name="serviceType"
                                id="serviceType"
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value as any)}
                                className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-3 text-base focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                                style={{ fontSize: '16px' }}
                            >
                                <option>Mesa</option>
                                <option>Para llevar</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-600 mb-1">Método de Pago</label>
                            <select
                                name="paymentMethod"
                                id="paymentMethod"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value as any)}
                                className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-3 px-3 text-base focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
                                style={{ fontSize: '16px' }}
                            >
                                <option>Efectivo</option>
                                <option>Tarjeta</option>
                                {selectedCustomer && <option>Crédito</option>}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="tipAmount" className="block text-xs font-medium text-slate-600">Propina (opcional)</label>
                            <input
                                type="number"
                                name="tipAmount"
                                id="tipAmount"
                                value={tip}
                                onChange={(e) => setTip(parseFloat(e.target.value) || 0)}
                                className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-1.5 px-2 sm:text-sm"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>

                        {paymentMethod === 'Crédito' && selectedCustomer && (
                            <div className={`border rounded-lg p-2 ${selectedCustomer.currentCredit + finalTotal > selectedCustomer.creditLimit ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                                <p className="text-xs">
                                    <span className="font-semibold">Crédito actual:</span> ${selectedCustomer.currentCredit.toFixed(2)}
                                </p>
                                <p className="text-xs">
                                    <span className="font-semibold">Nuevo crédito:</span> ${(selectedCustomer.currentCredit + finalTotal).toFixed(2)}
                                </p>
                                <p className="text-xs">
                                    <span className="font-semibold">Límite:</span> ${selectedCustomer.creditLimit.toFixed(2)}
                                </p>
                                {selectedCustomer.currentCredit + finalTotal > selectedCustomer.creditLimit && (
                                    <p className="text-xs text-red-600 font-semibold mt-1">⚠️ Excede el límite de crédito</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="p-3 sm:p-4 pb-6 lg:pb-4 border-t bg-slate-50 rounded-b-3xl">
                 <div className="space-y-2 text-sm mb-4">
                     {discount > 0 && (
                         <>
                             <div className="flex justify-between text-sm text-slate-600">
                                <span>Subtotal:</span>
                                <span>${cartTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Descuento ({selectedCustomer?.discountPercentage}%):</span>
                                <span>-${discount.toFixed(2)}</span>
                            </div>
                         </>
                     )}
                     {tip > 0 && (
                         <div className="flex justify-between text-sm text-slate-600">
                            <span>Propina:</span>
                            <span>+${tip.toFixed(2)}</span>
                        </div>
                     )}
                     <div className="flex justify-between text-lg font-bold">
                        <span className="text-slate-900">Total:</span>
                        <span>${finalTotal.toFixed(2)}</span>
                    </div>
                </div>
                <div className="flex gap-2 sm:gap-3">
                     <button
                        onClick={isCheckingOut ? handleCancelCheckout : clearCart}
                        disabled={isProcessing}
                        className="min-h-[44px] flex-1 py-3 px-3 sm:px-4 bg-white border border-slate-300 rounded-xl text-base sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                        style={{ fontSize: '16px' }}
                    >
                        {isCheckingOut ? 'Cancelar' : 'Limpiar'}
                    </button>
                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || isProcessing}
                        className="min-h-[44px] flex-1 py-3 px-3 sm:px-4 bg-zinc-900 rounded-xl text-base sm:text-sm font-semibold text-white hover:bg-zinc-800 active:bg-zinc-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed touch-manipulation"
                        style={{ fontSize: '16px' }}
                    >
                        {isProcessing ? '⏳ Procesando...' : (isCheckingOut ? `Pagar $${finalTotal.toFixed(2)}` : 'Cobrar')}
                    </button>
                </div>
            </div>
        </div>
    );
}

const SalesScreen: React.FC = () => {
    const { products, addToCart } = useAppContext();
    const [toastMessage, setToastMessage] = useState<{ message: string; productName: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile device on mount
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3 sm:mb-4">Punto de Venta</h1>

                    {/* Search Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            inputMode="search"
                            placeholder="Buscar productos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 sm:pl-12 pr-12 py-3 sm:py-3 border border-slate-300 rounded-xl sm:rounded-2xl shadow-sm focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500 text-base transition-all"
                            style={{ fontSize: '16px' }}
                            autoFocus={!isMobile}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-slate-400 hover:text-slate-600 active:text-slate-800 min-w-[44px] min-h-[44px] touch-manipulation"
                                aria-label="Limpiar búsqueda"
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
                        <div key={category} className="mb-6 sm:mb-8">
                            <h2 className="text-lg sm:text-xl font-semibold text-slate-700 mb-3 sm:mb-4 border-b pb-2">{category}</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
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