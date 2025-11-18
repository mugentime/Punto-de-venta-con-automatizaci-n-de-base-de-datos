import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import StatCard from '../components/StatCard';
import { SalesIcon, ProductsIcon, DashboardIcon, ExpenseIcon, CashIcon, HistoryIcon } from '../components/Icons';
import { deduplicateOrders } from '../utils/deduplication';

// Helper to format date to YYYY-MM-DD
const toISODateString = (date: Date) => date.toISOString().split('T')[0];

const ReportsScreen: React.FC = () => {
    const { isDataLoaded, orders, expenses, coworkingSessions } = useAppContext();

    // ⏳ LOADING STATE: Prevent premature rendering with $0.00 values
    if (!isDataLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
                    <h2 className="text-2xl font-semibold text-gray-800 mb-2">Cargando reportes...</h2>
                    <p className="text-gray-600">Por favor espere mientras se cargan los datos del sistema</p>
                </div>
            </div>
        );
    }

    // FIX BUG 4: Deduplicate orders before calculations
    const deduplicatedOrders = useMemo(() => deduplicateOrders(orders), [orders]);
    
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

    const setToday = () => {
        setDateRange(today, today);
    };

    const setYesterday = () => {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateRange(yesterday, yesterday);
    };

    const setThisWeek = () => {
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const startOfWeek = new Date(today);
        // Set to Monday (if Sunday, go back 6 days; otherwise go back dayOfWeek - 1 days)
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startOfWeek.setDate(today.getDate() - daysToMonday);
        setDateRange(startOfWeek, today);
    };

    const {
        filteredOrders,
        filteredExpenses,
        filteredCoworkingSessions,
        totalRevenue,
        totalExpensesAmount,
        netProfit,
        averageTicket,
        totalOrdersCount
    } = useMemo(() => {
        // Helper to extract date in local timezone as YYYY-MM-DD
        const getLocalDateString = (dateInput: string | Date): string => {
            const date = new Date(dateInput);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // DEBUG: Log date range and sample data
        console.log('📅 Date Range:', { startDate, endDate });
        console.log('📦 Total orders (deduplicated):', deduplicatedOrders.length);
        console.log('🏢 Total coworking sessions:', coworkingSessions.length);
        if (orders.length > 0) {
            console.log('Sample order dates:', orders.slice(0, 3).map(o => ({
                date: o.date,
                localDate: getLocalDateString(o.date),
                total: o.total
            })));
        }
        if (coworkingSessions.length > 0) {
            console.log('Sample coworking dates:', coworkingSessions.slice(0, 3).map(s => ({
                endTime: s.endTime,
                localDate: s.endTime ? getLocalDateString(s.endTime) : null,
                total: s.total
            })));
        }

        const currentFilteredOrders = deduplicatedOrders.filter(o => {
            const orderLocalDate = getLocalDateString(o.date);
            const isInRange = orderLocalDate >= startDate && orderLocalDate <= endDate;
            return isInRange;
        });

        const currentFilteredExpenses = expenses.filter(e => {
            const expenseLocalDate = getLocalDateString(e.date);
            return expenseLocalDate >= startDate && expenseLocalDate <= endDate;
        });

        // Include finished coworking sessions in revenue calculation
        const currentFilteredCoworkingSessions = coworkingSessions.filter(session => {
            if (session.status !== 'finished' || !session.endTime) return false;
            const sessionLocalDate = getLocalDateString(session.endTime);
            return sessionLocalDate >= startDate && sessionLocalDate <= endDate;
        });

        console.log('✅ Filtered results:', {
            orders: currentFilteredOrders.length,
            coworking: currentFilteredCoworkingSessions.length,
            expenses: currentFilteredExpenses.length
        });

        // Calculate revenue from orders
        const ordersRevenue = currentFilteredOrders.reduce((acc, order) => acc + order.total, 0);

        // ⚠️ CRITICAL FIX: Do NOT add coworkingRevenue separately!
        // Coworking sessions are automatically saved as orders via finishCoworkingSession()
        // in AppContext.tsx (lines 886-927). Adding them twice DUPLICATES revenue by $7,019.70+
        // const coworkingRevenue = currentFilteredCoworkingSessions.reduce((acc, session) => acc + (session.total || 0), 0);

        // Total revenue = orders only (already includes coworking sessions as orders)
        const totalRevenue = ordersRevenue;

        // Operating Expenses (includes COGS + rent, utilities, salaries, etc.)
        // Los gastos operativos ya incluyen el costo de mercancía, por lo tanto NO se deben sumar los costos por separado
        const totalExpensesAmount = currentFilteredExpenses.reduce((acc, expense) => acc + expense.amount, 0);

        // Net Profit = Revenue - Operating Expenses
        // Ganancia Neta = Ingresos - Gastos Operativos (que ya incluyen costos de mercancía)
        // Los costos NO entran separadamente para evitar duplicación
        const netProfit = totalRevenue - totalExpensesAmount;

        const totalOrdersCount = currentFilteredOrders.length + currentFilteredCoworkingSessions.length;
        const averageTicket = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

        return {
            filteredOrders: currentFilteredOrders,
            filteredExpenses: currentFilteredExpenses,
            filteredCoworkingSessions: currentFilteredCoworkingSessions,
            totalRevenue,
            totalExpensesAmount,
            netProfit,
            averageTicket,
            totalOrdersCount
        };
    }, [startDate, endDate, orders, expenses, coworkingSessions]);

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
                        <button onClick={setToday} className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium">Hoy</button>
                        <button onClick={setYesterday} className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium">Ayer</button>
                        <button onClick={setThisWeek} className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium">Esta Semana</button>
                        <button onClick={setThisMonth} className="px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Este Mes</button>
                        <button onClick={setLastMonth} className="px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Mes Pasado</button>
                        <button onClick={setThisYear} className="px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Este Año</button>
                    </div>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard title="Ingresos Totales" value={`$${totalRevenue.toFixed(2)}`} icon={<DashboardIcon className="h-6 w-6 text-green-600" />} />
                <StatCard title="Gastos Totales" value={`$${totalExpensesAmount.toFixed(2)}`} icon={<ExpenseIcon className="h-6 w-6 text-red-600" />} />
                <StatCard title="Ganancia Neta" value={`$${netProfit.toFixed(2)}`} icon={<CashIcon className="h-6 w-6 text-indigo-600" />} />
                <StatCard title="Ticket Promedio" value={`$${averageTicket.toFixed(2)}`} icon={<HistoryIcon className="h-6 w-6 text-yellow-600" />} />
            </div>

            {/* Clarification Note */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-lg">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-blue-700">
                            <strong>Nota:</strong> Los gastos totales incluyen todos los costos operativos (mercancía, renta, servicios, salarios, etc.).
                            La ganancia neta se calcula como: Ingresos - Gastos Totales. Los costos de mercancía no se suman por separado para evitar duplicación.
                        </p>
                    </div>
                </div>
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