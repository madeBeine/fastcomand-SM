
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { View, ShippingType, UserRole } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrdersPage from './components/OrdersPage';
import ShipmentsPage from './components/ShipmentsPage';
import ClientsPage from './components/ClientsPage';
import StoragePage from './components/StoragePage';
import DeliveryPage from './components/DeliveryPage';
import BillingPage from './components/BillingPage';
import SettingsPage from './components/SettingsPage';
import LoginPage from './components/LoginPage';
import PublicCalculatorPage from './components/PublicCalculatorPage'; // Import
import { supabase, getErrorMessage } from './supabaseClient';
import type { Order, Client, Store, Shipment, ShippingCompany, StorageDrawer, Currency, CompanyInfo, AppSettings, User, GlobalActivityLog } from './types';
import { Menu, ServerCrash, RefreshCw, LogOut, Moon, Sun, Settings, Users, WifiOff, Globe, ArrowUp } from 'lucide-react';
import { AuthContext } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { useLanguage } from './contexts/LanguageContext'; // Import hook
import Logo from './components/Logo';
import { DEFAULT_EMPLOYEE_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS } from './constants';
import FloatingCalculator from './components/FloatingCalculator';
import NotificationCenter from './components/NotificationCenter';

const CACHE_KEY_PREFIX = 'fast_comand_v4_'; 

const DEFAULT_SETTINGS: AppSettings = {
    commissionRate: 10,
    shippingRates: { fast: 450, normal: 280 },
    deliveryDays: {
        fast: { min: 3, max: 5 },
        normal: { min: 9, max: 12 },
    },
    defaultShippingType: ShippingType.NORMAL,
    defaultOriginCenter: 'Dubai',
    paymentMethods: [],
    orderIdPrefix: 'FCD',
    defaultCurrency: 'AED',
    viewOrder: ['dashboard', 'orders', 'shipments', 'clients', 'storage', 'delivery', 'billing', 'settings'],
    whatsappTemplates: {
        ar: `{greeting} {clientName}،\nنخبرك أن طلبك رقم {orderId} قد وصل وهو جاهز للتسليم في ({location}).\nوزنه: {weight} كغ\nقيمة الشحن: {shippingCost}\nالباقي من قيمة الطلب: {productRemaining}\nالمجموع الذي يجب دفعه: {totalDue}\n\n{loyaltyMessage}`,
        en: `{greeting} {clientName},\nWe are pleased to inform you that your order #{orderId} has arrived and is ready for pickup at ({location}).\nWeight: {weight} kg\nShipping Cost: {shippingCost}\nRemaining Item Cost: {productRemaining}\nTotal Due: {totalDue}\n\n{loyaltyMessage}`,
        fr: `{greeting} {clientName},\nNous avons le plaisir de vous informer que votre commande #{orderId} est arrivée et est prête à être récupérée à ({location}).\nPoids: {weight} kg\nFrais de livraison: {shippingCost}\nReste du prix de l'article: {productRemaining}\nTotal à payer: {totalDue}\n\n{loyaltyMessage}`
    },
    calculatorShortLink: ''
};

const mapSettings = (data: any): AppSettings => {
    if (!data) return DEFAULT_SETTINGS;
    return {
        id: data.id,
        commissionRate: data.commission_rate ?? data.commissionRate ?? DEFAULT_SETTINGS.commissionRate,
        shippingRates: data.shipping_rates ?? data.shippingRates ?? DEFAULT_SETTINGS.shippingRates,
        deliveryDays: data.delivery_days ?? data.delivery_days ?? DEFAULT_SETTINGS.deliveryDays,
        defaultShippingType: data.default_shipping_type ?? data.defaultShippingType ?? DEFAULT_SETTINGS.defaultShippingType,
        defaultOriginCenter: data.default_origin_center ?? data.defaultOriginCenter ?? DEFAULT_SETTINGS.defaultOriginCenter,
        paymentMethods: data.payment_methods ?? data.paymentMethods ?? DEFAULT_SETTINGS.paymentMethods,
        orderIdPrefix: data.order_id_prefix ?? data.orderIdPrefix ?? DEFAULT_SETTINGS.orderIdPrefix,
        defaultCurrency: data.default_currency ?? data.defaultCurrency ?? DEFAULT_SETTINGS.defaultCurrency,
        viewOrder: data.view_order ?? data.viewOrder ?? DEFAULT_SETTINGS.viewOrder,
        whatsappTemplates: data.whatsapp_templates ?? data.whatsappTemplates ?? DEFAULT_SETTINGS.whatsappTemplates,
        calculatorShortLink: data.calculator_short_link ?? data.calculatorShortLink ?? DEFAULT_SETTINGS.calculatorShortLink
    };
};

const mapCompanyInfo = (data: any): CompanyInfo => {
    if (!data) return { name: '', email: '', phone: '', address: '', logo: '' };
    return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        logo: data.logo,
        invoiceTerms: data.invoiceTerms ?? data.invoice_terms,
        invoiceSignature: data.invoiceSignature ?? data.invoice_signature
    };
};

const mapOrder = (o: any): Order => ({
    ...o,
    localOrderId: o.localOrderId ?? o.local_order_id,
    globalOrderId: o.globalOrderId ?? o.global_order_id,
    clientId: o.clientId ?? o.client_id,
    storeId: o.storeId ?? o.store_id,
    priceInMRU: o.priceInMRU ?? o.price_in_mru,
    amountPaid: o.amountPaid ?? o.amount_paid,
    paymentMethod: o.paymentMethod ?? o.payment_method,
    shippingType: o.shippingType ?? o.shipping_type,
    orderDate: o.orderDate ?? o.order_date,
    arrivalDateAtOffice: o.arrivalDateAtOffice ?? o.arrival_date_at_office,
    expectedArrivalDate: o.expectedArrivalDate ?? o.expected_arrival_date,
    expectedHubArrivalStartDate: o.expectedHubArrivalStartDate ?? o.expected_hub_arrival_start_date,
    expectedHubArrivalEndDate: o.expectedHubArrivalEndDate ?? o.expected_hub_arrival_end_date,
    commissionType: o.commissionType ?? o.commission_type,
    commissionRate: o.commissionRate ?? o.commission_rate,
    productLinks: o.productLinks ?? o.product_links,
    productImages: o.productImages ?? o.product_images ?? [],
    orderImages: o.orderImages ?? o.order_images ?? [],
    hubArrivalImages: o.hubArrivalImages ?? o.hub_arrival_images ?? [],
    weighingImages: o.weighingImages ?? o.weighing_images ?? [],
    trackingNumber: o.trackingNumber ?? o.tracking_number,
    shippingCost: o.shippingCost ?? o.shipping_cost,
    storageLocation: o.storageLocation ?? o.storage_location,
    storageDate: o.storageDate ?? o.storage_date,
    withdrawalDate: o.withdrawalDate ?? o.withdrawal_date,
    receiptImage: o.receiptImage ?? o.receipt_image,
    receiptImages: (o.receipt_images && o.receipt_images.length > 0) 
        ? o.receipt_images 
        : (o.receipt_image ? [o.receipt_image] : []),
    shipmentId: o.shipmentId ?? o.shipment_id,
    boxId: o.boxId ?? o.box_id,
    originCenter: o.originCenter ?? o.origin_center,
    receivingCompanyId: o.receivingCompanyId ?? o.receiving_company_id,
    whatsappNotificationSent: o.whatsapp_notification_sent ?? false,
    isInvoicePrinted: o.isInvoicePrinted ?? o.is_invoice_printed ?? false,
    history: o.history ?? [],
});

const mapClient = (c: any): Client => ({
    ...c,
    whatsappNumber: c.whatsappNumber ?? c.whatsapp_number,
});

const mapShipment = (s: any): Shipment => ({
    ...s,
    shipmentNumber: s.shipmentNumber ?? s.shipment_number,
    shippingType: s.shippingType ?? s.shipping_type,
    shippingCompanyId: s.shippingCompanyId ?? s.shipping_company_id,
    departureDate: s.departureDate ?? s.departure_date,
    expectedArrivalDate: s.expectedArrivalDate ?? s.expected_arrival_date,
    totalWeight: s.totalWeight ?? s.total_weight,
    totalShippingCost: s.totalShippingCost ?? s.total_shipping_cost,
    receiptImage: s.receiptImage ?? s.receipt_image,
    trackingNumber: s.trackingNumber ?? s.tracking_number,
    numberOfBoxes: s.numberOfBoxes ?? s.number_of_boxes,
    history: s.history ?? [],
});

const mapStore = (s: any): Store => ({
    ...s,
    estimatedDeliveryDays: s.estimatedDeliveryDays ?? s.estimated_delivery_days,
    country: s.country,
    website: s.website,
    logo: s.logo // Added logo mapping
});

const mapShippingCompany = (s: any): ShippingCompany => ({
    ...s,
    originCountry: s.originCountry ?? s.origin_country,
    destinationCountry: s.destinationCountry ?? s.destination_country,
    rates: s.rates,
    addresses: s.addresses,
    contactMethods: s.contactMethods ?? s.contact_methods,
});

const mapGlobalActivityLog = (l: any): GlobalActivityLog => ({
    id: l.id,
    timestamp: l.timestamp,
    user: l.user,
    action: l.action,
    entityType: l.entityType ?? l.entity_type,
    entityId: l.entityId ?? l.entity_id,
    details: l.details
});

const saveToCache = (key: string, data: any) => {
    try {
        let cleanData = data;
        if (key === 'Orders' && Array.isArray(data)) {
            cleanData = data.map(o => {
                const { productImages, orderImages, hubArrivalImages, weighingImages, receiptImage, receiptImages, history, ...rest } = o;
                return rest;
            });
        } else if (key === 'Shipments' && Array.isArray(data)) {
            cleanData = data.map(s => {
                const { receiptImage, history, ...rest } = s;
                return rest;
            });
        }

        const cachePayload = { timestamp: Date.now(), data: cleanData };
        localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(cachePayload));
    } catch (e) {
        try { localStorage.clear(); } catch {}
    }
};

const loadFromCache = (key: string): any | null => {
    try {
        const stored = localStorage.getItem(CACHE_KEY_PREFIX + key);
        if (!stored) return null;
        const { data } = JSON.parse(stored);
        return data;
    } catch (e) {
        return null;
    }
};

// Error Screen Component
const ErrorScreen: React.FC<{ message: string; onRetry?: () => void; onLogout?: () => void }> = ({ message, onRetry, onLogout }) => (
     <div className="flex items-center justify-center h-screen bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200" dir="rtl">
        <div className="text-center p-8 bg-content-light dark:bg-content-dark rounded-2xl shadow-2xl max-w-lg mx-4 border border-red-100 dark:border-red-900">
            <div className="bg-red-100 dark:bg-red-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ServerCrash className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">خطأ في الاتصال</h2>
            <p className="mt-2 text-md text-gray-600 dark:text-gray-400">حدثت مشكلة أثناء الاتصال.</p>
            <div className="mt-6 bg-red-50 dark:bg-red-900/30 p-4 rounded-lg text-right dir-ltr font-mono text-xs overflow-auto max-h-32 border border-red-100 dark:border-red-800 whitespace-pre-wrap break-words">
                {message}
            </div>
            <div className="mt-6 flex flex-col gap-3">
                {onRetry && (
                    <button onClick={onRetry} className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors w-full font-bold shadow-lg">
                        <RefreshCw size={20} /> إعادة المحاولة
                    </button>
                )}
                {onLogout && (
                    <button onClick={onLogout} className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors w-full font-bold">
                        <LogOut size={20} /> تسجيل الخروج
                    </button>
                )}
            </div>
        </div>
    </div>
);

export const App: React.FC = () => {
  // Check for Public Route First
  const isPublicCalculator = window.location.pathname === '/calculator';
  const { language, dir, t } = useLanguage();

  // Initialize user from cache to show app immediately if logged in previously
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
      return loadFromCache('CurrentUser');
  });
  
  const currentUserRef = useRef<User | null>(currentUser); 
  
  useEffect(() => {
      currentUserRef.current = currentUser;
  }, [currentUser]);

  const [view, setView] = useState<View>(() => {
      const savedView = localStorage.getItem('lastActiveView');
      return (savedView as View) || 'dashboard';
  });

  useEffect(() => {
      localStorage.setItem('lastActiveView', view);
  }, [view]);

  // --- Scroll Preservation & Back-to-Top Logic ---
  const scrollPositions = useRef<Record<string, number>>({});
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Function to change view while saving scroll position
  const handleViewChange = (newView: View) => {
      if (mainContentRef.current) {
          scrollPositions.current[view] = mainContentRef.current.scrollTop;
      }
      setView(newView);
      setIsSidebarOpen(false); // Mobile UX: close sidebar on navigate
  };

  // Restore scroll position when view changes
  useLayoutEffect(() => {
      if (mainContentRef.current) {
          const savedPosition = scrollPositions.current[view] || 0;
          mainContentRef.current.scrollTop = savedPosition;
      }
  }, [view]);

  // Handle scroll events for "Back to Top" button
  const handleScroll = () => {
      if (mainContentRef.current) {
          // Lowered threshold to 50px for quicker access as requested
          setShowScrollTop(mainContentRef.current.scrollTop > 50);
      }
  };

  const scrollToTop = () => {
      mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // ------------------------------------------------

  const [orderFilter, setOrderFilter] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                   (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
  });

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
  }, [isDarkMode]);
  
  const [shouldOpenNewOrderModal, setShouldOpenNewOrderModal] = useState(false);

  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize data from cache
  const [orders, setOrders] = useState<Order[]>(() => (loadFromCache('Orders') || []).map(mapOrder));
  const [clients, setClients] = useState<Client[]>(() => (loadFromCache('Clients') || []).map(mapClient));
  const [stores, setStores] = useState<Store[]>(() => (loadFromCache('Stores') || []).map(mapStore));
  const [shipments, setShipments] = useState<Shipment[]>(() => (loadFromCache('Shipments') || []).map(mapShipment));
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>(() => (loadFromCache('ShippingCompanies') || []).map(mapShippingCompany));
  const [drawers, setDrawers] = useState<StorageDrawer[]>(() => loadFromCache('StorageDrawers') || []);
  const [currencies, setCurrencies] = useState<Currency[]>(() => loadFromCache('Currencies') || []);
  const [users, setUsers] = useState<User[]>(() => loadFromCache('Users') || []);
  const [globalActivityLog, setGlobalActivityLog] = useState<GlobalActivityLog[]>([]);
  
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => {
      const cachedCompany = loadFromCache('CompanyInfo');
      if (cachedCompany?.[0]) return mapCompanyInfo(cachedCompany[0]);
      return { name: 'Fast Comand', logo: '', email: '', phone: '', address: '' };
  });
  
  const [settings, setSettings] = useState<AppSettings>(() => {
      const cached = loadFromCache('AppSettings');
      if (cached?.[0]) return mapSettings(cached[0]);
      return DEFAULT_SETTINGS;
  });

    const isFetching = useRef(false);

    const fetchFreshData = useCallback(async (userId?: string) => {
        if (!supabase || isFetching.current) return;
        isFetching.current = true;
        setIsBackgroundUpdating(true);

        try {
            if (!navigator.onLine) {
                isFetching.current = false;
                setIsBackgroundUpdating(false);
                return;
            }

            let currentUserId = userId || currentUser?.id;
            let finalUser = currentUser;

            if (!currentUserId) {
                 const { data: { user } } = await supabase.auth.getUser();
                 if (user) {
                     currentUserId = user.id;
                 } else {
                     // No user session found
                     isFetching.current = false;
                     setIsBackgroundUpdating(false);
                     return;
                 }
            }

            if (currentUserId && (!finalUser || finalUser.id !== currentUserId)) {
                try {
                    const { data: userProfile, error: profileError } = await supabase
                        .from('Users')
                        .select('*')
                        .eq('id', currentUserId)
                        .maybeSingle();
                    
                    if (userProfile) {
                        finalUser = { ...userProfile as User };
                    } else {
                        // Fallback admin for recovery
                        finalUser = {
                            id: currentUserId,
                            username: 'Admin (Recovery)',
                            role: UserRole.ADMIN,
                            permissions: DEFAULT_ADMIN_PERMISSIONS 
                        };
                    }
                } catch (e) {
                     console.error("User fetch exception", e);
                }

                if (finalUser) {
                    setCurrentUser(finalUser);
                    currentUserRef.current = finalUser;
                    saveToCache('CurrentUser', finalUser);
                }
            }

            // --- OPTIMIZED QUERY: EXCLUDING HEAVY IMAGES ---
            // Removed: product_images, order_images, hub_arrival_images, weighing_images, receipt_image, receipt_images
            const ordersQuery = `
                id, local_order_id, global_order_id, client_id, store_id, 
                price, currency, price_in_mru, commission, quantity, amount_paid, payment_method, 
                shipping_type, order_date, arrival_date_at_office, expected_arrival_date, 
                commission_type, commission_rate, product_links, notes, status, tracking_number, 
                weight, shipping_cost, storage_location, storage_date, withdrawal_date, 
                shipment_id, box_id, origin_center, receiving_company_id, whatsapp_notification_sent, 
                is_invoice_printed, history, created_at
            `;

            const fetchTable = async (table: string, query = '*', orderCol = 'created_at', limit = 1000) => {
                try {
                    const { data, error } = await supabase!
                        .from(table)
                        .select(query)
                        .order(orderCol, { ascending: false })
                        .limit(limit);
                    
                    if (error) throw error;
                    return data;
                } catch (e: any) {
                    return [];
                }
            };

            const shipmentsQuery = `
                id, shipment_number, shipping_type, shipping_company_id, departure_date, expected_arrival_date, 
                status, country, total_weight, total_shipping_cost, tracking_number, number_of_boxes, boxes, created_at
            `;

            const [
                settingsData,
                companyData,
                currenciesData,
                storesData,
                shippingData,
                drawersData,
                ordersData,
                clientsData,
                shipmentsData,
                logsData,
                usersData
            ] = await Promise.all([
                fetchTable('AppSettings', '*', 'created_at', 1),
                fetchTable('CompanyInfo', '*', 'created_at', 1),
                fetchTable('Currencies', '*', 'created_at', 100),
                fetchTable('Stores', '*', 'created_at', 100),
                fetchTable('ShippingCompanies', '*', 'created_at', 100),
                fetchTable('StorageDrawers', '*', 'name', 100), 
                fetchTable('Orders', ordersQuery, 'created_at', 2000), // Updated query, limit 2000
                fetchTable('Clients', '*', 'created_at', 2000), // Reduced limit to 2000
                fetchTable('Shipments', shipmentsQuery, 'created_at', 300),
                fetchTable('GlobalActivityLog', '*', 'timestamp', 100),
                fetchTable('Users', '*', 'created_at', 100)
            ]);

            if (settingsData?.[0]) { 
                setSettings(mapSettings(settingsData[0])); 
                saveToCache('AppSettings', settingsData); 
            }

            if (companyData?.[0]) { 
                setCompanyInfo(mapCompanyInfo(companyData[0])); 
                saveToCache('CompanyInfo', companyData); 
            }

            if (currenciesData) { 
                setCurrencies(currenciesData as Currency[]); 
                saveToCache('Currencies', currenciesData); 
            }

            if (storesData) { 
                setStores(storesData.map(mapStore)); 
                saveToCache('Stores', storesData); 
            }

            if (shippingData) { 
                setShippingCompanies(shippingData.map(mapShippingCompany)); 
                saveToCache('ShippingCompanies', shippingData); 
            }

            if (drawersData) { 
                const sortedDrawers = (drawersData as StorageDrawer[]).sort((a, b) => a.name.localeCompare(b.name));
                setDrawers(sortedDrawers); 
                saveToCache('StorageDrawers', sortedDrawers); 
            }

            if (ordersData) { 
                setOrders(ordersData.map(mapOrder)); 
                saveToCache('Orders', ordersData); 
            }

            if (clientsData) { 
                setClients(clientsData.map(mapClient)); 
                saveToCache('Clients', clientsData); 
            }

            if (shipmentsData) { 
                setShipments(shipmentsData.map(mapShipment)); 
                saveToCache('Shipments', shipmentsData); 
            }

            if (logsData) { 
                setGlobalActivityLog(logsData.map(mapGlobalActivityLog)); 
            }

            if (usersData) { 
                setUsers(usersData as User[]); 
                saveToCache('Users', usersData); 
            }

            setError(null);

        } catch (error: any) {
            console.error('Critical Data Fetch Error:', error);
            setError(getErrorMessage(error));
        } finally {
            setIsBackgroundUpdating(false);
            isFetching.current = false;
        }
    }, [currentUser?.id]);

    const forceLogout = useCallback(async () => {
        try {
            localStorage.clear(); 
            if (supabase) await supabase.auth.signOut();
        } catch (e) {
            console.error("Force signout error:", e);
        }
        setCurrentUser(null);
        setError(null);
        isFetching.current = false;
        window.location.reload();
    }, []);

    useEffect(() => {
        if (!currentUser || !supabase || isPublicCalculator) return;

        const channel = supabase.channel('fast-comand-global-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, () => {
                setTimeout(() => fetchFreshData(currentUser.id), 500);
            })
            .subscribe();

        return () => { if (supabase) supabase.removeChannel(channel); };
    }, [currentUser, fetchFreshData, isPublicCalculator]);

    useEffect(() => {
        if (isPublicCalculator) return;
        const handleOnline = () => { setIsOnline(true); fetchFreshData(); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [fetchFreshData, isPublicCalculator]);

    useEffect(() => {
        if (isPublicCalculator) return;
        
        const init = async () => {
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    // Update user state if needed (e.g. from cache to fresh session id)
                    if (!currentUser || currentUser.id !== session.user.id) {
                         // We will fetch fresh data which updates currentUser state fully
                         fetchFreshData(session.user.id);
                    } else {
                         // Just background refresh
                         fetchFreshData(session.user.id);
                    }
                } else {
                    // No session, clear user
                    setCurrentUser(null);
                }
                
                supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_IN' && session?.user) {
                        fetchFreshData(session.user.id);
                    } else if (event === 'SIGNED_OUT') {
                        setCurrentUser(null);
                    }
                });
            } else {
                setError("Supabase client not initialized");
            }
        };
        init();
    }, [isPublicCalculator]);

    const logAction = async (action: string, entityType: GlobalActivityLog['entityType'], entityId: string, details: string) => {
        if (!currentUser || !supabase) return;
        try {
            await supabase.from('GlobalActivityLog').insert({
                timestamp: new Date().toISOString(),
                user: currentUser.username,
                action,
                entity_type: entityType,
                entity_id: entityId,
                details
            });
        } catch (e) { /* silent fail */ }
    };

    const loginDemo = useCallback(() => { alert("Demo mode disabled."); }, []);

    // --- RENDER LOGIC ---

    // 1. Check for Public Calculator Route
    if (isPublicCalculator) {
        return <PublicCalculatorPage />;
    }

    // 2. If no user is logged in, show login page
    if (!currentUser) return <LoginPage />;

    // 3. Main App (Protected)
    return (
        <AuthContext.Provider value={{ currentUser, logout: forceLogout, loginDemo }}>
            <ToastProvider>
                <>
                    {!isOnline && (
                        <div className="bg-red-500 text-white p-1 text-center text-xs font-bold fixed top-0 w-full z-[100]">
                            <WifiOff className="inline mr-1" size={12}/> {t('offline')}
                        </div>
                    )}
                    
                    {error && <ErrorScreen message={error} onRetry={() => window.location.reload()} onLogout={forceLogout} />}
                    
                    <FloatingCalculator currencies={currencies} settings={settings} />

                    {/* Scroll To Top Button - Adjusted Position for Mobile */}
                    <div className={`fixed bottom-24 right-4 md:right-6 z-[90] transition-all duration-300 transform ${showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                        <button
                            onClick={scrollToTop}
                            className="bg-primary hover:bg-primary-dark text-white p-3 rounded-full shadow-lg border-2 border-white dark:border-slate-800 transition-colors"
                            title="Scroll to Top"
                        >
                            <ArrowUp size={24} />
                        </button>
                    </div>

                    <div className={`flex h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans transition-colors duration-300 ${isDarkMode ? 'dark' : ''} ${!isOnline ? 'pt-6' : ''}`} dir={dir}>
                        
                        {isSidebarOpen && (
                            <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
                        )}

                        <Sidebar 
                            currentView={view} 
                            setView={handleViewChange} 
                            isSidebarOpen={isSidebarOpen}
                            companyInfo={companyInfo}
                            viewOrder={settings.viewOrder} 
                            isCollapsed={isSidebarCollapsed}
                            setIsCollapsed={setIsSidebarCollapsed}
                        />

                        {/* Updated Main Layout: Added padding bottom to scroll container */}
                        <main className={`flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300`}>
                            <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
                                {/* Actions: Menu and Logo for Mobile */}
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                        <Menu size={24} />
                                    </button>
                                    
                                    <div className="flex items-center gap-2 md:hidden">
                                        {companyInfo.logo ? <img src={companyInfo.logo} alt="Logo" className="w-8 h-8 object-contain" /> : <Logo className="w-8 h-8" />}
                                    </div>
                                    
                                    {/* Welcome Message: Only in Dashboard */}
                                    {view === 'dashboard' && currentUser && (
                                        <div className="hidden md:block font-bold text-gray-700 dark:text-gray-200 text-sm md:text-base animate-in fade-in">
                                            {t('welcome')}، <span className="text-primary">{currentUser.username}</span>
                                        </div>
                                    )}

                                    {isBackgroundUpdating && isOnline && (
                                        <div className="text-primary animate-spin" title={t('loading')}>
                                            <RefreshCw size={16} />
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Actions, Theme, Notification, Profile */}
                                <div className="flex items-center gap-2 md:gap-3">
                                    {currentUser?.permissions.clients.view && (
                                        <button onClick={() => handleViewChange('clients')} className={`hidden md:block p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${view === 'clients' ? 'text-primary bg-primary/10' : 'text-gray-600 dark:text-gray-400'}`}>
                                            <Users size={22} />
                                        </button>
                                    )}
                                    {currentUser?.permissions.canAccessSettings && (
                                        <button onClick={() => handleViewChange('settings')} className={`hidden md:block p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${view === 'settings' ? 'text-primary bg-primary/10' : 'text-gray-600 dark:text-gray-400'}`}>
                                            <Settings size={22} />
                                        </button>
                                    )}
                                    
                                    <NotificationCenter 
                                        orders={orders} 
                                        stores={stores}
                                        onNavigateToOrder={(id) => { 
                                            setOrderFilter(id); 
                                            handleViewChange('orders'); 
                                        }}
                                    />
                                    
                                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400">
                                        {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
                                    </button>
                                </div>
                            </header>

                            <div 
                                className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth pb-32" 
                                ref={mainContentRef}
                                onScroll={handleScroll}
                            >
                                <div className="max-w-7xl mx-auto h-full">
                                    {(() => {
                                        switch (view) {
                                            case 'dashboard':
                                                return <Dashboard 
                                                    orders={orders} 
                                                    clients={clients} 
                                                    stores={stores} 
                                                    shipments={shipments} 
                                                    onFilterClick={(filter) => { setOrderFilter(filter); handleViewChange('orders'); }}
                                                    globalActivityLog={globalActivityLog}
                                                    onNewOrder={() => { handleViewChange('orders'); setShouldOpenNewOrderModal(true); }}
                                                    settings={settings}
                                                    currencies={currencies}
                                                    isLoading={isBackgroundUpdating && orders.length === 0}
                                                />;
                                            case 'orders':
                                                return <OrdersPage 
                                                    orders={orders} 
                                                    setOrders={setOrders} 
                                                    clients={clients} 
                                                    stores={stores} 
                                                    currencies={currencies}
                                                    shippingCompanies={shippingCompanies}
                                                    activeFilter={orderFilter}
                                                    clearFilter={() => setOrderFilter(null)}
                                                    commissionRate={settings.commissionRate}
                                                    drawers={drawers}
                                                    paymentMethods={settings.paymentMethods || []}
                                                    settings={settings}
                                                    shouldOpenModal={shouldOpenNewOrderModal}
                                                    onModalOpenHandled={() => setShouldOpenNewOrderModal(false)}
                                                    companyInfo={companyInfo}
                                                    users={users}
                                                />;
                                            case 'shipments':
                                                return <ShipmentsPage 
                                                    shipments={shipments} 
                                                    setShipments={setShipments} 
                                                    orders={orders} 
                                                    setOrders={setOrders}
                                                    shippingCompanies={shippingCompanies}
                                                    settings={settings}
                                                    clients={clients}
                                                    stores={stores}
                                                />;
                                            case 'clients':
                                                return <ClientsPage 
                                                    clients={clients} 
                                                    setClients={setClients} 
                                                    orders={orders} 
                                                />;
                                            case 'storage':
                                                return <StoragePage 
                                                    drawers={drawers} 
                                                    setDrawers={setDrawers} 
                                                    orders={orders} 
                                                    setOrders={setOrders}
                                                    clients={clients}
                                                    settings={settings}
                                                    stores={stores}
                                                />;
                                            case 'delivery':
                                                return <DeliveryPage 
                                                    orders={orders} 
                                                    clients={clients} 
                                                    stores={stores} 
                                                    setOrders={setOrders}
                                                    companyInfo={companyInfo}
                                                />;
                                            case 'billing':
                                                return <BillingPage 
                                                    orders={orders} 
                                                    clients={clients} 
                                                    stores={stores} 
                                                    currencies={currencies}
                                                    companyInfo={companyInfo}
                                                    settings={settings}
                                                />;
                                            case 'settings':
                                                return <SettingsPage 
                                                    stores={stores} setStores={setStores}
                                                    shippingCompanies={shippingCompanies} setShippingCompanies={setShippingCompanies}
                                                    currencies={currencies} setCurrencies={setCurrencies}
                                                    settings={settings} setSettings={setSettings}
                                                    companyInfo={companyInfo} setCompanyInfo={setCompanyInfo}
                                                    setView={handleViewChange}
                                                    users={users} setUsers={setUsers}
                                                    globalActivityLog={globalActivityLog}
                                                    logAction={logAction}
                                                />;
                                            default:
                                                return <div>View not found</div>;
                                        }
                                    })()}
                                </div>
                            </div>
                        </main>
                    </div>
                </>
            </ToastProvider>
        </AuthContext.Provider>
    );
};