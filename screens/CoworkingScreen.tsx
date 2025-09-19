import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { PlusIcon, TrashIcon } from '../components/Icons';
import type { CoworkingSession, Product, CartItem } from '../types';

const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 0) milliseconds = 0;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const calculateCoworkingCost = (startTime: string, endTime: string): { cost: number; minutes: number } => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.max(0, Math.ceil(durationMs / (1000 * 60)));

    let cost = 0;
    if (durationMinutes > 0) {
      if (durationMinutes <= 60) {
          cost = 58;
      } else {
          const extraMinutes = durationMinutes - 60;
          const halfHourBlocks = Math.ceil(extraMinutes / 30);
          cost = 58 + (halfHourBlocks * 35);
      }
    }
    return { cost, minutes: durationMinutes };
};

const CoworkingScreen: React.FC = () => {
    const { coworkingSessions, startCoworkingSession, products, updateCoworkingSession, finishCoworkingSession } = useAppContext();
    const [now, setNow] = useState(new Date());
    const [isStartModalOpen, setIsStartModalOpen] = useState(false);
    const [clientName, setClientName] = useState('');

    const [sessionToFinalize, setSessionToFinalize] = useState<CoworkingSession | null>(null);
    const [sessionForExtras, setSessionForExtras] = useState<CoworkingSession | null>(null);
    
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleStartSession = () => {
        startCoworkingSession(clientName);
        setIsStartModalOpen(false);
        setClientName('');
    };
    
    const handleAddExtra = (product: Product) => {
        if (!sessionForExtras) return;
        const existingExtra = sessionForExtras.consumedExtras.find(item => item.id === product.id);
        let newExtras;
        if(existingExtra) {
            newExtras = sessionForExtras.consumedExtras.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
        } else {
            newExtras = [...sessionForExtras.consumedExtras, { ...product, quantity: 1 }];
        }
        updateCoworkingSession(sessionForExtras.id, { consumedExtras: newExtras });
    };

    const handleRemoveExtra = (session: CoworkingSession, itemId: string) => {
        const newExtras = session.consumedExtras.filter(item => item.id !== itemId);
        updateCoworkingSession(session.id, { consumedExtras: newExtras });
    };
    
    const activeSessions = coworkingSessions.filter(s => s.status === 'active').sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const extraProducts = products.filter(p => p.category === 'Refrigerador' || p.category === 'Alimentos');

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Coworking</h1>
                <button
                    onClick={() => setIsStartModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-zinc-900 text-white rounded-xl shadow-sm hover:bg-zinc-800 transition-colors"
                >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Nueva Sesión
                </button>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-semibold text-slate-700">Sesiones Activas</h2>
                {activeSessions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeSessions.map(session => (
                            <div key={session.id} className="bg-white p-5 rounded-3xl shadow-md flex flex-col">
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-800">{session.clientName}</h3>
                                    <p className="text-sm text-slate-500">Inicio: {new Date(session.startTime).toLocaleTimeString()}</p>
                                    <p className="text-4xl font-mono font-bold text-zinc-900 my-4 text-center bg-gray-100 py-2 rounded-xl">
                                        {formatDuration(now.getTime() - new Date(session.startTime).getTime())}
                                    </p>
                                    {session.consumedExtras.length > 0 && (
                                        <div className="mb-2">
                                            <h4 className="text-sm font-semibold text-slate-600 mb-1">Extras:</h4>
                                            <ul className="text-xs space-y-1">
                                            {session.consumedExtras.map(item => (
                                                <li key={item.id} className="flex justify-between items-center">
                                                    <span>{item.name} x{item.quantity}</span>
                                                    <button onClick={() => handleRemoveExtra(session, item.id)} className="p-0.5 text-slate-400 hover:text-red-500">
                                                        <TrashIcon className="h-3 w-3" />
                                                    </button>
                                                </li>
                                            ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button onClick={() => setSessionForExtras(session)} className="w-full py-2 px-3 bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-200">Extras</button>
                                    <button onClick={() => setSessionToFinalize(session)} className="w-full py-2 px-3 bg-green-500 rounded-xl text-sm font-semibold text-white hover:bg-green-600">Finalizar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-slate-500 py-4">No hay sesiones activas.</p>
                )}
            </div>
            
            {isStartModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">Iniciar Sesión</h2>
                        <input
                            type="text"
                            value={clientName}
                            onChange={e => setClientName(e.target.value)}
                            placeholder="Nombre del Cliente (Opcional)"
                            className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm mb-4"
                        />
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setIsStartModalOpen(false)} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700">Cancelar</button>
                            <button onClick={handleStartSession} className="px-4 py-2 bg-zinc-900 rounded-xl text-sm font-medium text-white">Iniciar</button>
                        </div>
                    </div>
                 </div>
            )}
            
            {sessionToFinalize && <FinalizeModal session={sessionToFinalize} onClose={() => setSessionToFinalize(null)} onConfirm={finishCoworkingSession} />}
            
            {sessionForExtras && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 flex flex-col max-h-[90vh]">
                         <h2 className="text-2xl font-bold text-slate-800 mb-4">Agregar Extras para {sessionForExtras.clientName}</h2>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto">
                            {extraProducts.map(p => (
                                <div key={p.id} onClick={() => handleAddExtra(p)} className="bg-slate-50 rounded-xl p-3 text-center cursor-pointer hover:bg-slate-200">
                                    <img src={p.imageUrl} alt={p.name} className="h-16 w-16 mx-auto rounded-lg object-cover mb-2" />
                                    <p className="text-xs font-semibold">{p.name}</p>
                                    <p className="text-xs">${p.price.toFixed(2)}</p>
                                </div>
                            ))}
                         </div>
                         <div className="mt-4 text-right">
                            <button onClick={() => setSessionForExtras(null)} className="px-4 py-2 bg-zinc-900 rounded-xl text-sm font-medium text-white">Cerrar</button>
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const FinalizeModal: React.FC<{session: CoworkingSession, onClose: () => void, onConfirm: (id: string, pm: 'Efectivo' | 'Tarjeta') => void}> = ({ session, onClose, onConfirm}) => {
    const { cost, minutes } = calculateCoworkingCost(session.startTime, new Date().toISOString());
    const extrasCost = session.consumedExtras.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const subtotal = cost + extrasCost;
    const total = subtotal;
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta'>('Efectivo');
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Finalizar Sesión</h2>
                <h3 className="text-lg font-semibold text-slate-600 mb-4">{session.clientName}</h3>
                <div className="space-y-1 text-sm border-t border-b py-3">
                    <div className="flex justify-between"><span className="text-slate-500">Tiempo de Coworking ({minutes} min):</span> <span className="font-medium">${cost.toFixed(2)}</span></div>
                    {extrasCost > 0 && <div className="flex justify-between"><span className="text-slate-500">Extras consumidos:</span> <span className="font-medium">${extrasCost.toFixed(2)}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">Subtotal:</span> <span className="font-medium">${subtotal.toFixed(2)}</span></div>
                </div>
                <div className="flex justify-between text-2xl font-bold pt-2 my-2"><span className="text-slate-800">Total:</span> <span>${total.toFixed(2)}</span></div>
                 <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Método de Pago</label>
                     <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-1.5 px-2 sm:text-sm">
                        <option>Efectivo</option>
                        <option>Tarjeta</option>
                    </select>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700">Cancelar</button>
                    <button onClick={() => { onConfirm(session.id, paymentMethod); onClose(); }} className="px-4 py-2 bg-green-500 rounded-xl text-sm font-medium text-white">Confirmar Pago</button>
                </div>
            </div>
        </div>
    );
}

export default CoworkingScreen;