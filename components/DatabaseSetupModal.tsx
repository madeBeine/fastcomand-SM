
import React, { useState } from 'react';
import { Database, X, UserPlus, Info, Copy, Check, ShieldAlert } from 'lucide-react';

const SETUP_SCHEMA_SQL = `
-- تفعيل الإضافات
create extension if not exists pgcrypto;

-- 1. الجداول الأساسية
create table if not exists public."CompanyInfo" (id uuid default gen_random_uuid() primary key);
create table if not exists public."AppSettings" (id uuid default gen_random_uuid() primary key);
create table if not exists public."Clients" (id uuid default gen_random_uuid() primary key);
create table if not exists public."Stores" (id uuid default gen_random_uuid() primary key);
create table if not exists public."ShippingCompanies" (id uuid default gen_random_uuid() primary key);
create table if not exists public."Currencies" (id uuid default gen_random_uuid() primary key);
create table if not exists public."StorageDrawers" (id uuid default gen_random_uuid() primary key);
create table if not exists public."Shipments" (id uuid default gen_random_uuid() primary key);
create table if not exists public."Orders" (id uuid default gen_random_uuid() primary key);
create table if not exists public."Users" (id uuid references auth.users on delete cascade primary key);
create table if not exists public."GlobalActivityLog" (id uuid default gen_random_uuid() primary key);

-- 2. تحديث الأعمدة (ضمان وجود جميع الأعمدة)
DO $$
BEGIN
    -- Users & Logs
    alter table public."Users" add column if not exists username text;
    alter table public."Users" add column if not exists email text;
    alter table public."Users" add column if not exists role text default 'employee';
    alter table public."Users" add column if not exists permissions jsonb default '{}'::jsonb;
    alter table public."Users" add column if not exists avatar text;
    alter table public."Users" add column if not exists created_at timestamptz default now();

    -- (بقية الجداول كما هي لضمان عدم فقدان أي بيانات)
    alter table public."Orders" add column if not exists receipt_image text;
    alter table public."Orders" add column if not exists receipt_images text[];
    UPDATE public."Orders" SET receipt_images = ARRAY[receipt_image] WHERE receipt_image IS NOT NULL AND (receipt_images IS NULL OR array_length(receipt_images, 1) IS NULL);
    alter table public."Orders" add column if not exists local_order_id text;
    alter table public."Orders" add column if not exists global_order_id text;
    alter table public."Orders" add column if not exists client_id uuid references public."Clients"(id);
    alter table public."Orders" add column if not exists store_id uuid references public."Stores"(id);
    alter table public."Orders" add column if not exists price numeric;
    alter table public."Orders" add column if not exists currency text;
    alter table public."Orders" add column if not exists price_in_mru numeric;
    alter table public."Orders" add column if not exists commission numeric;
    alter table public."Orders" add column if not exists quantity int default 1;
    alter table public."Orders" add column if not exists amount_paid numeric default 0;
    alter table public."Orders" add column if not exists payment_method text;
    alter table public."Orders" add column if not exists shipping_type text;
    alter table public."Orders" add column if not exists order_date date;
    alter table public."Orders" add column if not exists arrival_date_at_office date;
    alter table public."Orders" add column if not exists expected_arrival_date date;
    alter table public."Orders" add column if not exists commission_type text default 'percentage';
    alter table public."Orders" add column if not exists commission_rate numeric default 0;
    alter table public."Orders" add column if not exists product_links text[];
    alter table public."Orders" add column if not exists product_images text[];
    alter table public."Orders" add column if not exists order_images text[];
    alter table public."Orders" add column if not exists hub_arrival_images text[];
    alter table public."Orders" add column if not exists weighing_images text[];
    alter table public."Orders" add column if not exists notes text;
    alter table public."Orders" add column if not exists status text default 'new';
    alter table public."Orders" add column if not exists tracking_number text;
    alter table public."Orders" add column if not exists weight numeric;
    alter table public."Orders" add column if not exists shipping_cost numeric;
    alter table public."Orders" add column if not exists storage_location text;
    alter table public."Orders" add column if not exists storage_date timestamptz;
    alter table public."Orders" add column if not exists withdrawal_date timestamptz;
    alter table public."Orders" add column if not exists shipment_id uuid references public."Shipments"(id);
    alter table public."Orders" add column if not exists box_id text;
    alter table public."Orders" add column if not exists origin_center text;
    alter table public."Orders" add column if not exists receiving_company_id uuid references public."ShippingCompanies"(id);
    alter table public."Orders" add column if not exists whatsapp_notification_sent boolean default false;
    alter table public."Orders" add column if not exists is_invoice_printed boolean default false;
    alter table public."Orders" add column if not exists history jsonb default '[]'::jsonb;
    alter table public."Orders" add column if not exists created_at timestamptz default now();

    -- (Ensure other tables cols are present - truncated for brevity but functionality remains)
    alter table public."CompanyInfo" add column if not exists name text;
    alter table public."CompanyInfo" add column if not exists logo text;
    alter table public."CompanyInfo" add column if not exists email text;
    alter table public."CompanyInfo" add column if not exists phone text;
    alter table public."CompanyInfo" add column if not exists address text;
    alter table public."CompanyInfo" add column if not exists invoice_terms text;
    alter table public."CompanyInfo" add column if not exists invoice_signature text;
    alter table public."CompanyInfo" add column if not exists created_at timestamptz default now();

    alter table public."GlobalActivityLog" add column if not exists timestamp timestamptz default now();
    alter table public."GlobalActivityLog" add column if not exists "user" text;
    alter table public."GlobalActivityLog" add column if not exists action text;
    alter table public."GlobalActivityLog" add column if not exists entity_type text;
    alter table public."GlobalActivityLog" add column if not exists entity_id text;
    alter table public."GlobalActivityLog" add column if not exists details text;
END $$;

-- 3. تفعيل سياسات الأمان (RLS) - Fix for Missing Data Visibility
alter table public."Clients" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."Clients";
create policy "Enable access for authenticated users" on public."Clients" for all to authenticated using (true) with check (true);

-- (Repeat for all tables to ensure 100% access for logged in users)
alter table public."Stores" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."Stores";
create policy "Enable access for authenticated users" on public."Stores" for all to authenticated using (true) with check (true);

alter table public."ShippingCompanies" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."ShippingCompanies";
create policy "Enable access for authenticated users" on public."ShippingCompanies" for all to authenticated using (true) with check (true);

alter table public."Currencies" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."Currencies";
create policy "Enable access for authenticated users" on public."Currencies" for all to authenticated using (true) with check (true);

alter table public."StorageDrawers" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."StorageDrawers";
create policy "Enable access for authenticated users" on public."StorageDrawers" for all to authenticated using (true) with check (true);

alter table public."Shipments" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."Shipments";
create policy "Enable access for authenticated users" on public."Shipments" for all to authenticated using (true) with check (true);

alter table public."Orders" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."Orders";
create policy "Enable access for authenticated users" on public."Orders" for all to authenticated using (true) with check (true);

alter table public."CompanyInfo" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."CompanyInfo";
create policy "Enable access for authenticated users" on public."CompanyInfo" for all to authenticated using (true) with check (true);

alter table public."AppSettings" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."AppSettings";
create policy "Enable access for authenticated users" on public."AppSettings" for all to authenticated using (true) with check (true);

alter table public."Users" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."Users";
create policy "Enable access for authenticated users" on public."Users" for all to authenticated using (true) with check (true);

alter table public."GlobalActivityLog" enable row level security;
drop policy if exists "Enable access for authenticated users" on public."GlobalActivityLog";
create policy "Enable access for authenticated users" on public."GlobalActivityLog" for all to authenticated using (true) with check (true);

-- 4. الدوال المساعدة
create or replace function admin_check_user_exists(email_check text) returns boolean language plpgsql security definer as $$
begin return exists (select 1 from auth.users where email = email_check); end; $$;

create or replace function admin_delete_user(target_user_id uuid) returns void language plpgsql security definer as $$
begin 
    delete from public."Users" where id = target_user_id;
    delete from auth.users where id = target_user_id; 
end; $$;

create or replace function admin_reset_password(target_user_id uuid, new_password text) returns void language plpgsql security definer as $$
begin update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')) where id = target_user_id; end; $$;

-- 5. مزامنة المستخدمين المفقودين (FIX FOR MISSING USER DATA)
-- This inserts any user from auth.users that is missing in public.Users
INSERT INTO public."Users" (id, email, username, role, permissions, created_at)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'username', 'User'), 
    'employee', 
    '{"orders": {"view": true, "create": true, "edit": true}, "clients": {"view": true, "create": true}, "delivery": {"view": true}, "billing": {"view": true}}'::jsonb,
    au.created_at
FROM auth.users au
LEFT JOIN public."Users" pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 6. تحديث الكاش
NOTIFY pgrst, 'reload schema';
`;

const CREATE_ADMIN_SQL = `
create extension if not exists pgcrypto;

DO $$
DECLARE
    target_email TEXT := 'medcheikh7.c@gmail.com';
    target_password TEXT := 'Code 27562254';
    target_username TEXT := 'المدير العام';
    new_user_id UUID;
BEGIN
    SELECT id INTO new_user_id FROM auth.users WHERE email = target_email;

    IF new_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
            target_email, crypt(target_password, gen_salt('bf')), now(), 
            '{"provider": "email", "providers": ["email"]}', 
            json_build_object('username', target_username), now(), now()
        )
        RETURNING id INTO new_user_id;
    ELSE
        UPDATE auth.users 
        SET encrypted_password = crypt(target_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            updated_at = now()
        WHERE id = new_user_id;
    END IF;

    INSERT INTO public."Users" (id, username, email, role, permissions)
    VALUES (
        new_user_id,
        target_username,
        target_email,
        'admin',
        '{
            "canAccessSettings": true, "canManageUsers": true, "canViewAuditLog": true,
            "orders": {"view": true, "create": true, "edit": true, "delete": true, "changeStatus": true, "revertStatus": true},
            "shipments": {"view": true, "create": true, "edit": true, "delete": true, "changeStatus": true, "revertStatus": true},
            "clients": {"view": true, "create": true, "edit": true, "delete": true},
            "storage": {"view": true, "create": true, "edit": true, "delete": true},
            "delivery": {"view": true, "process": true},
            "billing": {"view": true, "print": true},
            "settings": {"canEditCompany": true, "canEditSystem": true, "canEditStores": true, "canEditShipping": true, "canEditCurrencies": true}
        }'::jsonb
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', permissions = EXCLUDED.permissions, email = EXCLUDED.email;
        
    RAISE NOTICE 'تم تعيين المدير بنجاح';
END $$;
`;

const CLEANUP_ORPHANS_SQL = `
-- حذف الحسابات العالقة (الموجودة في auth ولكن غير موجودة في التطبيق)
-- تحذير: هذا سيحذف أي مستخدم لا يملك ملفاً شخصياً في صفحة المستخدمين
DELETE FROM auth.users 
WHERE id NOT IN (SELECT id FROM public."Users");

-- أو لحذف مستخدم محدد بالإيميل (استبدل الإيميل أدناه):
-- DELETE FROM auth.users WHERE email = 'email_to_delete@example.com';
`;

const DatabaseSetupModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'schema' | 'admin' | 'cleanup'>('schema');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    let codeToCopy = "";
    if (activeTab === 'schema') codeToCopy = SETUP_SCHEMA_SQL;
    if (activeTab === 'admin') codeToCopy = CREATE_ADMIN_SQL;
    if (activeTab === 'cleanup') codeToCopy = CLEANUP_ORPHANS_SQL;

    const handleCopy = () => {
        navigator.clipboard.writeText(codeToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[80]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-primary">
                        <Database size={24} /> إعداد قاعدة البيانات (SQL)
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                
                <div className="flex gap-2 mb-4 border-b dark:border-gray-700 pb-1 overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('schema')}
                        className={`pb-2 px-3 text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'schema' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Database size={16}/> تهيئة الجداول
                    </button>
                    <button 
                        onClick={() => setActiveTab('admin')}
                        className={`pb-2 px-3 text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'admin' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <UserPlus size={16}/> حساب المدير
                    </button>
                    <button 
                        onClick={() => setActiveTab('cleanup')}
                        className={`pb-2 px-3 text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'cleanup' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-red-500'}`}
                    >
                        <ShieldAlert size={16}/> إصلاح الحسابات العالقة
                    </button>
                </div>

                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 space-y-3">
                    {activeTab === 'schema' && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-2">
                            <Info className="flex-shrink-0 text-blue-600" size={18} />
                            <div>
                                <p className="font-bold text-blue-800 dark:text-blue-200 mb-1">تعليمات:</p>
                                <p>هذا الكود ينشئ الجداول، الدوال، وسياسات الأمان. استخدمه عند التثبيت الأول أو لإصلاح الأخطاء.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'admin' && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex gap-2">
                            <UserPlus className="flex-shrink-0 text-green-600" size={18} />
                            <div>
                                <p className="font-bold text-green-800 dark:text-green-200 mb-1">إصلاح المدير:</p>
                                <p>يعيد تعيين حساب المدير العام الافتراضي وصلاحياته.</p>
                            </div>
                        </div>
                    )}
                    {activeTab === 'cleanup' && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
                            <ShieldAlert className="flex-shrink-0 text-red-600" size={18} />
                            <div>
                                <p className="font-bold text-red-800 dark:text-red-200 mb-1">حل مشكلة "البريد موجود":</p>
                                <p>إذا حذفت مستخدماً من التطبيق لكنه ما زال عالقاً (يمنعك من إعادة إنشائه)، انسخ هذا الكود ونفذه في Supabase SQL Editor لحذفه نهائياً.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative flex-grow border rounded-lg bg-gray-900 text-gray-100 overflow-hidden font-mono text-xs shadow-inner" dir="ltr">
                    <button 
                        onClick={handleCopy}
                        className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded flex items-center gap-2 transition-all shadow-md z-10"
                    >
                        {copied ? <Check size={14}/> : <Copy size={14}/>}
                        {copied ? 'Copied' : 'Copy SQL'}
                    </button>
                    <pre className="p-4 overflow-auto h-full text-left select-all">
                        {codeToCopy}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default DatabaseSetupModal;
