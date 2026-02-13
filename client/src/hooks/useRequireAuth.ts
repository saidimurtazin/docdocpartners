import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Hook to require authentication for dashboard pages
 * Redirects to /login if agent is not authenticated
 */
export function useRequireAuth() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if agent token exists in localStorage
    const hasToken = Boolean(localStorage.getItem('agent_token'));
    
    if (!hasToken) {
      // Redirect to login page
      setLocation('/login');
    }
  }, [setLocation]);
}
