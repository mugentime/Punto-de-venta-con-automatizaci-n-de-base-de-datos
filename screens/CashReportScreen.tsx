import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import StatCard from '../components/StatCard';
import { CashIcon, SalesIcon, HistoryIcon, DashboardIcon, ExpenseIcon, PlusIcon } from '../components/Icons';
import { deduplicateOrders } from '../utils/deduplication';

// Start Day Modal Component
const StartDayModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onStart: (amount: number) => void;
}> = ({ isOpen, onClose, onStart }) => {
  const [amount, setAmount] = useState('');

  const handleStart = () => {
    const startAmount = parseFloat(amount);
    if (!isNaN(startAmount) && startAmount >= 0) {
      onStart(startAmount);
      onClose();
    } else {
      alert('Por favor, ingrese un monto válido.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Iniciar Día</h2>
        <p className="text-slate-600 mb-4">Ingrese la cantidad de efectivo inicial en la caja.</p>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Ej: 300.00"
          className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm mb-4"
          autoFocus
        />
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700">Cancelar</button>
          <button onClick={handleStart} className="px-4 py-2 bg-zinc-900 rounded-xl text-sm font-medium text-white">Iniciar</button>
        </div>
      </div>
    </div>
  );
};

// Cash Withdrawal Modal Component
const CashWithdrawalModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (amount: number, description: string) => void;
}> = ({ isOpen, onClose, onWithdraw }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleWithdraw = () => {
    const withdrawAmount = parseFloat(amount);
    if (!isNaN(withdrawAmount) && withdrawAmount > 0 && description.trim()) {
      onWithdraw(withdrawAmount, description);
      setAmount('');
      setDescription('');
      onClose();
    } else {
      alert('Por favor, ingrese un monto válido y una descripción.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Retiro de Efectivo</h2>
        <p className="text-slate-600 mb-4">Registre el retiro de efectivo de la caja.</p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 mb-1">Monto a Retirar</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ej: 500.00"
            className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm"
            autoFocus
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-600 mb-1">Motivo del Retiro</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Pago a proveedor, cambio de billetes, etc."
            className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm"
            rows={3}
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700">Cancelar</button>
          <button onClick={handleWithdraw} className="px-4 py-2 bg-blue-600 rounded-xl text-sm font-medium text-white">Confirmar Retiro</button>
        </div>
      </div>
    </div>
  );
};

// Close Day Modal Component
const CloseDayModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  sessionData: {
    startAmount: number;
    cashSales: number;
    cashExpenses: number;
    cashWithdrawals: number;
  };
}> = ({ isOpen, onClose, onConfirm, sessionData }) => {
  const [countedAmount, setCountedAmount] = useState('');
  const expectedAmount = sessionData.startAmount + sessionData.cashSales - sessionData.cashExpenses - sessionData.cashWithdrawals;
  const difference = parseFloat(countedAmount) - expectedAmount;

  const handleConfirm = () => {
    const finalAmount = parseFloat(countedAmount);
    if (!isNaN(finalAmount) && finalAmount >= 0) {
      onConfirm(finalAmount);
      onClose();
    } else {
      alert('Por favor, ingrese un monto contado válido.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Cierre de Caja</h2>
        <div className="space-y-2 text-sm border-t border-b py-3 my-4">
          <div className="flex justify-between"><span className="text-slate-500">Efectivo Inicial:</span> <span className="font-medium">${sessionData.startAmount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">(+) Ventas en Efectivo:</span> <span className="font-medium text-green-600">${sessionData.cashSales.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">(-) Gastos:</span> <span className="font-medium text-red-600">${sessionData.cashExpenses.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">(-) Retiros de Efectivo:</span> <span className="font-medium text-orange-600">${sessionData.cashWithdrawals.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span className="text-slate-800">Efectivo Esperado:</span> <span>${expectedAmount.toFixed(2)}</span></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Efectivo Contado</label>
          <input
            type="number"
            value={countedAmount}
            onChange={(e) => setCountedAmount(e.target.value)}
            placeholder="Monto final en caja"
            className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm"
          />
        </div>
        {!isNaN(difference) && (
           <div className={`mt-2 text-sm font-bold flex justify-between p-2 rounded-lg ${difference === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
             <span>Diferencia:</span>
             <span>${difference.toFixed(2)} {difference > 0 ? '(Sobrante)' : difference < 0 ? '(Faltante)' : ''}</span>
           </div>
        )}
        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700">Cancelar</button>
          <button onClick={handleConfirm} className="px-4 py-2 bg-zinc-900 rounded-xl text-sm font-medium text-white">Confirmar y Cerrar</button>
        </div>
      </div>
    </div>
  );
};


const CashReportScreen: React.FC = () => {
  const { orders, expenses, cashSessions, cashWithdrawals, coworkingSessions, startCashSession, closeCashSession, addCashWithdrawal } = useAppContext();
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // FIX BUG 4: Deduplicate orders before calculations
  const deduplicatedOrders = deduplicateOrders(orders);

  const currentSession = cashSessions.find(s => s.status === 'open');

  // Logic for the active session view
  const sessionOrders = currentSession ? deduplicatedOrders.filter(o => new Date(o.date) >= new Date(currentSession.startDate)) : [];
  const sessionExpenses = currentSession ? expenses.filter(e => new Date(e.date) >= new Date(currentSession.startDate)) : [];
  const sessionCoworking = currentSession ? coworkingSessions.filter(s =>
    s.status === 'finished' && s.endTime && new Date(s.endTime) >= new Date(currentSession.startDate)
  ) : [];

  const ordersSales = sessionOrders.reduce((sum, order) => sum + order.total, 0);
  // ⚠️ CRITICAL FIX: Coworking sessions already included in orders - do NOT add separately
  // const coworkingSales = sessionCoworking.reduce((sum, session) => sum + (session.total || 0), 0);
  const totalSales = ordersSales; // Already includes coworking sessions

  const totalExpenses = sessionExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  // ⚠️ CRITICAL FIX: Coworking sessions already included in sessionOrders - do NOT add separately
  const cashSales = sessionOrders.filter(o => o.paymentMethod === 'Efectivo').reduce((sum, o) => sum + o.total, 0);
  // const coworkingCashSales = sessionCoworking.filter(s => s.paymentMethod === 'Efectivo').reduce((sum, s) => sum + (s.total || 0), 0);
  // const cashSales = ordersCashSales + coworkingCashSales;

  // Calculate credit sales (Crédito or Fiado)
  const creditSales = sessionOrders.filter(o => o.paymentMethod === 'Crédito' || o.paymentMethod === 'Fiado').reduce((sum, o) => sum + o.total, 0);
  // const coworkingCreditSales = sessionCoworking.filter(s => s.paymentMethod === 'Crédito' || s.paymentMethod === 'Fiado').reduce((sum, s) => sum + (s.total || 0), 0);
  // const creditSales = ordersCreditSales + coworkingCreditSales;

  // Calculate withdrawals for current session
  const sessionWithdrawals = currentSession ? cashWithdrawals.filter(w => w.cash_session_id === currentSession.id) : [];
  const totalWithdrawals = sessionWithdrawals.reduce((sum, w) => sum + w.amount, 0);

  // Card sales = Total - Cash - Credit
  const cardSales = totalSales - cashSales - creditSales;
  const totalOrders = sessionOrders.length + sessionCoworking.length;
  const expectedCash = currentSession ? currentSession.startAmount + cashSales - totalExpenses - totalWithdrawals : 0;

  const handleWithdraw = async (amount: number, description: string) => {
    if (currentSession) {
      try {
        await addCashWithdrawal(currentSession.id, amount, description);
      } catch (error) {
        console.error('Error adding withdrawal:', error);
      }
    }
  };
  
  if (currentSession) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Caja Activa</h1>
            <p className="text-sm text-slate-500">Día iniciado a las {new Date(currentSession.startDate).toLocaleTimeString()}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors font-semibold"
            >
              Retirar Efectivo
            </button>
            <button
              onClick={() => setIsCloseModalOpen(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition-colors font-semibold"
            >
              Cerrar Caja
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Efectivo Inicial" value={`$${currentSession.startAmount.toFixed(2)}`} icon={<DashboardIcon className="h-6 w-6 text-gray-500" />} />
          <StatCard title="Ventas en Efectivo" value={`$${cashSales.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-green-600" />} />
          <StatCard title="Ventas con Tarjeta" value={`$${cardSales.toFixed(2)}`} icon={<SalesIcon className="h-6 w-6 text-purple-600" />} />
          <StatCard title="Ventas a Crédito" value={`$${creditSales.toFixed(2)}`} icon={<SalesIcon className="h-6 w-6 text-amber-600" />} />
          <StatCard title="Gastos" value={`$${totalExpenses.toFixed(2)}`} icon={<ExpenseIcon className="h-6 w-6 text-red-600" />} />
          <StatCard title="Retiros de Efectivo" value={`$${totalWithdrawals.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-orange-600" />} />
          <StatCard title="Total de Órdenes" value={totalOrders.toString()} icon={<HistoryIcon className="h-6 w-6 text-yellow-600" />} />
          <StatCard title="Efectivo Esperado" value={`$${expectedCash.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-blue-600" />} />
        </div>

        {/* Withdrawals List */}
        {sessionWithdrawals.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Retiros de Efectivo</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Descripción</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Monto</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {sessionWithdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                        {new Date(withdrawal.withdrawn_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{withdrawal.description}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-orange-600">
                        ${withdrawal.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <CashWithdrawalModal
          isOpen={isWithdrawModalOpen}
          onClose={() => setIsWithdrawModalOpen(false)}
          onWithdraw={handleWithdraw}
        />

        <CloseDayModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          onConfirm={closeCashSession}
          sessionData={{
            startAmount: currentSession.startAmount,
            cashSales: cashSales,
            cashExpenses: totalExpenses,
            cashWithdrawals: totalWithdrawals
          }}
        />
      </div>
    );
  }

  // View when no session is active (historical view + start day)
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };
  
  const filteredOrders = deduplicatedOrders.filter(order => order.date && order.date.startsWith(selectedDate));
  const filteredExpenses = expenses.filter(expense => expense.date && expense.date.startsWith(selectedDate));
  const filteredCoworkingHist = coworkingSessions.filter(s =>
    s.status === 'finished' && s.endTime && s.endTime.startsWith(selectedDate)
  );

  const ordersRevenueHist = filteredOrders.reduce((sum, order) => sum + order.total, 0);
  // ⚠️ CRITICAL FIX: Coworking sessions already included in orders - do NOT add separately
  // const coworkingRevenueHist = filteredCoworkingHist.reduce((sum, session) => sum + (session.total || 0), 0);
  const totalSalesHist = ordersRevenueHist; // Already includes coworking sessions

  const totalExpensesHist = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  // Expenses already include costs, so final balance is just sales minus expenses
  const finalBalanceHist = totalSalesHist - totalExpensesHist;

  // ⚠️ CRITICAL FIX: Coworking sessions already included in filteredOrders - do NOT add separately
  const cashSalesHist = filteredOrders.filter(o => o.paymentMethod === 'Efectivo').reduce((sum, o) => sum + o.total, 0);
  // const coworkingCashHist = filteredCoworkingHist.filter(s => s.paymentMethod === 'Efectivo').reduce((sum, s) => sum + (s.total || 0), 0);
  // const cashSalesHist = ordersCashHist + coworkingCashHist;

  // Calculate credit sales (Crédito or Fiado) for historical view
  const creditSalesHist = filteredOrders.filter(o => o.paymentMethod === 'Crédito' || o.paymentMethod === 'Fiado').reduce((sum, o) => sum + o.total, 0);
  // const coworkingCreditHist = filteredCoworkingHist.filter(s => s.paymentMethod === 'Crédito' || s.paymentMethod === 'Fiado').reduce((sum, s) => sum + (s.total || 0), 0);
  // const creditSalesHist = ordersCreditHist + coworkingCreditHist;

  const cardSalesHist = totalSalesHist - cashSalesHist - creditSalesHist;
  const totalOrdersHist = filteredOrders.length + filteredCoworkingHist.length;

  // Get all closed sessions for history (sorted by most recent first)
  const closedSessions = cashSessions
    .filter(s => s.status === 'closed')
    .sort((a, b) => new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime());

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Reporte de Caja</h1>
            <p className="text-slate-600">No hay una sesión de caja activa. Viendo reporte histórico.</p>
          </div>
          <button
            onClick={() => setIsStartModalOpen(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-xl shadow-sm hover:bg-green-700 transition-colors font-semibold"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Iniciar Día
          </button>
        </div>

        <div className="flex justify-end mb-4">
            <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="bg-white border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-zinc-500 focus:border-zinc-500 sm:text-sm"
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard title="Ventas Totales" value={`$${totalSalesHist.toFixed(2)}`} icon={<DashboardIcon className="h-6 w-6 text-green-600" />} />
            <StatCard title="Gastos del Día" value={`$${totalExpensesHist.toFixed(2)}`} icon={<ExpenseIcon className="h-6 w-6 text-red-600" />} />
            <StatCard title="Balance Final" value={`$${finalBalanceHist.toFixed(2)}`} icon={<SalesIcon className="h-6 w-6 text-blue-600" />} />
            <StatCard title="Ventas en Efectivo" value={`$${cashSalesHist.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-cyan-600" />} />
            <StatCard title="Ventas con Tarjeta" value={`$${cardSalesHist.toFixed(2)}`} icon={<SalesIcon className="h-6 w-6 text-purple-600" />} />
            <StatCard title="Ventas a Crédito" value={`$${creditSalesHist.toFixed(2)}`} icon={<SalesIcon className="h-6 w-6 text-amber-600" />} />
            <StatCard title="Total de Órdenes" value={totalOrdersHist.toString()} icon={<HistoryIcon className="h-6 w-6 text-yellow-600" />} />
        </div>

        {/* Cash Sessions History */}
        <div className="bg-white p-6 rounded-xl shadow-md mt-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
                Historial de Cortes de Caja
                <span className="text-sm font-normal text-slate-500 ml-2">({closedSessions.length} registros)</span>
            </h2>
            {closedSessions.length > 0 ? (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Fecha Apertura</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Fecha Cierre</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Inicial</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Final</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Esperado</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider bg-slate-50">Diferencia</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {closedSessions.map((session: any) => {
                                const difference = session.endAmount ? (session.endAmount - (session.expectedCash || session.startAmount)) : 0;
                                return (
                                    <tr key={session.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                            {new Date(session.startDate).toLocaleString('es-MX', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                            {session.endDate ? new Date(session.endDate).toLocaleString('es-MX', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : '-'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-slate-900">
                                            ${session.startAmount?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-slate-900">
                                            ${session.endAmount?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-600">
                                            ${(session.expectedCash || session.startAmount)?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${
                                            difference === 0 ? 'text-green-600' :
                                            difference > 0 ? 'text-blue-600' : 'text-red-600'
                                        }`}>
                                            ${difference.toFixed(2)}
                                            {difference > 0 && <span className="text-xs ml-1">(Sobra)</span>}
                                            {difference < 0 && <span className="text-xs ml-1">(Falta)</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-center text-slate-500 py-4">No hay sesiones de caja cerradas en el historial.</p>
            )}
        </div>

        <StartDayModal
          isOpen={isStartModalOpen}
          onClose={() => setIsStartModalOpen(false)}
          onStart={startCashSession}
        />
    </div>
  );
};

export default CashReportScreen;