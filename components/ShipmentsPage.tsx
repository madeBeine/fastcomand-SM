
import React, { useState, useEffect, useContext } from 'react';
import type { Shipment, Order, ShippingCompany, ActivityLog, Client, Store, Box } from '../types';
import { ShipmentStatus, ShippingType, OrderStatus } from '../types';
import { PlusCircle, Truck, CheckCircle, PackagePlus, AlertCircle, X, Save, Zap, Upload, Edit2, ScrollText, GitCommit, Box as BoxIcon, Info, Eye } from 'lucide-react';
import type { AppSettings } from '../types';
import HistoryLogModal from './HistoryLogModal';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, getErrorMessage } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface ShipmentsPageProps {
  shipments: Shipment[];
  setShipments: React.Dispatch<React.SetStateAction<Shipment[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  shippingCompanies: ShippingCompany[];
  settings: AppSettings;
  clients: Client[];
  stores: Store[];
}

type ModalMode = 'new' | 'edit';

const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async (event) => {
            if (!event.target?.result) return reject("Failed to read file");
            
            const originalBase64 = event.target.result as string;
            const img = new Image();
            img.src = originalBase64;
            
            try {
                await img.decode();
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200; 
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas context failed");

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            } catch (error) {
                console.warn('Compression failed, falling back to original', error);
                resolve(originalBase64);
            }
        };
        reader.onerror = (err) => reject(err);
    });
};

const ShipmentDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    shipment: Shipment | null;
    companyName: string;
    ordersCount: number;
}> = ({ isOpen, onClose, shipment, companyName, ordersCount }) => {
    const { t } = useLanguage();
    if (!isOpen || !shipment) return null;
    
    const getStatus = (status: ShipmentStatus) => {
        switch(status) {
            case ShipmentStatus.NEW: return { name: t('shipmentNew'), icon: <PackagePlus size={16} className="ml-1"/>, color: 'text-gray-800 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-900' };
            case ShipmentStatus.SHIPPED: return { name: t('st_shipped_from_store'), icon: <Truck size={16} className="ml-1"/>, color: 'text-blue-800 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900' };
            case ShipmentStatus.PARTIALLY_ARRIVED: return { name: t('shipmentPartial'), icon: <GitCommit size={16} className="ml-1"/>, color: 'text-orange-800 dark:text-orange-300', bgColor: 'bg-orange-100 dark:bg-orange-900' };
            case ShipmentStatus.ARRIVED: return { name: t('shipmentArrived'), icon: <CheckCircle size={16} className="ml-1"/>, color: 'text-green-800 dark:text-green-300', bgColor: 'bg-green-100 dark:bg-green-900' };
            case ShipmentStatus.RECEIVED: return { name: t('statusCompleted'), icon: <CheckCircle size={16} className="ml-1"/>, color: 'text-purple-800 dark:text-purple-300', bgColor: 'bg-purple-100 dark:bg-purple-900' };
            case ShipmentStatus.DELAYED: return { name: t('lateOrders'), icon: <AlertCircle size={16} className="ml-1"/>, color: 'text-red-800 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900' };
            default: return { name: status, icon: null, color: '', bgColor: '' };
        }
    };

    const statusInfo = getStatus(shipment.status);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-2xl font-bold text-primary dark:text-primary-dark font-mono">{shipment.shipmentNumber}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                             <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                <span className="text-gray-500 dark:text-gray-400">{t('status')}:</span>
                                <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${statusInfo.bgColor} ${statusInfo.color}`}>
                                    {statusInfo.icon} {statusInfo.name}
                                </span>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{t('company')}:</span>
                                <span className="font-semibold">{companyName}</span>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{t('shippingType')}:</span>
                                <span className="font-semibold">{shipment.shippingType === ShippingType.FAST ? t('fast') : t('normal')}</span>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{t('origin')}:</span>
                                <span className="font-semibold">{shipment.country}</span>
                            </div>
                             <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{t('tracking')}:</span>
                                <span className="font-semibold font-mono">{shipment.trackingNumber || '---'}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{t('numberOfBoxes')}:</span>
                                <span className="font-semibold font-mono">{shipment.numberOfBoxes}</span>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{t('ordersCount')}:</span>
                                <span className="font-semibold font-mono">{ordersCount}</span>
                            </div>
                             <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{t('departureDate')}:</span>
                                <span className="font-semibold font-mono">{shipment.departureDate}</span>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{t('expectedArrival')}:</span>
                                <span className="font-semibold font-mono">{shipment.expectedArrivalDate}</span>
                            </div>
                        </div>
                    </div>

                    {(shipment.status === ShipmentStatus.RECEIVED) && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                            <h4 className="font-bold text-green-800 dark:text-green-200 mb-2">Details</h4>
                            <div className="flex justify-around text-sm">
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400 block">{t('weight')}:</span>
                                    <span className="font-bold text-lg font-mono">{shipment.totalWeight ? `${shipment.totalWeight} kg` : '---'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400 block">Cost:</span>
                                    <span className="font-bold text-lg font-mono">{shipment.totalShippingCost ? `${shipment.totalShippingCost.toLocaleString('en-US')} MRU` : '---'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {shipment.receiptImage && (
                        <div className="mt-4">
                            <h4 className="font-bold mb-2">Receipt</h4>
                            <img src={shipment.receiptImage} alt="Receipt" className="max-h-48 rounded-lg border dark:border-gray-700 mx-auto" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const ShipmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (payload: Partial<Shipment>, linkedOrders: Record<string, string>) => void;
    shipment: Shipment | null;
    shippingCompanies: ShippingCompany[];
    availableOrders: Order[];
    settings: AppSettings;
    mode: ModalMode;
    clients: Client[];
    stores: Store[];
}> = ({ isOpen, onClose, onSave, shipment, shippingCompanies, availableOrders, settings, mode, clients, stores }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState<Partial<Shipment>>({});
    const [linkedOrders, setLinkedOrders] = useState<Record<string, string>>({}); // { [orderId]: boxId }

    useEffect(() => {
        if (isOpen) {
            const initialData: Partial<Shipment> = (mode === 'new')
                ? {
                      shippingType: ShippingType.NORMAL,
                      status: ShipmentStatus.NEW,
                      country: 'Dubai',
                      departureDate: new Date().toISOString().split('T')[0],
                      numberOfBoxes: 1,
                  }
                : { ...shipment };
            setFormData(initialData);

            if (shipment && mode === 'edit') {
                const currentLinked = availableOrders
                    .filter(o => o.shipmentId === shipment.id && o.boxId)
                    .reduce((acc, o) => ({ ...acc, [o.id]: o.boxId! }), {});
                setLinkedOrders(currentLinked);
            } else {
                setLinkedOrders({});
            }
        }
    }, [shipment, isOpen, availableOrders, mode]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let finalValue: string | number = value;
        if (type === 'number') {
            finalValue = parseInt(value, 10);
            if (name === 'numberOfBoxes' && finalValue < 1) finalValue = 1;
        }
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleOrderLinkToggle = (orderId: string) => {
        setLinkedOrders(prev => {
            const newLinked = { ...prev };
            if (newLinked[orderId]) {
                delete newLinked[orderId];
            } else {
                newLinked[orderId] = 'box-1';
            }
            return newLinked;
        });
    };
    
    const handleBoxAssignment = (orderId: string, boxNumber: number) => {
        setLinkedOrders(prev => ({...prev, [orderId]: `box-${boxNumber}` }));
    };

    const handleSave = () => {
        onSave(formData, linkedOrders);
    };
    
    const renderOrderLabel = (order: Order) => {
        const clientName = clients.find(c => c.id === order.clientId)?.name || 'N/A';
        const storeName = stores.find(s => s.id === order.storeId)?.name || 'N/A';
        return (
            <div className="flex flex-col text-right">
                <span className="font-semibold font-mono">{order.localOrderId}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{clientName} - {storeName}</span>
            </div>
        );
    };

    const inputClass = "w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light";
    const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    
    const potentialOrders = availableOrders.filter(o =>
        (shipment && o.shipmentId === shipment.id) ||
        (
            o.status === OrderStatus.ARRIVED_AT_HUB &&
            !o.shipmentId &&
            o.originCenter === formData.country &&
            o.shippingType === formData.shippingType &&
            o.receivingCompanyId === formData.shippingCompanyId
        )
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold">{mode === 'new' ? t('addShipment') : t('edit')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>{t('shipmentNum')}*</label>
                            <input type="text" name="shipmentNumber" value={formData.shipmentNumber || ''} onChange={handleInputChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('company')}*</label>
                            <select name="shippingCompanyId" value={formData.shippingCompanyId || ''} onChange={handleInputChange} className={inputClass}>
                                <option value="">Select Company</option>
                                {shippingCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>{t('origin')}*</label>
                            <select name="country" value={formData.country || ''} onChange={handleInputChange} className={inputClass}>
                                <option value="Dubai">Dubai</option>
                                <option value="China">China</option>
                                <option value="Turkey">Turkey</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>{t('shippingType')}*</label>
                            <select name="shippingType" value={formData.shippingType || ''} onChange={handleInputChange} className={inputClass}>
                                <option value={ShippingType.NORMAL}>{t('normal')}</option>
                                <option value={ShippingType.FAST}>{t('fast')}</option>
                            </select>
                        </div>
                         <div>
                            <label className={labelClass}>{t('numberOfBoxes')}*</label>
                            <input type="number" name="numberOfBoxes" value={formData.numberOfBoxes || 1} onChange={handleInputChange} className={inputClass} min="1"/>
                        </div>
                        <div>
                            <label className={labelClass}>{t('departureDate')}</label>
                            <input type="date" name="departureDate" value={formData.departureDate || ''} onChange={handleInputChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('expectedArrival')}</label>
                            <input type="date" name="expectedArrivalDate" value={formData.expectedArrivalDate || ''} onChange={handleInputChange} className={inputClass} />
                        </div>
                    </div>
                    <div className="md:col-span-2 mt-4 pt-4 border-t dark:border-gray-600">
                        <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">{t('linkedOrders')}</h4>
                        <div className="max-h-48 overflow-y-auto p-2 border rounded dark:border-gray-600 bg-background-light dark:bg-background-dark">
                           {potentialOrders.length > 0 ? potentialOrders.map(order => (
                                <div key={order.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={!!linkedOrders[order.id]} 
                                            onChange={() => handleOrderLinkToggle(order.id)} 
                                            className="form-checkbox h-4 w-4"
                                        />
                                        {renderOrderLabel(order)}
                                    </label>
                                    {linkedOrders[order.id] && (
                                        <select 
                                            value={parseInt(linkedOrders[order.id].split('-')[1])}
                                            onChange={(e) => handleBoxAssignment(order.id, parseInt(e.target.value))}
                                            className="p-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600 text-text-light dark:text-text-dark"
                                        >
                                            {Array.from({length: formData.numberOfBoxes || 1}, (_, i) => i + 1).map(num => (
                                                <option key={num} value={num}>Box {num}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                           )) : <p className="text-sm text-gray-500 p-2">{t('noOrdersFound')}</p>}
                        </div>
                    </div>
                </div>
                <div className="p-6 pt-0 flex justify-end flex-shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={!formData.shipmentNumber || !formData.shippingCompanyId || !formData.country || !formData.shippingType}
                        className="flex items-center gap-2 px-6 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        <Save size={18} /> {t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ShipmentStatusUpdateModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    shipment: Shipment | null;
    orders: Order[];
    clients: Client[];
    onConfirmShip: (shipmentId: string, trackingNumber?: string, receiptImage?: string) => void;
    onConfirmArrival: (shipmentId: string, boxId: string) => void;
    onConfirmAllReceived: (shipmentId: string, totalWeight?: number, totalShippingCost?: number) => void;
}> = ({ isOpen, onClose, shipment, orders, clients, onConfirmShip, onConfirmArrival, onConfirmAllReceived }) => {
    const { t } = useLanguage();
    const [trackingNumber, setTrackingNumber] = useState('');
    const [receiptImage, setReceiptImage] = useState<string | null>(null);
    const [totalWeight, setTotalWeight] = useState<number | undefined>(undefined);
    const [totalShippingCost, setTotalShippingCost] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (shipment) {
            setTrackingNumber(shipment.trackingNumber || '');
            setReceiptImage(shipment.receiptImage || null);
            setTotalWeight(shipment.totalWeight);
            setTotalShippingCost(shipment.totalShippingCost);
        } else {
            setTrackingNumber('');
            setReceiptImage(null);
            setTotalWeight(undefined);
            setTotalShippingCost(undefined);
        }
    }, [shipment]);

    if (!isOpen || !shipment) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const base64 = await compressImage(e.target.files[0]);
            setReceiptImage(base64);
        }
    };
    
    const renderContent = () => {
        const inputClass = "w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light";
        const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

        switch (shipment.status) {
            case ShipmentStatus.NEW:
                return (
                    <div>
                        <div className="text-center mb-4">
                            <Truck size={48} className="mx-auto text-blue-500 mb-4"/>
                            <h4 className="font-bold text-lg mb-2">{t('confirmShip')}</h4>
                        </div>
                        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <div>
                                <label className={labelClass}>{t('tracking')}*</label>
                                <input 
                                    type="text" 
                                    value={trackingNumber} 
                                    onChange={e => setTrackingNumber(e.target.value)} 
                                    className={inputClass} 
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Image ({t('optional')})</label>
                                <input type="file" onChange={handleFileChange} accept="image/*" className={`${inputClass} p-1.5`} />
                            </div>
                        </div>
                        <button 
                            onClick={() => onConfirmShip(shipment.id, trackingNumber, receiptImage || undefined)} 
                            disabled={!trackingNumber}
                            className="w-full mt-6 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {t('confirm')}
                        </button>
                    </div>
                );
            case ShipmentStatus.SHIPPED:
            case ShipmentStatus.PARTIALLY_ARRIVED: {
                const arrivedCount = shipment.boxes.filter(b => b.status === 'arrived').length;
                return (
                    <>
                        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
                            <p className="font-bold text-lg text-text-light dark:text-text-dark font-mono">
                                <span className="text-primary dark:text-secondary">{arrivedCount}</span> / {shipment.numberOfBoxes}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Arrived</p>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-2">
                            {shipment.boxes.map(box => {
                                const ordersInBox = orders.filter(o => o.boxId === box.id);
                                const isArrived = box.status === 'arrived';
                                return (
                                     <div key={box.id} className={`p-4 rounded-lg border-l-4 ${isArrived ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'}`}>
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-lg font-bold flex items-center gap-2"><BoxIcon size={20}/> Box <span className="font-mono">{box.boxNumber}</span></h4>
                                            {isArrived 
                                                ? <span className="text-sm font-bold text-green-600 dark:text-green-300 font-mono">Arrived: {box.arrivalDate}</span>
                                                : <button onClick={() => onConfirmArrival(shipment.id, box.id)} className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600">{t('confirm')}</button>
                                            }
                                        </div>
                                        <div className="mt-2 pl-4">
                                            <h5 className="text-sm font-semibold mb-1">{t('linkedOrders')} ({ordersInBox.length}):</h5>
                                            {ordersInBox.length > 0 ? (
                                                <ul className="text-xs list-disc list-inside text-gray-600 dark:text-gray-400 font-mono">
                                                    {ordersInBox.map(o => <li key={o.id}>{o.localOrderId} ({clients.find(c=>c.id === o.clientId)?.name})</li>)}
                                                </ul>
                                            ) : <p className="text-xs text-gray-500">Empty box</p>}
                                        </div>
                                     </div>
                                )
                            })}
                        </div>
                    </>
                );
            }
            case ShipmentStatus.ARRIVED: {
                const linkedOrders = orders.filter(o => o.shipmentId === shipment.id);
                const uncompletedOrders = linkedOrders.filter(o => o.status !== OrderStatus.COMPLETED);
                const areAllOrdersCompleted = uncompletedOrders.length === 0;
                 return (
                    <div>
                        <div className="text-center">
                            <CheckCircle size={48} className="mx-auto text-purple-500 mb-4"/>
                            <h4 className="font-bold text-lg mb-2">{t('confirmReceived')}</h4>
                        </div>
                        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-4">
                            <div>
                                <label className={labelClass}>{t('weight')} (kg) ({t('optional')})</label>
                                <input type="number" value={totalWeight || ''} onChange={e => setTotalWeight(parseFloat(e.target.value))} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Cost (MRU) ({t('optional')})</label>
                                <input type="number" value={totalShippingCost || ''} onChange={e => setTotalShippingCost(parseFloat(e.target.value))} className={inputClass} />
                            </div>
                        </div>
                        {!areAllOrdersCompleted && (
                             <div className="p-3 my-4 bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500 rounded-r-lg text-yellow-800 dark:text-yellow-200">
                                <h4 className="font-bold flex items-center gap-2"><AlertCircle size={18}/> Warning</h4>
                                <p className="text-sm mt-1"><span className="font-mono">{uncompletedOrders.length}</span> orders not delivered yet.</p>
                            </div>
                        )}
                        <button 
                            onClick={() => onConfirmAllReceived(shipment.id, totalWeight, totalShippingCost)} 
                            disabled={!areAllOrdersCompleted}
                            className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-bold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {t('confirm')}
                        </button>
                    </div>
                );
            }
            default:
                return (
                    <div className="text-center p-4">
                         <Info size={32} className="mx-auto text-gray-400 mb-2"/>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold">{t('updateStatus')}: <span className="font-mono">{shipment?.shipmentNumber}</span></h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};


const ShipmentCard: React.FC<{ shipment: Shipment; orderCount: number; companyName: string; onUpdate: () => void; onEdit: () => void; onHistory: () => void; onView: () => void }> = ({ shipment, orderCount, companyName, onUpdate, onEdit, onHistory, onView }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    
    const getStatus = (status: ShipmentStatus) => {
        switch(status) {
            case ShipmentStatus.NEW: return { name: t('shipmentNew'), icon: <PackagePlus size={16} className="ml-1"/>, color: 'text-gray-800 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-900' };
            case ShipmentStatus.SHIPPED: return { name: t('st_shipped_from_store'), icon: <Truck size={16} className="ml-1"/>, color: 'text-blue-800 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900' };
            case ShipmentStatus.PARTIALLY_ARRIVED: return { name: t('shipmentPartial'), icon: <GitCommit size={16} className="ml-1"/>, color: 'text-orange-800 dark:text-orange-300', bgColor: 'bg-orange-100 dark:bg-orange-900' };
            case ShipmentStatus.ARRIVED: return { name: t('shipmentArrived'), icon: <CheckCircle size={16} className="ml-1"/>, color: 'text-green-800 dark:text-green-300', bgColor: 'bg-green-100 dark:bg-green-900' };
            case ShipmentStatus.RECEIVED: return { name: t('statusCompleted'), icon: <CheckCircle size={16} className="ml-1"/>, color: 'text-purple-800 dark:text-purple-300', bgColor: 'bg-purple-100 dark:bg-purple-900' };
            case ShipmentStatus.DELAYED: return { name: t('lateOrders'), icon: <AlertCircle size={16} className="ml-1"/>, color: 'text-red-800 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900' };
            default: return { name: status, icon: null, color: '', bgColor: '' };
        }
    };

    const statusInfo = getStatus(shipment.status);
    const arrivedBoxes = shipment.boxes.filter(b => b.status === 'arrived').length;
    const progress = shipment.numberOfBoxes > 0 ? (arrivedBoxes / shipment.numberOfBoxes) * 100 : 0;
    
    return (
        <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-lg p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div>
                <div className="flex justify-between items-start">
                    <p className="font-bold text-lg text-primary dark:text-primary-dark font-mono">{shipment.shipmentNumber}</p>
                    <span className={`flex items-center px-3 py-1 text-sm font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                        {statusInfo.icon} {statusInfo.name}
                    </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{companyName} - {shipment.country} - {shipment.shippingType === ShippingType.FAST ? t('fast') : t('normal')}</p>
            </div>
            <div className="my-4">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono">
                    <span>{shipment.departureDate}</span>
                    <span>{shipment.expectedArrivalDate}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all duration-500 ${shipment.status === ShipmentStatus.DELAYED ? 'bg-red-500' : 'bg-primary dark:bg-secondary'}`} style={{ width: `${progress}%` }}></div>
                </div>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center font-semibold font-mono">{arrivedBoxes} / {shipment.numberOfBoxes} boxes</p>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between items-center text-sm">
                <p>{t('orders')}: <span className="font-bold font-mono">{orderCount}</span></p>
                <div className="flex items-center gap-2">
                    <button onClick={onView} className="p-2 text-xs text-gray-500 hover:text-primary-light dark:hover:text-primary-dark" title={t('view')}><Eye size={16} /></button>
                    <button onClick={onHistory} className="p-2 text-xs text-gray-500 hover:text-primary-light dark:hover:text-primary-dark" title={t('history')}><ScrollText size={16} /></button>
                    {currentUser?.permissions.shipments.edit && (
                    <button onClick={onEdit} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><Edit2 size={14}/> {t('edit')}</button>
                    )}
                    {currentUser?.permissions.shipments.changeStatus && <button onClick={onUpdate} className="flex items-center gap-2 px-3 py-1.5 text-xs bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-dark rounded-md hover:bg-primary/20 dark:hover:bg-primary-dark/30 transition-colors font-semibold"><Zap size={14}/> {t('updateStatus')}</button>}
                </div>
            </div>
        </div>
    );
};

const ShipmentsPage: React.FC<ShipmentsPageProps> = ({ shipments, setShipments, orders, setOrders, shippingCompanies, settings, clients, stores }) => {
  const { currentUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('new');
  const [historyShipment, setHistoryShipment] = useState<Shipment | null>(null);
  const [isStatusModalOpen, setStatusModalOpen] = useState(false);
  const [viewingShipment, setViewingShipment] = useState<Shipment | null>(null);

  const handleOpenModal = (shipment: Shipment | null = null, mode: ModalMode) => {
      setSelectedShipment(shipment);
      setModalMode(mode);
      setModalOpen(true);
  };
  
  const handleCloseModal = () => {
      setSelectedShipment(null);
      setModalOpen(false);
      setStatusModalOpen(false);
      setViewingShipment(null);
  };
  
  const handleOpenStatusUpdateModal = (shipment: Shipment) => {
      setSelectedShipment(shipment);
      setStatusModalOpen(true);
  };

  const handleSaveShipment = async (payload: Partial<Shipment>, linkedOrders: Record<string, string>) => {
    if (!supabase) return;
    
    const isDuplicate = shipments.some(s => s.shipmentNumber === payload.shipmentNumber && s.id !== payload.id);
    if (isDuplicate) {
        showToast("Duplicate Shipment Number", 'error');
        return;
    }

    const user = currentUser?.username || 'System';
    
    try {
        let shipmentData = { ...payload };
        let boxes = payload.boxes || [];

        if (modalMode === 'new') {
            const newBoxes: Box[] = Array.from({ length: payload.numberOfBoxes! }, (_, i) => ({
                id: `b${Date.now()}-${i + 1}`,
                boxNumber: i + 1,
                status: 'in_transit'
            }));
            
            shipmentData = {
                ...payload,
                status: ShipmentStatus.NEW,
                boxes: newBoxes,
                history: [{ timestamp: new Date().toISOString(), activity: 'Created', user }],
            };
        } else { // Edit
            const shipmentToUpdate = shipments.find(s => s.id === payload.id);
            if (shipmentToUpdate) {
                 if (payload.numberOfBoxes! > shipmentToUpdate.numberOfBoxes) {
                    const newBoxesCount = payload.numberOfBoxes! - shipmentToUpdate.numberOfBoxes;
                    const newBoxes: Box[] = Array.from({ length: newBoxesCount }, (_, i) => ({
                        id: `b${Date.now()}-${shipmentToUpdate.numberOfBoxes + i + 1}`,
                        boxNumber: shipmentToUpdate.numberOfBoxes + i + 1,
                        status: 'in_transit'
                    }));
                    boxes = [...shipmentToUpdate.boxes, ...newBoxes];
                } else if (payload.numberOfBoxes! < shipmentToUpdate.numberOfBoxes) {
                    boxes = shipmentToUpdate.boxes.slice(0, payload.numberOfBoxes);
                } else {
                    boxes = shipmentToUpdate.boxes;
                }
                shipmentData = { ...shipmentToUpdate, ...payload, boxes };
            }
        }

        const dbPayload = {
            shipment_number: shipmentData.shipmentNumber,
            shipping_type: shipmentData.shippingType,
            shipping_company_id: shipmentData.shippingCompanyId,
            departure_date: shipmentData.departureDate,
            expected_arrival_date: shipmentData.expectedArrivalDate,
            number_of_boxes: shipmentData.numberOfBoxes,
            country: shipmentData.country,
            status: shipmentData.status,
            boxes: shipmentData.boxes,
            history: shipmentData.history
        };

        let res;
        if (modalMode === 'new') {
             res = await (supabase.from('Shipments') as any).insert(dbPayload).select().single();
        } else {
             res = await (supabase.from('Shipments') as any).update(dbPayload).eq('id', shipmentData.id).select().single();
        }

        if (res.error) throw res.error;
        
        const savedShipment = {
            ...res.data,
            shipmentNumber: res.data.shipment_number,
            shippingType: res.data.shipping_type,
            shippingCompanyId: res.data.shipping_company_id,
            departureDate: res.data.departure_date,
            expectedArrivalDate: res.data.expected_arrival_date,
            numberOfBoxes: res.data.number_of_boxes,
        };

        if (modalMode === 'new') {
            setShipments(prev => [savedShipment, ...prev]);
            showToast(t('success'), 'success');
        } else {
            setShipments(prev => prev.map(s => s.id === savedShipment.id ? savedShipment : s));
            showToast(t('success'), 'success');
        }

        const newLinkedOrderIds = Object.keys(linkedOrders);
        
        setOrders(prevOrders => {
             return prevOrders.map(o => {
                 if (newLinkedOrderIds.includes(o.id)) {
                    const boxNumber = parseInt(linkedOrders[o.id].split('-')[1]);
                    const box = savedShipment.boxes.find((b: Box) => b.boxNumber === boxNumber);
                    return {...o, shipmentId: savedShipment.id, boxId: box?.id };
                 }
                 if (modalMode === 'edit' && o.shipmentId === savedShipment.id && !newLinkedOrderIds.includes(o.id)) {
                      return { ...o, shipmentId: undefined, boxId: undefined, status: OrderStatus.ARRIVED_AT_HUB };
                 }
                 return o;
             })
        });

        for (const orderId of newLinkedOrderIds) {
            const boxNumber = parseInt(linkedOrders[orderId].split('-')[1]);
            const box = savedShipment.boxes.find((b: Box) => b.boxNumber === boxNumber);
            await (supabase.from('Orders') as any).update({ 
                shipment_id: savedShipment.id, 
                box_id: box?.id 
            }).eq('id', orderId);
        }
        
        if (modalMode === 'edit') {
             const ordersToUnlink = orders.filter(o => o.shipmentId === savedShipment.id && !newLinkedOrderIds.includes(o.id));
             for(const order of ordersToUnlink) {
                 await (supabase.from('Orders') as any).update({ 
                    shipment_id: null, 
                    box_id: null,
                    status: OrderStatus.ARRIVED_AT_HUB
                 }).eq('id', order.id);
             }
        }

        handleCloseModal();

    } catch(error: any) {
        console.error("Error saving shipment:", error);
        showToast(t('error') + ': ' + getErrorMessage(error), 'error');
    }
  };
  
    const handleConfirmShip = async (shipmentId: string, trackingNumber?: string, receiptImage?: string) => {
        if (!supabase) return;
        const shipment = shipments.find(s => s.id === shipmentId);
        if (!shipment) return;
        const user = currentUser?.username || 'System';
        
        const now = new Date().toISOString();
        const logs: string[] = [`Updated status to: Shipped`];
        if (trackingNumber) logs.push(`Tracking: ${trackingNumber}`);
        if (receiptImage) logs.push(`Image attached`);

        const newLog: ActivityLog = { timestamp: now, activity: logs.join(' | '), user };
        
        try {
            const dbPayload = {
                status: ShipmentStatus.SHIPPED,
                tracking_number: trackingNumber || shipment.trackingNumber,
                receipt_image: receiptImage || shipment.receiptImage,
                departure_date: shipment.departureDate || now.split('T')[0],
                history: [...(shipment.history || []), newLog]
            };

            const { error } = await (supabase.from('Shipments') as any).update(dbPayload).eq('id', shipmentId);
            if(error) throw error;
            
            setShipments(prev => prev.map(s => s.id === shipmentId ? { 
                ...s, 
                status: ShipmentStatus.SHIPPED,
                trackingNumber: trackingNumber || s.trackingNumber,
                receiptImage: receiptImage || s.receiptImage,
                departureDate: s.departureDate || now.split('T')[0],
                history: [...(s.history || []), newLog]
            } : s));
            
             const linkedOrders = orders.filter(o => o.shipmentId === shipmentId);
             const orderLog: ActivityLog = { timestamp: now, activity: 'In Transit', user };
             
             for(const order of linkedOrders) {
                 await (supabase.from('Orders') as any).update({
                     status: OrderStatus.IN_TRANSIT,
                     history: [...(order.history || []), orderLog]
                 }).eq('id', order.id);
             }

             setOrders(prev => prev.map(o => o.shipmentId === shipmentId ? { 
                ...o, 
                status: OrderStatus.IN_TRANSIT,
                history: [...(o.history || []), orderLog]
            } : o));

            showToast(t('success'), 'success');
            handleCloseModal();
        } catch (e: any) {
            console.error("Error confirming shipment:", e);
            showToast(t('error') + ': ' + getErrorMessage(e), 'error');
        }
    };

    const handleConfirmAllReceived = async (shipmentId: string, totalWeight?: number, totalShippingCost?: number) => {
        if (!supabase) return;
        const shipment = shipments.find(s => s.id === shipmentId);
        if (!shipment) return;
        const user = currentUser?.username || 'System';
        
        const now = new Date().toISOString();
        const logs = [`Received all items`];
        if (totalWeight) logs.push(`Weight: ${totalWeight}kg`);
        if (totalShippingCost) logs.push(`Cost: ${totalShippingCost} MRU`);
        
        const newLog: ActivityLog = { timestamp: now, activity: logs.join(' | '), user };

        try {
             const dbPayload = {
                status: ShipmentStatus.RECEIVED,
                total_weight: totalWeight || shipment.totalWeight,
                total_shipping_cost: totalShippingCost || shipment.totalShippingCost,
                history: [...(shipment.history || []), newLog]
             };

             const { error } = await (supabase.from('Shipments') as any).update(dbPayload).eq('id', shipmentId);
             if(error) throw error;

             setShipments(prev => prev.map(s => s.id === shipmentId ? { 
                ...s, 
                status: ShipmentStatus.RECEIVED,
                totalWeight: totalWeight || s.totalWeight,
                totalShippingCost: totalShippingCost || s.totalShippingCost,
                history: [...(s.history || []), newLog]
            } : s));

            showToast(t('success'), 'success');
            handleCloseModal();
        } catch(e: any) {
             console.error("Error confirming received:", e);
             showToast(t('error') + ': ' + getErrorMessage(e), 'error');
        }
    };

  const handleConfirmBoxArrival = async (shipmentId: string, boxId: string) => {
        if (!supabase) return;
        const shipment = shipments.find(s => s.id === shipmentId);
        if (!shipment) return;
        const user = currentUser?.username || 'System';

        const updatedBoxes = shipment.boxes.map(b => 
            b.id === boxId ? { ...b, status: 'arrived' as 'arrived', arrivalDate: new Date().toISOString().split('T')[0] } : b
        );

        const arrivedBoxesCount = updatedBoxes.filter(b => b.status === 'arrived').length;
        let newStatus = shipment.status;
        let logMessage = `Box ${shipment.boxes.find(b=>b.id===boxId)?.boxNumber} arrived`;

        if (arrivedBoxesCount === shipment.numberOfBoxes) {
            newStatus = ShipmentStatus.ARRIVED;
            logMessage += ". Shipment Arrived.";
        } else if (arrivedBoxesCount > 0) {
            newStatus = ShipmentStatus.PARTIALLY_ARRIVED;
            logMessage += ". Partial Arrival.";
        }

        const newShipmentLog: ActivityLog = { timestamp: new Date().toISOString(), activity: logMessage, user };
        
        try {
            const { error } = await (supabase.from('Shipments') as any).update({
                boxes: updatedBoxes,
                status: newStatus,
                history: [...(shipment.history || []), newShipmentLog]
            }).eq('id', shipmentId);

            if(error) throw error;

            setShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, boxes: updatedBoxes, status: newStatus, history: [...(s.history || []), newShipmentLog] } : s));
            
            const orderLog: ActivityLog = { timestamp: new Date().toISOString(), activity: 'Arrived at Office', user };
            
            const ordersInBox = orders.filter(o => o.boxId === boxId);
            for(const order of ordersInBox) {
                await (supabase.from('Orders') as any).update({
                    status: OrderStatus.ARRIVED_AT_OFFICE,
                    arrival_date_at_office: new Date().toISOString().split('T')[0],
                    history: [...(order.history || []), orderLog]
                }).eq('id', order.id);
            }

            setOrders(prev => prev.map(o => o.boxId === boxId ? { ...o, status: OrderStatus.ARRIVED_AT_OFFICE, arrivalDateAtOffice: new Date().toISOString().split('T')[0], history: [...(o.history || []), orderLog] } : o));

            showToast(t('success'), 'success');

            const updatedShipmentForModal = shipments.find(s => s.id === shipmentId);
            if (updatedShipmentForModal && newStatus !== ShipmentStatus.ARRIVED) {
                setSelectedShipment(prev => prev ? { ...prev, boxes: updatedBoxes, status: newStatus } : null);
            } else {
                handleCloseModal();
            }
        } catch(e: any) {
             console.error("Error confirming box arrival:", e);
             showToast(t('error') + ': ' + getErrorMessage(e), 'error');
        }
  };

  return (
    <>
      <ShipmentModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
          onSave={handleSaveShipment}
          shipment={selectedShipment} 
          shippingCompanies={shippingCompanies}
          availableOrders={orders}
          settings={settings}
          mode={modalMode}
          clients={clients}
          stores={stores}
      />
      <ShipmentStatusUpdateModal
        isOpen={isStatusModalOpen}
        onClose={handleCloseModal}
        shipment={selectedShipment}
        orders={orders}
        clients={clients}
        onConfirmShip={handleConfirmShip}
        onConfirmArrival={handleConfirmBoxArrival}
        onConfirmAllReceived={handleConfirmAllReceived}
      />
      <HistoryLogModal
        isOpen={!!historyShipment}
        onClose={() => setHistoryShipment(null)}
        history={historyShipment?.history || []}
        title={`${t('history')} ${historyShipment?.shipmentNumber}`}
      />
      <ShipmentDetailsModal 
          isOpen={!!viewingShipment}
          onClose={handleCloseModal}
          shipment={viewingShipment}
          companyName={shippingCompanies.find(c => c.id === viewingShipment?.shippingCompanyId)?.name || 'N/A'}
          ordersCount={orders.filter(o => o.shipmentId === viewingShipment?.id).length}
      />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-text-light dark:text-text-dark">{t('manageShipments')}</h2>
          {currentUser?.permissions.shipments.create && (
          <button onClick={() => handleOpenModal(null, 'new')} className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow-md hover:bg-primary-dark dark:hover:bg-secondary-dark transition-colors transform hover:scale-105">
            <PlusCircle size={20} />
            <span>{t('addShipment')}</span>
          </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shipments.map(shipment => {
            const orderCount = orders.filter(o => o.shipmentId === shipment.id).length;
            const companyName = shippingCompanies.find(c => c.id === shipment.shippingCompanyId)?.name || 'N/A';
            return <ShipmentCard 
                        key={shipment.id} 
                        shipment={shipment} 
                        orderCount={orderCount} 
                        companyName={companyName} 
                        onUpdate={() => handleOpenStatusUpdateModal(shipment)}
                        onEdit={() => handleOpenModal(shipment, 'edit')}
                        onHistory={() => setHistoryShipment(shipment)}
                        onView={() => setViewingShipment(shipment)}
                    />;
          })}
        </div>
      </div>
    </>
  );
};

export default ShipmentsPage;
