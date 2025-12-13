
import { Order, Client, Store, Shipment, ShippingCompany, StorageDrawer, Currency, User, OrderStatus, ShippingType, ShipmentStatus, GlobalActivityLog, UserRole } from '../types';

export const MOCK_USERS: User[] = [
    {
        id: 'mock-admin-id',
        username: 'Admin User',
        email: 'medcheikh7.c@gmail.com',
        role: UserRole.ADMIN,
        permissions: {
            canAccessSettings: true,
            canManageUsers: true,
            canViewAuditLog: true,
            orders: { view: true, create: true, edit: true, delete: true, changeStatus: true, revertStatus: true },
            shipments: { view: true, create: true, edit: true, delete: true, changeStatus: true, revertStatus: true },
            clients: { view: true, create: true, edit: true, delete: true },
            storage: { view: true, create: true, edit: true, delete: true },
            delivery: { view: true, process: true },
            billing: { view: true, print: true },
            settings: { canEditCompany: true, canEditSystem: true, canEditStores: true, canEditShipping: true, canEditCurrencies: true }
        }
    }
];

export const MOCK_CLIENTS: Client[] = [
    { id: 'c1', name: 'محمد أحمد', phone: '22334455', gender: 'male', address: 'نواكشوط' },
    { id: 'c2', name: 'فاطمة سيدي', phone: '33445566', gender: 'female', address: 'تفرغ زينة' },
    { id: 'c3', name: 'التاجر الموريتاني', phone: '44556677', gender: 'male', address: 'السوق الكبير' },
];

export const MOCK_STORES: Store[] = [
    { id: 's1', name: 'Shein', estimatedDeliveryDays: 10, country: 'الصين', website: 'https://shein.com' },
    { id: 's2', name: 'Amazon', estimatedDeliveryDays: 14, country: 'الولايات المتحدة', website: 'https://amazon.com' },
    { id: 's3', name: 'AliExpress', estimatedDeliveryDays: 20, country: 'الصين', website: 'https://aliexpress.com' },
];

export const MOCK_SHIPPING_COMPANIES: ShippingCompany[] = [
    { 
        id: 'sc1', 
        name: 'DHL', 
        originCountry: 'Dubai', 
        destinationCountry: 'Nouakchott',
        rates: { fast: 500, normal: 300 },
        addresses: { origin: 'Dubai Silicon Oasis', destination: 'Nouakchott Airport Road' },
        contactMethods: [{ type: 'Phone', value: '+97150000000' }]
    },
    { 
        id: 'sc2', 
        name: 'Aramex',
        originCountry: 'China',
        destinationCountry: 'Nouakchott',
        rates: { fast: 450, normal: 250 },
        contactMethods: [{ type: 'Email', value: 'contact@aramex.com' }] 
    },
    { id: 'sc3', name: 'Local Cargo' },
];

export const MOCK_CURRENCIES: Currency[] = [
    { id: 'cur1', name: 'دولار أمريكي', code: 'USD', rate: 40 },
    { id: 'cur2', name: 'يورو', code: 'EUR', rate: 43 },
    { id: 'cur3', name: 'درهم إماراتي', code: 'AED', rate: 11 },
];

export const MOCK_DRAWERS: StorageDrawer[] = [
    { id: 'd1', name: 'A', capacity: 20, rows: 4, columns: 5 },
    { id: 'd2', name: 'B', capacity: 24, rows: 4, columns: 6 },
    { id: 'd3', name: 'C', capacity: 25, rows: 5, columns: 5 },
];

export const MOCK_SHIPMENTS: Shipment[] = [
    {
        id: 'sh1',
        shipmentNumber: 'SH-2023-001',
        shippingType: ShippingType.NORMAL,
        shippingCompanyId: 'sc3',
        departureDate: '2023-10-01',
        expectedArrivalDate: '2023-10-15',
        status: ShipmentStatus.ARRIVED,
        country: 'Dubai',
        numberOfBoxes: 5,
        boxes: [{ id: 'b1', boxNumber: 1, status: 'arrived', arrivalDate: '2023-10-14' }],
        trackingNumber: 'TRK123456'
    }
];

export const MOCK_ORDERS: Order[] = [
    {
        id: 'o1',
        localOrderId: 'FCD1001',
        globalOrderId: 'G-998877',
        clientId: 'c1',
        storeId: 's1',
        price: 50,
        currency: 'USD',
        priceInMRU: 2000,
        commission: 200,
        quantity: 1,
        amountPaid: 1000,
        shippingType: ShippingType.NORMAL,
        orderDate: '2023-10-01',
        expectedArrivalDate: '2023-10-15',
        status: OrderStatus.STORED,
        weight: 1.5,
        shippingCost: 420,
        storageLocation: 'A-01',
        trackingNumber: 'CN123456789',
        history: []
    },
    {
        id: 'o2',
        localOrderId: 'FCD1002',
        clientId: 'c2',
        storeId: 's2',
        price: 100,
        currency: 'EUR',
        priceInMRU: 4300,
        commission: 430,
        quantity: 2,
        amountPaid: 4730,
        shippingType: ShippingType.FAST,
        orderDate: '2023-10-05',
        expectedArrivalDate: '2023-10-10',
        status: OrderStatus.ARRIVED_AT_OFFICE,
        weight: 0.5,
        shippingCost: 225,
        history: []
    }
];

export const MOCK_LOGS: GlobalActivityLog[] = [
    {
        id: 'l1',
        timestamp: new Date().toISOString(),
        user: 'System',
        action: 'System Init',
        entityType: 'Settings',
        entityId: 'sys',
        details: 'تم تحميل البيانات التجريبية'
    }
];
