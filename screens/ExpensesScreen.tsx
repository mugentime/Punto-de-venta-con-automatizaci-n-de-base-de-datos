import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import ExpenseModal from '../components/ExpenseModal';
import RefreshButton from '../components/RefreshButton';
import { PlusIcon, EditIcon, TrashIcon } from '../components/Icons';
import type { Expense } from '../types';

const ExpensesScreen: React.FC = () => {
  const { expenses, addExpense, updateExpense, deleteExpense, cashSessions, refetchAll } = useAppContext();
  const hasOpenCashSession = cashSessions.some(s => s.status === 'open');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const openModal = (expense: Expense | null = null) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setExpenseToEdit(null);
    setIsModalOpen(false);
  };

  const handleSave = (expenseData: Omit<Expense, 'id'> | Expense) => {
    if ('id' in expenseData) {
      updateExpense(expenseData as Expense);
    } else {
      addExpense(expenseData);
    }
  };

  const typeBadgeClass = (type: string) => {
    switch (type) {
      case 'Frecuente': return 'bg-blue-100 text-blue-800';
      case 'Emergente': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const paymentSourceBadge = (source: string) => {
    switch (source) {
      case 'efectivo_caja': return { class: 'bg-green-100 text-green-800', label: 'Caja' };
      case 'transferencia': return { class: 'bg-purple-100 text-purple-800', label: 'Transferencia' };
      default: return { class: 'bg-slate-100 text-slate-800', label: source || 'N/A' };
    }
  };

  const sortedExpenses = expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Gestión de Gastos</h1>
        <div className="flex gap-2">
          <RefreshButton onRefresh={refetchAll} size="md" />
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-xl shadow-sm hover:bg-slate-900 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Nuevo Gasto
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-3xl overflow-hidden">
        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left">
            <thead className="bg-slate-50">
                <tr>
                    <th className="p-4 text-sm font-semibold text-slate-600">Fecha</th>
                    <th className="p-4 text-sm font-semibold text-slate-600">Descripción</th>
                    <th className="p-4 text-sm font-semibold text-slate-600">Categoría</th>
                    <th className="p-4 text-sm font-semibold text-slate-600">Tipo</th>
                    <th className="p-4 text-sm font-semibold text-slate-600">Origen</th>
                    <th className="p-4 text-sm font-semibold text-slate-600 text-right">Monto</th>
                    <th className="p-4 text-sm font-semibold text-slate-600 text-center">Acciones</th>
                </tr>
            </thead>
            <tbody>
                {sortedExpenses.map(expense => (
                <tr key={expense.id} className="border-b hover:bg-slate-50">
                    <td className="p-4 text-sm text-slate-500">
                        {new Date(expense.date).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}
                    </td>
                    <td className="p-4 text-sm text-slate-800 font-medium max-w-sm truncate">{expense.description}</td>
                    <td className="p-4 text-sm text-slate-500">{expense.category}</td>
                    <td className="p-4 text-sm text-slate-500">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${typeBadgeClass(expense.type)}`}>
                            {expense.type}
                        </span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${paymentSourceBadge(expense.paymentSource).class}`}>
                            {paymentSourceBadge(expense.paymentSource).label}
                        </span>
                    </td>
                    <td className="p-4 text-sm text-slate-800 font-medium text-right">${expense.amount.toFixed(2)}</td>
                    <td className="p-4 text-center">
                    <div className="flex justify-center items-center space-x-2">
                        <button onClick={() => openModal(expense)} className="p-2 text-slate-500 hover:text-blue-600 rounded-full hover:bg-slate-100 transition-colors">
                            <EditIcon className="h-5 w-5" />
                        </button>
                        <button onClick={() => deleteExpense(expense.id)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
            {sortedExpenses.map(expense => (
                <div key={expense.id} className="border-b p-4">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 pr-4">
                            <p className="font-medium text-slate-800">{expense.description}</p>
                            <p className="text-xs text-slate-500">
                                {new Date(expense.date).toLocaleDateString('es-MX', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <p className="text-lg font-bold text-slate-800">${expense.amount.toFixed(2)}</p>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                        <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-slate-600">{expense.category}</span>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${typeBadgeClass(expense.type)}`}>
                                {expense.type}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${paymentSourceBadge(expense.paymentSource).class}`}>
                                {paymentSourceBadge(expense.paymentSource).label}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <button onClick={() => openModal(expense)} className="p-2 text-slate-500 hover:text-blue-600 rounded-full hover:bg-slate-100 transition-colors">
                                <EditIcon className="h-5 w-5" />
                            </button>
                            <button onClick={() => deleteExpense(expense.id)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>


         {expenses.length === 0 && (
            <p className="text-center text-slate-500 py-8">No hay gastos registrados.</p>
        )}
      </div>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSave}
        expenseToEdit={expenseToEdit}
        hasOpenCashSession={hasOpenCashSession}
      />
    </div>
  );
};

export default ExpensesScreen;
