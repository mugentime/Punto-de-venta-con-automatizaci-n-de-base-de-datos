import React, { useState, useEffect } from 'react';
import type { Expense, ExpenseCategory, ExpenseType, ExpensePaymentSource } from '../types';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id'> | Expense) => void;
  expenseToEdit?: Expense | null;
  hasOpenCashSession?: boolean;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, onSave, expenseToEdit, hasOpenCashSession = false }) => {
  const getInitialState = () => ({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    category: 'Otro' as ExpenseCategory,
    type: 'Emergente' as ExpenseType,
    paymentSource: 'transferencia' as ExpensePaymentSource
  });

  const [expense, setExpense] = useState(getInitialState());

  useEffect(() => {
    if (isOpen) {
        if (expenseToEdit) {
            setExpense({
              ...expenseToEdit,
              date: expenseToEdit.date.split('T')[0],
              paymentSource: expenseToEdit.paymentSource || 'transferencia'
            });
        } else {
            setExpense(getInitialState());
        }
    }
  }, [expenseToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setExpense(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) || 0 : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expense.amount <= 0) {
        alert("El monto debe ser mayor a cero.");
        return;
    }
    onSave({
        ...expense,
        date: new Date(expense.date).toISOString() // Ensure date is stored consistently
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] my-auto flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{expenseToEdit ? 'Editar Gasto' : 'Nuevo Gasto'}</h2>
            <div className="space-y-4">
               <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-600 mb-1">Descripción</label>
                <textarea name="description" id="description" value={expense.description} onChange={handleChange} rows={3} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm" required />
              </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-slate-600 mb-1">Monto</label>
                  <input type="number" name="amount" id="amount" value={expense.amount} onChange={handleChange} step="0.01" className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm" required />
                </div>
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
                  <input type="date" name="date" id="date" value={expense.date} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-slate-600 mb-1">Categoría</label>
                    <select name="category" id="category" value={expense.category} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm" required>
                        <option value="Luz">Luz</option>
                        <option value="Internet">Internet</option>
                        <option value="Sueldos">Sueldos</option>
                        <option value="Inventario">Inventario</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="type" className="block text-sm font-medium text-slate-600 mb-1">Tipo</label>
                    <select name="type" id="type" value={expense.type} onChange={handleChange} className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm" required>
                        <option value="Frecuente">Frecuente</option>
                        <option value="Emergente">Emergente</option>
                    </select>
                </div>
              </div>
              <div>
                <label htmlFor="paymentSource" className="block text-sm font-medium text-slate-600 mb-1">Origen del Pago</label>
                <select
                  name="paymentSource"
                  id="paymentSource"
                  value={expense.paymentSource}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-slate-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                  required
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo_caja" disabled={!hasOpenCashSession}>
                    Efectivo de Caja {!hasOpenCashSession && '(Requiere caja abierta)'}
                  </option>
                </select>
                {expense.paymentSource === 'efectivo_caja' && (
                  <p className="mt-1 text-xs text-amber-600">
                    ⚠️ Este monto se descontará del efectivo en caja
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4 flex justify-end space-x-3 rounded-b-3xl flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-slate-800 border border-transparent rounded-xl text-sm font-medium text-white hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseModal;