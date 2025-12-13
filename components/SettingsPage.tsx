
import React, { useState, useContext, useRef } from 'react';
import type { Store, ShippingCompany, Currency, AppSettings, CompanyInfo, User, GlobalActivityLog, View } from '../types';
import { 
    Building, Truck, DollarSign, Settings, Users, 
    FileText, Plus, Edit, Trash2, Map, Clock, 
    Link as LinkIcon, Save, Upload, Info, AlertTriangle, Loader2,
    X, Globe, Building2, UserCog, History, Calculator
} from 'lucide-react';
import UsersPage from './UsersPage';
import AuditLogPage from './AuditLogPage';
import { supabase, getErrorMessage } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AuthContext } from '../contexts/AuthContext';

interface SettingsPageProps {
    stores: Store[];
    setStores: React.Dispatch<React.SetStateAction<Store[]>>;
    shippingCompanies: ShippingCompany[];
    setShippingCompanies: React.Dispatch<React.SetStateAction<ShippingCompany[]>>;
    currencies: Currency[];
    setCurrencies: React.Dispatch<React.SetStateAction<Currency[]>>;
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    companyInfo: CompanyInfo;
    setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfo>>;
    setView: (view: View) => void;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    globalActivityLog: GlobalActivityLog[];
    logAction: (action: string, entityType: GlobalActivityLog['entityType'], entityId: string, details: string) => void;
}

const SettingsCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, description, icon, actions, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-full flex flex-col">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    {icon}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                </div>
            </div>
            {actions && <div>{actions}</div>}
        </div>
        <div className="p-6 flex-grow overflow-y-auto custom-scrollbar">
            {children}
        </div>
    </div>
);

type Tab = 'profile' | 'system' | 'stores' | 'shipping' | 'currencies' | 'users' | 'audit';
type ModalType = 'store' | 'shipping' | 'currency' | null;

const SettingsPage: React.FC<SettingsPageProps> = ({
    stores, setStores,
    shippingCompanies, setShippingCompanies,
    currencies, setCurrencies,
    settings, setSettings,
    companyInfo, setCompanyInfo,
    users, setUsers,
    globalActivityLog,
    logAction
}) => {
    const { showToast } = useToast();
    const { t } = useLanguage();
    const { currentUser } = useContext(AuthContext);
    
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const [isSaving, setIsSaving] = useState(false);
    
    // Modal State
    const [modalType, setModalType] = useState<ModalType>(null);
    const [editingItem, setEditingItem] = useState<any>(null);
    
    // Helper to compress image
    const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (event) => {
                if (!event.target?.result) return reject("Failed to read file");
                const img = new Image();
                img.src = event.target.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 500;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject("Canvas error");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const base64 = await compressImage(e.target.files[0]);
                setCompanyInfo(prev => ({ ...prev, logo: base64 }));
            } catch (err) {
                showToast("فشل رفع الشعار", "error");
            }
        }
    };

    const handleSaveCompany = async () => {
        if (!supabase) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('CompanyInfo').upsert(companyInfo).select();
            if (error) throw error;
            showToast('تم حفظ معلومات الشركة', 'success');
            logAction('Update Company', 'Settings', 'company', 'Updated company profile');
        } catch (e: any) {
            showToast('خطأ: ' + getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!supabase) return;
        setIsSaving(true);
        
        const payload = {
            ...settings,
            calculator_short_link: settings.calculatorShortLink // Ensure mapping for this specific field if needed
        };

        try {
            // Using mapped payload to DB structure if necessary, though supabase client usually handles camelCase if configured or mapped manually
            // Here we stick to AppSettings type which maps to DB columns in SupabaseClient.ts generally or via explicit mapping
            // But since 'calculatorShortLink' is new, let's just pass settings and rely on the fact that we might need to update the DB mapping logic 
            // OR simply pass it and let Supabase handle if column exists. 
            // Note: In `App.tsx` fetch logic, we map manually. For insert/upsert, we might need manual mapping if keys differ.
            // Let's assume automatic mapping or update the supabaseClient types if they were strict. 
            // For now, we'll map manually to be safe.
            
            const dbPayload: any = {
                id: settings.id,
                commission_rate: settings.commissionRate,
                shipping_rates: settings.shippingRates,
                delivery_days: settings.deliveryDays,
                default_shipping_type: settings.defaultShippingType,
                default_origin_center: settings.defaultOriginCenter,
                payment_methods: settings.paymentMethods,
                order_id_prefix: settings.orderIdPrefix,
                default_currency: settings.defaultCurrency,
                view_order: settings.viewOrder,
                whatsapp_templates: settings.whatsappTemplates,
                calculator_short_link: settings.calculatorShortLink
            };

            const { error } = await supabase.from('AppSettings').upsert(dbPayload).select();
            if (error) throw error;
            showToast('تم حفظ إعدادات النظام', 'success');
            logAction('Update System', 'Settings', 'system', 'Updated system settings');
        } catch (e: any) {
            showToast('خطأ: ' + getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenModal = (type: ModalType, item: any = null) => {
        setModalType(type);
        setEditingItem(item || {});
    };

    const handleCloseModal = () => {
        setModalType(null);
        setEditingItem(null);
    };

    const handleDeleteItem = async (type: ModalType, id: string) => {
        if (!supabase || !type) return;
        if (!confirm(t('deleteWarning'))) return;

        try {
            let table = '';
            if (type === 'store') table = 'Stores';
            if (type === 'shipping') table = 'ShippingCompanies';
            if (type === 'currency') table = 'Currencies';

            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;

            if (type === 'store') setStores(prev => prev.filter(i => i.id !== id));
            if (type === 'shipping') setShippingCompanies(prev => prev.filter(i => i.id !== id));
            if (type === 'currency') setCurrencies(prev => prev.filter(i => i.id !== id));

            showToast(t('success'), 'success');
            logAction('Delete', 'Settings', id, `Deleted ${type}`);
        } catch (e: any) {
            showToast('خطأ: ' + getErrorMessage(e), 'error');
        }
    };

    const handleSaveItem = async () => {
        if (!supabase || !modalType) return;
        setIsSaving(true);
        try {
            let table = '';
            let payload = { ...editingItem };
            delete payload.created_at; // Remove readonly fields

            if (modalType === 'store') table = 'Stores';
            if (modalType === 'shipping') table = 'ShippingCompanies';
            if (modalType === 'currency') table = 'Currencies';

            let res;
            if (payload.id) {
                res = await (supabase.from(table) as any).update(payload).eq('id', payload.id).select().single();
            } else {
                res = await (supabase.from(table) as any).insert(payload).select().single();
            }

            if (res.error) throw res.error;
            const data = res.data;

            if (modalType === 'store') {
                setStores(prev => payload.id ? prev.map(i => i.id === data.id ? data : i) : [...prev, data]);
            } else if (modalType === 'shipping') {
                setShippingCompanies(prev => payload.id ? prev.map(i => i.id === data.id ? data : i) : [...prev, data]);
            } else if (modalType === 'currency') {
                setCurrencies(prev => payload.id ? prev.map(i => i.id === data.id ? data : i) : [...prev, data]);
            }

            showToast(t('success'), 'success');
            logAction(payload.id ? 'Update' : 'Create', 'Settings', data.id, `${payload.id ? 'Updated' : 'Created'} ${modalType}`);
            handleCloseModal();
        } catch (e: any) {
            showToast('خطأ: ' + getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const tabs: { id: Tab; label: string; icon: any; permission?: boolean }[] = [
        { id: 'profile', label: 'ملف الشركة', icon: Building2, permission: currentUser?.permissions.settings.canEditCompany },
        { id: 'system', label: 'النظام', icon: Settings, permission: currentUser?.permissions.settings.canEditSystem },
        { id: 'stores', label: 'المتاجر', icon: Building, permission: currentUser?.permissions.settings.canEditStores },
        { id: 'shipping', label: 'شركات الشحن', icon: Truck, permission: currentUser?.permissions.settings.canEditShipping },
        { id: 'currencies', label: 'العملات', icon: DollarSign, permission: currentUser?.permissions.settings.canEditCurrencies },
        { id: 'users', label: 'المستخدمين', icon: UserCog, permission: currentUser?.permissions.canManageUsers },
        { id: 'audit', label: 'سجل النظام', icon: History, permission: currentUser?.permissions.canViewAuditLog },
    ];

    const allowedTabs = tabs.filter(t => t.permission !== false);

    return (
        <div className="h-full flex flex-col md:flex-row gap-6">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden flex-shrink-0">
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                        <Settings className="text-primary"/> الإعدادات
                    </h2>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-1">
                    {allowedTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                                activeTab === tab.id 
                                ? 'bg-primary text-white shadow-md' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow min-w-0 h-full flex flex-col">
                {activeTab === 'profile' && (
                    <SettingsCard
                        title="معلومات الشركة"
                        description="تعديل بيانات الشركة التي تظهر في الفواتير والتقارير."
                        icon={<Building2 size={20}/>}
                    >
                        <div className="space-y-4 max-w-2xl">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden relative group">
                                    {companyInfo.logo ? (
                                        <img src={companyInfo.logo} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <Upload size={24} className="text-gray-400" />
                                    )}
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoUpload} />
                                </div>
                                <div className="text-sm text-gray-500">
                                    <p className="font-bold">شعار الشركة</p>
                                    <p>انقر لرفع صورة (PNG, JPG)</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">اسم الشركة</label>
                                    <input type="text" value={companyInfo.name} onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">رقم الهاتف</label>
                                    <input type="text" value={companyInfo.phone} onChange={e => setCompanyInfo({...companyInfo, phone: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">العنوان</label>
                                    <input type="text" value={companyInfo.address} onChange={e => setCompanyInfo({...companyInfo, address: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">شروط الفاتورة</label>
                                    <textarea value={companyInfo.invoiceTerms || ''} onChange={e => setCompanyInfo({...companyInfo, invoiceTerms: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" rows={3} placeholder="مثال: البضاعة المباعة لا ترد ولا تستبدل..." />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button onClick={handleSaveCompany} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
                                    {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} حفظ التغييرات
                                </button>
                            </div>
                        </div>
                    </SettingsCard>
                )}

                {activeTab === 'system' && (
                    <SettingsCard
                        title="إعدادات النظام"
                        description="تكوين الأسعار الافتراضية وخيارات النظام."
                        icon={<Settings size={20}/>}
                    >
                        <div className="space-y-6 max-w-2xl">
                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 border-b dark:border-gray-700 pb-1">أسعار الشحن (لكل كغ)</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">سريع (MRU)</label>
                                        <input type="number" value={settings.shippingRates.fast} onChange={e => setSettings({...settings, shippingRates: {...settings.shippingRates, fast: parseFloat(e.target.value)}})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">عادي (MRU)</label>
                                        <input type="number" value={settings.shippingRates.normal} onChange={e => setSettings({...settings, shippingRates: {...settings.shippingRates, normal: parseFloat(e.target.value)}})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 border-b dark:border-gray-700 pb-1">العمولة الافتراضية</h4>
                                <div>
                                    <label className="block text-sm font-medium mb-1">نسبة العمولة (%)</label>
                                    <input type="number" value={settings.commissionRate} onChange={e => setSettings({...settings, commissionRate: parseFloat(e.target.value)})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 border-b dark:border-gray-700 pb-1">أيام التوصيل التقديرية</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-red-600">سريع (المدى)</label>
                                        <div className="flex gap-2">
                                            <input type="number" value={settings.deliveryDays.fast.min} onChange={e => setSettings({...settings, deliveryDays: {...settings.deliveryDays, fast: {...settings.deliveryDays.fast, min: parseInt(e.target.value)}}})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Min"/>
                                            <input type="number" value={settings.deliveryDays.fast.max} onChange={e => setSettings({...settings, deliveryDays: {...settings.deliveryDays, fast: {...settings.deliveryDays.fast, max: parseInt(e.target.value)}}})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Max"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-blue-600">عادي (المدى)</label>
                                        <div className="flex gap-2">
                                            <input type="number" value={settings.deliveryDays.normal.min} onChange={e => setSettings({...settings, deliveryDays: {...settings.deliveryDays, normal: {...settings.deliveryDays.normal, min: parseInt(e.target.value)}}})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Min"/>
                                            <input type="number" value={settings.deliveryDays.normal.max} onChange={e => setSettings({...settings, deliveryDays: {...settings.deliveryDays, normal: {...settings.deliveryDays.normal, max: parseInt(e.target.value)}}})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Max"/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 border-b dark:border-gray-700 pb-1 flex items-center gap-2">
                                    <Calculator size={18} /> الحاسبة السريعة
                                </h4>
                                <div>
                                    <label className="block text-sm font-medium mb-1">الرابط المختصر للحاسبة (يستخدم للمشاركة)</label>
                                    <input 
                                        type="text" 
                                        value={settings.calculatorShortLink || ''} 
                                        onChange={e => setSettings({...settings, calculatorShortLink: e.target.value})} 
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dir-ltr" 
                                        placeholder="مثال: https://bit.ly/my-calc" 
                                        dir="ltr"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">عند مشاركة الحاسبة مع العملاء، سيتم نسخ هذا الرابط بدلاً من الرابط الافتراضي.</p>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button onClick={handleSaveSettings} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
                                    {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} حفظ الإعدادات
                                </button>
                            </div>
                        </div>
                    </SettingsCard>
                )}

                {activeTab === 'stores' && (
                    <SettingsCard
                        title="إدارة المتاجر"
                        description="إضافة وتعديل قائمة المتاجر المتاحة."
                        icon={<Building size={20}/>}
                        actions={
                            <button onClick={() => handleOpenModal('store')} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">
                                <Plus size={16}/> إضافة متجر
                            </button>
                        }
                    >
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {stores.map(store => (
                                <div key={store.id} className="p-4 border rounded-lg dark:border-gray-700 flex flex-col justify-between bg-white dark:bg-gray-800">
                                    <div className="mb-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                {store.logo && (
                                                    <img src={store.logo} alt={store.name} className="w-8 h-8 rounded-full object-contain bg-white border border-gray-100 dark:border-gray-600"/>
                                                )}
                                                <p className="font-bold text-lg">{store.name}</p>
                                            </div>
                                            {store.country && <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded flex items-center gap-1"><Map size={10}/> {store.country}</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Clock size={12}/> توصيل خلال {store.estimatedDeliveryDays} يوم</p>
                                        {store.website && (
                                            <a 
                                                href={store.website} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                                title={store.website}
                                            >
                                                <LinkIcon size={14}/> زيارة المتجر
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex gap-2 justify-end mt-2 pt-2 border-t dark:border-gray-700">
                                        <button onClick={() => handleOpenModal('store', store)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                                        <button onClick={() => handleDeleteItem('store', store.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </SettingsCard>
                )}

                {activeTab === 'shipping' && (
                    <SettingsCard
                        title="شركات الشحن"
                        description="إدارة شركات الشحن المحلية والدولية."
                        icon={<Truck size={20}/>}
                        actions={
                            <button onClick={() => handleOpenModal('shipping')} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">
                                <Plus size={16}/> إضافة شركة
                            </button>
                        }
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {shippingCompanies.map(company => (
                                <div key={company.id} className="p-4 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800">
                                    <h4 className="font-bold text-lg mb-1">{company.name}</h4>
                                    <div className="text-xs text-gray-500 space-y-1">
                                        {company.originCountry && <p>من: {company.originCountry}</p>}
                                        {company.destinationCountry && <p>إلى: {company.destinationCountry}</p>}
                                    </div>
                                    <div className="flex gap-2 justify-end mt-3 pt-2 border-t dark:border-gray-700">
                                        <button onClick={() => handleOpenModal('shipping', company)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                                        <button onClick={() => handleDeleteItem('shipping', company.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SettingsCard>
                )}

                {activeTab === 'currencies' && (
                    <SettingsCard
                        title="العملات وأسعار الصرف"
                        description="إدارة العملات الأجنبية وسعر صرفها مقابل الأوقية."
                        icon={<DollarSign size={20}/>}
                        actions={
                            <button onClick={() => handleOpenModal('currency')} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">
                                <Plus size={16}/> إضافة عملة
                            </button>
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500">
                                    <tr>
                                        <th className="p-3">الرمز</th>
                                        <th className="p-3">الاسم</th>
                                        <th className="p-3">سعر الصرف (MRU)</th>
                                        <th className="p-3 text-center">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currencies.map(curr => (
                                        <tr key={curr.id} className="border-b dark:border-gray-700">
                                            <td className="p-3 font-bold">{curr.code}</td>
                                            <td className="p-3">{curr.name}</td>
                                            <td className="p-3 font-mono">{curr.rate}</td>
                                            <td className="p-3 flex justify-center gap-2">
                                                <button onClick={() => handleOpenModal('currency', curr)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                                                <button onClick={() => handleDeleteItem('currency', curr.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </SettingsCard>
                )}

                {activeTab === 'users' && (
                    <div className="h-full overflow-y-auto custom-scrollbar p-1">
                        <UsersPage users={users} setUsers={setUsers} logAction={logAction} globalActivityLog={globalActivityLog} />
                    </div>
                )}

                {activeTab === 'audit' && (
                    <div className="h-full overflow-y-auto custom-scrollbar p-1">
                        <AuditLogPage log={globalActivityLog} />
                    </div>
                )}
            </div>

            {/* Generic Modal for Adding/Editing Items */}
            {modalType && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70]" onClick={handleCloseModal}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                            <h3 className="text-xl font-bold">
                                {editingItem.id ? t('edit') : t('add')} {modalType === 'store' ? 'متجر' : modalType === 'shipping' ? 'شركة شحن' : 'عملة'}
                            </h3>
                            <button onClick={handleCloseModal} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                        </div>
                        
                        <div className="space-y-4">
                            {modalType === 'store' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">اسم المتجر</label>
                                        <input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">الدولة</label>
                                        <input type="text" value={editingItem.country || ''} onChange={e => setEditingItem({...editingItem, country: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">الموقع الإلكتروني</label>
                                        <input type="text" value={editingItem.website || ''} onChange={e => setEditingItem({...editingItem, website: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">وقت التوصيل التقديري (أيام)</label>
                                        <input type="number" value={editingItem.estimatedDeliveryDays || ''} onChange={e => setEditingItem({...editingItem, estimatedDeliveryDays: parseInt(e.target.value)})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                </>
                            )}

                            {modalType === 'shipping' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">اسم الشركة</label>
                                        <input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">بلد المنشأ</label>
                                        <input type="text" value={editingItem.originCountry || ''} onChange={e => setEditingItem({...editingItem, originCountry: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">بلد الوصول</label>
                                        <input type="text" value={editingItem.destinationCountry || ''} onChange={e => setEditingItem({...editingItem, destinationCountry: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                </>
                            )}

                            {modalType === 'currency' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">الرمز (Code)</label>
                                        <input type="text" value={editingItem.code || ''} onChange={e => setEditingItem({...editingItem, code: e.target.value.toUpperCase()})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 uppercase" placeholder="USD" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">الاسم</label>
                                        <input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="دولار أمريكي" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">سعر الصرف (مقابل 1 عملة)</label>
                                        <input type="number" value={editingItem.rate || ''} onChange={e => setEditingItem({...editingItem, rate: parseFloat(e.target.value)})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01" />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={handleCloseModal} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg">{t('cancel')}</button>
                            <button onClick={handleSaveItem} disabled={isSaving} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
                                {isSaving ? <Loader2 className="animate-spin" size={18}/> : t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;