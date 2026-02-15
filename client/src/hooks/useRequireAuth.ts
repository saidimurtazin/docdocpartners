import { useAuth } from '@/_core/hooks/useAuth';

/**
 * Hook to require authentication for dashboard pages.
 * Redirects to /login if agent is not authenticated.
 * Uses server-side auth.me check (cookie-based).
 */
export function useRequireAuth() {
  return useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: '/login',
  });
}
