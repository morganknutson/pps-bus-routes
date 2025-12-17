import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'auto' | 'blue' | 'green' | 'purple' | 'orange';

export interface ThemeConfig {
  name: string;
  displayName: string;
  cssClass: string;
}

export const themes: Record<Theme, ThemeConfig> = {
  light: {
    name: 'light',
    displayName: 'Light',
    cssClass: 'theme-light',
  },
  dark: {
    name: 'dark',
    displayName: 'Dark',
    cssClass: 'theme-dark',
  },
  auto: {
    name: 'auto',
    displayName: 'Auto',
    cssClass: 'theme-auto',
  },
  blue: {
    name: 'blue',
    displayName: 'Blue',
    cssClass: 'theme-blue',
  },
  green: {
    name: 'green',
    displayName: 'Green',
    cssClass: 'theme-green',
  },
  purple: {
    name: 'purple',
    displayName: 'Purple',
    cssClass: 'theme-purple',
  },
  orange: {
    name: 'orange',
    displayName: 'Orange',
    cssClass: 'theme-orange',
  },
};

// Get the effective theme (resolves 'auto' to 'light' or 'dark' based on system preference)
export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }
  // For color themes (blue, green, etc.), treat as dark
  return 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Always use auto theme
    return 'auto';
  });

  // Get effective theme for applying CSS classes
  const effectiveTheme = getEffectiveTheme(theme);

  useEffect(() => {
    // Always use auto theme
    const root = document.documentElement;
    Object.values(themes).forEach((themeConfig) => {
      root.classList.remove(themeConfig.cssClass);
    });
    
    // Add auto theme class (with effective theme)
    root.classList.add(`theme-${effectiveTheme}`);
    root.classList.add('theme-auto');
    
    // Save to localStorage
    localStorage.setItem('theme', 'auto');
    
    // Also update darkMode for backward compatibility
    const isDark = effectiveTheme === 'dark';
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
  }, [effectiveTheme]);

  // Listen for system theme changes (always in auto mode)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Force re-render by updating state
      const root = document.documentElement;
      const newEffectiveTheme = getEffectiveTheme('auto');
      
      // Remove old theme class
      root.classList.remove('theme-light', 'theme-dark');
      // Add new theme class
      root.classList.add(`theme-${newEffectiveTheme}`);
      root.classList.add('theme-auto');
      
      // Update darkMode for backward compatibility
      localStorage.setItem('darkMode', newEffectiveTheme === 'dark' ? 'true' : 'false');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const setThemeValue = (newTheme: Theme) => {
    // Theme is always auto, ignore changes
    // This is kept for API compatibility but does nothing
  };

  return { theme: 'auto' as const, setTheme: setThemeValue, effectiveTheme };
}




