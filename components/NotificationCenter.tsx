
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Clock, Hash, CheckCircle, X, ChevronRight, Truck, PackageX, Hourglass, AlertOctagon, History } from 'lucide-react';
import type { Order, Store } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationCenterProps {
    orders: Order[];
    stores: Store[];
    onNavigateToOrder: (orderId: string) => void;
}

interface NotificationItem {
    id: string;
    type: 'urgent' | 'warning' | 'info';
    category: 'shipping' | 'tracking' | 'inventory' | 'billing';
    title: string;
    message: string;
    orderId?: string; // Internal UUID
    localOrderId?: string; // Human Readable ID (e.g. FCD1001)
    date: Date;
    daysLate?: number;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ orders, stores, onNavigateToOrder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const menuRef = useRef<HTMLDivElement>(null);
    const { dir } = useLanguage();

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const notifications = useMemo(() => {
        const list: NotificationItem[] = [];
        const now = new Date();

        // Helper to calculate days difference
        const getDaysDiff = (dateStr: string) => {
            const date = new Date(dateStr);
            const diffTime = now.getTime() - date.getTime();
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        };

        // --- 1. SMART TRACKING WATCHDOG (مراقب التتبع الذكي) ---
        const ordersNeedingTracking = orders.filter(o => o.status === OrderStatus.ORDERED && !o.trackingNumber);
        
        ordersNeedingTracking.forEach(order => {
            const store = stores.find(s => s.id === order.storeId);
            const estimatedDays = store?.estimatedDeliveryDays || 14; 
            const halfDuration = Math.ceil(estimatedDays / 2);
            const daysPassed = getDaysDiff(order.orderDate);

            if (daysPassed >= halfDuration) {
                list.push({
                    id: `track-${order.id}-${daysPassed}`,
                    type: 'urgent',
                    category: 'tracking',
                    title: `تأخر تتبع (${order.localOrderId})`,
                    message: `مرت ${daysPassed} أيام (نصف المدة) على طلب ${store?.name || 'المتجر'} دون رقم تتبع.`,
                    orderId: order.id,
                    localOrderId: order.localOrderId,
                    date: now,
                    daysLate: daysPassed
                });
            }
        });

        // --- 2. FAST SHIPPING ALARM (منبه الشحن السريع) ---
        const fastOrders = orders.filter(o => o.shippingType === ShippingType.FAST && 
            [OrderStatus.NEW, OrderStatus.ORDERED, OrderStatus.SHIPPED_FROM_STORE, OrderStatus.ARRIVED_AT_HUB].includes(o.status)
        );

        fastOrders.forEach(order => {
            const store = stores.find(s => s.id === order.storeId);
            const estimatedDays = store?.estimatedDeliveryDays || 10;
            const halfDuration = Math.ceil(estimatedDays / 2);
            const daysPassed = getDaysDiff(order.orderDate);

            if (daysPassed >= halfDuration) {
                list.push({
                    id: `fast-${order.id}-${daysPassed}`,
                    type: 'urgent',
                    category: 'shipping',
                    title: `شحن سريع متأخر (${order.localOrderId})`,
                    message: `الطلب لم يتحرك منذ ${daysPassed} أيام! يرجى مراجعته فوراً.`,
                    orderId: order.id,
                    localOrderId: order.localOrderId,
                    date: now
                });
            }
        });

        // --- 3. STAGNANT INVENTORY (المخزون الراكد) ---
        const storedOrders = orders.filter(o => o.status === OrderStatus.STORED && o.storageDate);
        
        storedOrders.forEach(order => {
            const daysInStorage = getDaysDiff(order.storageDate!);
            if (daysInStorage > 15) {
                list.push({
                    id: `stagnant-${order.id}`,
                    type: 'warning',
                    category: 'inventory',
                    title: `تكدس مخزون (${order.localOrderId})`,
                    message: `الطلب موجود في ${order.storageLocation} منذ ${daysInStorage} يوماً.`,
                    orderId: order.id,
                    localOrderId: order.localOrderId,
                    date: now
                });
            }
        });

        // --- 4. GHOST ORDERS (طلبات منسية) ---
        const newOrders = orders.filter(o => o.status === OrderStatus.NEW);
        newOrders.forEach(order => {
            const daysPassed = getDaysDiff(order.orderDate);
            const isHighValue = (order.priceInMRU || 0) > 10000;

            if ((isHighValue && daysPassed >= 2) || daysPassed >= 5) {
                list.push({
                    id: `ghost-${order.id}`,
                    type: isHighValue ? 'urgent' : 'info',
                    category: 'billing',
                    title: isHighValue ? `طلب جديد عالٍ (${order.localOrderId})` : `طلب جديد مهمل (${order.localOrderId})`,
                    message: `الطلب لا يزال في حالة "جديد" منذ ${daysPassed} أيام.`,
                    orderId: order.id,
                    localOrderId: order.localOrderId,
                    date: now
                });
            }
        });

        // --- 5. LATE ARRIVAL (تأخر الوصول) ---
        const transitOrders = orders.filter(o => o.status === OrderStatus.IN_TRANSIT);
        transitOrders.forEach(order => {
            if (new Date(order.expectedArrivalDate) < now) {
                const daysLate = getDaysDiff(order.expectedArrivalDate);
                if (daysLate > 0) {
                    list.push({
                        id: `late-${order.id}`,
                        type: 'warning',
                        category: 'shipping',
                        title: `شحنة متأخرة (${order.localOrderId})`,
                        message: `تجاوز الطلب موعد الوصول المتوقع بـ ${daysLate} أيام.`,
                        orderId: order.id,
                        localOrderId: order.localOrderId,
                        date: now
                    });
                }
            }
        });

        return list.sort((a, b) => {
            // Sort priority: Urgent > Warning > Info
            const score = (type: string) => (type === 'urgent' ? 3 : type === 'warning' ? 2 : 1);
            return score(b.type) - score(a.type);
        });
    }, [orders, stores]);

    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

    const handleMarkRead = (id: string) => {
        setReadIds(prev => new Set(prev).add(id));
    };

    const handleItemClick = (item: NotificationItem) => {
        handleMarkRead(item.id);
        if (item.localOrderId) {
            // Pass the Local Order ID (e.g., FCD1001) to be used as a search filter
            onNavigateToOrder(item.localOrderId);
            setIsOpen(false);
        } else if (item.orderId) {
            // Fallback to internal ID if local ID missing
            onNavigateToOrder(item.orderId);
            setIsOpen(false);
        }
    };

    const getIcon = (item: NotificationItem) => {
        if (item.category === 'tracking') return <Hash size={18}/>;
        if (item.category === 'shipping') return <Truck size={18}/>;
        if (item.category === 'inventory') return <PackageX size={18}/>;
        if (item.type === 'urgent') return <AlertOctagon size={18}/>;
        return <Bell size={18}/>;
    };

    const getColors = (type: string) => {
        switch (type) {
            case 'urgent': return "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900";
            case 'warning': return "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900";
            default: return "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900";
        }
    };

    // Correct positioning based on direction
    const dropdownPositionClass = dir === 'rtl' 
        ? 'md:left-0 origin-top-left' 
        : 'md:right-0 origin-top-right';

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
            >
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    {/* Mobile Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Notification Panel */}
                    <div className={`fixed inset-x-4 top-20 z-50 md:absolute md:inset-auto md:top-full md:mt-2 w-auto md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${dropdownPositionClass}`}>
                        <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                                <History size={16}/> مركز التنبيهات الذكي
                            </h3>
                            {unreadCount > 0 && (
                                <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {unreadCount} جديد
                                </span>
                            )}
                        </div>
                        
                        <div className="max-h-[70vh] md:max-h-80 overflow-y-auto custom-scrollbar">
                            {notifications.length > 0 ? (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {notifications.map(item => {
                                        const isRead = readIds.has(item.id);
                                        const colors = getColors(item.type);

                                        return (
                                            <div 
                                                key={item.id} 
                                                onClick={() => handleItemClick(item)}
                                                className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex gap-3 group relative ${isRead ? 'opacity-60' : 'opacity-100'}`}
                                            >
                                                {!isRead && <div className="absolute top-4 right-2 w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                                                
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${colors}`}>
                                                    {getIcon(item)}
                                                </div>
                                                
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <h4 className={`text-sm font-bold truncate ${isRead ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                            {item.title}
                                                        </h4>
                                                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                            {item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug line-clamp-2">
                                                        {item.message}
                                                    </p>
                                                    {item.localOrderId && (
                                                        <div className="mt-2 flex items-center text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 duration-200">
                                                            الذهاب للطلب {item.localOrderId} <ChevronRight size={12}/>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-10 text-center text-gray-400">
                                    <CheckCircle size={40} className="mx-auto mb-3 opacity-10 text-green-500"/>
                                    <p className="text-sm font-medium">كل شيء على ما يرام!</p>
                                    <p className="text-xs opacity-60 mt-1">لا توجد تنبيهات تستدعي انتباهك حالياً.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationCenter;
