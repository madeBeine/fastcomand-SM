
import React, { useEffect, useState } from 'react';
import type { Order, Client, Store, ShippingCompany } from '../types';
import { STATUS_DETAILS } from '../constants';
import { X, User, Store as StoreIcon, Calendar, DollarSign, Truck, MapPin, Package, FileText, Image as ImageIcon, Scale, Globe, Building, Copy, Check, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface OrderDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
    client?: Client;
    store?: Store;
    shippingCompanies: ShippingCompany[];
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, order: initialOrder, client, store, shippingCompanies }) => {
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const [fullOrder, setFullOrder] = useState<Order | null>(null);
    const [isLoadingImages, setIsLoadingImages] = useState(false);

    useEffect(() => {
        if (isOpen && initialOrder) {
            setFullOrder(initialOrder); 
            
            const fetchImages = async () => {
                if (!supabase) return;
                setIsLoadingImages(true);
                try {
                    const { data, error } = await supabase
                        .from('Orders')
                        .select('product_images, order_images, hub_arrival_images, weighing_images, receipt_image, receipt_images')
                        .eq('id', initialOrder.id)
                        .single();
                    
                    if (data && !error) {
                        setFullOrder(prev => prev ? ({
                            ...prev,
                            productImages: (data as any).product_images || [],
                            orderImages: (data as any).order_images || [],
                            hubArrivalImages: (data as any).hub_arrival_images || [],
                            weighingImages: (data as any).weighing_images || [],
                            receiptImage: (data as any).receipt_image,
                            // Ensure array is prioritized
                            receiptImages: (data as any).receipt_images && (data as any).receipt_images.length > 0 
                                ? (data as any).receipt_images 
                                : ((data as any).receipt_image ? [(data as any).receipt_image] : [])
                        }) : null);
                    }
                } catch (e) {
                    console.error("Failed to load images", e);
                } finally {
                    setIsLoadingImages(false);
                }
            };
            fetchImages();
        }
    }, [isOpen, initialOrder]);

    if (!isOpen || !fullOrder) return null;

    const statusInfo = STATUS_DETAILS[fullOrder.status] || { name: fullOrder.status || 'غير معروف', color: 'text-gray-500', bgColor: 'bg-gray-100' };
    const receivingCompany = shippingCompanies.find(c => c.id === fullOrder.receivingCompanyId)?.name || 'غير محدد';

    const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '---';
    const fmtMoney = (amount?: number) => amount ? Math.round(amount).toLocaleString('en-US') : '0';

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleViewImage = (src: string) => {
        const win = window.open();
        if (win) {
            win.document.write(
                `<html>
                    <head><title>Image Preview</title></head>
                    <body style="margin:0; display:flex; justify-content:center; align-items:center; background:#222; height: 100vh;">
                        <img src="${src}" style="max-width:100%; max-height:100%; object-fit:contain;" />
                    </body>
                </html>`
            );
            win.document.close();
        }
    };

    const CopyButton: React.FC<{ text: string; id: string }> = ({ text, id }) => (
        <button 
            onClick={(e) => { e.stopPropagation(); handleCopy(text, id); }} 
            className="p-1.5 text-gray-400 hover:text-primary transition-colors bg-gray-100 dark:bg-gray-800 rounded-md ml-2"
            title="نسخ"
        >
            {copiedId === id ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
        </button>
    );

    const SectionTitle: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => (
        <h4 className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3 mt-4">
            {icon} {title}
        </h4>
    );

    const InfoRow: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode; copyValue?: string; copyId?: string }> = ({ label, value, icon, copyValue, copyId }) => (
        <div className="flex justify-between items-center py-1">
            <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">{icon} {label}:</span>
            <div className="flex items-center">
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-right">{value}</span>
                {copyValue && copyId && <CopyButton text={copyValue} id={copyId} />}
            </div>
        </div>
    );

    const ImageCategory: React.FC<{ title: string; images?: string[]; singleImage?: string }> = ({ title, images, singleImage }) => {
        // Correct logic to prioritize array
        const imgs = (images && images.length > 0) ? images : (singleImage ? [singleImage] : []);
        
        if (imgs.length === 0) return null;

        return (
            <div className="mb-4">
                <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{title}</h5>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {imgs.map((src, idx) => (
                        <img 
                            key={idx} 
                            src={src} 
                            alt={`${title} ${idx}`} 
                            className="h-20 w-auto rounded-lg border dark:border-gray-700 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleViewImage(src)}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-start p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold font-mono tracking-tight text-gray-900 dark:text-white">{fullOrder.localOrderId}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusInfo.bgColor} ${statusInfo.color}`}>
                                {statusInfo.name}
                            </span>
                        </div>
                        {fullOrder.globalOrderId && <p className="text-sm text-gray-500 font-mono">Global ID: {fullOrder.globalOrderId}</p>}
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><X size={24} /></button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
                    {isLoadingImages && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg flex items-center gap-2">
                            <Loader2 className="animate-spin" size={16}/> جاري تحميل الصور...
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Column 1: Details */}
                        <div className="space-y-6">
                            
                            <div>
                                <SectionTitle title="معلومات العميل والمتجر" icon={<User size={18}/>} />
                                <InfoRow label="العميل" value={client?.name || '---'} icon={<User size={14}/>} />
                                <InfoRow label="الهاتف" value={client?.phone || '---'} icon={<User size={14}/>} copyValue={client?.phone} copyId="client-phone" />
                                <InfoRow label="المتجر" value={store?.name || '---'} icon={<StoreIcon size={14}/>} />
                                <InfoRow label="تاريخ الطلب" value={formatDate(fullOrder.orderDate)} icon={<Calendar size={14}/>} />
                            </div>

                            <div>
                                <SectionTitle title="تفاصيل مالية" icon={<DollarSign size={18}/>} />
                                <InfoRow label="السعر" value={`${fmtMoney(fullOrder.price)} ${fullOrder.currency}`} />
                                <InfoRow label="السعر (MRU)" value={fmtMoney(fullOrder.priceInMRU)} />
                                <InfoRow label="العمولة" value={fmtMoney(fullOrder.commission)} />
                                <InfoRow label="المدفوع" value={fmtMoney(fullOrder.amountPaid)} />
                                <div className="mt-2 pt-2 border-t dark:border-gray-700 flex justify-between items-center font-bold">
                                    <span>المتبقي</span>
                                    <span className={`${((fullOrder.priceInMRU||0)+(fullOrder.commission||0)+(fullOrder.shippingCost||0)-(fullOrder.amountPaid||0)) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {fmtMoney(((fullOrder.priceInMRU||0)+(fullOrder.commission||0)+(fullOrder.shippingCost||0)-(fullOrder.amountPaid||0)))} MRU
                                    </span>
                                </div>
                            </div>

                            <div>
                                <SectionTitle title="الشحن والتوصيل" icon={<Truck size={18}/>} />
                                <InfoRow label="نوع الشحن" value={fullOrder.shippingType === 'fast' ? 'سريع' : 'عادي'} />
                                <InfoRow label="الوزن" value={`${fullOrder.weight || 0} kg`} icon={<Scale size={14}/>} />
                                <InfoRow label="تكلفة الشحن" value={`${fmtMoney(fullOrder.shippingCost)} MRU`} />
                                <InfoRow label="رقم التتبع" value={fullOrder.trackingNumber || '---'} icon={<MapPin size={14}/>} copyValue={fullOrder.trackingNumber} copyId="track-num" />
                                <InfoRow label="المركز الأصلي" value={fullOrder.originCenter || '---'} icon={<Globe size={14}/>} />
                                <InfoRow label="شركة الاستلام" value={receivingCompany} icon={<Building size={14}/>} />
                                <InfoRow label="مكان التخزين" value={fullOrder.storageLocation || '---'} icon={<Package size={14}/>} />
                            </div>

                        </div>

                        {/* Column 2: Images & Notes */}
                        <div className="space-y-6">
                            
                            {fullOrder.notes && (
                                <div>
                                    <SectionTitle title="ملاحظات" icon={<FileText size={18}/>} />
                                    <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 whitespace-pre-wrap">{fullOrder.notes}</p>
                                </div>
                            )}

                            <div>
                                <SectionTitle title="المرفقات والصور" icon={<ImageIcon size={18}/>} />
                                
                                <ImageCategory title="صور المنتجات" images={fullOrder.productImages} />
                                <ImageCategory title="صور من الطلبية" images={fullOrder.orderImages} />
                                <ImageCategory title="صور الوصول للمكتب" images={fullOrder.hubArrivalImages} />
                                <ImageCategory title="صور الوزن" images={fullOrder.weighingImages} />
                                <ImageCategory title="إيصال الاستلام/الدفع" images={fullOrder.receiptImages} singleImage={fullOrder.receiptImage} />

                                {!fullOrder.productImages?.length && !fullOrder.orderImages?.length && !fullOrder.hubArrivalImages?.length && !fullOrder.weighingImages?.length && !fullOrder.receiptImage && !fullOrder.receiptImages?.length && (
                                    <p className="text-center text-gray-400 text-sm py-4">لا توجد صور مرفقة</p>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailsModal;
