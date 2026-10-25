/**
 * Roles and permissions. Mirrors public.permissions / role_permissions
 * (0003). The database is the authority — has_permission() guards every
 * policy and function; this file only decides what the admin UI shows.
 * Safe for client components (no secrets).
 */
export const ROLES = ['super_admin', 'manager', 'support'] as const;
export type AdminRole = (typeof ROLES)[number];

export const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super admin',
  manager: 'Manager',
  support: 'Support',
};

export const PERMISSIONS = [
  'dashboard',
  'revenue',
  'orders',
  'orders_edit',
  'orders_delete',
  'orders_export',
  'courier',
  'catalog',
  'inventory',
  'customers',
  'marketing',
  'courier_settings',
  'store_settings',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
/** 'staff' (staff & roles) belongs to super admins only and is not assignable. */
export type Capability = Permission | 'staff';

export const PERMISSION_LABEL: Record<Permission, string> = {
  dashboard: 'View dashboard',
  revenue: 'See sales amounts and reports',
  orders: 'View orders, change status, notes, assign, payments',
  orders_edit: 'Edit order items, prices, delivery and discount; add manual orders',
  orders_delete: 'Delete and restore orders',
  orders_export: 'Download orders CSV',
  courier: 'Send parcels to the courier',
  catalog: 'Products, categories, photos and coupons',
  inventory: 'Restock and adjust stock',
  customers: 'Customers and block list',
  marketing: 'Facebook Pixel, Conversions API and catalog',
  courier_settings: 'Courier API keys and options',
  store_settings: 'Store settings and delivery charges',
};

/** Defaults written by the migration; shown as a hint in the roles editor. */
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<AdminRole, 'super_admin'>, Permission[]> = {
  manager: ['dashboard', 'revenue', 'orders', 'orders_edit', 'orders_delete', 'orders_export', 'courier', 'catalog', 'inventory', 'customers'],
  support: ['dashboard', 'orders', 'courier', 'customers'],
};

export function isRole(v: unknown): v is AdminRole {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

export function isPermission(v: unknown): v is Permission {
  return typeof v === 'string' && (PERMISSIONS as readonly string[]).includes(v);
}

/** Capabilities of a role given the role's permission rows. */
export function capabilitiesFor(role: AdminRole, granted: readonly string[]): Set<Capability> {
  if (role === 'super_admin') return new Set<Capability>([...PERMISSIONS, 'staff']);
  return new Set(granted.filter(isPermission));
}

/** Settings tabs and who sees them. */
export const SETTINGS_TABS = [
  { key: 'store', label: 'Store', need: 'store_settings' },
  { key: 'delivery', label: 'Delivery', need: 'store_settings' },
  { key: 'payments', label: 'Payments', need: 'store_settings' },
  { key: 'courier', label: 'Courier', need: 'courier_settings' },
  { key: 'facebook', label: 'Facebook & tracking', need: 'marketing' },
  { key: 'staff', label: 'Staff & roles', need: 'staff' },
] as const satisfies readonly { key: string; label: string; need: Capability }[];
export type SettingsTab = (typeof SETTINGS_TABS)[number]['key'];
