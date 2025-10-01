import React, { useState } from 'react';
import type { Customer } from '../types';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onAddCredit: (customerId: string, amount: number, type: 'charge' | 'payment', description: string) => void;
}

const CreditModal: React.FC<CreditModalProps> = ({ isOpen, onClose, customer, onAddCredit }) => {
  const [type, setType] = useState<'charge' | 'payment'>('charge');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    if (amount <= 0) {
      alert("El monto debe ser mayor a 0.");
      return;
    }

    if (type === 'charge' && customer.creditLimit > 0) {
      const newCredit = customer.currentCredit + amount;
      if (newCredit > customer.creditLimit) {
        if (!confirm(`El crédito excederá el límite ($${customer.creditLimit}). ¿Desea continuar?`)) {
          return;
        }
      }
    }

    if (type === 'payment' && amount > customer.currentCredit) {
      alert("El monto del pago no puede ser mayor al crédito actual.");
      return;
    }

    onAddCredit(customer.id, amount, type, description);
    setAmount(0);
    setDescription('');
    setType('charge');
    onClose();
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Gestionar Crédito - {customer.name}
          </h2>

          <div className="mb-4 p-3 bg-gray-100 rounded-md">
            <p className="text-sm text-gray-600">Crédito actual: <span className="font-bold text-red-600">${customer.currentCredit.toFixed(2)}</span></p>
            <p className="text-sm text-gray-600">Límite de crédito: <span className="font-bold">${customer.creditLimit.toFixed(2)}</span></p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Movimiento
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'charge' | 'payment')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="charge">Cargo (Fiado)</option>
                <option value="payment">Pago</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto ($) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Motivo del cargo o pago..."
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setAmount(0);
                  setDescription('');
                  setType('charge');
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex-1 px-4 py-2 text-white rounded-md transition-colors ${
                  type === 'charge'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {type === 'charge' ? 'Agregar Cargo' : 'Registrar Pago'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreditModal;
