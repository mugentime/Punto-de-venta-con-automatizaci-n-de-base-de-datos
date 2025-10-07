import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import StatCard from '../components/StatCard';
import { CashIcon, SalesIcon, HistoryIcon, DashboardIcon, ExpenseIcon, PlusIcon } from '../components/Icons';

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

// Close Day Modal Component
const CloseDayModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  sessionData: {
    startAmount: number;
    cashSales: number;
    cashExpenses: number;
  };
}> = ({ isOpen, onClose, onConfirm, sessionData }) => {
  const [countedAmount, setCountedAmount] = useState('');
  const expectedAmount = sessionData.startAmount + sessionData.cashSales - sessionData.cashExpenses;
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
  const { orders, expenses, cashSessions, coworkingSessions, startCashSession, closeCashSession } = useAppContext();
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const currentSession = cashSessions.find(s => s.status === 'open');

  // Logic for the active session view
  const sessionOrders = currentSession ? orders.filter(o => new Date(o.date) >= new Date(currentSession.startDate)) : [];
  const sessionExpenses = currentSession ? expenses.filter(e => new Date(e.date) >= new Date(currentSession.startDate)) : [];
  const sessionCoworking = currentSession ? coworkingSessions.filter(s =>
    s.status === 'finished' && s.endTime && new Date(s.endTime) >= new Date(currentSession.startDate)
  ) : [];

  const ordersSales = sessionOrders.reduce((sum, order) => sum + order.total, 0);
  const coworkingSales = sessionCoworking.reduce((sum, session) => sum + (session.total || 0), 0);
  const totalSales = ordersSales + coworkingSales;

  const totalExpenses = sessionExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const ordersCashSales = sessionOrders.filter(o => o.paymentMethod === 'Efectivo').reduce((sum, o) => sum + o.total, 0);
  const coworkingCashSales = sessionCoworking.filter(s => s.paymentMethod === 'Efectivo').reduce((sum, s) => sum + (s.total || 0), 0);
  const cashSales = ordersCashSales + coworkingCashSales;

  const cardSales = totalSales - cashSales;
  const totalOrders = sessionOrders.length + sessionCoworking.length;
  const expectedCash = currentSession ? currentSession.startAmount + cashSales - totalExpenses : 0;
  
  if (currentSession) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Caja Activa</h1>
            <p className="text-sm text-slate-500">Día iniciado a las {new Date(currentSession.startDate).toLocaleTimeString()}</p>
          </div>
          <button 
            onClick={() => setIsCloseModalOpen(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition-colors font-semibold"
          >
            Cerrar Caja
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard title="Efectivo Inicial" value={`$${currentSession.startAmount.toFixed(2)}`} icon={<DashboardIcon className="h-6 w-6 text-gray-500" />} />
          <StatCard title="Ventas en Efectivo" value={`$${cashSales.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-green-600" />} />
          <StatCard title="Ventas con Tarjeta" value={`$${cardSales.toFixed(2)}`} icon={<SalesIcon className="h-6 w-6 text-purple-600" />} />
          <StatCard title="Gastos" value={`$${totalExpenses.toFixed(2)}`} icon={<ExpenseIcon className="h-6 w-6 text-red-600" />} />
          <StatCard title="Total de Órdenes" value={totalOrders.toString()} icon={<HistoryIcon className="h-6 w-6 text-yellow-600" />} />
          <StatCard title="Efectivo Esperado" value={`$${expectedCash.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-blue-600" />} />
        </div>
        
        <CloseDayModal 
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          onConfirm={closeCashSession}
          sessionData={{
            startAmount: currentSession.startAmount,
            cashSales: cashSales,
            cashExpenses: totalExpenses
          }}
        />
      </div>
    );
  }

  // View when no session is active (historical view + start day)
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };
  
  const filteredOrders = orders.filter(order => order.date && order.date.startsWith(selectedDate));
  const filteredExpenses = expenses.filter(expense => expense.date && expense.date.startsWith(selectedDate));
  const filteredCoworkingHist = coworkingSessions.filter(s =>
    s.status === 'finished' && s.endTime && s.endTime.startsWith(selectedDate)
  );

  const ordersRevenueHist = filteredOrders.reduce((sum, order) => sum + order.total, 0);
  const coworkingRevenueHist = filteredCoworkingHist.reduce((sum, session) => sum + (session.total || 0), 0);
  const totalSalesHist = ordersRevenueHist + coworkingRevenueHist;

  const totalExpensesHist = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const finalBalanceHist = totalSalesHist - totalExpensesHist;

  const ordersCashHist = filteredOrders.filter(o => o.paymentMethod === 'Efectivo').reduce((sum, o) => sum + o.total, 0);
  const coworkingCashHist = filteredCoworkingHist.filter(s => s.paymentMethod === 'Efectivo').reduce((sum, s) => sum + (s.total || 0), 0);
  const cashSalesHist = ordersCashHist + coworkingCashHist;

  const cardSalesHist = totalSalesHist - cashSalesHist;
  const totalOrdersHist = filteredOrders.length + filteredCoworkingHist.length;
  
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
            <StatCard title="Total de Órdenes" value={totalOrdersHist.toString()} icon={<HistoryIcon className="h-6 w-6 text-yellow-600" />} />
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