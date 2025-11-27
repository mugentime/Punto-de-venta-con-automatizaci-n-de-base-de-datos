import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import CustomerModal from '../components/CustomerModal';
import CreditModal from '../components/CreditModal';
import { PlusIcon, EditIcon, TrashIcon } from '../components/Icons';
import type { Customer, CustomerCredit } from '../types';

const CustomersScreen: React.FC = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer, addCustomerCredit } = useAppContext();
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerCredits, setCustomerCredits] = useState<{ [key: string]: CustomerCredit[] }>({});
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  const openCustomerModal = (customer: Customer | null = null) => {
    setCustomerToEdit(customer);
    setIsCustomerModalOpen(true);
  };

  const closeCustomerModal = () => {
    setCustomerToEdit(null);
    setIsCustomerModalOpen(false);
  };

  const openCreditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsCreditModalOpen(true);
  };

  const closeCreditModal = () => {
    setSelectedCustomer(null);
    setIsCreditModalOpen(false);
  };

  const handleSaveCustomer = (customerData: Omit<Customer, 'id' | 'createdAt' | 'currentCredit'> | Customer) => {
    if ('id' in customerData) {
      updateCustomer(customerData as Customer);
    } else {
      addCustomer(customerData);
    }
  };

  const handleAddCredit = (customerId: string, amount: number, type: 'charge' | 'payment', description: string) => {
    addCustomerCredit(customerId, amount, type, description);
  };

  const loadCustomerCredits = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}/credits`);
      if (response.ok) {
        const credits = await response.json();
        setCustomerCredits(prev => ({ ...prev, [customerId]: credits }));
      }
    } catch (error) {
      console.error('Error loading customer credits:', error);
    }
  };

  const toggleCustomerDetails = (customerId: string) => {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null);
    } else {
      setExpandedCustomerId(customerId);
      if (!customerCredits[customerId]) {
        loadCustomerCredits(customerId);
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Clientes Frecuentes</h1>
        <button
          onClick={() => openCustomerModal()}
          className="flex items-center px-4 py-2 bg-zinc-900 text-white rounded-xl shadow-sm hover:bg-zinc-800 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nuevo Cliente
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="bg-white shadow-md rounded-3xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-600">Cliente</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Contacto</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Descuento</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Límite Crédito</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Crédito Actual</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <React.Fragment key={customer.id}>
                  <tr className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => toggleCustomerDetails(customer.id)}>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-slate-800">{customer.name}</p>
                        <p className="text-xs text-slate-500">ID: {customer.id}</p>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {customer.email && <div>{customer.email}</div>}
                      {customer.phone && <div>{customer.phone}</div>}
                      {!customer.email && !customer.phone && <span className="text-gray-400">-</span>}
                    </td>
                    <td className="p-4 text-sm text-green-600 font-medium">{customer.discountPercentage}%</td>
                    <td className="p-4 text-sm text-slate-800">${customer.creditLimit.toFixed(2)}</td>
                    <td className="p-4 text-sm font-medium">
                      <span className={customer.currentCredit > 0 ? 'text-red-600' : 'text-green-600'}>
                        ${customer.currentCredit.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center items-center space-x-2">
                        <button
                          onClick={() => openCreditModal(customer)}
                          className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                          Crédito
                        </button>
                        <button
                          onClick={() => openCustomerModal(customer)}
                          className="p-2 text-slate-500 hover:text-zinc-700 rounded-full hover:bg-slate-100 transition-colors"
                        >
                          <EditIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar cliente ${customer.name}?`)) {
                              deleteCustomer(customer.id);
                            }
                          }}
                          className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedCustomerId === customer.id && (
                    <tr>
                      <td colSpan={6} className="p-4 bg-gray-50">
                        <div className="max-h-60 overflow-y-auto">
                          <h4 className="font-semibold text-sm mb-2">Historial de Créditos</h4>
                          {customerCredits[customer.id] && customerCredits[customer.id].length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="p-2 text-left">Fecha</th>
                                  <th className="p-2 text-left">Tipo</th>
                                  <th className="p-2 text-left">Monto</th>
                                  <th className="p-2 text-left">Estado</th>
                                  <th className="p-2 text-left">Detalle</th>
                                </tr>
                              </thead>
                              <tbody>
                                {customerCredits[customer.id].map((credit: any) => (
                                  <tr key={credit.id} className="border-b">
                                    <td className="p-2">{new Date(credit.createdAt).toLocaleDateString()}</td>
                                    <td className="p-2">
                                      <span className={`px-2 py-1 rounded ${credit.type === 'charge' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {credit.type === 'charge' ? 'Cargo' : 'Pago'}
                                      </span>
                                    </td>
                                    <td className="p-2 font-medium">${credit.amount.toFixed(2)}</td>
                                    <td className="p-2">
                                      <span className={`px-2 py-1 rounded ${credit.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {credit.status === 'paid' ? 'Pagado' : 'Pendiente'}
                                      </span>
                                    </td>
                                    <td className="p-2 max-w-xs">
                                      {credit.type === 'charge' && credit.orderSummary ? (
                                        <div>
                                          <p className="text-xs text-gray-700 truncate" title={credit.orderSummary}>
                                            {credit.orderSummary}
                                          </p>
                                          {credit.orderDiscount > 0 && (
                                            <p className="text-xs text-green-600">
                                              Descuento: {credit.customerDiscount || 0}%
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-500">{credit.description || '-'}</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-gray-500 text-sm">No hay historial de créditos</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 md:hidden gap-4">
        {customers.map(customer => (
          <div key={customer.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-slate-800">{customer.name}</p>
                  <p className="text-xs text-slate-500">{customer.email || customer.phone || 'Sin contacto'}</p>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => openCreditModal(customer)}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md"
                  >
                    Crédito
                  </button>
                  <button onClick={() => openCustomerModal(customer)} className="p-2 text-slate-500 hover:text-zinc-700">
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar cliente ${customer.name}?`)) {
                        deleteCustomer(customer.id);
                      }
                    }}
                    className="p-2 text-slate-500 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg text-center text-xs">
                <div>
                  <div className="text-slate-500">Descuento</div>
                  <div className="font-bold text-green-600">{customer.discountPercentage}%</div>
                </div>
                <div>
                  <div className="text-slate-500">Límite</div>
                  <div className="font-medium">${customer.creditLimit.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Deuda</div>
                  <div className={`font-bold ${customer.currentCredit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${customer.currentCredit.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={closeCustomerModal}
        onSave={handleSaveCustomer}
        customerToEdit={customerToEdit}
      />
      <CreditModal
        isOpen={isCreditModalOpen}
        onClose={closeCreditModal}
        customer={selectedCustomer}
        onAddCredit={handleAddCredit}
      />
    </div>
  );
};

export default CustomersScreen;
