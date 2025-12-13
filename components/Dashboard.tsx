
import React, { useContext, useState, useEffect } from 'react';
import type { Order, Client, Store, Shipment, GlobalActivityLog, AppSettings, Currency } from '../types';
import { OrderStatus, ShipmentStatus, ShippingType } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, CartesianGrid, AreaChart, Area, ComposedChart, Legend
} from 'recharts';
import { 
    TrendingUp, DollarSign, Clock, 
    Activity, ArrowUpRight, ArrowDownRight, Calendar, 
    FileText, Wallet,
    BellRing, Hash, Scale, Store as StoreIcon, Truck, Percent,
    Container, Anchor, Warehouse, Plus, Globe, MessageCircle, ChevronDown, ChevronUp, Calculator,
    ListOrdered, ShoppingCart, MapPin, PackageCheck, CheckCircle2, CircleDashed
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import QuickCalculator from './QuickCalculator';

interface DashboardProps {
  orders: Order[];
  clients: Client[];
  stores: Store[];
  shipments: Shipment[];
  onFilterClick: (filter: string) => void;
  globalActivityLog: GlobalActivityLog[];
  onNewOrder: () => void;
  settings: AppSettings;
  currencies: Currency[];
  isLoading?: boolean;
}

const fmtNum = (num: number) => num.toLocaleString('en-US');
const fmtCurrency = (num: number) => Math.round(num).toLocaleString('en-US');

// --- Skeleton Components ---
const SkeletonCard = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-32 animate-pulse">
        <div className="flex justify-between items-start">
            <div className="space-y-3 w-1/2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            </div>
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
        <div className="mt-4 h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>
);

const SkeletonChart = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-80 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
        <div className="h-full bg-gray-100 dark:bg-gray-800/50 rounded-lg flex items-end justify-between px-4 pb-4 gap-2">
            {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className="bg-gray-300 dark:bg-gray-700 rounded-t w-full" style={{height: `${Math.random() * 60 + 20}%`}}></div>
            ))}
        </div>
    </div>
);

const SkeletonList = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        {[1,2,3,4].map(i => (
            <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-3 w-full">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="space-y-1 w-full">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const CurrencyTicker: React.FC<{ currencies: Currency[]; settings: AppSettings }> = ({ currencies }) => {
    const [liveRates, setLiveRates] = useState<Record<string, number>>({});
    
    useEffect(() => {
        const fetchRates = async () => {
            try {
                const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
                if (res.ok) {
                    const data = await res.json();
                    const rates = data.rates;
                    const systemUsd = currencies.find(c => c.code === 'USD');
                    const baseUsdToMru = rates['MRU'] || (systemUsd ? systemUsd.rate : 39.8); 
                    const calculatedRates: Record<string, number> = {};
                    const targets = ['USD', 'EUR', 'CNY', 'GBP', 'TRY', 'AED'];
                    targets.forEach(code => {
                        if (code === 'USD') calculatedRates[code] = baseUsdToMru;
                        else if (rates[code]) calculatedRates[code] = (1 / rates[code]) * baseUsdToMru;
                    });
                    setLiveRates(calculatedRates);
                }
            } catch (e) { console.error("Failed to fetch live rates", e); }
        };
        fetchRates();
    }, [currencies]);

    return (
        <div className="flex flex-col md:flex-row gap-2 text-xs font-mono mb-6" dir="ltr">
            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 px-3 py-2 flex items-center gap-4 overflow-x-auto shadow-sm flex-1">
                <span className="text-primary font-bold whitespace-nowrap flex items-center gap-1"><DollarSign size={12}/> System:</span>
                {currencies.map(c => (
                    <span key={c.id} className="whitespace-nowrap"><b className="text-gray-700 dark:text-gray-300">{c.code}</b> <span className="text-primary">{c.rate}</span></span>
                ))}
            </div>
            <div className="bg-black/90 text-white rounded-lg px-3 py-2 flex items-center gap-4 overflow-x-auto shadow-sm flex-1">
                <span className="text-green-400 font-bold whitespace-nowrap flex items-center gap-1"><Globe size={12}/> Market:</span>
                {Object.entries(liveRates).map(([code, rate]) => (
                    <span key={code} className="whitespace-nowrap"><b className="text-gray-400">{code}</b> <span className="text-green-400">{(rate as number).toFixed(2)}</span></span>
                ))}
            </div>
        </div>
    );
};

const StatCard: React.FC<{ 
    title: string; 
    value: string; 
    subValue?: string;
    icon: React.ReactNode; 
    trend?: string; 
    trendDirection?: 'up' | 'down' | 'neutral';
    colorClass: string;
    description?: string;
}> = ({ title, value, subValue, icon, trend, trendDirection, colorClass, description }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-all">
        <div className="flex justify-between items-start z-10 relative">
            <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{title}</p>
                <div className="flex items-baseline gap-1">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tight">{value}</h3>
                    {subValue && <span className="text-xs font-semibold text-gray-400">{subValue}</span>}
                </div>
            </div>
            <div className={`p-2.5 rounded-xl ${colorClass} text-white shadow-lg shadow-gray-200/50 dark:shadow-none bg-opacity-90`}>
                {icon}
            </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
            {trend && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trendDirection === 'up' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {trend}
                </span>
            )}
            <span className="text-[10px] text-gray-400 truncate">{description}</span>
        </div>
        {/* Abstract bg shape */}
        <div className={`absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-5 ${colorClass.replace('bg-', 'text-')}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { size: 96, fill: 'currentColor' })}
        </div>
    </div>
);

const OrderSummaryCard: React.FC<{
    title: string;
    count: number;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
}> = ({ title, count, icon, color, onClick }) => {
    // Mapping standard Tailwind colors to specific style sets
    const styles: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
        purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
        pink: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800',
        cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
        green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
        gray: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    };

    const activeStyle = styles[color] || styles.gray;

    return (
        <button 
            onClick={onClick}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.02] hover:shadow-sm w-full group ${activeStyle}`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/60 dark:bg-black/20 shadow-sm backdrop-blur-sm`}>
                    {icon}
                </div>
                <div className="text-right">
                    <span className="block text-[11px] font-bold opacity-80">{title}</span>
                    <span className="block text-xl font-black font-mono tracking-tight">{count}</span>
                </div>
            </div>
        </button>
    );
};

const PipelineStage: React.FC<{ label: string; count: number; color: string; icon: React.ReactNode, isLast?: boolean }> = ({ label, count, color, icon, isLast }) => (
    <div className="flex items-center flex-1 min-w-[120px]">
        <div className="flex flex-col items-center w-full relative group">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md mb-2 transition-transform group-hover:scale-110 ${color}`}>
                {icon}
            </div>
            <span className="text-xl font-bold text-gray-800 dark:text-white font-mono">{count}</span>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{label}</span>
        </div>
        {!isLast && (
            <div className="hidden md:block w-full h-0.5 bg-gray-200 dark:bg-gray-700 mx-2 relative">
                <div className="absolute right-0 -top-1 w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            </div>
        )}
    </div>
);

const UrgentActionCard: React.FC<{ 
    title: string; 
    count: number; 
    icon: React.ReactNode; 
    color: string; // Tailwind color class e.g., 'red', 'blue'
    onClick: () => void;
    label: string;
}> = ({ title, count, icon, color, onClick, label }) => {
    // We map color prop to classes dynamically
    const bgClass = `bg-${color}-50 dark:bg-${color}-900/10`;
    const borderClass = `border-${color}-100 dark:border-${color}-900/30`;
    const textClass = `text-${color}-700 dark:text-${color}-300`;
    const iconBgClass = `bg-${color}-100 dark:bg-${color}-900/50`;
    const iconTextClass = `text-${color}-600 dark:text-${color}-400`;

    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all hover:shadow-md active:scale-95 group ${bgClass} ${borderClass}`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${iconBgClass} ${iconTextClass}`}>
                    {icon}
                </div>
                <div className="text-right">
                    <h4 className={`font-bold text-sm ${textClass}`}>{title}</h4>
                    <span className="text-[10px] opacity-70 font-medium">{label}</span>
                </div>
            </div>
            <div className={`text-xl font-black font-mono ${textClass} group-hover:scale-110 transition-transform`}>
                {fmtNum(count)}
            </div>
        </button>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ orders, stores, shipments, onFilterClick, onNewOrder, settings, currencies, isLoading }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const [showCalculator, setShowCalculator] = useState(false);

    // --- Calculations ---
    const totalCommission = orders.reduce((sum, o) => sum + (o.commission || 0), 0);
    const totalShippingRevenue = orders.reduce((sum, o) => sum + (o.shippingCost || 0), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + (o.priceInMRU || 0) + (o.commission || 0) + (o.shippingCost || 0), 0); 
    const totalPaid = orders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
    const totalDebt = totalRevenue - totalPaid;

    // Status Counts for Summary Strip
    const statusCounts = {
        total: orders.length,
        new: orders.filter(o => o.status === OrderStatus.NEW).length,
        ordered: orders.filter(o => o.status === OrderStatus.ORDERED).length,
        arrived: orders.filter(o => o.status === OrderStatus.ARRIVED_AT_OFFICE).length,
        stored: orders.filter(o => o.status === OrderStatus.STORED).length,
        completed: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
    };

    const shipmentsNew = shipments.filter(s => s.status === ShipmentStatus.NEW).length;
    const shipmentsShipped = shipments.filter(s => s.status === ShipmentStatus.SHIPPED).length; 
    const shipmentsArrivedHub = shipments.filter(s => s.status === ShipmentStatus.PARTIALLY_ARRIVED).length; 
    const shipmentsArrivedOffice = shipments.filter(s => s.status === ShipmentStatus.ARRIVED).length; 

    const alerts = {
        tracking: orders.filter(o => o.status === OrderStatus.ORDERED && !o.trackingNumber).length,
        whatsapp: orders.filter(o => (o.status === OrderStatus.ARRIVED_AT_OFFICE || o.status === OrderStatus.STORED) && !o.whatsappNotificationSent).length,
        billing: orders.filter(o => o.status === OrderStatus.STORED && ((o.priceInMRU||0)+(o.commission||0)+(o.shippingCost||0)-(o.amountPaid||0)) > 0).length,
        late: orders.filter(o => o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.CANCELLED && new Date(o.expectedArrivalDate).getTime() < new Date().getTime()).length,
        stored: orders.filter(o => o.status === OrderStatus.STORED).length
    };

    const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const chartData = last7Days.map(date => {
        const dailyOrders = orders.filter(o => o.orderDate === date);
        const income = dailyOrders.reduce((sum, o) => sum + (o.commission || 0) + (o.shippingCost || 0), 0); 
        return { 
            date: new Date(date).toLocaleDateString('en-GB', {weekday: 'short'}), 
            orders: dailyOrders.length,
            income: income 
        };
    });

    const storePerformance = stores.map(store => {
        const storeOrders = orders.filter(o => o.storeId === store.id);
        const value = storeOrders.reduce((sum, o) => sum + (o.priceInMRU || 0), 0);
        return { name: store.name, orders: storeOrders.length, value };
    }).sort((a, b) => b.value - a.value).slice(0, 5);

    const shippingTypeData = [
        { name: t('fast'), value: orders.filter(o => o.shippingType === ShippingType.FAST).length, color: '#EF4444' },
        { name: t('normal'), value: orders.filter(o => o.shippingType === ShippingType.NORMAL).length, color: '#3B82F6' },
    ];

    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    if (isLoading && orders.length === 0) {
        return (
            <div className="space-y-8 pb-10 animate-in fade-in duration-500">
                <div className="h-20 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2"><SkeletonChart /></div>
                    <div><SkeletonList /></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10 animate-in fade-in duration-500">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        {t('dashboard')}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium flex items-center gap-2">
                        <Calendar size={14}/> {today}
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {currentUser?.permissions.orders.create && (
                        <button onClick={onNewOrder} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/30 transition-all active:scale-95">
                            <Plus size={18}/> <span>{t('newOrder')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Currency Ticker & Collapsible Calculator */}
            <CurrencyTicker currencies={currencies} settings={settings} />
            
            <div className="border-b border-gray-200 dark:border-gray-800 pb-6">
                <button 
                    onClick={() => setShowCalculator(!showCalculator)}
                    className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-primary transition-colors mb-2"
                >
                    <Calculator size={16}/> {showCalculator ? t('hideCalculator') : t('openCalculator')} 
                    {showCalculator ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                
                {showCalculator && (
                    <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                        <QuickCalculator currencies={currencies} settings={settings} />
                    </div>
                )}
            </div>

            {/* --- Order Status Summary Strip (New Feature) --- */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <OrderSummaryCard 
                    title={t('totalCount')}
                    count={statusCounts.total} 
                    icon={<ListOrdered size={20}/>} 
                    color="gray"
                    onClick={() => onFilterClick('all')} 
                />
                <OrderSummaryCard 
                    title={t('statusNew')} 
                    count={statusCounts.new} 
                    icon={<CircleDashed size={20}/>} 
                    color="blue"
                    onClick={() => onFilterClick(OrderStatus.NEW)} 
                />
                <OrderSummaryCard 
                    title={t('statusOrdered')}
                    count={statusCounts.ordered} 
                    icon={<ShoppingCart size={20}/>} 
                    color="indigo"
                    onClick={() => onFilterClick(OrderStatus.ORDERED)} 
                />
                <OrderSummaryCard 
                    title={t('statusArrivedOffice')} 
                    count={statusCounts.arrived} 
                    icon={<MapPin size={20}/>} 
                    color="pink"
                    onClick={() => onFilterClick(OrderStatus.ARRIVED_AT_OFFICE)} 
                />
                <OrderSummaryCard 
                    title={t('statusStored')}
                    count={statusCounts.stored} 
                    icon={<PackageCheck size={20}/>} 
                    color="cyan"
                    onClick={() => onFilterClick(OrderStatus.STORED)} 
                />
                <OrderSummaryCard 
                    title={t('statusCompleted')}
                    count={statusCounts.completed} 
                    icon={<CheckCircle2 size={20}/>} 
                    color="green"
                    onClick={() => onFilterClick(OrderStatus.COMPLETED)} 
                />
            </div>

            {/* Main Stats Grid (Bento Box Style) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title={t('netCommission')} 
                    value={fmtCurrency(totalCommission)}
                    subValue="MRU"
                    icon={<Percent size={24}/>}
                    colorClass="bg-purple-600"
                    trend="+12%" trendDirection="up"
                    description="Net Profit"
                />
                <StatCard 
                    title={t('shippingRevenue')}
                    value={fmtCurrency(totalShippingRevenue)}
                    subValue="MRU"
                    icon={<Truck size={24}/>}
                    colorClass="bg-blue-600"
                    trend="+5%" trendDirection="up"
                    description="Revenue"
                />
                <StatCard 
                    title={t('debt')}
                    value={fmtCurrency(totalDebt)}
                    subValue="MRU"
                    icon={<Wallet size={24}/>}
                    colorClass="bg-red-500"
                    trend="-2%" trendDirection="down"
                    description="Receivables"
                />
                <StatCard 
                    title={t('cash')} 
                    value={fmtCurrency(totalPaid)}
                    subValue="MRU"
                    icon={<DollarSign size={24}/>}
                    colorClass="bg-green-600"
                    trend="+18%" trendDirection="up"
                    description="Realized"
                />
            </div>

            {/* Operations & Performance Section */}
            <div className="grid grid-cols-12 gap-6">
                
                {/* Urgent Action Center (Left - 4 Cols) */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                            <BellRing size={20} className="text-red-500"/> {t('urgentAction')}
                        </h3>
                        <div className="space-y-3">
                            <UrgentActionCard 
                                title={t('lateOrders')}
                                count={alerts.late}
                                icon={<Clock size={18}/>}
                                color="red"
                                onClick={() => onFilterClick('late')}
                                label="Overdue"
                            />
                            <UrgentActionCard 
                                title={t('needsTracking')} 
                                count={alerts.tracking}
                                icon={<Hash size={18}/>}
                                color="indigo"
                                onClick={() => onFilterClick('needs_tracking')}
                                label="Missing Numbers"
                            />
                            <UrgentActionCard 
                                title={t('clientNotifications')} 
                                count={alerts.whatsapp}
                                icon={<MessageCircle size={18}/>}
                                color="green"
                                onClick={() => onFilterClick('needs_whatsapp')}
                                label="Ready to send"
                            />
                            <UrgentActionCard 
                                title={t('pendingBilling')} 
                                count={alerts.billing}
                                icon={<FileText size={18}/>}
                                color="blue"
                                onClick={() => onFilterClick('ready_billing')} 
                                label="Unpaid Stored"
                            />
                        </div>
                    </div>
                </div>

                {/* Financial Chart (Right - 8 Cols) */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <TrendingUp size={20} className="text-primary"/> {t('weeklyPerformance')}
                            </h3>
                        </div>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} stroke="#E5E7EB" strokeOpacity={0.5} strokeDasharray="3 3"/>
                                    <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis yAxisId="left" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`}/>
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false}/>
                                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }} cursor={{fill: 'transparent'}}/>
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Area yAxisId="left" type="monotone" dataKey="income" name={t('income') + ' (MRU)'} stroke="#8B5CF6" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                                    <Bar yAxisId="right" dataKey="orders" name={t('ordersCount')} barSize={30} fill="#3B82F6" radius={[6, 6, 0, 0]} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logistics Row */}
            <div className="grid grid-cols-12 gap-6">
                {/* Shipment Pipeline */}
                <div className="col-span-12 lg:col-span-8 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Container className="text-primary"/> {t('activeShipments')}
                        </h3>
                    </div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 px-4">
                        <PipelineStage label={t('shipmentNew')} count={shipmentsNew} color="bg-gray-400" icon={<FileText size={20}/>} />
                        <PipelineStage label={t('shipmentTransit')} count={shipmentsShipped} color="bg-blue-500" icon={<Anchor size={20}/>} />
                        <PipelineStage label={t('shipmentPartial')} count={shipmentsArrivedHub} color="bg-orange-500" icon={<Container size={20}/>} />
                        <PipelineStage label={t('shipmentArrived')} count={shipmentsArrivedOffice} color="bg-green-500" icon={<Warehouse size={20}/>} isLast={true} />
                    </div>
                </div>

                {/* Storage Status */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Warehouse className="text-primary"/> {t('storageStatus')}
                        </h3>
                        <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full font-bold">
                            {alerts.stored} {t('orders')}
                        </span>
                    </div>
                    <div className="flex items-center justify-center py-4">
                        <div className="relative w-32 h-32">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={[{ value: alerts.stored, color: '#3B82F6' }, { value: 100, color: '#E5E7EB' }]} innerRadius={50} outerRadius={60} startAngle={180} endAngle={0} paddingAngle={0} dataKey="value" stroke="none">
                                        <Cell fill="#3B82F6" />
                                        <Cell fill="#f3f4f6" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                <Scale className="mx-auto text-gray-400 mb-1" size={16}/>
                                <span className="text-lg font-black text-gray-800 dark:text-white font-mono">{fmtNum(orders.reduce((acc, o) => acc + (o.weight || 0), 0))}</span>
                                <span className="text-[10px] text-gray-400 block">KG Total</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Stores & Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <StoreIcon size={20} className="text-primary"/> {t('topStores')}
                    </h3>
                    <div className="space-y-4">
                        {storePerformance.map((store, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 font-mono text-sm">
                                    {idx + 1}
                                </div>
                                <div className="flex-grow">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-bold text-gray-800 dark:text-gray-200">{store.name}</span>
                                        <span className="font-mono text-gray-600 dark:text-gray-400 font-bold">{fmtCurrency(store.value)} <span className="text-[10px]">MRU</span></span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                                        <div className="bg-primary h-1.5 rounded-full transition-all duration-1000" style={{ width: `${(store.value / (storePerformance[0]?.value || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-grow">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                            <Activity size={20} className="text-primary"/> {t('shippingPrefs')}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">Distribution by Speed</p>
                        <div className="space-y-3">
                            {shippingTypeData.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                                        <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-bold text-md font-mono">{item.value}</span>
                                        <span className="text-[10px] text-gray-400">{t('orders')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-40 h-40 relative flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={shippingTypeData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={5} cornerRadius={4}>
                                    {shippingTypeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', backgroundColor: '#1f2937', color: '#fff'}} itemStyle={{color: '#fff'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xs font-bold text-gray-400">Type</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
