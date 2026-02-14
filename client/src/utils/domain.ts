/**
 * Domain utilities for separating admin and agent panels
 */

/**
 * Check if current hostname is admin subdomain
 */
export function isAdminDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('admin.');
}

/**
 * Get base domain (admin or main)
 */
export function getBaseDomain(): string {
  return isAdminDomain() ? 'admin.docdocpartners.ru' : 'docdocpartners.ru';
}

/**
 * Get login path based on current domain
 */
export function getLoginPath(): string {
  return '/login';
}

/**
 * Get dashboard path based on role
 */
export function getDashboardPath(role?: 'admin' | 'agent'): string {
  if (role === 'admin') return '/';
  return '/dashboard';
}
