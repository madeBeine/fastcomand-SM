
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration: Use Environment Variables for Security
// Local Development: Create a .env file with these values
// Cloudflare/Production: Add these to Environment Variables in dashboard

// Safe access to environment variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export interface DBOrder {
  id: string;
  local_order_id: string;
  global_order_id?: string;
  client_id: string;
  store_id: string;
  price: number;
  currency: string;
  price_in_mru?: number;
  commission?: number;
  quantity: number;
  amount_paid: number;
  payment_method?: string;
  shipping_type: string;
  order_date: string;
  arrival_date_at_office?: string;
  expected_arrival_date: string;
  expected_hub_arrival_start_date?: string;
  expected_hub_arrival_end_date?: string;
  commission_type?: 'percentage' | 'fixed';
  commission_rate?: number;
  product_links?: string[];
  product_images?: string[]; 
  order_images?: string[];   
  hub_arrival_images?: string[]; 
  weighing_images?: string[];    
  notes?: string;
  status: string;
  tracking_number?: string;
  weight?: number;
  shipping_cost?: number;
  storage_location?: string;
  storage_date?: string;
  withdrawal_date?: string;      
  receipt_image?: string;
  receipt_images?: string[];        
  whatsapp_notification_sent?: boolean; 
  shipment_id?: string;
  box_id?: string;
  origin_center?: string;
  receiving_company_id?: string;
  history?: any[]; // JSONB
  is_invoice_printed?: boolean;
}

export interface DBClient {
  id: string;
  name: string;
  phone: string;
  whatsapp_number?: string;
  address?: string;
  gender?: 'male' | 'female';
}

export interface DBStore {
  id: string;
  name: string;
  country?: string; 
  website?: string; 
  logo?: string;
  estimated_delivery_days: number;
}

export interface DBShipment {
  id: string;
  shipment_number: string;
  shipping_type: string;
  shipping_company_id: string;
  departure_date: string;
  expected_arrival_date: string;
  status: string;
  country?: string;
  total_weight?: number;         
  total_shipping_cost?: number;  
  receipt_image?: string;        
  tracking_number?: string;      
  history?: any[];
  number_of_boxes: number;
  boxes: any[]; // JSONB
}

export interface DBShippingCompany {
  id: string;
  name: string;
  origin_country?: string; 
  destination_country?: string; 
  rates?: any; 
  addresses?: any; 
  contact_methods?: any[]; 
}

export interface DBStorageDrawer {
  id: string;
  name: string;
  capacity: number;
  rows?: number;
  columns?: number;
}

export interface DBCurrency {
  id: string;
  name: string;
  code: string;
  rate: number;
}

export interface DBUser {
  id: string;
  username: string;
  role: string;
  permissions: any; // JSONB
  avatar?: string;
}

export interface DBGlobalActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
}

export interface DBCompanyInfo {
  id: string;
  name: string;
  logo: string;
  email: string;
  phone: string;
  address: string;
  invoice_terms?: string;      
  invoice_signature?: string;  
}

export interface DBAppSettings {
  id: string;
  commission_rate: number;
  shipping_rates: any; 
  delivery_days: any;  
  default_shipping_type: string;
  default_origin_center: string;
  payment_methods?: string[]; 
  order_id_prefix?: string;   
  default_currency?: string; 
  view_order?: string[];
  whatsapp_templates?: any;
}

export interface Database {
  public: {
    Tables: {
      Orders: {
        Row: DBOrder;
        Insert: Partial<DBOrder>;
        Update: Partial<DBOrder>;
      };
      Clients: {
        Row: DBClient;
        Insert: Partial<DBClient>;
        Update: Partial<DBClient>;
      };
      Stores: {
        Row: DBStore;
        Insert: Partial<DBStore>;
        Update: Partial<DBStore>;
      };
      Shipments: {
        Row: DBShipment;
        Insert: Partial<DBShipment>;
        Update: Partial<DBShipment>;
      };
      ShippingCompanies: {
        Row: DBShippingCompany;
        Insert: Partial<DBShippingCompany>;
        Update: Partial<DBShippingCompany>;
      };
      StorageDrawers: {
        Row: DBStorageDrawer;
        Insert: Partial<DBStorageDrawer>;
        Update: Partial<DBStorageDrawer>;
      };
      Currencies: {
        Row: DBCurrency;
        Insert: Partial<DBCurrency>;
        Update: Partial<DBCurrency>;
      };
      Users: {
        Row: DBUser;
        Insert: DBUser;
        Update: Partial<DBUser>;
      };
      GlobalActivityLog: {
        Row: DBGlobalActivityLog;
        Insert: Partial<DBGlobalActivityLog>;
        Update: Partial<DBGlobalActivityLog>;
      };
      CompanyInfo: {
        Row: DBCompanyInfo;
        Insert: Partial<DBCompanyInfo>;
        Update: Partial<DBCompanyInfo>;
      };
      AppSettings: {
        Row: DBAppSettings;
        Insert: Partial<DBAppSettings>;
        Update: Partial<DBAppSettings>;
      };
    };
  };
}

let supabase: SupabaseClient<Database> | null = null;
let supabaseInitializationError: string | null = null;

try {
    if (supabaseUrl && supabaseAnonKey) {
        supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage,
            },
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
                heartbeatIntervalMs: 5000, 
            },
        });
    } else {
        supabaseInitializationError = "مفاتيح الاتصال بقاعدة البيانات مفقودة. يرجى التأكد من ملف .env";
        console.warn("Supabase credentials not found. Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }
} catch (e: any) {
    supabaseInitializationError = e.message;
    console.error("Supabase Init Error:", e);
}

export const getErrorMessage = (error: any): string => {
    if (!error) return 'Unknown error';
    
    // Check for string error
    if (typeof error === 'string') {
        const lower = error.toLowerCase();
        if (lower.includes('failed to fetch')) return 'فشل الاتصال بالخادم. تأكد من الإنترنت.';
        if (lower.includes('relation') && lower.includes('does not exist')) return 'قاعدة البيانات غير مهيئة (الجداول مفقودة). يرجى الضغط على زر إعداد قاعدة البيانات في صفحة المستخدمين.';
        return error;
    }
    
    // Check for standard Error object
    if (error instanceof Error) return error.message;
    
    // Check for Supabase/Postgrest Error structure
    if (error.message) return error.message;
    if (error.error_description) return error.error_description;
    if (error.details) return error.details;
    if (error.hint) return error.hint;
    
    // Recursive check for nested error object
    if (error.error && typeof error.error === 'object') return getErrorMessage(error.error);

    // Specific Postgres Codes
    if (error.code === '42P01') return 'الجداول غير موجودة. يرجى إعداد قاعدة البيانات.';
    if (error.code === '23505') return 'قيمة مكررة (Duplicate Key).';
    if (error.code) return `Database Error: ${error.code}`;

    // JSON Stringify as last resort
    try {
        const json = JSON.stringify(error);
        if (json && json !== '{}' && json !== '[]') return `Error: ${json}`;
    } catch {}

    return `Unknown error: ${String(error)}`;
};

export { supabase, supabaseUrl, supabaseAnonKey, supabaseInitializationError };
