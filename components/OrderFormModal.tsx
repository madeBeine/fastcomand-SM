
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Order, Client, Store, Currency, AppSettings } from '../types';
import { ShippingType, OrderStatus } from '../types';
import { Save, X, Plus, Trash2, UploadCloud, AlertCircle, Loader2, CheckCircle, Receipt, Eye } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface OrderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (order: Order) => Promise<void>;
    order: Order | null;
    clients: Client[];
    stores: Store[];
    currencies: Currency[];
    commissionRate: number;
    isSaving?: boolean;
    paymentMethods?: string[];
    orders?: Order[];
    settings?: AppSettings;
}

// --- SearchableSelect Component --- //
interface SearchableSelectProps<T> {
    options: T[];
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
    getDisplayValue: (value: string) => string;
    renderOption: (option: T) => React.ReactNode;
    filterFunction: (option: T, searchTerm: string) => boolean;
    valueField: keyof T;
    error?: string;
}

function SearchableSelect<T extends { id: string }>({ options, value, placeholder, onChange, getDisplayValue, renderOption, filterFunction, valueField, error }: SearchableSelectProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredOptions = useMemo(() => {
        try {
             return options.filter((option: T) => filterFunction(option, searchTerm));
        } catch (e) {
            console.error("Error filtering options", e);
            return options;
        }
    }, [options, searchTerm, filterFunction]);

    const selectOption = (option: T) => {
        onChange(option[valueField] as string);
        setIsOpen(false);
        setSearchTerm('');
    };
    
    const inputClasses = `w-full mt-1 p-2 border rounded-lg bg-white dark:bg-gray-900 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`;

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                value={isOpen ? searchTerm : getDisplayValue(value)}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => {
                    setIsOpen(true);
                    setSearchTerm('');
                }}
                placeholder={placeholder}
                className={inputClasses}
            />
            {isOpen && (
                <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(option => (
                            <li key={option.id} onClick={() => selectOption(option)} className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b dark:border-gray-700 last:border-0">
                                {renderOption(option)}
                            </li>
                        ))
                    ) : (
                        <li className="px-3 py-2 text-gray-500 text-sm">{t('noOrdersFound')}</li>
                    )}
                </ul>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
}


// --- OrderFormModal Component --- //
const OrderFormModal: React.FC<OrderFormModalProps> = ({ isOpen, onClose, onSave, order, clients, stores, currencies, commissionRate, isSaving = false, paymentMethods = [], orders = [], settings }) => {
    const { t } = useLanguage();
    // Helper to avoid displaying '0'
    const formatNumberInput = (num: number | undefined) => (num === undefined ? '' : num);

    const getInitialFormData = (): Partial<Order> => {
        if (order) {
            return {
                ...order,
                commissionType: order.commissionType || 'fixed',
                productLinks: order.productLinks && order.productLinks.length > 0 ? order.productLinks : [''],
                paymentMethod: order.paymentMethod || (paymentMethods.length > 0 ? paymentMethods[0] : ''),
                receiptImages: order.receiptImages || (order.receiptImage ? [order.receiptImage] : [])
            };
        }
        
        // Use default currency from settings if available, otherwise fallback
        const defaultCurrency = settings?.defaultCurrency || (currencies.length > 0 ? currencies[0].code : 'MRU');

        return {
            status: OrderStatus.NEW,
            localOrderId: '',
            shippingType: ShippingType.NORMAL,
            currency: defaultCurrency,
            orderDate: new Date().toISOString().split('T')[0],
            expectedArrivalDate: '',
            quantity: 1,
            price: undefined,
            commission: undefined,
            commissionType: 'percentage',
            commissionRate: commissionRate,
            amountPaid: undefined,
            paymentMethod: paymentMethods.length > 0 ? paymentMethods[0] : '',
            productLinks: [''],
            productImages: [],
            receiptImage: undefined,
            receiptImages: [],
        };
    };

    const [formData, setFormData] = useState<Partial<Order>>(getInitialFormData());
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    // Use an array for receipt previews to support multiple images
    const [receiptPreviews, setReceiptPreviews] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [localIsSaving, setLocalIsSaving] = useState(false);
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    
    // Sort Stores based on frequency
    const sortedStores = useMemo(() => {
        const storeCounts: Record<string, number> = {};
        orders.forEach(o => {
            if (o.storeId) {
                storeCounts[o.storeId] = (storeCounts[o.storeId] || 0) + 1;
            }
        });
        
        // Clone stores to avoid mutating props
        return [...stores].sort((a, b) => {
            const countA = storeCounts[a.id] || 0;
            const countB = storeCounts[b.id] || 0;
            return countB - countA; // Descending order
        });
    }, [stores, orders]);

    useEffect(() => {
        // --- AUTO ID GENERATION & DRAFT LOADING ---
        if (isOpen) {
            let initialData = getInitialFormData();

            // Only load draft if creating a NEW order
            if (!order) {
                const savedDraft = localStorage.getItem('orderDraft');
                if (savedDraft) {
                    try {
                        const parsedDraft = JSON.parse(savedDraft);
                        // Ensure we don't overwrite ID logic if not present in draft
                        initialData = { ...initialData, ...parsedDraft };
                        // Restore images from draft if they exist (though heavy)
                        if (parsedDraft.productImages) setImagePreviews(parsedDraft.productImages);
                        if (parsedDraft.receiptImages) setReceiptPreviews(parsedDraft.receiptImages);
                    } catch (e) {
                        console.error("Error loading draft", e);
                    }
                }

                // Ensure ID is generated if not in draft
                if (!initialData.localOrderId) {
                    const prefix = settings?.orderIdPrefix || 'FCD';
                    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
                    
                    let maxId = 0;
                    orders.forEach(o => {
                        const match = o.localOrderId.match(regex);
                        if (match) {
                            const num = parseInt(match[1]);
                            if (!isNaN(num) && num > maxId) maxId = num;
                        }
                    });
                    const nextId = maxId > 0 ? maxId + 1 : 1001; 
                    initialData.localOrderId = `${prefix}${nextId}`;
                }
            } else {
                // If editing, always reset previews to current order state
                setImagePreviews(initialData.productImages || []);
                setReceiptPreviews(initialData.receiptImages || (initialData.receiptImage ? [initialData.receiptImage] : []));
            }

            setFormData(initialData);
            setErrors({});
            setLocalIsSaving(false);
            setIsProcessingImages(false);
        }
        
        return () => {
            // Cleanup blob URLs if any (though we use base64 mostly)
            imagePreviews.forEach(url => {
                if (url.startsWith('blob:')) URL.revokeObjectURL(url);
            });
        };
    }, [isOpen, order]); 

    // --- AUTO DRAFT SAVING ---
    useEffect(() => {
        if (!order && isOpen) {
            const draftData = { 
                ...formData, 
                productImages: imagePreviews, // Warning: Large size
                receiptImages: receiptPreviews // Warning: Large size
            };
            try {
                localStorage.setItem('orderDraft', JSON.stringify(draftData));
            } catch (e) {
                console.warn("Draft too large to save fully", e);
                // Fallback: Save without images
                const { productImages, receiptImages, ...textData } = draftData;
                localStorage.setItem('orderDraft', JSON.stringify(textData));
            }
        }
    }, [formData, imagePreviews, receiptPreviews, order, isOpen]);

    // --- AUTO DATE CALCULATION ---
    useEffect(() => {
        if (!order && isOpen && settings && formData.storeId && formData.shippingType) {
            const store = stores.find(s => s.id === formData.storeId);
            if (store) {
                const storeDays = store.estimatedDeliveryDays;
                
                let shippingDays = 0;
                if (formData.shippingType === ShippingType.FAST) {
                    shippingDays = Math.ceil((settings.deliveryDays.fast.min + settings.deliveryDays.fast.max) / 2);
                } else {
                    shippingDays = Math.ceil((settings.deliveryDays.normal.min + settings.deliveryDays.normal.max) / 2);
                }

                const totalDays = storeDays + shippingDays;
                const today = new Date();
                today.setDate(today.getDate() + totalDays);
                
                const formattedDate = today.toISOString().split('T')[0];
                setFormData(prev => ({ ...prev, expectedArrivalDate: formattedDate }));
            }
        }
    }, [formData.storeId, formData.shippingType, isOpen, order]);

    useEffect(() => {
        const selectedCurrency = currencies.find(c => c.code === formData.currency);
        const priceInMRU = Math.round((formData.price || 0) * (selectedCurrency?.rate || 0));
        
        let commission = formData.commission || 0;
        if (formData.commissionType === 'percentage') {
            commission = Math.round(priceInMRU * ((formData.commissionRate || 0) / 100));
        }

        setFormData(prev => ({ ...prev, priceInMRU, commission }));

    }, [formData.price, formData.currency, formData.commissionType, formData.commissionRate, currencies]);

    if (!isOpen) return null;

    // --- Helper: Compress Image (Optimized) ---
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
                    // Reduced max width to 800 for better performance and smaller payload
                    const MAX_WIDTH = 800; 
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
                    
                    // Compress to JPEG with 0.6 quality (Good enough for previews/docs)
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                } catch (e) {
                    console.warn('Image compression failed or decode error, using original file', e);
                    resolve(originalBase64);
                }
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isNumber = type === 'number';
        const val = isNumber ? (value === '' ? undefined : parseFloat(value)) : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };
    
    const handleProductLinkChange = (index: number, value: string) => {
        const newLinks = [...(formData.productLinks || [])];
        newLinks[index] = value;
        setFormData(prev => ({ ...prev, productLinks: newLinks }));
    };

    const addProductLink = () => {
        const newLinks = [...(formData.productLinks || []), ''];
        setFormData(prev => ({...prev, productLinks: newLinks}));
    };
    
    const removeProductLink = (index: number) => {
        if (formData.productLinks && formData.productLinks.length > 1) {
            const newLinks = formData.productLinks.filter((_, i) => i !== index);
            setFormData(prev => ({...prev, productLinks: newLinks}));
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsProcessingImages(true);
            const files = Array.from(e.target.files) as File[];
            
            try {
                const compressedImages = await Promise.all(
                    files.map(file => compressImage(file))
                );
                
                setImagePreviews(prev => [...prev, ...compressedImages]);
            } catch (error) {
                console.error("Error compressing images", error);
                alert(t('error'));
            } finally {
                setIsProcessingImages(false);
            }
        }
    };

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (receiptPreviews.length + e.target.files.length > 3) {
                alert("Max 3 images");
                return;
            }

            setIsProcessingImages(true);
            const files = Array.from(e.target.files) as File[];

            try {
                const compressedImages = await Promise.all(
                    files.map(file => compressImage(file))
                );
                const newPreviews = [...receiptPreviews, ...compressedImages];
                setReceiptPreviews(newPreviews);
                setFormData(prev => ({ ...prev, receiptImages: newPreviews, receiptImage: newPreviews[0] }));
            } catch (error) {
                console.error("Error compressing receipt", error);
            } finally {
                setIsProcessingImages(false);
            }
        }
    };

    const removeImage = (index: number) => {
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const openImage = (src: string) => {
        const win = window.open();
        if (win) {
            win.document.write(`<img src="${src}" style="max-width:100%; height:auto;" />`);
        }
    }

    const removeReceipt = (index: number) => {
        const newPreviews = receiptPreviews.filter((_, i) => i !== index);
        setReceiptPreviews(newPreviews);
        setFormData(prev => ({ ...prev, receiptImages: newPreviews, receiptImage: newPreviews[0] }));
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.localOrderId) newErrors.localOrderId = t('required');
        
        const duplicate = orders.find(o => o.localOrderId === formData.localOrderId && o.id !== order?.id);
        if (duplicate) {
            newErrors.localOrderId = "Duplicate ID";
        }

        if (!formData.clientId) newErrors.clientId = t('required');
        if (!formData.storeId) newErrors.storeId = t('required');
        if (!formData.quantity || formData.quantity <= 0) newErrors.quantity = t('required');
        if (formData.price === undefined || formData.price < 0) newErrors.price = t('required'); 
        if (formData.amountPaid === undefined || formData.amountPaid < 0) newErrors.amountPaid = t('required');
        if (!formData.expectedArrivalDate) newErrors.expectedArrivalDate = t('required');
        if (!formData.productLinks || formData.productLinks.every(link => link.trim() === '')) {
            newErrors.productLinks = t('required');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    const handleSubmit = async () => {
        if (localIsSaving || isSaving || isProcessingImages) return; 
        if (!validateForm()) return;

        setLocalIsSaving(true);

        try {
            let finalData = {
                ...formData,
                price: formData.price || 0,
                amountPaid: formData.amountPaid || 0,
                commission: formData.commission || 0,
                productLinks: formData.productLinks?.filter(link => link.trim() !== ''),
                productImages: imagePreviews,
                receiptImages: receiptPreviews,
                receiptImage: receiptPreviews.length > 0 ? receiptPreviews[0] : undefined
            };
            
            await onSave(finalData as Order);
        } catch (error) {
            console.error(error);
            setLocalIsSaving(false); 
        }
    };

    const totalCost = (formData.priceInMRU || 0) + (formData.commission || 0);
    const remainingAmount = totalCost - (formData.amountPaid || 0);
    const isEditing = !!order;

    const inputClass = (fieldName: keyof Order) => `w-full mt-1 p-2 border rounded-lg bg-white dark:bg-gray-900 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light font-mono ${errors[fieldName] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`;
    const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    const sectionTitleClass = "text-lg font-semibold text-primary dark:text-secondary-light mb-4";
    const sectionClass = "bg-background-light dark:bg-background-dark p-4 rounded-lg border dark:border-gray-700";

    const handlePayFull = () => {
        setFormData(prev => ({ ...prev, amountPaid: totalCost }));
    };

    const isButtonDisabled = localIsSaving || isSaving || isProcessingImages;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-5xl transform transition-all mx-4 max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold">{order ? t('editOrder') : t('addOrder')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <X size={20} />
                    </button>
                </div>

                {Object.keys(errors).length > 0 && (
                    <div className="p-3 mb-4 bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 rounded-r-lg text-red-800 dark:text-red-200 flex-shrink-0">
                        <h4 className="font-bold flex items-center gap-2"><AlertCircle size={18}/> {t('error')}</h4>
                    </div>
                )}
                
                <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* --- Left Column --- */}
                        <div className="lg:col-span-3 space-y-4">
                            <section className={sectionClass}>
                                <h4 className={sectionTitleClass}>1. {t('basicInfo')}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>{t('localOrderId')}*</label>
                                        <input 
                                            type="text" 
                                            name="localOrderId" 
                                            value={formData.localOrderId || ''} 
                                            onChange={handleInputChange} 
                                            className={inputClass('localOrderId')}
                                            placeholder="1234"
                                        />
                                         {errors.localOrderId && <p className="text-red-500 text-xs mt-1">{errors.localOrderId}</p>}
                                    </div>
                                    {isEditing && (
                                        <div>
                                            <label className={labelClass}>{t('globalOrderId')}</label>
                                            <input type="text" name="globalOrderId" value={formData.globalOrderId || ''} onChange={handleInputChange} className={inputClass('globalOrderId')} />
                                        </div>
                                    )}
                                    
                                    <div className="md:col-span-1">
                                        <label className={labelClass}>{t('client')}*</label>
                                        <SearchableSelect
                                            options={clients}
                                            value={formData.clientId || ''}
                                            onChange={(value) => setFormData(p => ({...p, clientId: value}))}
                                            placeholder={t('searchPlaceholder')}
                                            getDisplayValue={(val) => clients.find(c => c.id === val)?.name || ''}
                                            renderOption={(client: Client) => <div className="flex flex-col"><span className="font-bold">{client.name}</span><span className="text-xs text-gray-500 font-mono">{client.phone}</span></div>}
                                            filterFunction={(client: Client, term) => (client.name || '').toLowerCase().includes(term.toLowerCase()) || (client.phone || '').includes(term)}
                                            valueField="id"
                                            error={errors.clientId}
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className={labelClass}>{t('store')}*</label>
                                        <SearchableSelect
                                            options={sortedStores} 
                                            value={formData.storeId || ''}
                                            onChange={(value) => setFormData(p => ({...p, storeId: value}))}
                                            placeholder={t('searchPlaceholder')}
                                            getDisplayValue={(val) => stores.find(s => s.id === val)?.name || ''}
                                            renderOption={(store: Store) => <>{store.name}</>}
                                            filterFunction={(store: Store, term) => (store.name || '').toLowerCase().includes(term.toLowerCase())}
                                            valueField="id"
                                            error={errors.storeId}
                                        />
                                    </div>
                                    
                                    {isEditing && (
                                        <div className="md:col-span-2">
                                            <label className={labelClass}>{t('tracking')}</label>
                                            <input type="text" name="trackingNumber" value={formData.trackingNumber || ''} onChange={handleInputChange} className={inputClass('trackingNumber')} />
                                        </div>
                                    )}

                                    <div>
                                        <label className={labelClass}>{t('orderDate')}</label>
                                        <input type="date" name="orderDate" value={formData.orderDate} onChange={handleInputChange} className={inputClass('orderDate')} />
                                    </div>
                                </div>
                            </section>

                            <section className={sectionClass}>
                                 <h4 className={sectionTitleClass}>2. {t('shippingAndDate')}</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>{t('shippingType')}*</label>
                                        <select name="shippingType" value={formData.shippingType} onChange={handleInputChange} className={inputClass('shippingType')}>
                                            <option value={ShippingType.NORMAL}>{t('normal')}</option>
                                            <option value={ShippingType.FAST}>{t('fast')}</option>
                                        </select>
                                    </div>
                                     <div>
                                        <label className={labelClass}>{t('expectedArrival')}*</label>
                                        <input type="date" name="expectedArrivalDate" value={formData.expectedArrivalDate} onChange={handleInputChange} className={inputClass('expectedArrivalDate')} />
                                         {errors.expectedArrivalDate && <p className="text-red-500 text-xs mt-1">{errors.expectedArrivalDate}</p>}
                                    </div>
                                 </div>
                            </section>

                             <section className={sectionClass}>
                                <h4 className={sectionTitleClass}>3. {t('productInfo')}</h4>
                                 <div>
                                    <label className={labelClass}>{t('productLinks')}*</label>
                                    <div className="space-y-2 mt-2">
                                        {formData.productLinks?.map((link, index) => (
                                             <div key={index} className="flex items-center gap-2">
                                                 <input type="text" value={link} onChange={(e) => handleProductLinkChange(index, e.target.value)} className={`${inputClass('productLinks')} mt-0`} placeholder={`https://...`} />
                                                 {formData.productLinks && formData.productLinks.length > 1 && (
                                                    <button type="button" onClick={() => removeProductLink(index)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                                 )}
                                             </div>
                                        ))}
                                        <button type="button" onClick={addProductLink} className="flex items-center gap-2 text-sm text-primary dark:text-secondary-light font-semibold hover:underline pt-2">
                                            <Plus size={16} /> {t('addLink')}
                                        </button>
                                    </div>
                                     {errors.productLinks && <p className="text-red-500 text-xs mt-1">{errors.productLinks}</p>}
                                </div>
                                <div className="mt-4">
                                    <label className={labelClass}>{t('productImages')}</label>
                                    <div className="mt-2 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                        {isProcessingImages && (
                                            <div className="mb-2 flex items-center justify-center gap-2 text-primary text-sm font-bold">
                                                <Loader2 size={16} className="animate-spin" /> {t('processing')}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                            {imagePreviews.map((src, index) => (
                                                <div key={index} className="relative group">
                                                    <img src={src} alt={`Preview ${index + 1}`} className="w-full h-24 object-cover rounded-md" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-md">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => openImage(src)} 
                                                            className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeImage(index)} 
                                                            className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <label htmlFor="image-upload" className="cursor-pointer w-full h-24 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                                                <UploadCloud size={24} className="text-gray-500" />
                                                <span className="text-xs text-gray-500 mt-1">{t('addLink')}</span>
                                            </label>
                                        </div>
                                    </div>
                                    <input id="image-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </div>
                            </section>
                        </div>

                        {/* --- Right Column (Sticky Financial Panel) --- */}
                        <div className="lg:col-span-2">
                             <div className="sticky top-0 space-y-4">
                                <section className={sectionClass}>
                                    <h4 className={sectionTitleClass}>4. {t('financialDetails')}</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelClass}>{t('quantity')}*</label>
                                            <input type="number" name="quantity" value={formatNumberInput(formData.quantity)} onChange={handleInputChange} className={inputClass('quantity')} min="1" />
                                            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
                                        </div>

                                         <div>
                                            <label className={labelClass}>{t('totalPrice')}*</label>
                                            <div className="flex items-center gap-2">
                                                <input type="number" name="price" value={formatNumberInput(formData.price)} onChange={handleInputChange} className={inputClass('price')} />
                                                <select name="currency" value={formData.currency} onChange={handleInputChange} className={`${inputClass('currency')} w-28`}>
                                                    {currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                                                </select>
                                            </div>
                                             {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('commission')}</label>
                                            <div className="flex items-center gap-1 mt-1">
                                                <button type="button" onClick={() => setFormData(p => ({...p, commissionType: 'percentage'}))} className={`p-2 rounded-md flex-1 text-sm ${formData.commissionType === 'percentage' ? 'bg-primary dark:bg-secondary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>%</button>
                                                <button type="button" onClick={() => setFormData(p => ({...p, commissionType: 'fixed'}))} className={`p-2 rounded-md flex-1 text-sm ${formData.commissionType === 'fixed' ? 'bg-primary dark:bg-secondary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Fixed</button>
                                            </div>
                                            {formData.commissionType === 'percentage' ? (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <input type="number" name="commissionRate" value={formatNumberInput(formData.commissionRate)} onChange={handleInputChange} className={`${inputClass('commissionRate')} mt-0`} />
                                                    <span className="font-bold text-gray-500">%</span>
                                                </div>
                                            ) : (
                                                <input type="number" name="commission" value={formatNumberInput(formData.commission)} onChange={handleInputChange} className={inputClass('commission')} placeholder="MRU"/>
                                            )}
                                        </div>
                                        <div className="space-y-2 mt-4 p-4 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-700">
                                             <div className="flex justify-between items-center text-sm"><span className="text-gray-500 dark:text-gray-400">{t('totalPrice')} (MRU):</span> <span className="font-semibold font-mono">{formData.priceInMRU?.toLocaleString('en-US', {maximumFractionDigits: 0}) || '0'}</span></div>
                                             <div className="flex justify-between items-center text-sm"><span className="text-gray-500 dark:text-gray-400">{t('commission')} (MRU):</span> <span className="font-semibold font-mono">{formData.commission?.toLocaleString('en-US', {maximumFractionDigits: 0}) || '0'}</span></div>
                                             <hr className="border-gray-300 dark:border-gray-600"/>
                                             <div className="flex justify-between items-center font-bold text-md"><span className="">{t('total')}:</span> <span className="text-primary dark:text-secondary-light font-mono">{totalCost.toLocaleString('en-US', {maximumFractionDigits: 0})}</span></div>
                                        </div>
                                         <div>
                                            <label className={labelClass}>{t('amountPaid')} (MRU)*</label>
                                            <div className="relative">
                                                <input type="number" name="amountPaid" value={formatNumberInput(formData.amountPaid)} onChange={handleInputChange} className={inputClass('amountPaid')} placeholder="0" />
                                                <button 
                                                    onClick={handlePayFull}
                                                    type="button"
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-800 p-1 bg-green-100 dark:bg-green-900 rounded-full"
                                                >
                                                    <CheckCircle size={16}/>
                                                </button>
                                            </div>
                                            {errors.amountPaid && <p className="text-red-500 text-xs mt-1">{errors.amountPaid}</p>}
                                        </div>
                                        
                                        <div>
                                            <label className={labelClass}>{t('paymentReceipt')} (Max 3)</label>
                                            <div className="mt-1">
                                                <div className="grid grid-cols-4 gap-2 mb-2">
                                                    {receiptPreviews.map((src, idx) => (
                                                        <div key={idx} className="relative group w-14 h-14">
                                                            <img src={src} alt="Receipt" className="w-full h-full object-cover rounded border" />
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded">
                                                                <button type="button" onClick={() => openImage(src)} className="text-white p-0.5"><Eye size={12}/></button>
                                                                <button type="button" onClick={() => removeReceipt(idx)} className="text-red-500 p-0.5"><X size={12}/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {receiptPreviews.length < 3 && (
                                                        <label htmlFor="receipt-upload" className="cursor-pointer flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-14 h-14">
                                                            {isProcessingImages ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16} className="text-gray-500" />}
                                                            <input id="receipt-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleReceiptUpload} />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelClass}>{t('paymentMethod')}</label>
                                            <select name="paymentMethod" value={formData.paymentMethod || ''} onChange={handleInputChange} className={inputClass('paymentMethod')}>
                                                <option value="">Select Method</option>
                                                {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
                                            </select>
                                        </div>
                                         <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg text-center">
                                            <p className="text-sm font-semibold text-green-800 dark:text-green-300">{t('remaining')}</p>
                                            <p className="font-bold text-lg text-green-800 dark:text-green-200 font-mono">{remainingAmount.toLocaleString('en-US', {maximumFractionDigits: 0})} MRU</p>
                                        </div>
                                    </div>
                                </section>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end pt-4 border-t dark:border-gray-700 flex-shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={isButtonDisabled}
                        className="flex items-center gap-2 px-6 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow hover:bg-primary-dark dark:hover:bg-secondary-dark disabled:bg-gray-400 transition-colors disabled:cursor-not-allowed"
                    >
                        {isButtonDisabled ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {isProcessingImages ? t('processing') : localIsSaving || isSaving ? t('processing') : t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderFormModal;
