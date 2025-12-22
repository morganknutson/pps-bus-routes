import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../services/analytics';

/**
 * Hook to automatically track page views on route changes.
 * Place this in the root App component or any component that has access to the Router context.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on initial mount and whenever the path changes
    const currentPath = location.pathname + location.search;
    analyticsService.trackPageView(currentPath);
  }, [location]);
}


