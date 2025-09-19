import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import StatCard from '../components/StatCard';
import { SalesIcon, ProductsIcon, DashboardIcon, ExpenseIcon, CashIcon, HistoryIcon } from '../components/Icons';

// Helper to format date to YYYY-MM-DD
const toISODateString = (date: Date) => date.toISOString().split('T')[0];

const ReportsScreen: React.FC = () => {
    const { orders, expenses } = useAppContext();
    
    const today = new Date();
    const startOfMonth = toISODateString(new Date(today.getFullYear(), today.getMonth(), 1));
    const endOfToday = toISODateString(today);

    const [startDate, setStartDate] = useState(startOfMonth);
    const [endDate, setEndDate] = useState(endOfToday);

    const setDateRange = (start: Date, end: Date) => {
        setStartDate(toISODateString(start));
        setEndDate(toISODateString(end));
    };

    const setThisMonth = () => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setDateRange(start, end > today ? today : end);
    };

    const setLastMonth = () => {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateRange(start, end);
    };
    
    const setThisYear = () => {
        const start = new Date(today.getFullYear(), 0, 1);
        setDateRange(start, today);
    };

    const {
        filteredOrders,
        filteredExpenses,
        totalRevenue,
        totalCOGS,
        grossProfit,
        totalExpensesAmount,
        netProfit,
        averageTicket
    } = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59`);

        const currentFilteredOrders = orders.filter(o => {
            const orderDate = new Date(o.date);
            return orderDate >= start && orderDate <= end;
        });

        const currentFilteredExpenses = expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate >= start && expenseDate <= end;
        });

        const totalRevenue = currentFilteredOrders.reduce((acc, order) => acc + order.total, 0);
        const totalCOGS = currentFilteredOrders.reduce((acc, order) => acc + order.totalCost, 0);
        const grossProfit = totalRevenue - totalCOGS;
        const totalExpensesAmount = currentFilteredExpenses.reduce((acc, expense) => acc + expense.amount, 0);
        const netProfit = grossProfit - totalExpensesAmount;
        const totalOrdersCount = currentFilteredOrders.length;
        const averageTicket = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

        return {
            filteredOrders: currentFilteredOrders,
            filteredExpenses: currentFilteredExpenses,
            totalRevenue,
            totalCOGS,
            grossProfit,
            totalExpensesAmount,
            netProfit,
            averageTicket
        };
    }, [startDate, endDate, orders, expenses]);

    const downloadCSV = (data: any[], filename: string) => {
        if (data.length === 0) {
            alert("No hay datos para exportar en el periodo seleccionado.");
            return;
        }
        const headers = Object.keys(data[0]);
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(','), ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(','))].join('\n');
        
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadSales = () => {
        const salesData = filteredOrders.flatMap(order => 
            order.items.map(item => ({
                order_id: order.id,
                order_date: order.date,
                client_name: order.clientName,
                payment_method: order.paymentMethod,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                price: item.price,
                cost: item.cost,
                item_total: item.price * item.quantity,
            }))
        );
        downloadCSV(salesData, `ventas_${startDate}_a_${endDate}.csv`);
    };

    const handleDownloadExpenses = () => {
        const expensesData = filteredExpenses.map(e => ({
            expense_id: e.id,
            date: e.date,
            description: e.description,
            amount: e.amount,
            category: e.category,
            type: e.type
        }));
        downloadCSV(expensesData, `gastos_${startDate}_a_${endDate}.csv`);
    };
    
    return (
        <div id="report-content">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-6">Reportes Financieros</h1>

            {/* Date Filters */}
            <div className="bg-white p-4 rounded-3xl shadow-md mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-grow min-w-[150px]">
                        <label className="text-sm font-medium text-slate-600">Desde</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-xl p-2"/>
                    </div>
                    <div className="flex-grow min-w-[150px]">
                        <label className="text-sm font-medium text-slate-600">Hasta</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-xl p-2"/>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-5">
                        <button onClick={setThisMonth} className="px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Este Mes</button>
                        <button onClick={setLastMonth} className="px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Mes Pasado</button>
                        <button onClick={setThisYear} className="px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Este Año</button>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <StatCard title="Ingresos Totales" value={`$${totalRevenue.toFixed(2)}`} icon={<DashboardIcon className="h-6 w-6 text-green-600" />} />
                <StatCard title="Costo de Mercancía" value={`$${totalCOGS.toFixed(2)}`} icon={<ProductsIcon className="h-6 w-6 text-orange-600" />} />
                <StatCard title="Ganancia Bruta" value={`$${grossProfit.toFixed(2)}`} icon={<SalesIcon className="h-6 w-6 text-sky-600" />} />
                <StatCard title="Gastos Operativos" value={`$${totalExpensesAmount.toFixed(2)}`} icon={<ExpenseIcon className="h-6 w-6 text-red-600" />} />
                <StatCard title="Ganancia Neta" value={`$${netProfit.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-indigo-600" />} />
                <StatCard title="Ticket Promedio" value={`$${averageTicket.toFixed(2)}`} icon={<HistoryIcon className="h-6 w-6 text-yellow-600" />} />
            </div>

            {/* Export Actions */}
            <div className="bg-white p-4 rounded-3xl shadow-md mb-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">Exportar Datos</h2>
                <div className="flex flex-wrap gap-4">
                     <button onClick={() => window.print()} className="px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors">Imprimir / Guardar PDF</button>
                     <button onClick={handleDownloadSales} className="px-4 py-2 bg-green-700 text-white rounded-xl hover:bg-green-600 transition-colors">Descargar Ventas (CSV)</button>
                     <button onClick={handleDownloadExpenses} className="px-4 py-2 bg-red-700 text-white rounded-xl hover:bg-red-600 transition-colors">Descargar Gastos (CSV)</button>
                </div>
            </div>

            {/* Styling for print */}
            <style>
            {`
                @media print {
                    body {
                        padding-bottom: 0 !important;
                    }
                    body * {
                        visibility: hidden;
                    }
                    nav {
                        display: none !important;
                    }
                    #report-content, #report-content * {
                        visibility: visible;
                    }
                    #report-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 1rem;
                    }
                    .shadow-md {
                        box-shadow: none !important;
                    }
                    .bg-white {
                        border: 1px solid #eee;
                    }
                }
            `}
            </style>
        </div>
    );
};

export default ReportsScreen;