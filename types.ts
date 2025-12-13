
export enum OrderStatus {
  NEW = 'new',
  ORDERED = 'ordered',
  SHIPPED_FROM_STORE = 'shipped_from_store',
  ARRIVED_AT_HUB = 'arrived_at_hub',
  IN_TRANSIT = 'in_transit',
  ARRIVED_AT_OFFICE = 'arrived_at_office',
  STORED = 'stored',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled', // New Status
}

export enum ShippingType {
  FAST = 'fast',
  NORMAL = 'normal',
}

export enum ShipmentStatus {
    NEW = 'new',
    SHIPPED = 'shipped',
    PARTIALLY_ARRIVED = 'partially_arrived',
    ARRIVED = 'arrived',
    RECEIVED = 'received',
    DELAYED = 'delayed',
}

export interface ActivityLog {
  timestamp: string;
  activity: string;
  user: string;
}

export interface GlobalActivityLog {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    entityType: 'Order' | 'Shipment' | 'Client' | 'User' | 'Store' | 'ShippingCompany' | 'Currency' | 'Drawer' | 'Settings';
    entityId: string;
    details: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  address?: string;
  gender?: 'male' | 'female';
}

export interface Store {
  id: string;
  name: string;
  country?: string; 
  website?: string; 
  estimatedDeliveryDays: number;
  logo?: string; // New: Store Logo/Icon
}

export interface ContactMethod {
    type: string; // e.g., 'Phone', 'WhatsApp', 'Email'
    value: string;
}

export interface ShippingCompany {
  id: string;
  name: string;
  originCountry?: string; // e.g., China, UAE
  destinationCountry?: string; // e.g., Mauritania
  rates?: { fast: number; normal: number };
  addresses?: { origin: string; destination: string };
  contactMethods?: ContactMethod[];
}

export interface Currency {
  id: string;
  name: string;
  code: string;
  rate: number; // Rate against MRU (Ouguiya)
}

export interface Order {
  id: string;
  localOrderId: string;
  globalOrderId?: string;
  clientId: string;
  storeId: string;
  price: number;
  currency: string; // This will now be the currency code e.g., 'USD'
  priceInMRU?: number;
  commission?: number; // Assumed to be in MRU
  quantity: number;
  amountPaid: number; // This is in MRU
  paymentMethod?: string; // Added payment method
  shippingType: ShippingType;
  orderDate: string;
  arrivalDateAtOffice?: string;
  expectedArrivalDate: string;
  expectedHubArrivalStartDate?: string;
  expectedHubArrivalEndDate?: string;
  commissionType?: 'percentage' | 'fixed';
  commissionRate?: number;
  productLinks?: string[];
  productImages?: string[]; // Renamed from productImage
  orderImages?: string[];
  hubArrivalImages?: string[];
  weighingImages?: string[];
  notes?: string;
  status: OrderStatus;
  trackingNumber?: string;
  weight?: number;
  shippingCost?: number;
  storageLocation?: string; 
  storageDate?: string;
  withdrawalDate?: string;
  receiptImage?: string; 
  receiptImages?: string[]; // Support multiple receipts
  shipmentId?: string;
  boxId?: string;
  originCenter?: string; // e.g., "Dubai", "China"
  receivingCompanyId?: string;
  history?: ActivityLog[];
  whatsappNotificationSent?: boolean;
  isInvoicePrinted?: boolean; // New Field
}

export interface Box {
  id: string;
  boxNumber: number;
  status: 'in_transit' | 'arrived';
  arrivalDate?: string;
}

export interface Shipment {
  id:string;
  shipmentNumber: string;
  shippingType: ShippingType;
  shippingCompanyId: string;
  departureDate: string;
  expectedArrivalDate: string;
  status: ShipmentStatus;
  country?: string; // e.g., "Dubai", "China"
  totalWeight?: number;
  totalShippingCost?: number;
  receiptImage?: string;
  trackingNumber?: string;
  history?: ActivityLog[];
  numberOfBoxes: number;
  boxes: Box[];
}

export interface StorageDrawer {
  id: string;
  name: string;
  capacity: number; // Total slots (rows * columns)
  rows: number;     // Number of shelves/rows
  columns: number;  // Number of slots per row
}

export interface CompanyInfo {
    id?: string; // UUID from DB
    name: string;
    logo: string; // base64 string
    email: string;
    phone: string;
    address: string;
    invoiceTerms?: string;
    invoiceSignature?: string;
}

export interface AppSettings {
    id?: string; // UUID from DB
    commissionRate: number;
    shippingRates: { fast: number; normal: number };
    deliveryDays: {
        fast: { min: number; max: number };
        normal: { min: number; max: number };
    };
    defaultShippingType: ShippingType;
    defaultOriginCenter: string;
    paymentMethods?: string[];
    orderIdPrefix?: string;
    defaultCurrency?: string;
    viewOrder?: string[]; // List of View IDs in order
    whatsappTemplates?: {
        ar: string;
        en: string;
        fr: string;
    };
    calculatorShortLink?: string; // New: Custom short link for sharing
}

export enum UserRole {
    ADMIN = 'admin',
    EMPLOYEE = 'employee',
    VIEWER = 'viewer', // Read-only role
}

export interface PermissionSet {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export interface OrderPermissions extends PermissionSet {
    changeStatus: boolean;
    revertStatus: boolean;
}

export interface ShipmentPermissions extends PermissionSet {
    changeStatus: boolean;
    revertStatus: boolean;
}


export interface Permissions {
    canAccessSettings: boolean;
    canManageUsers: boolean;
    canViewAuditLog: boolean;
    orders: OrderPermissions;
    shipments: ShipmentPermissions;
    clients: PermissionSet;
    storage: PermissionSet;
    delivery: { view: boolean; process: boolean };
    billing: { view: boolean; print: boolean };
    settings: {
        canEditCompany: boolean;
        canEditSystem: boolean;
        canEditStores: boolean;
        canEditShipping: boolean;
        canEditCurrencies: boolean;
    };
}


export interface User {
    id: string;
    username: string;
    email?: string;
    password?: string; // Optional for security reasons when sending user data to client
    role: UserRole;
    permissions: Permissions;
    avatar?: string; // Added avatar field
}


export type View = 'dashboard' | 'orders' | 'shipments' | 'clients' | 'storage' | 'delivery' | 'billing' | 'settings' | 'users' | 'audit';

export type Theme = 'light' | 'dark';