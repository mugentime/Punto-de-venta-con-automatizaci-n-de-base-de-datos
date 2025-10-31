export interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  description: string;
  imageUrl: string;
  category: 'Cafetería' | 'Refrigerador' | 'Alimentos' | 'Membresías';
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  totalCost: number;
  clientName: string;
  serviceType: 'Mesa' | 'Para llevar';
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Crédito'; // FIX BUG 2: Add Crédito
  tip?: number;
  discount?: number; // FIX BUG 1: Add discount field
  customerId?: string; // Add customerId for tracking
}

export type ExpenseCategory = 'Luz' | 'Internet' | 'Sueldos' | 'Inventario' | 'Otro';
export type ExpenseType = 'Frecuente' | 'Emergente';
export type ExpensePaymentMethod = 'Efectivo Caja' | 'Transferencia' | 'Tarjeta' | 'Otro';

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  type: ExpenseType;
  paymentMethod: ExpensePaymentMethod;
}

export interface CoworkingSession {
  id: string;
  clientName: string;
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  status: 'active' | 'finished';
  consumedExtras: CartItem[];
}

export interface CashSession {
  id: string;
  startDate: string;
  endDate: string | null;
  startAmount: number;
  endAmount: number | null;
  status: 'open' | 'closed';
  totalSales?: number;
  totalExpenses?: number;
  expectedCash?: number;
  difference?: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  role: 'admin' | 'employee';
  status: 'pending' | 'approved';
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  discountPercentage: number;
  creditLimit: number;
  currentCredit: number;
  createdAt: string;
}

export interface CustomerCredit {
  id: string;
  customerId: string;
  orderId?: string;
  amount: number;
  type: 'charge' | 'payment';
  status: 'pending' | 'paid';
  description?: string;
  createdAt: string;
}

export interface CashWithdrawal {
  id: string;
  cash_session_id: string;
  amount: number;
  description: string;
  withdrawn_by?: string;
  withdrawn_at: string;
  created_at: string;
}