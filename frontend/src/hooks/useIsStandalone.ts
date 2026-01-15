import { useState, useEffect } from 'react';

/**
 * Detects if the app is running in standalone mode (saved to home screen as PWA).
 * Returns true for:
 * - iOS Safari (navigator.standalone)
 * - Other browsers with display-mode: standalone
 */
export function useIsStandalone(): boolean {
    const [isStandalone, setIsStandalone] = useState(() => {
        // Check iOS Safari standalone mode
        if ('standalone' in window.navigator) {
            return (window.navigator as any).standalone === true;
        }
        // Check for display-mode: standalone (other browsers)
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(display-mode: standalone)').matches;
        }
        return false;
    });

    useEffect(() => {
        // Listen for display-mode changes (in case it changes dynamically)
        const mediaQuery = window.matchMedia('(display-mode: standalone)');

        const handleChange = (e: MediaQueryListEvent) => {
            setIsStandalone(e.matches || ('standalone' in window.navigator && (window.navigator as any).standalone === true));
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return isStandalone;
}
