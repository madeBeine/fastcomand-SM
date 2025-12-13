
import { OrderStatus, UserRole, Permissions } from './types';

// The 'name' property now holds the translation key (e.g. 'st_new') instead of the hardcoded Arabic string.
export const STATUS_DETAILS: { [key in OrderStatus]: { name: string; color: string; bgColor: string } } = {
  [OrderStatus.NEW]: { name: 'st_new', color: 'text-blue-800', bgColor: 'bg-blue-100 dark:bg-blue-900 dark:text-blue-300' },
  [OrderStatus.ORDERED]: { name: 'st_ordered', color: 'text-purple-800', bgColor: 'bg-purple-100 dark:bg-purple-900 dark:text-purple-300' },
  [OrderStatus.SHIPPED_FROM_STORE]: { name: 'st_shipped_from_store', color: 'text-indigo-800', bgColor: 'bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300' },
  [OrderStatus.ARRIVED_AT_HUB]: { name: 'st_arrived_at_hub', color: 'text-teal-800', bgColor: 'bg-teal-100 dark:bg-teal-900 dark:text-teal-300' },
  [OrderStatus.IN_TRANSIT]: { name: 'st_in_transit', color: 'text-amber-800', bgColor: 'bg-amber-100 dark:bg-amber-900 dark:text-amber-300' },
  [OrderStatus.ARRIVED_AT_OFFICE]: { name: 'st_arrived_at_office', color: 'text-pink-800', bgColor: 'bg-pink-100 dark:bg-pink-900 dark:text-pink-300' },
  [OrderStatus.STORED]: { name: 'st_stored', color: 'text-cyan-800', bgColor: 'bg-cyan-100 dark:bg-cyan-900 dark:text-cyan-300' },
  [OrderStatus.COMPLETED]: { name: 'st_completed', color: 'text-green-800', bgColor: 'bg-green-100 dark:bg-green-900 dark:text-green-300' },
  [OrderStatus.CANCELLED]: { name: 'st_cancelled', color: 'text-gray-600', bgColor: 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300' },
};

export const DEFAULT_EMPLOYEE_PERMISSIONS: Permissions = {
    canAccessSettings: false,
    canManageUsers: false,
    canViewAuditLog: false,
    orders: { view: true, create: true, edit: true, delete: false, changeStatus: true, revertStatus: false },
    shipments: { view: true, create: true, edit: true, delete: false, changeStatus: true, revertStatus: false },
    clients: { view: true, create: true, edit: true, delete: false },
    storage: { view: true, create: false, edit: false, delete: false },
    delivery: { view: true, process: true },
    billing: { view: true, print: true },
    settings: { canEditCompany: false, canEditSystem: false, canEditStores: false, canEditShipping: false, canEditCurrencies: false }
};

export const DEFAULT_VIEWER_PERMISSIONS: Permissions = {
    canAccessSettings: false,
    canManageUsers: false,
    canViewAuditLog: false,
    orders: { view: true, create: false, edit: false, delete: false, changeStatus: false, revertStatus: false },
    shipments: { view: true, create: false, edit: false, delete: false, changeStatus: false, revertStatus: false },
    clients: { view: true, create: false, edit: false, delete: false },
    storage: { view: true, create: false, edit: false, delete: false },
    delivery: { view: true, process: false },
    billing: { view: true, print: false },
    settings: { canEditCompany: false, canEditSystem: false, canEditStores: false, canEditShipping: false, canEditCurrencies: false }
};

export const DEFAULT_ADMIN_PERMISSIONS: Permissions = {
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
};
