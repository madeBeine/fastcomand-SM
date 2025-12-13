
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import type { Order, Client, Store, Currency, ShippingCompany, ActivityLog, StorageDrawer, AppSettings, GlobalActivityLog, CompanyInfo, User } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { STATUS_DETAILS } from '../constants';
import { PlusCircle, Search, X, Zap, Edit2, Info, AlertTriangle, Upload, Save, User as UserIcon, PackageX, Calendar, CalendarCheck, ScrollText, Lightbulb, Package, Hash, Weight, DollarSign, Wallet, Archive, ExternalLink, Send, RotateCcw, ShieldCheck, Loader2, Grid3X3, CheckCircle2, Ban, Link, Filter, Store as StoreIcon, Truck as ShippingTruckIcon, Trash2, Eye, Copy, Check, MoreVertical, Printer, CheckCircle, ChevronDown, Clock, Plane, Image as ImageIcon, Briefcase, Phone, MapPin } from 'lucide-react';
import OrderFormModal from './OrderFormModal';
import HistoryLogModal from './HistoryLogModal';
import OrderDetailsModal from './OrderDetailsModal';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, getErrorMessage } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import StorageSelectorModal from './StorageSelectorModal';
import PasswordConfirmationModal from './PasswordConfirmationModal';
import SplitOrderModal from './SplitOrderModal';
import { generateInvoiceHTML } from './BillingPage';
import PrintLanguageModal, { PrintLanguage } from './PrintLanguageModal';

interface OrdersPageProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  clients: Client[];
  stores: Store[];
  currencies: Currency[];
  shippingCompanies: ShippingCompany[];
  activeFilter: string | null;
  clearFilter: () => void;
  commissionRate: number;
  drawers: StorageDrawer[];
  paymentMethods: string[];
  settings?: AppSettings; 
  shouldOpenModal?: boolean;
  onModalOpenHandled?: () => void;
  companyInfo?: CompanyInfo;
  users?: User[];
}

const getStorageSuggestion = (orderToStore: Order, allOrders: Order[], drawers: StorageDrawer[]): { location: string | null; score: number; reasons: string[] } => {
    const occupiedSlots = new Set(allOrders.filter(o => o.status === OrderStatus.STORED).map(o => o.storageLocation).filter(Boolean));
    
    const scoredDrawers = drawers.map(drawer => {
        const ordersInDrawer = allOrders.filter(o => o.storageLocation?.startsWith(drawer.name + '-') && o.status === OrderStatus.STORED);
        if (ordersInDrawer.length >= drawer.capacity) return null;

        let score = 0;
        let reasons: string[] = [];

        if (orderToStore.shipmentId && ordersInDrawer.some(o => o.shipmentId === orderToStore.shipmentId)) {
            score += 40;
            reasons.push("تحتوي على طرود من نفس الشحنة");
        }
        if (ordersInDrawer.some(o => o.clientId === orderToStore.clientId)) {
            score += 25;
            reasons.push("تحتوي على طرود أخرى لنفس العميل");
        }
        const fillPercentage = ordersInDrawer.length / drawer.capacity;
        if (fillPercentage > 0.1 && fillPercentage < 0.9) {
            score += 20;
            reasons.push("جيد لتجميع الطرود معًا");
        }
        return { drawer, score, reasons };
    }).filter((d): d is { drawer: StorageDrawer; score: number; reasons: string[] } => d !== null);

    scoredDrawers.sort((a, b) => b.score - a.score);

    const bestDrawerInfo = scoredDrawers[0];
    const targetDrawerInfo = bestDrawerInfo || (drawers.length > 0 ? { drawer: drawers[0], score: 0, reasons: ['أول درج متاح'] } : null);

    if (!targetDrawerInfo) return { location: null, score: 0, reasons: [] };

    let firstAvailableSlot: string | null = null;
    for (let i = 1; i <= targetDrawerInfo.drawer.capacity; i++) {
        const slotLocation = `${targetDrawerInfo.drawer.name}-${String(i).padStart(2, '0')}`;
        if (!occupiedSlots.has(slotLocation)) {
            firstAvailableSlot = slotLocation;
            break;
        }
    }

    return { location: firstAvailableSlot, score: targetDrawerInfo.score, reasons: targetDrawerInfo.reasons };
};

const OrderStatusModal: React.FC<{
    order: Order | null;
    allOrders: Order[];
    drawers: StorageDrawer[];
    clients: Client[];
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (orderId: string, payload: Partial<Order>) => Promise<void>;
    onRevert: (orderId: string, password?: string) => Promise<boolean>;
    shippingCompanies: ShippingCompany[];
    settings?: AppSettings;
}> = ({ order, allOrders, drawers, clients, isOpen, onClose, onUpdate, onRevert, shippingCompanies, settings }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const [formData, setFormData] = useState<Partial<Order>>({});
    const [files, setFiles] = useState<{ [key: string]: string }>({});
    const [suggestion, setSuggestion] = useState<{ location: string | null; score: number; reasons: string[] } | null>(null);
    const [isReverting, setIsReverting] = useState(false);
    const [password, setPassword] = useState('');
    const [revertError, setRevertError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isStorageSelectorOpen, setStorageSelectorOpen] = useState(false);

    useEffect(() => {
        if (order) {
            setFormData({
                globalOrderId: order.globalOrderId || '',
                originCenter: order.originCenter || 'Dubai',
                receivingCompanyId: order.receivingCompanyId || '',
                trackingNumber: order.trackingNumber || '',
                weight: order.weight || 0,
                shippingCost: order.shippingCost,
                storageLocation: order.storageLocation || '',
                shippingType: order.shippingType,
                arrivalDateAtOffice: order.arrivalDateAtOffice || new Date().toISOString().split('T')[0],
            });

            if(order.status === OrderStatus.ARRIVED_AT_OFFICE){
                setSuggestion(getStorageSuggestion(order, allOrders, drawers));
            }

            setFiles({});
            setIsReverting(false);
            setPassword('');
            setRevertError('');
            setIsSaving(false);
        }
    }, [order, allOrders, drawers, isOpen]);

    if (!isOpen || !order) return null;
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                if (reader.result) {
                    setFiles(prev => ({ ...prev, [field]: reader.result as string }));
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let newFormData = { ...formData, [name]: value };

        if ((name === 'weight' || name === 'shippingType') && order.status === OrderStatus.ARRIVED_AT_OFFICE) {
            const weight = name === 'weight' ? parseFloat(value) : (formData.weight || 0);
            const type = name === 'shippingType' ? value : (formData.shippingType || order.shippingType);
            
            const fastRate = settings?.shippingRates?.fast || 450;
            const normalRate = settings?.shippingRates?.normal || 280;
            const shippingRate = type === ShippingType.FAST ? fastRate : normalRate;
            
            newFormData.shippingCost = weight * shippingRate;
        }

        setFormData(newFormData);
    };

    const handleLocationSelect = (location: string) => {
        setFormData(prev => ({ ...prev, storageLocation: location }));
        setStorageSelectorOpen(false);
    }

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload: Partial<Order> = { ...formData };
            if (files.orderImages) payload.orderImages = [files.orderImages];
            if (files.hubArrivalImages) payload.hubArrivalImages = [files.hubArrivalImages];
            if (files.weighingImages) payload.weighingImages = [files.weighingImages];
            
            if(order.status === OrderStatus.ARRIVED_AT_OFFICE){
                payload.storageDate = new Date().toISOString();
            }

            await onUpdate(order.id, payload);
        } catch (e) {
            console.error(e);
            setIsSaving(false);
        }
    };

    const handleRevert = async () => {
        setRevertError('');
        setIsSaving(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: currentUser?.email || '',
                password: password
            });

            if (error) {
                 setRevertError(t('error'));
                 setIsSaving(false);
                 return;
            }

            const success = await onRevert(order.id, password);
            if(!success) setRevertError(t('error'));
        } catch(e) {
            setRevertError(t('error'));
        } finally {
            setIsSaving(false);
        }
    }

    const isFormValid = () => {
        switch (order.status) {
            case OrderStatus.NEW:
                return !!formData.globalOrderId && !!formData.originCenter && !!formData.receivingCompanyId;
            case OrderStatus.ORDERED:
                return !!formData.trackingNumber;
            case OrderStatus.SHIPPED_FROM_STORE:
                 return true; 
            case OrderStatus.ARRIVED_AT_HUB:
                 return !order.shipmentId;
            case OrderStatus.IN_TRANSIT:
                 return !order.shipmentId && !!formData.arrivalDateAtOffice;
            case OrderStatus.ARRIVED_AT_OFFICE:
                return (formData.weight !== undefined && formData.weight > 0) && !!formData.storageLocation;
            case OrderStatus.STORED:
                return !!formData.storageLocation;
            default:
                return false;
        }
    };
    
    const renderContent = () => {
        const inputClass = "w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light";
        const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";
        const fileInputLabelClass = "cursor-pointer mt-1 flex items-center gap-2 p-2 border-2 border-dashed border-gray-400 rounded-lg hover:border-primary dark:hover:border-secondary";
        
        const nextStatus = {
            [OrderStatus.NEW]: OrderStatus.ORDERED,
            [OrderStatus.ORDERED]: OrderStatus.SHIPPED_FROM_STORE,
            [OrderStatus.SHIPPED_FROM_STORE]: OrderStatus.ARRIVED_AT_HUB,
            [OrderStatus.ARRIVED_AT_HUB]: OrderStatus.IN_TRANSIT,
            [OrderStatus.IN_TRANSIT]: OrderStatus.ARRIVED_AT_OFFICE,
            [OrderStatus.ARRIVED_AT_OFFICE]: OrderStatus.STORED,
        }[order.status];

        const nextStatusName = nextStatus && STATUS_DETAILS[nextStatus] ? t(STATUS_DETAILS[nextStatus].name as any) : t('updateStatus');

        switch (order.status) {
            case OrderStatus.NEW:
                return {
                    title: `${t('updateStatus')}: ${nextStatusName}`,
                    body: (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>{t('globalOrderId')}*</label>
                                <input type="text" name="globalOrderId" value={formData.globalOrderId || ''} onChange={handleInputChange} className={inputClass} required />
                            </div>
                            <div>
                                <label className={labelClass}>{t('origin')}*</label>
                                <select name="originCenter" value={formData.originCenter || 'Dubai'} onChange={handleInputChange} className={inputClass}>
                                    <option value="Dubai">Dubai</option>
                                    <option value="China">China</option>
                                    <option value="Turkey">Turkey</option>
                                </select>
                            </div>
                             <div>
                                <label className={labelClass}>{t('company')}*</label>
                                <select name="receivingCompanyId" value={formData.receivingCompanyId || ''} onChange={handleInputChange} className={inputClass}>
                                    <option value="">Select Company</option>
                                    {shippingCompanies.map(company => (
                                        <option key={company.id} value={company.id}>{company.name}</option>
                                    ))}
                                </select>
                            </div>
                             <div>
                                <label className={labelClass}>{t('productImages')} ({t('optional')})</label>
                                <label htmlFor="file-order" className={fileInputLabelClass}><Upload size={16}/> {files.orderImages ? t('success') : t('optional')}</label>
                                <input id="file-order" type="file" className="hidden" onChange={(e) => handleFileChange(e, 'orderImages')} accept="image/*" />
                            </div>
                        </div>
                    ),
                    manual: true
                };
            case OrderStatus.ORDERED:
                return {
                    title: `${t('updateStatus')}: ${nextStatusName}`,
                    body: (
                        <div>
                            <label className={labelClass}>{t('tracking')}*</label>
                            <input type="text" name="trackingNumber" value={formData.trackingNumber || ''} onChange={handleInputChange} className={inputClass} required />
                        </div>
                    ),
                    manual: true
                };
            case OrderStatus.SHIPPED_FROM_STORE:
                return {
                    title: `${t('updateStatus')}: ${nextStatusName}`,
                    body: (
                         <div>
                            <label className={labelClass}>{t('optional')}</label>
                            <label htmlFor="file-hub" className={fileInputLabelClass}><Upload size={16}/> {files.hubArrivalImages ? t('success') : t('optional')}</label>
                            <input id="file-hub" type="file" className="hidden" onChange={(e) => handleFileChange(e, 'hubArrivalImages')} accept="image/*" />
                            {!order.shipmentId && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                                    <Info size={16} className="inline mr-1"/>
                                    Manual update
                                </div>
                            )}
                        </div>
                    ),
                    manual: true
                };
            case OrderStatus.ARRIVED_AT_HUB:
                if (order.shipmentId) {
                    return {
                        title: t('updateStatus'),
                        body: (
                            <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg text-yellow-800 dark:text-yellow-200 flex items-center gap-3">
                                <AlertTriangle size={24} />
                                <div>
                                    <p className="font-semibold">{t('error')}</p>
                                    <p className="text-xs mt-1">Managed via Shipments</p>
                                </div>
                            </div>
                        ),
                        manual: false
                    };
                }
                return {
                    title: `${t('updateStatus')}: ${nextStatusName}`,
                    body: (
                        <div className="space-y-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                                <Plane size={20} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-sm">Manual Shipping</p>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>{t('departureDate')}</label>
                                <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className={inputClass} disabled />
                            </div>
                        </div>
                    ),
                    manual: true
                };
            case OrderStatus.IN_TRANSIT:
                if (order.shipmentId) {
                    return {
                        title: t('updateStatus'),
                        body: (
                            <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg text-yellow-800 dark:text-yellow-200 flex items-center gap-3">
                                <AlertTriangle size={24} />
                                <div>
                                    <p className="font-semibold">{t('error')}</p>
                                </div>
                            </div>
                        ),
                        manual: false
                    };
                }
                return {
                    title: `${t('updateStatus')}: ${nextStatusName}`,
                    body: (
                        <div className="space-y-4">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 flex items-start gap-2">
                                <CheckCircle size={20} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-sm">Arrived at Office</p>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>{t('arrivalDate')}</label>
                                <input type="date" name="arrivalDateAtOffice" value={formData.arrivalDateAtOffice} onChange={handleInputChange} className={inputClass} />
                            </div>
                        </div>
                    ),
                    manual: true
                };
            case OrderStatus.ARRIVED_AT_OFFICE:
                return {
                     title: `${t('updateStatus')}: ${nextStatusName}`,
                     body: (
                         <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>{t('weight')} (kg)</label>
                                    <input type="number" name="weight" value={formData.weight || ''} onChange={handleInputChange} className={inputClass} step="0.1" />
                                </div>
                                <div>
                                    <label className={labelClass}>{t('shippingType')}</label>
                                    <select name="shippingType" value={formData.shippingType} onChange={handleInputChange} className={inputClass}>
                                        <option value={ShippingType.NORMAL}>{t('normal')}</option>
                                        <option value={ShippingType.FAST}>{t('fast')}</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 text-sm flex justify-between items-center">
                                <span className="text-gray-500">Cost:</span>
                                <span className="font-bold font-mono text-primary">{Math.round(formData.shippingCost || 0).toLocaleString()} MRU</span>
                            </div>

                            {suggestion && suggestion.location && !formData.storageLocation && (
                                <div className="p-3 bg-teal-50 dark:bg-teal-900/50 border-l-4 border-teal-500 rounded-r-lg cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/70 transition-colors" onClick={() => setStorageSelectorOpen(true)}>
                                    <h4 className="font-bold text-teal-800 dark:text-teal-200 flex items-center gap-2"><Lightbulb size={18}/> Suggestion</h4>
                                    <p className="mt-1">Location: <strong className="text-lg">{suggestion.location}</strong></p>
                                </div>
                            )}

                             <div>
                                <label className={labelClass}>{t('location')}*</label>
                                <div 
                                    onClick={() => setStorageSelectorOpen(true)}
                                    className={`w-full mt-1 p-3 border-2 rounded-lg flex justify-between items-center cursor-pointer transition-all hover:border-primary dark:hover:border-secondary bg-white dark:bg-gray-800 ${formData.storageLocation ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 border-dashed'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Grid3X3 size={24} className={formData.storageLocation ? "text-green-600" : "text-primary"}/>
                                        {formData.storageLocation ? (
                                            <span className="font-bold text-xl text-green-700 dark:text-green-400">{formData.storageLocation}</span>
                                        ) : (
                                            <span className="text-gray-500 font-medium">Select Location</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                             <div>
                                <label className={labelClass}>{t('optional')}</label>
                                <label htmlFor="file-weigh" className={fileInputLabelClass}><Upload size={16}/> {files.weighingImages ? t('success') : t('optional')}</label>
                                <input id="file-weigh" type="file" className="hidden" onChange={(e) => handleFileChange(e, 'weighingImages')} accept="image/*" />
                            </div>
                         </div>
                     ),
                     manual: true
                }
            case OrderStatus.STORED:
                return {
                    title: t('updateStatus'),
                    body: (
                        <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg text-yellow-800 dark:text-yellow-200 flex items-center gap-3">
                            <AlertTriangle size={24} />
                            <div>
                                <p className="font-semibold">{t('error')}</p>
                            </div>
                        </div>
                    ),
                    manual: false
                };
            default:
                return { title: t('updateStatus'), body: null, manual: false };
        }
    };
    
    const { title, body, manual } = renderContent();

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
                <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700">
                        <h3 className="text-xl font-bold">{title}</h3>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                            <X size={20} />
                        </button>
                    </div>
                    {body}
                    {isReverting && (
                        <div className="mt-4 p-4 border-t dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/50 rounded-b-lg">
                            <h4 className="font-bold text-yellow-800 dark:text-yellow-200">{t('confirm')}</h4>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('password')}
                                className="w-full mt-2 p-2 border border-yellow-300 dark:border-yellow-600 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                             {revertError && <p className="text-red-500 text-xs mt-1">{revertError}</p>}
                            <button onClick={handleRevert} disabled={isSaving} className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50">
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} {t('confirm')}
                            </button>
                        </div>
                    )}
                    <div className="mt-6 flex justify-end gap-2">
                        {currentUser?.permissions.orders.revertStatus && order.status !== OrderStatus.NEW && !isReverting && (
                            <button
                                onClick={() => setIsReverting(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
                            >
                                <RotateCcw size={16} /> Revert
                            </button>
                        )}
                        {manual && (
                            <button
                                onClick={handleSave}
                                disabled={!isFormValid() || isSaving}
                                className="flex items-center gap-2 px-6 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                {t('save')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <StorageSelectorModal 
                isOpen={isStorageSelectorOpen}
                onClose={() => setStorageSelectorOpen(false)}
                onSelect={handleLocationSelect}
                drawers={drawers}
                allOrders={allOrders}
                suggestedLocation={suggestion?.location || null}
                clients={clients}
            />
        </>
    );
};

const OrderCard: React.FC<{ 
    order: Order; 
    client: Client | undefined; 
    store: Store | undefined;
    users: User[] | undefined;
    onEdit: () => void; 
    onDelete: () => void; 
    onCancel: () => void;
    onChangeStatus: () => void;
    onHistory: () => void;
    onView: () => void;
    onSplit: () => void;
    onPrintInvoice: (order: Order) => void;
}> = ({ order, client, store, users = [], onEdit, onDelete, onCancel, onChangeStatus, onHistory, onView, onSplit, onPrintInvoice }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const [copied, setCopied] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const statusInfo = STATUS_DETAILS[order.status] || { name: 'st_new', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' };
    const isLate = order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED && new Date(order.expectedArrivalDate) < new Date();
    
    // Calculations
    const totalCost = (order.priceInMRU || 0) + (order.commission || 0) + (order.shippingCost || 0);
    const amountPaid = order.amountPaid || 0;
    const remaining = Math.max(0, totalCost - amountPaid);
    const percentPaid = totalCost > 0 ? (amountPaid / totalCost) * 100 : 0;
    
    const isStored = order.status === OrderStatus.STORED;
    const isCompleted = order.status === OrderStatus.COMPLETED;
    const isFastShipping = order.shippingType === ShippingType.FAST;

    // Determine Creator and Editor
    const history = order.history || [];
    const createdByUsername = history.length > 0 ? history[0].user : null;
    const lastEditedByUsername = history.length > 1 ? history[history.length - 1].user : null;

    const creator = users.find(u => u.username === createdByUsername);
    const editor = users.find(u => u.username === lastEditedByUsername);

    // Calculate days ago
    const daysAgo = Math.max(0, Math.floor((new Date().getTime() - new Date(order.orderDate).getTime()) / (1000 * 60 * 60 * 24)));
    const daysText = daysAgo === 0 ? 'اليوم' : `منذ ${daysAgo} يوم`;
    const timeColor = daysAgo > 14 ? 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900' : daysAgo > 7 ? 'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900' : 'text-gray-500 bg-gray-100 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if(isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const UserAvatar: React.FC<{ user: User | undefined, label: string, isSmall?: boolean }> = ({ user, label, isSmall }) => {
        if (!user) return null;
        return (
            <div className={`relative group/user cursor-help ${isSmall ? 'w-6 h-6 -ml-2' : 'w-8 h-8'}`}>
                <div className={`w-full h-full rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-sm ${!user.avatar ? 'bg-primary flex items-center justify-center text-white text-xs font-bold' : ''}`}>
                    {user.avatar ? <img src={user.avatar} alt={user.username} className="w-full h-full object-cover"/> : user.username.charAt(0).toUpperCase()}
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover/user:opacity-100 transition-opacity z-20 pointer-events-none">
                    {label}: {user.username}
                </div>
            </div>
        );
    };

    const canPrintInvoice = order.status === OrderStatus.ORDERED;

    return (
        <div className={`
            bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 
            flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group
            ${isLate ? 'ring-2 ring-red-500/50' : ''}
            ${order.status === OrderStatus.CANCELLED ? 'opacity-75 grayscale' : ''}
        `}>
            {/* Status Indicator Bar */}
            <div className={`h-1.5 w-full ${isCompleted ? 'bg-green-500' : isStored ? 'bg-blue-500' : isLate ? 'bg-red-500' : 'bg-primary'}`}></div>

            {/* Header */}
            <div className="p-4 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-black text-gray-800 dark:text-white font-mono tracking-tight cursor-pointer hover:text-primary transition-colors" onClick={onView}>
                            {order.localOrderId}
                        </h3>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleCopy(order.localOrderId, 'local'); }}
                            className="text-gray-300 hover:text-primary transition-colors"
                        >
                            {copied === 'local' ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.bgColor} ${statusInfo.color} border-current border-opacity-20`}>
                            {t(statusInfo.name as any)}
                        </span>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 font-mono">
                                {new Date(order.orderDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${timeColor} flex items-center gap-1`}>
                                <Clock size={10}/> {daysText}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="relative" ref={menuRef}>
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors">
                        <MoreVertical size={18}/>
                    </button>
                    {isMenuOpen && (
                        <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl z-20 overflow-hidden text-sm font-medium animate-in fade-in zoom-in-95 duration-150 origin-top-left">
                            <button onClick={() => { onHistory(); setIsMenuOpen(false); }} className="w-full text-right px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <ScrollText size={16} className="text-blue-500"/> {t('history')}
                            </button>
                            {currentUser?.permissions.orders.edit && order.status !== OrderStatus.CANCELLED && (
                                <button onClick={() => { onEdit(); setIsMenuOpen(false); }} className="w-full text-right px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <Edit2 size={16} className="text-green-500"/> {t('edit')}
                                </button>
                            )}
                            {currentUser?.permissions.orders.create && order.status === OrderStatus.NEW && order.quantity > 1 && (
                                <button onClick={() => { onSplit(); setIsMenuOpen(false); }} className="w-full text-right px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <div className="rotate-90"><MoreVertical size={16} className="text-orange-500"/></div> {t('splitOrder')}
                                </button>
                            )}
                            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                            {currentUser?.permissions.orders.delete && (
                                <button onClick={() => { order.status === OrderStatus.ORDERED ? onCancel() : onDelete(); setIsMenuOpen(false); }} className="w-full text-right px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600">
                                    {order.status === OrderStatus.ORDERED ? <Ban size={16}/> : <Trash2 size={16}/>} 
                                    {order.status === OrderStatus.ORDERED ? t('cancel') : t('delete')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="px-4 pb-4 space-y-3">
                {/* Grid Layout for Details */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                    {/* Client */}
                    <div className="col-span-2 flex items-center gap-2 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-lg border border-gray-100 dark:border-gray-700/50">
                        <UserIcon size={14} className="text-gray-400"/>
                        <span className="font-bold truncate">{client?.name || '---'}</span>
                        <div className="h-3 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                        <Phone size={12} className="text-gray-400"/>
                        <span className="font-mono text-xs text-gray-500">{client?.phone}</span>
                    </div>

                    {/* Store & Shipping */}
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2 rounded-lg">
                        {store?.logo ? <img src={store.logo} className="w-4 h-4 object-contain"/> : <StoreIcon size={14}/>}
                        <span className="truncate text-xs font-semibold">{store?.name}</span>
                    </div>
                    <div className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-bold ${isFastShipping ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30' : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30'}`}>
                        {isFastShipping ? <Zap size={12}/> : <ShippingTruckIcon size={12}/>}
                        <span>{isFastShipping ? t('fast') : t('normal')}</span>
                    </div>
                </div>

                {/* Tracking & Location (if available) */}
                {(order.trackingNumber || order.storageLocation) && (
                    <div className="flex gap-2">
                        {order.trackingNumber && (
                            <div className="flex-1 flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-700/30 rounded border border-gray-100 dark:border-gray-700/50 text-xs">
                                <span className="text-gray-500 flex items-center gap-1"><Hash size={12}/> {t('tracking')}</span>
                                <span className="font-mono font-bold text-gray-700 dark:text-gray-300 truncate max-w-[80px]" title={order.trackingNumber}>{order.trackingNumber}</span>
                            </div>
                        )}
                        {order.storageLocation && (
                            <div className="flex-1 flex items-center justify-between px-2 py-1.5 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-900/30 text-xs">
                                <span className="text-green-700 dark:text-green-300 flex items-center gap-1"><Grid3X3 size={12}/> {t('location')}</span>
                                <span className="font-bold text-green-800 dark:text-green-200">{order.storageLocation}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Financial Progress */}
                <div>
                    <div className="flex justify-between items-end mb-1 text-[10px]">
                        <span className="text-gray-400 font-medium">المدفوعات</span>
                        <span className={`font-mono font-bold ${remaining > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {remaining > 0 ? `-${remaining.toLocaleString()}` : 'خالص'}
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${percentPaid >= 100 ? 'bg-green-500' : percentPaid > 0 ? 'bg-orange-400' : 'bg-gray-300'}`} 
                            style={{ width: `${percentPaid}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] font-mono text-gray-400">
                        <span>{amountPaid.toLocaleString()}</span>
                        <span>{totalCost.toLocaleString()} MRU</span>
                    </div>
                </div>
            </div>

            {/* Footer Actions & Users */}
            <div className="mt-auto px-4 py-3 bg-gray-50 dark:bg-gray-700/20 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center gap-3">
                
                {/* Actions Group */}
                <div className="flex gap-2">
                    <button onClick={onView} className="p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 hover:text-primary hover:border-primary transition-colors shadow-sm">
                        <Eye size={16}/>
                    </button>
                    {canPrintInvoice && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onPrintInvoice(order); }}
                            className={`p-2 rounded-lg transition-colors border shadow-sm ${order.isInvoicePrinted ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-blue-600 border-gray-200 hover:border-blue-400 hover:text-blue-700'}`}
                            title={order.isInvoicePrinted ? t('invoicePrinted') : t('printInvoice')}
                        >
                            {order.isInvoicePrinted ? <CheckCircle size={16}/> : <Printer size={16}/>}
                        </button>
                    )}
                </div>

                {/* Right Side: Status Action or Avatars */}
                <div className="flex items-center gap-2">
                    {/* User Avatars */}
                    <div className="flex items-center pl-2">
                        {creator && <UserAvatar user={creator} label="أنشئ بواسطة" />}
                        {editor && editor.id !== creator?.id && <UserAvatar user={editor} label="آخر تعديل" isSmall />}
                    </div>

                    {currentUser?.permissions.orders.changeStatus && !isCompleted && order.status !== OrderStatus.CANCELLED && (
                        <button 
                            onClick={onChangeStatus} 
                            className="flex items-center justify-center gap-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors shadow-md"
                        >
                            <Zap size={14} className={isStored ? 'text-yellow-400' : 'text-primary-light'}/>
                            <span className="hidden sm:inline">{isStored ? t('deliver') : t('updateStatus')}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

const OrdersPage: React.FC<OrdersPageProps> = ({ orders, setOrders, clients, stores, currencies, shippingCompanies, activeFilter, clearFilter, commissionRate, drawers, paymentMethods, settings, shouldOpenModal, onModalOpenHandled, companyInfo, users }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const { showToast } = useToast();
    
    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(() => {
        return localStorage.getItem('isOrderFormOpen') === 'true';
    });

    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
    const [isPrintModalOpen, setPrintModalOpen] = useState(false);
    const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
    
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
    const [fetchedHistory, setFetchedHistory] = useState<ActivityLog[]>([]);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [storeFilter, setStoreFilter] = useState<string>('all');

    // Pagination
    const [displayLimit, setDisplayLimit] = useState(20);

    // Save modal state
    useEffect(() => {
        localStorage.setItem('isOrderFormOpen', String(isFormOpen));
    }, [isFormOpen]);

    useEffect(() => {
        if (activeFilter) {
            const isStatus = Object.values(OrderStatus).includes(activeFilter as OrderStatus);

            if (activeFilter === 'all') {
                setStatusFilter('all');
                setSearchTerm('');
            } else if (isStatus) {
                setStatusFilter(activeFilter);
                setSearchTerm('');
            } else if (activeFilter === 'late') {
                setSearchTerm(''); 
            } else if (activeFilter === 'needs_tracking') {
                setStatusFilter(OrderStatus.ORDERED);
                setSearchTerm('');
            } else if (activeFilter === 'needs_whatsapp') {
                setStatusFilter(OrderStatus.STORED);
                setSearchTerm('');
            } else if (activeFilter === 'ready_billing') {
                setStatusFilter(OrderStatus.STORED);
                setSearchTerm('');
            } else {
                setSearchTerm(activeFilter);
                setStatusFilter('all');
                setStoreFilter('all');
            }
        }
    }, [activeFilter]);

    useEffect(() => {
        if (shouldOpenModal) {
            handleOpenForm(null);
            if (onModalOpenHandled) onModalOpenHandled();
        }
    }, [shouldOpenModal, onModalOpenHandled]);

    useEffect(() => {
        setDisplayLimit(20);
    }, [searchTerm, statusFilter, storeFilter, orders]);

    const logAction = async (action: string, entityType: GlobalActivityLog['entityType'], entityId: string, details: string) => {
        if (!supabase) return;
        const user = currentUser?.username || 'System';
        try {
            await supabase.from('GlobalActivityLog').insert({
                timestamp: new Date().toISOString(),
                user,
                action,
                entity_type: entityType,
                entity_id: entityId,
                details
            });
        } catch (e) {
            console.error("Failed to log", e);
        }
    };

    const mapOrderToDB = (o: Order) => ({
        local_order_id: o.localOrderId,
        global_order_id: o.globalOrderId,
        client_id: o.clientId,
        store_id: o.storeId,
        price: o.price,
        currency: o.currency,
        price_in_mru: o.priceInMRU,
        commission: o.commission,
        quantity: o.quantity,
        amount_paid: o.amountPaid,
        payment_method: o.paymentMethod,
        shipping_type: o.shippingType,
        order_date: o.orderDate,
        expected_arrival_date: o.expectedArrivalDate,
        status: o.status,
        tracking_number: o.trackingNumber,
        weight: o.weight,
        shipping_cost: o.shippingCost,
        storage_location: o.storageLocation,
        storage_date: o.storageDate,
        receipt_image: o.receiptImage,
        receipt_images: o.receiptImages,
        whatsapp_notification_sent: o.whatsappNotificationSent,
        shipment_id: o.shipmentId,
        box_id: o.boxId,
        origin_center: o.originCenter,
        receiving_company_id: o.receivingCompanyId,
        history: o.history,
        product_links: o.productLinks,
        product_images: o.productImages,
        hub_arrival_images: o.hubArrivalImages,
        weighing_images: o.weighingImages,
        order_images: o.orderImages,
        notes: o.notes,
        commission_type: o.commissionType,
        commission_rate: o.commissionRate,
        is_invoice_printed: o.isInvoicePrinted 
    });

    const mapDBToOrder = (data: any): Order => ({
        ...data,
        localOrderId: data.local_order_id,
        globalOrderId: data.global_order_id,
        clientId: data.client_id,
        store_id: data.store_id,
        priceInMRU: data.price_in_mru,
        amountPaid: data.amount_paid,
        shippingType: data.shipping_type,
        orderDate: data.order_date,
        expectedArrivalDate: data.expected_arrival_date,
        trackingNumber: data.tracking_number,
        shippingCost: data.shipping_cost,
        storageLocation: data.storage_location,
        shipmentId: data.shipment_id,
        boxId: data.box_id,
        productLinks: data.product_links,
        productImages: data.product_images,
        commissionType: data.commission_type,
        commissionRate: data.commission_rate,
        receiptImage: data.receipt_image, 
        receiptImages: data.receipt_images, 
        paymentMethod: data.payment_method, 
        whatsappNotificationSent: data.whatsapp_notification_sent, 
        hubArrivalImages: data.hub_arrival_images,
        weighingImages: data.weighing_images,
        orderImages: data.order_images,
        originCenter: data.origin_center,
        receivingCompanyId: data.receiving_company_id,
        arrivalDateAtOffice: data.arrival_date_at_office,
        storageDate: data.storage_date,
        withdrawalDate: data.withdrawal_date,
        isInvoicePrinted: data.is_invoice_printed,
        id: data.id,
        history: data.history || []
    });

    const handleOpenForm = async (order: Order | null) => {
        if (order) {
            try {
                const { data, error } = await supabase!
                    .from('Orders')
                    .select('*')
                    .eq('id', order.id)
                    .single();
                
                if (data && !error) {
                    const fullOrder = mapDBToOrder(data);
                    setSelectedOrder(fullOrder);
                } else {
                    setSelectedOrder(order); 
                }
            } catch (e) {
                console.error("Failed to fetch full order for edit", e);
                setSelectedOrder(order);
            }
        } else {
            setSelectedOrder(null);
        }
        setIsFormOpen(true);
    };

    const handleOpenHistory = async (order: Order) => {
        setHistoryOrder(order);
        setFetchedHistory(order.history || []); 
        setIsHistoryOpen(true);

        if (!order.history || order.history.length <= 1) {
            try {
                const { data } = await supabase!.from('Orders').select('history').eq('id', order.id).single();
                if (data && data.history) {
                    setFetchedHistory(data.history);
                }
            } catch (e) {
                console.error("Failed to fetch history", e);
            }
        }
    };

    const handleSaveOrder = async (orderData: Order) => {
        if (!supabase) return;
        const user = currentUser?.username || 'System';
        
        try {
            let dbPayload = mapOrderToDB(orderData);
            
            const performOperation = async (payload: any) => {
                if (orderData.id) { 
                    return await supabase.from('Orders').update(payload).eq('id', orderData.id).select().single();
                } else { 
                    payload.history = [{ timestamp: new Date().toISOString(), activity: 'Order Created', user }];
                    return await supabase.from('Orders').insert(payload).select().single();
                }
            };

            let { data, error } = await performOperation(dbPayload);

            if (error && error.code === 'PGRST204' && error.message.includes('receipt_images')) {
                const { receipt_images, ...legacyPayload } = dbPayload;
                const retry = await performOperation(legacyPayload);
                data = retry.data;
                error = retry.error;
                if (!error) {
                    showToast(t('success'), 'warning');
                }
            }

            if (error) throw error;

            if (orderData.id) {
                setOrders(prev => prev.map(o => o.id === orderData.id ? mapDBToOrder(data) : o));
                showToast(t('success'), 'success');
                logAction('Update Order', 'Order', orderData.id, `Updated order: ${orderData.localOrderId}`);
            } else {
                setOrders(prev => [mapDBToOrder(data), ...prev]);
                showToast(t('success'), 'success');
                logAction('Create Order', 'Order', data.id, `Created new order: ${orderData.localOrderId}`);
            }
            
            localStorage.removeItem('orderDraft');
            
            setIsFormOpen(false);
        } catch (error: any) {
            console.error("Save error:", JSON.stringify(error, null, 2));
            showToast(t('error') + ': ' + getErrorMessage(error), 'error');
        }
    };

    const handleUpdateStatus = async (orderId: string, payload: Partial<Order>) => {
        if (!supabase) return;
        const user = currentUser?.username || 'System';
        
        const { data: currentOrderData, error: fetchError } = await supabase
            .from('Orders')
            .select('history, status, order_images, hub_arrival_images, weighing_images, shipping_type')
            .eq('id', orderId)
            .single();

        if (fetchError || !currentOrderData) {
            showToast(t('error'), 'error');
            return;
        }

        const currentOrder = currentOrderData as any;
        const currentHistory = currentOrder.history || [];
        const currentStatus = currentOrder.status; 
        
        let activityText = 'Updated Details';
        let actionDesc = 'Update Details';

        if (payload.storageLocation) {
            activityText = `Stored at ${payload.storageLocation}`;
            actionDesc = 'Store Order';
        } else if (payload.trackingNumber) {
            activityText = `Added Tracking: ${payload.trackingNumber}`;
            actionDesc = 'Add Tracking';
        } else if (payload.globalOrderId) {
            activityText = `Added Global ID: ${payload.globalOrderId}`;
            actionDesc = 'Add Global ID';
        }

        const newLog: ActivityLog = { timestamp: new Date().toISOString(), activity: activityText, user };
        const updatedHistory = [...currentHistory, newLog];
        
        let nextStatus = currentStatus;
        if(currentStatus === OrderStatus.NEW) nextStatus = OrderStatus.ORDERED;
        else if(currentStatus === OrderStatus.ORDERED) nextStatus = OrderStatus.SHIPPED_FROM_STORE;
        else if(currentStatus === OrderStatus.SHIPPED_FROM_STORE) nextStatus = OrderStatus.ARRIVED_AT_HUB;
        else if(currentStatus === OrderStatus.ARRIVED_AT_HUB) nextStatus = OrderStatus.IN_TRANSIT; 
        else if(currentStatus === OrderStatus.IN_TRANSIT) nextStatus = OrderStatus.ARRIVED_AT_OFFICE; 
        else if(currentStatus === OrderStatus.ARRIVED_AT_OFFICE) nextStatus = OrderStatus.STORED;

        const dbUpdatePayload: any = {
            status: nextStatus,
            history: updatedHistory
        };

        if (payload.trackingNumber) dbUpdatePayload.tracking_number = payload.trackingNumber;
        if (payload.weight) dbUpdatePayload.weight = payload.weight;
        if (payload.shippingCost) dbUpdatePayload.shipping_cost = payload.shippingCost;
        if (payload.shippingType) dbUpdatePayload.shipping_type = payload.shippingType;
        if (payload.storageLocation) {
            dbUpdatePayload.storage_location = payload.storageLocation;
            dbUpdatePayload.storage_date = new Date().toISOString();
        }
        if (payload.globalOrderId) dbUpdatePayload.global_order_id = payload.globalOrderId;
        if (payload.originCenter) dbUpdatePayload.origin_center = payload.originCenter;
        if (payload.receivingCompanyId) dbUpdatePayload.receiving_company_id = payload.receivingCompanyId;
        
        if (payload.arrivalDateAtOffice) dbUpdatePayload.arrival_date_at_office = payload.arrivalDateAtOffice;

        if (payload.orderImages && payload.orderImages.length > 0) {
             dbUpdatePayload.order_images = [...(currentOrder.order_images || []), ...payload.orderImages];
        }
        if (payload.hubArrivalImages && payload.hubArrivalImages.length > 0) {
             dbUpdatePayload.hub_arrival_images = [...(currentOrder.hub_arrival_images || []), ...payload.hubArrivalImages];
        }
        if (payload.weighingImages && payload.weighingImages.length > 0) {
             dbUpdatePayload.weighing_images = [...(currentOrder.weighing_images || []), ...payload.weighingImages];
        }
        
        try {
            const { error } = await supabase.from('Orders').update(dbUpdatePayload).eq('id', orderId);
            if (error) throw error;

            const localUpdate: Partial<Order> = {
                status: nextStatus,
                history: updatedHistory
            };
            
            if (dbUpdatePayload.tracking_number) localUpdate.trackingNumber = dbUpdatePayload.tracking_number;
            if (dbUpdatePayload.weight) localUpdate.weight = dbUpdatePayload.weight;
            if (dbUpdatePayload.shipping_cost) localUpdate.shippingCost = dbUpdatePayload.shipping_cost;
            if (dbUpdatePayload.shipping_type) localUpdate.shippingType = dbUpdatePayload.shipping_type;
            if (dbUpdatePayload.storage_location) {
                localUpdate.storageLocation = dbUpdatePayload.storage_location;
                localUpdate.storageDate = dbUpdatePayload.storage_date;
            }
            if (dbUpdatePayload.global_order_id) localUpdate.globalOrderId = dbUpdatePayload.global_order_id;
            if (dbUpdatePayload.origin_center) localUpdate.originCenter = dbUpdatePayload.origin_center;
            if (dbUpdatePayload.receiving_company_id) localUpdate.receivingCompanyId = dbUpdatePayload.receiving_company_id;
            if (dbUpdatePayload.arrival_date_at_office) localUpdate.arrivalDateAtOffice = dbUpdatePayload.arrival_date_at_office;

            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...localUpdate } : o));
            showToast(t('success'), 'success');
            setIsStatusOpen(false);
            
            logAction(actionDesc, 'Order', orderId, `${activityText} - New Status: ${nextStatus}`);

        } catch(e: any) {
            showToast(t('error') + ': ' + getErrorMessage(e), 'error');
        }
    };

    const handleRevertStatus = async (orderId: string, password?: string) => {
        if (!supabase) return false;
        
        const { data: currentOrder, error: fetchError } = await supabase
            .from('Orders')
            .select('history, status')
            .eq('id', orderId)
            .single();

        if (fetchError || !currentOrder) {
             showToast(t('error'), 'error');
             return false;
        }

        const statusOrder = [
            OrderStatus.NEW, OrderStatus.ORDERED, OrderStatus.SHIPPED_FROM_STORE, 
            OrderStatus.ARRIVED_AT_HUB, OrderStatus.IN_TRANSIT, OrderStatus.ARRIVED_AT_OFFICE, 
            OrderStatus.STORED, OrderStatus.COMPLETED
        ];
        const currentIndex = statusOrder.indexOf(currentOrder.status as OrderStatus);
        
        if(currentIndex <= 0) return false;

        const prevStatus = statusOrder[currentIndex - 1];
        const user = currentUser?.username || 'System';
        const prevStatusName = t(STATUS_DETAILS[prevStatus].name as any);
        const currentStatusName = t(STATUS_DETAILS[currentOrder.status as OrderStatus].name as any);

        const newLog: ActivityLog = { 
            timestamp: new Date().toISOString(), 
            activity: `Reverted status from ${currentStatusName} to ${prevStatusName}`, 
            user 
        };

        const updatedHistory = [...(currentOrder.history || []), newLog];

        try {
            const { error } = await supabase.from('Orders').update({
                status: prevStatus,
                history: updatedHistory
            }).eq('id', orderId);

            if(error) throw error;

            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: prevStatus, history: updatedHistory } : o));
            showToast(t('success'), 'success');
            setIsStatusOpen(false);
            logAction('Revert Status', 'Order', orderId, `Reverted status from ${currentOrder.status} to ${prevStatus}`);
            return true;
        } catch(e: any) {
            showToast(t('error') + ': ' + getErrorMessage(e), 'error');
            return false;
        }
    };

    const handleSplitOrder = async (originalOrderId: string, splitDetails: { quantity: number; trackingNumber: string; globalOrderId?: string; priceAdjustment?: number }) => {
        if (!supabase) return;
        const user = currentUser?.username || 'System';
        const originalOrder = orders.find(o => o.id === originalOrderId);
        
        if (!originalOrder) return;

        try {
            const newOrderId = originalOrder.localOrderId + '-S'; 
            
            const remainingQty = originalOrder.quantity - splitDetails.quantity;
            const remainingPrice = (originalOrder.priceInMRU || 0) - (splitDetails.priceAdjustment || 0);
            
            let remainingCommission = originalOrder.commission || 0;
            let newOrderCommission = 0;

            if (originalOrder.commissionType === 'percentage') {
                remainingCommission = Math.round(remainingPrice * ((originalOrder.commissionRate || 0) / 100));
                newOrderCommission = Math.round((splitDetails.priceAdjustment || 0) * ((originalOrder.commissionRate || 0) / 100));
            } else {
                const unitComm = (originalOrder.commission || 0) / originalOrder.quantity;
                remainingCommission = Math.round(unitComm * remainingQty);
                newOrderCommission = Math.round(unitComm * splitDetails.quantity);
            }

            const updateLog: ActivityLog = { timestamp: new Date().toISOString(), activity: `Split Order. Moved ${splitDetails.quantity} items to ${newOrderId}.`, user };
            
            await supabase.from('Orders').update({
                quantity: remainingQty,
                price_in_mru: remainingPrice,
                commission: remainingCommission,
                history: [...(originalOrder.history || []), updateLog]
            }).eq('id', originalOrderId);

            const newOrderPayload: Partial<Order> = {
                ...originalOrder,
                id: undefined, 
                localOrderId: newOrderId,
                globalOrderId: splitDetails.globalOrderId || undefined,
                quantity: splitDetails.quantity,
                priceInMRU: splitDetails.priceAdjustment,
                commission: newOrderCommission,
                trackingNumber: splitDetails.trackingNumber,
                status: OrderStatus.NEW, 
                history: [{ timestamp: new Date().toISOString(), activity: `Created as split from ${originalOrder.localOrderId}`, user }]
            };
            
            delete newOrderPayload.id;
            delete newOrderPayload.receiptImage;
            delete newOrderPayload.storageLocation;
            delete newOrderPayload.storageDate;

            const dbPayload = mapOrderToDB(newOrderPayload as Order);
            const { data: newOrderData, error: createError } = await supabase.from('Orders').insert(dbPayload).select().single();
            
            if (createError) throw createError;

            setOrders(prev => {
                const updated = prev.map(o => o.id === originalOrderId ? { 
                    ...o, 
                    quantity: remainingQty, 
                    priceInMRU: remainingPrice, 
                    commission: remainingCommission,
                    history: [...(o.history || []), updateLog] 
                } : o);
                return [mapDBToOrder(newOrderData), ...updated];
            });

            showToast(t('success'), 'success');
            setIsSplitModalOpen(false);
            logAction('Split Order', 'Order', originalOrderId, `Split order ${originalOrder.localOrderId} into ${newOrderId}`);

        } catch (e: any) {
            console.error("Split Error:", e);
            showToast(t('error') + ': ' + getErrorMessage(e), 'error');
        }
    };

    const handleOpenSplit = (order: Order) => {
        setSelectedOrder(order);
        setIsSplitModalOpen(true);
    };

    const confirmDeleteOrder = async (password: string) => {
        if (!supabase || !selectedOrder) return;
        
        try {
            const { error } = await supabase.from('Orders').delete().eq('id', selectedOrder.id);
            if(error) throw error;
            
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            showToast(t('success'), 'success');
            logAction('Delete Order', 'Order', selectedOrder.id, `Deleted order: ${selectedOrder.localOrderId}`);
        } catch(e: any) {
            showToast(t('error') + ': ' + getErrorMessage(e), 'error');
        } finally {
            setIsDeleteModalOpen(false);
            setSelectedOrder(null);
        }
    };

    const confirmCancelOrder = async (password: string, reason?: string) => {
        if (!supabase || !selectedOrder) return;
        
        const user = currentUser?.username || 'System';
        const newLog: ActivityLog = { 
            timestamp: new Date().toISOString(), 
            activity: `Order Cancelled. Reason: ${reason || 'N/A'}`, 
            user 
        };

        try {
            const { error } = await supabase.from('Orders').update({
                status: OrderStatus.CANCELLED,
                notes: reason ? `${selectedOrder.notes || ''}\n[Cancel]: ${reason}` : selectedOrder.notes,
                history: [...(selectedOrder.history || []), newLog]
            }).eq('id', selectedOrder.id);

            if (error) throw error;

            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { 
                ...o, 
                status: OrderStatus.CANCELLED, 
                history: [...(o.history || []), newLog],
                notes: reason ? `${o.notes || ''}\n[Cancel]: ${reason}` : o.notes
            } : o));

            showToast(t('success'), 'success');
            logAction('Cancel Order', 'Order', selectedOrder.id, `Cancelled order: ${selectedOrder.localOrderId}. Reason: ${reason}`);

        } catch (e: any) {
            showToast(t('error') + ': ' + getErrorMessage(e), 'error');
        } finally {
            setIsCancelModalOpen(false);
            setSelectedOrder(null);
        }
    };

    const handlePrintRequest = (order: Order) => {
        setOrderToPrint(order);
        setPrintModalOpen(true);
    };

    const confirmPrintInvoice = (lang: PrintLanguage) => {
        if (!orderToPrint) return;
        
        const order = orderToPrint;
        const client = clients.find(c => c.id === order.clientId);
        const store = stores.find(s => s.id === order.storeId);
        
        const printWindow = window.open('', '_blank', 'width=900,height=800,scrollbars=yes');
        
        if (!printWindow) {
            showToast('Popup blocked', 'error');
            return;
        }

        const price = (order.priceInMRU || 0) / (order.quantity || 1); 
        const total = (order.priceInMRU || 0) + (order.commission || 0) + (order.shippingCost || 0);
        const paid = order.amountPaid || 0;
        const due = total - paid;

        let desc = 'طلب شراء';
        let shipDesc = 'رسوم الشحن';
        if (lang === 'en') {
            desc = 'Purchase Order';
            shipDesc = 'Shipping Cost';
        } else if (lang === 'fr') {
            desc = 'Commande';
            shipDesc = 'Frais de livraison';
        }

        const invoiceItems = [
            { desc: `${desc} - ${store?.name || ''}`, qty: order.quantity, price: price + ((order.commission || 0)/order.quantity), total: (order.priceInMRU || 0) + (order.commission || 0) }
        ];

        if (order.shippingCost && order.shippingCost > 0) {
            const shipType = order.shippingType === 'fast' ? (lang === 'ar' ? 'سريع' : lang === 'fr' ? 'Rapide' : 'Fast') : (lang === 'ar' ? 'عادي' : lang === 'fr' ? 'Normal' : 'Standard');
            invoiceItems.push({
                desc: `${shipDesc} (${shipType} - ${order.weight}kg)`,
                qty: 1,
                price: order.shippingCost,
                total: order.shippingCost
            });
        }

        let title = 'فاتورة طلبية';
        if (lang === 'en') title = 'Order Invoice';
        if (lang === 'fr') title = 'Facture de commande';

        const htmlContent = generateInvoiceHTML(
            title,
            order,
            new Date().toLocaleDateString('en-GB'),
            { name: client?.name || '---', phone: client?.phone || '', address: client?.address },
            companyInfo || { name: 'Fast Comand', phone: '', address: '', email: '', logo: '' },
            store || { id: '', name: '---', estimatedDeliveryDays: 0 },
            `Invoice: ${order.localOrderId} | Due: ${due} MRU`,
            lang
        );

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        setPrintModalOpen(false);
        setOrderToPrint(null);

        if (!order.isInvoicePrinted && supabase) {
            try {
                supabase.from('Orders').update({
                    is_invoice_printed: true
                }).eq('id', order.id).then(({ error }) => {
                    if (!error) {
                        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isInvoicePrinted: true } : o));
                        showToast(t('invoicePrinted'), 'success');
                    }
                });
            } catch (e: any) {
                console.error("Error updating print status", e);
            }
        }
    };

    const handleOpenDelete = (order: Order) => {
        setSelectedOrder(order);
        setIsDeleteModalOpen(true);
    };

    const handleOpenCancel = (order: Order) => {
        setSelectedOrder(order);
        setIsCancelModalOpen(true);
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            if (statusFilter !== 'all' && order.status !== statusFilter) return false;
            
            if (storeFilter !== 'all' && order.storeId !== storeFilter) return false;

            const searchLower = searchTerm.toLowerCase();
            const client = clients.find(c => c.id === order.clientId);
            const store = stores.find(s => s.id === order.storeId);
            
            return (
                order.localOrderId.toLowerCase().includes(searchLower) ||
                (order.globalOrderId || '').toLowerCase().includes(searchLower) ||
                (order.trackingNumber || '').toLowerCase().includes(searchLower) ||
                (client?.name || '').toLowerCase().includes(searchLower) ||
                (client?.phone || '').includes(searchLower) ||
                (store?.name || '').toLowerCase().includes(searchLower)
            );
        });
    }, [orders, statusFilter, storeFilter, searchTerm, clients, stores]);

    const visibleOrders = useMemo(() => {
        return filteredOrders.slice(0, displayLimit);
    }, [filteredOrders, displayLimit]);

    const handleLoadMore = () => {
        setDisplayLimit(prev => prev + 20);
    };

    return (
        <>
            <PrintLanguageModal 
                isOpen={isPrintModalOpen}
                onClose={() => setPrintModalOpen(false)}
                onConfirm={confirmPrintInvoice}
            />

            <OrderFormModal
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); localStorage.removeItem('isOrderFormOpen'); }}
                onSave={handleSaveOrder}
                order={selectedOrder}
                clients={clients}
                stores={stores}
                currencies={currencies}
                commissionRate={commissionRate}
                orders={orders}
                paymentMethods={paymentMethods}
                settings={settings}
            />

            <OrderStatusModal
                isOpen={isStatusOpen}
                onClose={() => setIsStatusOpen(false)}
                order={selectedOrder}
                allOrders={orders}
                drawers={drawers}
                clients={clients}
                onUpdate={handleUpdateStatus}
                onRevert={handleRevertStatus}
                shippingCompanies={shippingCompanies}
                settings={settings}
            />

            <HistoryLogModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                history={fetchedHistory}
                title={`${t('history')} ${historyOrder?.localOrderId}`}
            />

            <OrderDetailsModal
                isOpen={!!viewingOrder}
                onClose={() => setViewingOrder(null)}
                order={viewingOrder}
                client={clients.find(c => c.id === viewingOrder?.clientId)}
                store={stores.find(s => s.id === viewingOrder?.storeId)}
                shippingCompanies={shippingCompanies}
            />

            <SplitOrderModal
                isOpen={isSplitModalOpen}
                onClose={() => setIsSplitModalOpen(false)}
                onSplit={handleSplitOrder}
                order={selectedOrder}
            />

            <PasswordConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDeleteOrder}
                title={t('confirmDelete')}
                message={t('deleteWarning')}
                confirmButtonText={t('delete')}
                confirmButtonColor="bg-red-600"
            />

            <PasswordConfirmationModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={confirmCancelOrder}
                title={t('confirmCancel')}
                message={t('deleteWarning')}
                requireReason={true}
                confirmButtonText={t('cancel')}
                confirmButtonColor="bg-orange-600"
            />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-3xl font-bold text-text-light dark:text-text-dark">{t('manageOrders')}</h2>
                    
                    <div className="flex gap-2">
                        {activeFilter && (
                            <button onClick={clearFilter} className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors">
                                <X size={16}/> {t('clearFilter')}
                            </button>
                        )}
                        {currentUser?.permissions.orders.create && (
                            <button onClick={() => handleOpenForm(null)} className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow-md hover:bg-primary-dark transition-all transform hover:scale-105">
                                <PlusCircle size={20} /> <span>{t('newOrder')}</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-grow w-full md:w-auto">
                        <input 
                            type="text" 
                            placeholder={t('searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-none rounded-lg focus:ring-2 focus:ring-primary text-gray-700 dark:text-gray-200"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <Filter size={20} className="text-gray-400 flex-shrink-0"/>
                        
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-700/50 border-none rounded-lg py-2 px-4 text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer"
                        >
                            <option value="all">{t('allStatuses')}</option>
                            {Object.values(OrderStatus).map(status => (
                                <option key={status} value={status}>{t(STATUS_DETAILS[status].name as any)}</option>
                            ))}
                        </select>

                        <div className="relative group">
                            <StoreIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"/>
                            <select 
                                value={storeFilter} 
                                onChange={(e) => setStoreFilter(e.target.value)}
                                className="bg-gray-50 dark:bg-gray-700/50 border-none rounded-lg py-2 pr-9 pl-4 text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary cursor-pointer appearance-none min-w-[140px]"
                            >
                                <option value="all">{t('allStores')}</option>
                                {stores.map(store => (
                                    <option key={store.id} value={store.id}>{store.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {visibleOrders.map(order => (
                        <OrderCard 
                            key={order.id} 
                            order={order} 
                            client={clients.find(c => c.id === order.clientId)}
                            store={stores.find(s => s.id === order.storeId)}
                            users={users}
                            onEdit={() => handleOpenForm(order)}
                            onDelete={() => handleOpenDelete(order)}
                            onCancel={() => handleOpenCancel(order)}
                            onChangeStatus={() => { setSelectedOrder(order); setIsStatusOpen(true); }}
                            onHistory={() => handleOpenHistory(order)}
                            onView={() => setViewingOrder(order)}
                            onSplit={() => handleOpenSplit(order)}
                            onPrintInvoice={() => handlePrintRequest(order)}
                        />
                    ))}
                </div>

                {filteredOrders.length > visibleOrders.length && (
                    <div className="flex justify-center pt-4 pb-8">
                        <button 
                            onClick={handleLoadMore}
                            className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-6 py-3 rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-gray-600 dark:text-gray-300 font-semibold"
                        >
                            <ChevronDown size={20}/> {t('showMore')} ({filteredOrders.length - visibleOrders.length})
                        </button>
                    </div>
                )}

                {filteredOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <PackageX size={64} className="mb-4 opacity-20"/>
                        <p className="text-lg font-medium">{t('noOrdersFound')}</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default OrdersPage;
