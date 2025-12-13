
import React, { useState, useEffect } from 'react';
import type { StorageDrawer, Order, Client } from '../types';
import { OrderStatus } from '../types';
import { X, Grid3X3, AlertTriangle, Ban, CheckCircle2, GripHorizontal, Box } from 'lucide-react';

interface StorageSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (location: string) => void;
    drawers: StorageDrawer[];
    allOrders: Order[];
    suggestedLocation: string | null;
    clients: Client[];
}

const StorageSelectorModal: React.FC<StorageSelectorModalProps> = ({ isOpen, onClose, onSelect, drawers, allOrders, suggestedLocation, clients }) => {
    const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);

    // Ensure drawers is always an array
    const safeDrawers = Array.isArray(drawers) ? drawers : [];

    useEffect(() => {
        if (isOpen && safeDrawers.length > 0) {
            if (suggestedLocation) {
                const suggestedDrawerName = suggestedLocation.split('-')[0];
                const targetDrawer = safeDrawers.find(d => d.name === suggestedDrawerName);
                if (targetDrawer) {
                    setActiveDrawerId(targetDrawer.id);
                    return;
                }
            }
            // Default to first drawer if no active drawer is set
            setActiveDrawerId(prev => prev || safeDrawers[0].id);
        }
    }, [isOpen, safeDrawers, suggestedLocation]);

    if (!isOpen) return null;

    const activeDrawer = safeDrawers.find(d => d.id === activeDrawerId);
    const storedOrders = allOrders.filter(o => o.status === OrderStatus.STORED);

    // Function to get orders in a specific slot
    const getOrdersInSlot = (location: string) => {
        return storedOrders.filter(o => o.storageLocation === location);
    };

    const handleSlotSelect = (fullLocation: string) => {
        // Allow selection freely, slots can hold multiple items
        onSelect(fullLocation);
    };

    const handleFloorStorage = () => {
        onSelect('Floor');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[60]" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-5xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold flex items-center gap-2"><Grid3X3/> اختر موقع التخزين</h3>
                        <button 
                            onClick={handleFloorStorage}
                            className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:hover:bg-orange-900 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 border border-orange-300 dark:border-orange-800"
                        >
                            <Box size={16}/> تخزين أرضي (حجم كبير)
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>

                {safeDrawers.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-gray-500">
                         <AlertTriangle size={48} className="mb-4 text-yellow-500"/>
                         <p className="text-lg font-semibold">لا توجد وحدات تخزين (أدراج) مضافة.</p>
                         <p className="text-sm mt-2">يرجى الذهاب إلى صفحة الإعدادات &rarr; المخزن لإضافة أدراج جديدة.</p>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
                        {/* Drawer List (Cabinet Style) */}
                        <div className="w-full md:w-1/4 overflow-y-auto pr-2 space-y-2 flex-shrink-0 border-l dark:border-gray-700 pl-2">
                            <h4 className="font-bold text-gray-500 dark:text-gray-400 text-sm mb-2">قائمة الأدراج</h4>
                            {safeDrawers.map(drawer => {
                                const isSuggestedDrawer = suggestedLocation?.startsWith(drawer.name + '-');
                                const isActive = activeDrawerId === drawer.id;
                                
                                // Calculate occupancy
                                const ordersInDrawerCount = storedOrders.filter(o => o.storageLocation?.startsWith(drawer.name + '-')).length;
                                const capacity = drawer.capacity || (drawer.rows || 1) * (drawer.columns || 5);
                                const occupancyRate = capacity > 0 ? Math.min(ordersInDrawerCount / capacity, 1) : 0;

                                return (
                                    <button
                                        key={drawer.id}
                                        onClick={() => setActiveDrawerId(drawer.id)}
                                        className={`
                                            w-full relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center
                                            ${isActive 
                                                ? 'border-primary dark:border-secondary bg-primary text-white dark:bg-secondary dark:text-white shadow-lg transform scale-105 z-10' 
                                                : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}
                                            ${isSuggestedDrawer && !isActive ? 'ring-2 ring-yellow-400 ring-offset-1 dark:ring-offset-gray-900' : ''}
                                        `}
                                    >
                                        {/* Handle Visual */}
                                        <div className={`w-12 h-1 rounded-full mb-2 ${isActive ? 'bg-white/30' : 'bg-gray-400/30'}`}></div>
                                        
                                        <span className="font-bold text-xl">{drawer.name}</span>
                                        
                                        <div className="w-full mt-2 flex justify-between text-xs font-mono opacity-80">
                                            <span>{ordersInDrawerCount} طلبات</span>
                                            <span>{capacity} خانة</span>
                                        </div>
                                        
                                        {/* Mini Progress Bar */}
                                        <div className="w-full h-1.5 bg-black/10 rounded-full mt-1 overflow-hidden">
                                            <div 
                                                className={`h-full ${isActive ? 'bg-white' : 'bg-green-500'}`} 
                                                style={{width: `${occupancyRate * 100}%`}}
                                            ></div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Drawer Interior (Slots Grid) */}
                        <div className="flex-grow bg-gray-200 dark:bg-gray-900 rounded-xl p-4 border-4 border-gray-300 dark:border-gray-700 shadow-inner overflow-hidden flex flex-col">
                            {activeDrawer ? (
                                <>
                                    <div className="flex justify-between items-end mb-4 pb-2 border-b border-gray-300 dark:border-gray-700">
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300">محتويات {activeDrawer.name}</h4>
                                            <p className="text-xs text-gray-500">يمكن إضافة أكثر من طلب في نفس الخانة.</p>
                                        </div>
                                        <div className="flex gap-3 text-xs">
                                             <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-green-500 rounded shadow-sm"></div> فارغ</span>
                                             <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded shadow-sm"></div> مشغول</span>
                                             <span className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded shadow-sm ring-2 ring-white"></div> مقترح</span>
                                        </div>
                                    </div>

                                    <div className="flex-grow overflow-y-auto pr-1">
                                        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${activeDrawer.columns || 5}, 1fr)` }}>
                                            {Array.from({ length: (activeDrawer.rows || 1) * (activeDrawer.columns || 5) }, (_, i) => {
                                                const slotNum = String(i + 1).padStart(2, '0');
                                                const fullLocation = `${activeDrawer.name}-${slotNum}`;
                                                const itemsInSlot = getOrdersInSlot(fullLocation);
                                                const itemCount = itemsInSlot.length;
                                                const isSuggested = fullLocation === suggestedLocation;
                                                const hasItems = itemCount > 0;

                                                return (
                                                    <button
                                                        key={fullLocation}
                                                        onClick={() => handleSlotSelect(fullLocation)}
                                                        className={`
                                                            relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 shadow-md
                                                            ${hasItems 
                                                                ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500 hover:bg-blue-200' 
                                                                : 'bg-white dark:bg-gray-800 border-2 border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30'}
                                                            ${isSuggested ? 'ring-4 ring-yellow-400 z-10 animate-pulse scale-105' : ''}
                                                        `}
                                                    >
                                                        <span className={`font-bold text-lg ${hasItems ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-300'}`}>
                                                            {slotNum}
                                                        </span>
                                                        
                                                        {hasItems ? (
                                                            <div className="flex flex-col items-center mt-1 w-full px-1">
                                                                <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                                    {itemCount}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <CheckCircle2 size={24} className="text-green-500 mt-2 opacity-20"/>
                                                        )}

                                                        {isSuggested && (
                                                            <span className="absolute -top-3 -right-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-white">
                                                                هنا
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <GripHorizontal size={48} className="mb-4 opacity-20"/>
                                    <p>اختر درجاً من القائمة لعرض الخانات الداخلية</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageSelectorModal;
