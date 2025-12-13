
import React, { useState, useMemo, useEffect, useContext } from 'react';
import type { StorageDrawer, Order, Client, ActivityLog, Store } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { PlusCircle, Archive, X, Save, Search, Package, Check, User, Layers, Edit, Trash2, PackageSearch, Lightbulb, Weight, Loader2, Grid3X3, CheckCircle2, ScanBarcode, Store as StoreIcon, Hash, Globe, Box, CheckCheck, MessageCircle, ArrowRight, LayoutGrid, Printer } from 'lucide-react';
import { STATUS_DETAILS } from '../constants';
import type { AppSettings } from '../types';
import { AuthContext } from '../contexts/AuthContext';
import { supabase, getErrorMessage } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import StorageSelectorModal from './StorageSelectorModal';


// --- Types & Interfaces ---
interface StoragePageProps {
    drawers: StorageDrawer[];
    setDrawers: React.Dispatch<React.SetStateAction<StorageDrawer[]>>;
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    clients: Client[];
    settings: AppSettings;
    stores: Store[];
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    colorClass?: string;
}

interface PendingStorageData {
    orderId: string;
    weight: number;
    shippingCost: number;
    shippingType: ShippingType; // Added Shipping Type
    storageLocation: string;
    totalDue: number;
}

// --- Helper Functions ---
const getStorageSuggestion = (orderToStore: Order, allOrders: Order[], drawers: StorageDrawer[]): { location: string | null; score: number; reasons: string[] } => {
    const occupiedSlots = new Set(allOrders.filter(o => o.status === OrderStatus.STORED).map(o => o.storageLocation).filter(Boolean));
    
    const scoredDrawers = drawers.map(drawer => {
        const ordersInDrawer = allOrders.filter(o => o.storageLocation?.startsWith(drawer.name + '-') && o.status === OrderStatus.STORED);
        if (ordersInDrawer.length >= drawer.capacity) return null;

        let score = 0;
        let reasons: string[] = [];

        if (orderToStore.shipmentId && ordersInDrawer.some(o => o.shipmentId === orderToStore.shipmentId)) {
            score += 40;
            reasons.push("شحنة مماثلة");
        }
        if (ordersInDrawer.some(o => o.clientId === orderToStore.clientId)) {
            score += 25;
            reasons.push("نفس العميل");
        }
        const fillPercentage = ordersInDrawer.length / drawer.capacity;
        if (fillPercentage > 0.1 && fillPercentage < 0.9) {
            score += 20;
            reasons.push("مساحة جيدة");
        }
        return { drawer, score, reasons };
    }).filter((d): d is { drawer: StorageDrawer; score: number; reasons: string[] } => d !== null);

    scoredDrawers.sort((a, b) => b.score - a.score);

    const bestDrawerInfo = scoredDrawers[0];
    if (!bestDrawerInfo) return { location: null, score: 0, reasons: [] };

    let firstAvailableSlot: string | null = null;
    for (let i = 1; i <= bestDrawerInfo.drawer.capacity; i++) {
        const slotLocation = `${bestDrawerInfo.drawer.name}-${String(i).padStart(2, '0')}`;
        if (!occupiedSlots.has(slotLocation)) {
            firstAvailableSlot = slotLocation;
            break;
        }
    }

    return { location: firstAvailableSlot, score: bestDrawerInfo.score, reasons: bestDrawerInfo.reasons };
};

// --- Helper for Mini Label Printing ---
const printMiniLabel = (order: Order, client: Client | undefined, store: Store | undefined) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                body { font-family: 'Cairo', sans-serif; margin: 0; padding: 10px; width: 300px; text-align: center; color: #000; }
                .header { border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                .title { font-size: 18px; font-weight: bold; }
                .meta { font-size: 12px; margin-top: 5px; }
                .content { text-align: right; margin-bottom: 10px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
                .label { font-weight: bold; }
                .big-id { font-size: 24px; font-weight: 900; margin: 10px 0; border: 2px solid #000; padding: 5px; }
                .footer { border-top: 2px dashed #000; padding-top: 10px; font-size: 12px; margin-top: 10px; }
                @media print { body { width: 100%; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">Fast Comand</div>
                <div class="meta">${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString()}</div>
            </div>
            
            <div class="big-id">${order.localOrderId}</div>
            
            <div class="content">
                <div class="row"><span class="label">العميل:</span> <span>${client?.name || '---'}</span></div>
                <div class="row"><span class="label">الهاتف:</span> <span>${client?.phone || '---'}</span></div>
                <div class="row"><span class="label">المتجر:</span> <span>${store?.name || '---'}</span></div>
                <div class="row"><span class="label">العدد:</span> <span>${order.quantity}</span></div>
                <div class="row"><span class="label">الموقع:</span> <span>${order.storageLocation || '---'}</span></div>
                ${client?.address ? `<div class="row"><span class="label">العنوان:</span> <span>${client.address}</span></div>` : ''}
            </div>

            <div class="footer">
                شكراً لثقتكم بنا
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
};

// --- Sub-Components ---

const Highlight: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) return <>{text}</>;
    
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((part, i) => 
                part.toLowerCase() === highlight.toLowerCase() ? 
                    <span key={i} className="bg-yellow-300 text-black rounded px-0.5 font-bold shadow-sm">{part}</span> : 
                    part
            )}
        </>
    );
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass = "bg-primary" }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
        <div className="flex justify-between items-start">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">{title}</p>
            <div className={`p-2 rounded-lg ${colorClass} text-white bg-opacity-90`}>{icon}</div>
        </div>
        <h3 className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-2">{value}</h3>
    </div>
);

// --- DrawerDetailsModal Component ---
const DrawerDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    drawer: StorageDrawer | null;
    orders: Order[];
    clients: Client[];
    stores: Store[];
}> = ({ isOpen, onClose, drawer, orders, clients, stores }) => {
    if (!isOpen || !drawer) return null;

    const storedOrders = orders.filter(o => o.storageLocation?.startsWith(drawer.name + '-') && o.status === OrderStatus.STORED);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700 flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2"><Grid3X3/> محتويات الدرج: {drawer.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{storedOrders.length} طلبات مخزنة</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2">
                    {storedOrders.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {storedOrders.map(order => {
                                const client = clients.find(c => c.id === order.clientId);
                                const store = stores.find(s => s.id === order.storeId);
                                const slotNum = order.storageLocation?.split('-')[1];
                                
                                return (
                                    <div key={order.id} className="p-3 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm relative group">
                                        <div className="absolute top-2 left-2 text-xs font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                            خانة {slotNum}
                                        </div>
                                        <div className="mb-2">
                                            <h4 className="font-bold font-mono text-lg">{order.localOrderId}</h4>
                                            <p className="text-xs text-gray-500">{new Date(order.storageDate || '').toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-sm space-y-1">
                                            <p className="flex items-center gap-1"><User size={12}/> {client?.name}</p>
                                            <p className="flex items-center gap-1"><StoreIcon size={12}/> {store?.name}</p>
                                            <p className="flex items-center gap-1"><Weight size={12}/> {order.weight} kg</p>
                                        </div>
                                        <button 
                                            onClick={() => printMiniLabel(order, client, store)}
                                            className="absolute bottom-2 left-2 p-1.5 bg-gray-100 hover:bg-primary hover:text-white rounded text-gray-500 transition-colors"
                                            title="طباعة ملصق"
                                        >
                                            <Printer size={16}/>
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <Box size={48} className="mb-4 opacity-20"/>
                            <p>الدرج فارغ</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- AddDrawerModal Component ---
const AddDrawerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (drawer: Partial<StorageDrawer>) => void;
    isSaving: boolean;
}> = ({ isOpen, onClose, onSave, isSaving }) => {
    const [name, setName] = useState('');
    const [rows, setRows] = useState(5);
    const [columns, setColumns] = useState(5);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!name) return;
        onSave({ name, rows, columns, capacity: rows * columns });
        setName('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">إضافة وحدة تخزين (درج)</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">اسم الدرج (حرف/رقم)</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="A, B, 1..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">عدد الصفوف</label>
                            <input type="number" value={rows} onChange={e => setRows(parseInt(e.target.value))} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" min="1" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">عدد الأعمدة</label>
                            <input type="number" value={columns} onChange={e => setColumns(parseInt(e.target.value))} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" min="1" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500">السعة الإجمالية: <strong>{rows * columns}</strong> خانة</p>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">إلغاء</button>
                    <button onClick={handleSubmit} disabled={isSaving || !name} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50">
                        {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- StoredSuccessModal ---
const StoredSuccessModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    data: PendingStorageData | null;
    client?: Client;
    order?: Order;
    store?: Store;
    settings: AppSettings;
    allOrders?: Order[]; // Added to calculate order count
}> = ({ isOpen, onClose, data, client, order, store, settings, allOrders = [] }) => {
    const [selectedLanguage, setSelectedLanguage] = useState<'ar' | 'en' | 'fr'>('ar');

    if (!isOpen || !data || !client) return null;

    // Logic for Greeting based on Gender
    const getGreeting = (lang: 'ar' | 'en' | 'fr') => {
        if (lang === 'ar') {
            return client.gender === 'female' ? "مرحباً السيدة" : "مرحباً السيد";
        } else if (lang === 'fr') {
            return client.gender === 'female' ? "Bonjour Mme" : "Bonjour M.";
        } else {
            return client.gender === 'female' ? "Hello Ms." : "Hello Mr.";
        }
    };

    // Logic for Loyalty Message based on Order Count
    const getLoyaltyMessage = (lang: 'ar' | 'en' | 'fr') => {
        // Count previous orders for this client (including current one if it's already updated, but logic is safer if we count all)
        // Note: The order status is already updated to STORED before opening this modal
        const clientOrders = allOrders.filter(o => o.clientId === client.id);
        const count = clientOrders.length;

        if (count <= 1) { // First order
            if (lang === 'ar') return "شكرا على الثقة و نتمنى ان نكون عند حسن ظنك.";
            if (lang === 'fr') return "Merci de votre confiance, nous espérons être à la hauteur de vos attentes.";
            return "Thank you for your trust, we hope to meet your expectations.";
        } else { // Returning customer
            if (lang === 'ar') return "شكرا لك مرة اخرى و دائما على ثقتك بنا ،Fast Comand دائما في خدمتكم.";
            if (lang === 'fr') return "Merci encore pour votre confiance continue, Fast Comand est toujours à votre service.";
            return "Thanks again for your continued trust, Fast Comand is always at your service.";
        }
    };

    // Helper to replace placeholders
    const formatMessage = (template: string) => {
        const greeting = getGreeting(selectedLanguage);
        const loyaltyMessage = getLoyaltyMessage(selectedLanguage);
        
        // Calculate Remaining Item Cost (Product Cost + Commission - Paid Amount)
        // Wait, normally `Total Due` includes Shipping. 
        // `productRemaining` = (Price + Comm) - Paid.
        // `totalDue` = productRemaining + Shipping.
        const productRemaining = Math.max(0, ((order?.priceInMRU || 0) + (order?.commission || 0)) - (order?.amountPaid || 0));

        return template
            .replace(/{clientName}/g, client.name)
            .replace(/{orderId}/g, order?.localOrderId || '')
            .replace(/{location}/g, data.storageLocation)
            .replace(/{weight}/g, data.weight.toString())
            .replace(/{shippingCost}/g, data.shippingCost.toLocaleString())
            .replace(/{totalDue}/g, data.totalDue.toLocaleString())
            .replace(/{productRemaining}/g, productRemaining.toLocaleString())
            .replace(/{greeting}/g, greeting)
            .replace(/{loyaltyMessage}/g, loyaltyMessage);
    };

    const currentTemplate = settings.whatsappTemplates?.[selectedLanguage] || '';
    const message = formatMessage(currentTemplate);
    const whatsappLink = `https://wa.me/${client.whatsappNumber || client.phone}?text=${encodeURIComponent(message)}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">تم التخزين بنجاح!</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">تم تحديث حالة الطلب وحفظ الموقع.</p>
                
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">لغة رسالة العميل:</label>
                    <div className="flex justify-center gap-2">
                        <button 
                            onClick={() => setSelectedLanguage('ar')}
                            className={`px-3 py-1 rounded text-sm font-bold ${selectedLanguage === 'ar' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                            العربية
                        </button>
                        <button 
                            onClick={() => setSelectedLanguage('en')}
                            className={`px-3 py-1 rounded text-sm font-bold ${selectedLanguage === 'en' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                            English
                        </button>
                        <button 
                            onClick={() => setSelectedLanguage('fr')}
                            className={`px-3 py-1 rounded text-sm font-bold ${selectedLanguage === 'fr' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                            Français
                        </button>
                    </div>
                </div>

                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm text-left mb-4 text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto" dir={selectedLanguage === 'ar' ? 'rtl' : 'ltr'}>
                    {message}
                </div>

                <div className="flex flex-col gap-3">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors">
                        <MessageCircle size={20}/> إرسال عبر واتساب
                    </a>
                    
                    {order && (
                        <button 
                            onClick={() => printMiniLabel(order, client, store)}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors"
                        >
                            <Printer size={20}/> طباعة ملصق صغير
                        </button>
                    )}

                    <button onClick={onClose} className="w-full py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- AwaitingStorageRow Component ---
const AwaitingStorageRow: React.FC<{ 
    order: Order; 
    client?: Client;
    store?: Store;
    drawers: StorageDrawer[];
    allOrders: Order[];
    onConfirm: (data: PendingStorageData) => void;
    searchTerm: string;
    settings: AppSettings;
}> = ({ order, client, drawers, allOrders, onConfirm, store, searchTerm, settings }) => {
    const [weight, setWeight] = useState<number>(order.weight || 0);
    const [shippingType, setShippingType] = useState<ShippingType>(order.shippingType || ShippingType.NORMAL);
    const [location, setLocation] = useState(order.storageLocation || '');
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    // Calculate shipping cost dynamically
    const shippingRate = shippingType === ShippingType.FAST 
        ? settings.shippingRates.fast 
        : settings.shippingRates.normal;
        
    const calculatedShipping = weight * shippingRate;
    
    // Total Due
    const totalDue = ((order.priceInMRU || 0) + (order.commission || 0) + calculatedShipping) - (order.amountPaid || 0);

    // Suggestion logic
    const suggestion = useMemo(() => getStorageSuggestion(order, allOrders, drawers), [order, allOrders, drawers]);

    const handleConfirm = () => {
        if (weight > 0 && location) {
            onConfirm({
                orderId: order.id,
                weight,
                shippingCost: calculatedShipping,
                shippingType,
                storageLocation: location,
                totalDue
            });
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
            <StorageSelectorModal 
                isOpen={isSelectorOpen} 
                onClose={() => setIsSelectorOpen(false)}
                onSelect={(loc) => { setLocation(loc); setIsSelectorOpen(false); }}
                drawers={drawers}
                allOrders={allOrders}
                suggestedLocation={suggestion.location}
                clients={[]}
            />

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Order Info */}
                <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold font-mono text-lg"><Highlight text={order.localOrderId} highlight={searchTerm} /></span>
                        {order.globalOrderId && <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900 px-1.5 rounded w-fit"><Highlight text={order.globalOrderId} highlight={searchTerm} /></span>}
                        {order.isInvoicePrinted && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded">فاتورة مطبوعة</span>}
                    </div>
                    <div className="text-sm text-gray-500 space-y-0.5">
                        <p className="flex items-center gap-1"><User size={12}/> <Highlight text={client?.name || ''} highlight={searchTerm} /></p>
                        <p className="flex items-center gap-1"><StoreIcon size={12}/> {store?.name}</p>
                        {order.trackingNumber && <p className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded w-fit"><Highlight text={order.trackingNumber} highlight={searchTerm} /></p>}
                    </div>
                </div>

                {/* Inputs Area */}
                <div className="flex flex-wrap gap-2 items-end justify-center md:justify-start">
                    
                    {/* Shipping Type Selector */}
                    <div className="w-24">
                        <label className="block text-[10px] text-gray-400 mb-1">نوع الشحن</label>
                        <select
                            value={shippingType}
                            onChange={(e) => setShippingType(e.target.value as ShippingType)}
                            className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none"
                        >
                            <option value={ShippingType.NORMAL}>عادي</option>
                            <option value={ShippingType.FAST}>سريع</option>
                        </select>
                    </div>

                    {/* Weight Input */}
                    <div className="w-24">
                        <label className="block text-[10px] text-gray-400 mb-1">الوزن (kg)</label>
                        <input 
                            type="number" 
                            value={weight || ''} 
                            onChange={(e) => setWeight(parseFloat(e.target.value))} 
                            className="w-full p-2 text-center font-mono border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none"
                            placeholder="0.0"
                            step="0.1"
                        />
                    </div>

                    {/* Location Input */}
                    <div className="w-40 relative">
                        <label className="block text-[10px] text-gray-400 mb-1 flex justify-between">
                            الموقع
                            {suggestion.location && !location && <span className="text-green-500 animate-pulse text-[9px]">مقترح: {suggestion.location}</span>}
                        </label>
                        <button 
                            onClick={() => setIsSelectorOpen(true)}
                            className={`w-full p-2 border rounded-lg text-left flex justify-between items-center text-sm ${location ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}
                        >
                            <span>{location || 'اختر موقع'}</span>
                            <Grid3X3 size={14} className="opacity-50"/>
                        </button>
                    </div>

                    {/* Cost Preview */}
                    <div className="px-3 py-1 bg-gray-50 dark:bg-gray-700 rounded-lg text-center min-w-[80px]">
                        <span className="block text-[10px] text-gray-400">الشحن</span>
                        <span className="font-mono font-bold text-sm">{Math.round(calculatedShipping)}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button 
                        onClick={() => printMiniLabel(order, client, store)}
                        className="p-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl transition-colors"
                        title="طباعة ملصق"
                    >
                        <Printer size={20}/>
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!weight || !location}
                        className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center gap-2"
                    >
                        <Check size={20}/> <span className="font-bold hidden md:inline">تخزين</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- StoragePage Main Component ---
const StoragePage: React.FC<StoragePageProps> = ({ drawers, setDrawers, orders, setOrders, clients, settings, stores }) => {
    const { currentUser } = useContext(AuthContext);
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Logic for Stored Details Modal
    const [viewingDrawer, setViewingDrawer] = useState<StorageDrawer | null>(null);

    // Logic for Storage Success Modal
    const [successData, setSuccessData] = useState<{data: PendingStorageData, order: Order, client: Client} | null>(null);

    // 1. Get Orders "Arrived at Office" -> Waiting for Storage
    const awaitingStorageOrders = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return orders.filter(o => o.status === OrderStatus.ARRIVED_AT_OFFICE)
            .filter(o => {
                const client = clients.find(c => c.id === o.clientId);
                return (
                    o.localOrderId.toLowerCase().includes(lowerSearch) || 
                    (o.globalOrderId || '').toLowerCase().includes(lowerSearch) ||
                    (o.trackingNumber || '').toLowerCase().includes(lowerSearch) ||
                    (client?.name || '').toLowerCase().includes(lowerSearch) ||
                    (client?.phone || '').includes(lowerSearch)
                );
            });
    }, [orders, searchTerm, clients]);

    // 2. Stats
    const totalStored = orders.filter(o => o.status === OrderStatus.STORED).length;
    const totalCapacity = drawers.reduce((sum, d) => sum + (d.capacity || (d.rows || 0) * (d.columns || 0)), 0);
    const occupancyRate = totalCapacity > 0 ? (totalStored / totalCapacity) * 100 : 0;

    const handleConfirmStorage = async (data: PendingStorageData) => {
        if (!supabase) return;
        const user = currentUser?.username || 'System';
        
        try {
            const now = new Date().toISOString();
            const order = orders.find(o => o.id === data.orderId);
            if (!order) return;

            const log: ActivityLog = { timestamp: now, activity: `تم تخزين الطلب في ${data.storageLocation}. الوزن: ${data.weight}kg (${data.shippingType})`, user };
            
            const { error } = await supabase.from('Orders').update({
                status: OrderStatus.STORED,
                weight: data.weight,
                shipping_cost: data.shippingCost,
                shipping_type: data.shippingType,
                storage_location: data.storageLocation,
                storage_date: now,
                history: [...(order.history || []), log]
            }).eq('id', data.orderId);

            if (error) throw error;

            // Optimistically update local state
            const updatedOrder = {
                ...order,
                status: OrderStatus.STORED,
                weight: data.weight,
                shippingCost: data.shippingCost,
                shippingType: data.shippingType,
                storageLocation: data.storageLocation,
                storageDate: now,
                history: [...(order.history || []), log]
            };

            setOrders(prev => prev.map(o => o.id === data.orderId ? updatedOrder : o));

            // Show Success Modal
            const client = clients.find(c => c.id === order.clientId);
            if (client) {
                setSuccessData({ data, order: updatedOrder, client });
            }

        } catch (e: any) {
            console.error(e);
            showToast('حدث خطأ أثناء التخزين: ' + getErrorMessage(e), 'error');
        }
    };

    const handleAddDrawer = async (drawerData: Partial<StorageDrawer>) => {
        if (!supabase) return;
        setIsSaving(true);
        try {
            const { data, error } = await supabase.from('StorageDrawers').insert(drawerData).select().single();
            if (error) throw error;
            setDrawers(prev => [...prev, data]);
            showToast('تم إضافة وحدة التخزين بنجاح', 'success');
            setIsAddDrawerOpen(false);
        } catch (e: any) {
            showToast('خطأ: ' + getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDrawer = async (id: string) => {
        if (!supabase) return;
        if (!confirm('هل أنت متأكد من حذف وحدة التخزين؟ تأكد من أنها فارغة.')) return;
        try {
            const { error } = await supabase.from('StorageDrawers').delete().eq('id', id);
            if (error) throw error;
            setDrawers(prev => prev.filter(d => d.id !== id));
            showToast('تم الحذف بنجاح', 'success');
        } catch (e: any) {
            showToast('لا يمكن الحذف: ' + getErrorMessage(e), 'error');
        }
    }

    return (
        <div className="space-y-8">
            <AddDrawerModal isOpen={isAddDrawerOpen} onClose={() => setIsAddDrawerOpen(false)} onSave={handleAddDrawer} isSaving={isSaving} />
            <StoredSuccessModal 
                isOpen={!!successData} 
                onClose={() => setSuccessData(null)} 
                data={successData?.data || null} 
                client={successData?.client} 
                order={successData?.order} 
                store={stores.find(s => s.id === successData?.order.storeId)}
                settings={settings}
                allOrders={orders}
            />
            
            <DrawerDetailsModal 
                isOpen={!!viewingDrawer} 
                onClose={() => setViewingDrawer(null)} 
                drawer={viewingDrawer} 
                orders={orders} 
                clients={clients} 
                stores={stores}
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-bold text-text-light dark:text-text-dark">إدارة المخزن</h2>
                {currentUser?.permissions.storage.create && (
                    <button onClick={() => setIsAddDrawerOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg shadow hover:bg-primary-dark transition-all">
                        <PlusCircle size={20} /> <span>إضافة وحدة</span>
                    </button>
                )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="الطلبات بانتظار التخزين" value={awaitingStorageOrders.length} icon={<PackageSearch size={24}/>} colorClass="bg-orange-500" />
                <StatCard title="الطلبات المخزنة حالياً" value={totalStored} icon={<Archive size={24}/>} colorClass="bg-blue-500" />
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500 font-bold text-xs uppercase">نسبة الإشغال</span>
                        <Layers size={20} className="text-green-500"/>
                    </div>
                    <div className="flex items-end gap-2">
                        <h3 className="text-2xl font-black">{occupancyRate.toFixed(1)}%</h3>
                        <span className="text-xs text-gray-400 mb-1">من السعة الكلية</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${occupancyRate}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column: Waiting List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <ArrowRight className="text-orange-500"/> بانتظار التخزين
                            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">{awaitingStorageOrders.length}</span>
                        </h3>
                        <div className="relative w-64">
                            <input 
                                type="text" 
                                placeholder="بحث برقم الطلب، التتبع، العميل..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 focus:ring-1 focus:ring-primary"
                            />
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {awaitingStorageOrders.length > 0 ? awaitingStorageOrders.map(order => (
                            <AwaitingStorageRow 
                                key={order.id}
                                order={order}
                                client={clients.find(c => c.id === order.clientId)}
                                store={stores.find(s => s.id === order.storeId)}
                                drawers={drawers}
                                allOrders={orders}
                                onConfirm={handleConfirmStorage}
                                searchTerm={searchTerm}
                                settings={settings}
                            />
                        )) : (
                            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                                <CheckCheck size={40} className="mx-auto text-green-500 mb-2 opacity-50"/>
                                <p className="text-gray-500">لا توجد طلبات بانتظار التخزين</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Drawers Visualizer */}
                <div className="space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <LayoutGrid className="text-blue-500"/> وحدات التخزين
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {drawers.map(drawer => {
                            const count = orders.filter(o => o.storageLocation?.startsWith(drawer.name + '-') && o.status === OrderStatus.STORED).length;
                            const capacity = drawer.capacity || (drawer.rows * drawer.columns);
                            const percent = Math.min((count / capacity) * 100, 100);
                            
                            return (
                                <div key={drawer.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start z-10 relative">
                                        <h4 className="font-bold text-lg">{drawer.name}</h4>
                                        <button onClick={() => setViewingDrawer(drawer)} className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900 px-2 py-1 rounded transition-colors">
                                            عرض
                                        </button>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500 font-mono z-10 relative">
                                        {count} / {capacity}
                                    </div>
                                    {/* Visual Fill Bar */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                    
                                    {currentUser?.permissions.storage.delete && (
                                        <button 
                                            onClick={() => handleDeleteDrawer(drawer.id)} 
                                            className="absolute top-2 left-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                        
                        {currentUser?.permissions.storage.create && (
                            <button 
                                onClick={() => setIsAddDrawerOpen(true)}
                                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-400 hover:border-primary hover:text-primary transition-all bg-gray-50 dark:bg-gray-800/50"
                            >
                                <PlusCircle size={24} className="mb-1"/>
                                <span className="text-xs font-bold">إضافة وحدة</span>
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StoragePage;
