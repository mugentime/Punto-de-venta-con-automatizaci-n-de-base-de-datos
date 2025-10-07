import React, { useState } from 'react';
import StatCard from '../components/StatCard';
import { useAppContext } from '../contexts/AppContext';
import { SalesIcon, ProductsIcon, HistoryIcon, DashboardIcon, ExpenseIcon, CashIcon } from '../components/Icons';

const DashboardScreen: React.FC = () => {
    const { orders, expenses, coworkingSessions } = useAppContext();
    const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('today');

    const TimeframeButton: React.FC<{
      label: string;
      value: 'today' | 'week' | 'month';
    }> = ({ label, value }) => (
      <button
        onClick={() => setTimeframe(value)}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
          timeframe === value
            ? 'bg-zinc-900 text-white'
            : 'text-slate-600 hover:bg-slate-300'
        }`}
      >
        {label}
      </button>
    );

    // FIX: Used generics to preserve the item type after filtering.
    const filterByTimeframe = <T extends { date: string }>(items: T[]): T[] => {
        const now = new Date();
        switch (timeframe) {
            case 'today':
                return items.filter(i => new Date(i.date).toDateString() === now.toDateString());
            case 'week': {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                return items.filter(i => new Date(i.date) >= startOfWeek);
            }
            case 'month': {
                 const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                 return items.filter(i => new Date(i.date) >= startOfMonth);
            }
            default:
                return items;
        }
    };
    
    const filteredOrders = filterByTimeframe(orders);
    const filteredExpenses = filterByTimeframe(expenses);

    // Filter finished coworking sessions by timeframe
    const filteredCoworkingSessions = coworkingSessions.filter(session => {
        if (session.status !== 'finished' || !session.endTime) return false;
        const sessionDate = new Date(session.endTime);
        const now = new Date();

        switch (timeframe) {
            case 'today':
                return sessionDate.toDateString() === now.toDateString();
            case 'week': {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                return sessionDate >= startOfWeek;
            }
            case 'month': {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return sessionDate >= startOfMonth;
            }
            default:
                return false;
        }
    });

    // Calculate revenue from orders
    const ordersRevenue = filteredOrders.reduce((acc, order) => acc + order.total, 0);

    // Calculate revenue from finished coworking sessions
    const coworkingRevenue = filteredCoworkingSessions.reduce((acc, session) => acc + (session.total || 0), 0);

    // Total revenue includes both orders and coworking sessions
    const totalRevenue = ordersRevenue + coworkingRevenue;

    const totalCOGS = filteredOrders.reduce((acc, order) => acc + order.totalCost, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const totalExpenses = filteredExpenses.reduce((acc, expense) => acc + expense.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const totalOrders = filteredOrders.length;
    
    const getTopSellingProducts = () => {
        const productCounts = new Map<string, { name: string, count: number }>();
        filteredOrders.forEach(order => {
            order.items.forEach(item => {
                const existing = productCounts.get(item.id);
                productCounts.set(item.id, {
                    name: item.name,
                    count: (existing?.count || 0) + item.quantity
                });
            });
        });
        return Array.from(productCounts.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    };

    const topProducts = getTopSellingProducts();

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Dashboard</h1>
                <div className="flex space-x-1 bg-slate-200 p-1 rounded-lg self-start sm:self-center">
                    <TimeframeButton label="Hoy" value="today" />
                    <TimeframeButton label="Semana" value="week" />
                    <TimeframeButton label="Mes" value="month" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    title="Ingresos" 
                    value={`$${totalRevenue.toFixed(2)}`}
                    icon={<DashboardIcon className="h-6 w-6 text-green-600" />}
                />
                <StatCard 
                    title="Costo de Mercancía" 
                    value={`$${totalCOGS.toFixed(2)}`}
                    icon={<ProductsIcon className="h-6 w-6 text-orange-600" />}
                />
                <StatCard 
                    title="Ganancia Bruta" 
                    value={`$${grossProfit.toFixed(2)}`}
                    icon={<SalesIcon className="h-6 w-6 text-sky-600" />}
                />
                <StatCard 
                    title="Gastos Operativos" 
                    value={`$${totalExpenses.toFixed(2)}`}
                    icon={<ExpenseIcon className="h-6 w-6 text-red-600" />}
                />
                <StatCard 
                    title="Ganancia Neta" 
                    value={`$${netProfit.toFixed(2)}`}
                    icon={<CashIcon className="h-6 w-6 text-indigo-600" />}
                />
                <StatCard 
                    title="Órdenes" 
                    value={totalOrders.toString()}
                    icon={<HistoryIcon className="h-6 w-6 text-yellow-600" />}
                />
            </div>
            <div className="mt-8 bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Top Productos Vendidos</h2>
                {topProducts.length > 0 ? (
                    <ul className="space-y-3">
                        {topProducts.map((p, index) => (
                            <li key={p.name} className="flex justify-between items-center text-sm p-2 rounded-md even:bg-slate-50">
                                <span className="font-medium text-slate-700">{index + 1}. {p.name}</span>
                                <span className="font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded-full">{p.count} <span className="font-medium text-slate-500">vendidos</span></span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-slate-500 py-4">No hay datos de ventas para este periodo.</p>
                )}
            </div>
        </div>
    );
};

export default DashboardScreen;