/**
 * Domain utilities for separating admin and agent panels.
 * Supports two modes:
 *   1. Subdomain-based: admin.example.com → admin, example.com → agent
 *   2. Path-based (Railway): example.up.railway.app/admin → admin, everything else → agent
 */

/**
 * Check if current context is the admin panel.
 * Works both with subdomains (admin.domain.com) and path prefix (/admin).
 */
export function isAdminDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.startsWith('admin.') ||
    window.location.pathname.startsWith('/admin')
  );
}

/**
 * Get the base URL origin of the current app (protocol + host).
 */
export function getBaseDomain(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/**
 * Get login path based on current context.
 */
export function getLoginPath(): string {
  return isAdminDomain() ? '/admin/login' : '/login';
}

/**
 * Get dashboard path based on role.
 */
export function getDashboardPath(role?: 'admin' | 'agent'): string {
  if (role === 'admin') return '/admin';
  return '/dashboard';
}
