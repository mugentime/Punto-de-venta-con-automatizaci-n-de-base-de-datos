/**
 * Domain Entity Types
 * Core business entities with strict typing
 */

// Base entity interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// User related types
export type UserRole = 'admin' | 'manager' | 'employee';

export interface UserPermissions {
  canManageInventory?: boolean;
  canRegisterClients?: boolean;
  canViewReports?: boolean;
  canManageUsers?: boolean;
  canExportData?: boolean;
  canDeleteRecords?: boolean;
  canManageCashCuts?: boolean;
  canViewAnalytics?: boolean;
}

export interface User extends BaseEntity {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  permissions: UserPermissions;
  lastLogin?: Date;
  isEmailVerified?: boolean;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
}

export interface UserCreateData extends Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> {
  permissions?: UserPermissions;
}

export interface UserUpdateData extends Partial<Omit<User, 'id' | 'createdAt' | 'email'>> {}

// Product related types
export type ProductCategory = 'cafetería' | 'refrigerador' | 'otros';

export interface Product extends BaseEntity {
  name: string;
  category: ProductCategory;
  quantity: number;
  cost: number;
  price: number;
  lowStockAlert: number;
  description?: string;
  barcode?: string;
  createdBy: string;
  updatedBy?: string;
  tags?: string[];
  supplier?: string;
  unit?: string; // 'piece', 'kg', 'liter', etc.
}

export interface ProductCreateData extends Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> {
  description?: string;
  barcode?: string;
  tags?: string[];
  supplier?: string;
  unit?: string;
}

export interface ProductUpdateData extends Partial<Omit<Product, 'id' | 'createdAt' | 'createdBy'>> {}

// Record (Sales) related types
export type ServiceType = 'coworking' | 'cafetería' | 'evento';
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';

export interface SaleProduct {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category: ProductCategory;
}

export interface Record extends BaseEntity {
  client: string;
  service: ServiceType;
  products: SaleProduct[];
  hours?: number; // For coworking sessions
  payment: PaymentMethod;
  notes?: string;
  subtotal: number;
  serviceCharge: number;
  tip: number;
  total: number;
  cost: number;
  drinksCost: number;
  profit: number;
  date: Date;
  createdBy: string;
  isDeleted: boolean;
  deletedBy?: string;
  deletedAt?: Date;
}

export interface RecordCreateData extends Omit<Record, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'isDeleted'> {
  hours?: number;
  notes?: string;
}

export interface RecordUpdateData extends Partial<Omit<Record, 'id' | 'createdAt' | 'createdBy'>> {}

// Cash Cut related types
export type CashCutStatus = 'open' | 'closed';

export interface CashCutEntry {
  type: 'opening' | 'sale' | 'expense' | 'closing';
  amount: number;
  description: string;
  timestamp: Date;
  recordId?: string;
}

export interface SalesSummary {
  totalSales: number;
  totalRecords: number;
  paymentMethods: Record<PaymentMethod, number>;
  services: Record<ServiceType, number>;
}

export interface ProductSummary {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  category: ProductCategory;
}

export interface CashCutTotals {
  expectedCash: number;
  actualCash: number;
  difference: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  tips: number;
}

export interface CashCut extends BaseEntity {
  performedBy: string;
  startDate: Date;
  endDate?: Date;
  status: CashCutStatus;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount: number;
  openedBy: string;
  openedAt: Date;
  closedBy?: string;
  closedAt?: Date;
  entries: CashCutEntry[];
  salesSummary: SalesSummary;
  productSummary: ProductSummary[];
  totals: CashCutTotals;
  notes?: string;
  isAutomatic: boolean;
  isDeleted: boolean;
  deletedBy?: string;
  deletedAt?: Date;
}

export interface CashCutCreateData extends Omit<CashCut, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'isDeleted'> {}

export interface CashCutUpdateData extends Partial<Omit<CashCut, 'id' | 'createdAt' | 'performedBy'>> {}

// Coworking Session related types
export type SessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface CoworkingSession extends BaseEntity {
  client: string;
  startTime: Date;
  endTime?: Date;
  status: SessionStatus;
  hourlyRate: number;
  products: SaleProduct[];
  notes?: string;
  subtotal: number;
  timeCharge: number;
  total: number;
  cost: number;
  profit: number;
  payment?: PaymentMethod;
  createdBy: string;
  pausedDuration?: number; // in minutes
  discountApplied?: number;
}

export interface CoworkingSessionCreateData extends Omit<CoworkingSession, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> {
  endTime?: Date;
  notes?: string;
  payment?: PaymentMethod;
  pausedDuration?: number;
  discountApplied?: number;
}

export interface CoworkingSessionUpdateData extends Partial<Omit<CoworkingSession, 'id' | 'createdAt' | 'createdBy'>> {}

// Customer related types
export type CustomerType = 'regular' | 'coworker' | 'event';

export interface Customer extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
  type: CustomerType;
  notes?: string;
  visits: number;
  totalSpent: number;
  lastVisit?: Date;
  preferences?: string[];
  discountLevel?: number; // percentage
  membershipId?: string;
}

export interface CustomerCreateData extends Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'visits' | 'totalSpent'> {
  email?: string;
  phone?: string;
  notes?: string;
  preferences?: string[];
  discountLevel?: number;
  membershipId?: string;
}

export interface CustomerUpdateData extends Partial<Omit<Customer, 'id' | 'createdAt'>> {}

// Membership related types
export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'suspended';
export type MembershipType = 'daily' | 'weekly' | 'monthly' | 'annual';

export interface MembershipPlan {
  type: MembershipType;
  name: string;
  price: number;
  durationDays: number;
  benefits: string[];
  hoursIncluded?: number;
  discountPercentage?: number;
}

export interface Membership extends BaseEntity {
  customerId: string;
  planType: MembershipType;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  price: number;
  hoursRemaining?: number;
  autoRenew: boolean;
  notes?: string;
  suspendedBy?: string;
  suspendedAt?: Date;
  suspensionReason?: string;
}

export interface MembershipCreateData extends Omit<Membership, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> {
  notes?: string;
}

export interface MembershipUpdateData extends Partial<Omit<Membership, 'id' | 'createdAt' | 'customerId'>> {}

// Expense related types
export type ExpenseCategory = 'supplies' | 'utilities' | 'rent' | 'marketing' | 'maintenance' | 'other';

export interface Expense extends BaseEntity {
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: Date;
  receipt?: string; // file path or URL
  vendor?: string;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface ExpenseCreateData extends Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> {
  receipt?: string;
  vendor?: string;
  notes?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface ExpenseUpdateData extends Partial<Omit<Expense, 'id' | 'createdAt' | 'createdBy'>> {}