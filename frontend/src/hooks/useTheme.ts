import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'blue' | 'green' | 'purple' | 'orange';

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

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    const stored = localStorage.getItem('theme');
    if (stored && stored in themes) {
      return stored as Theme;
    }
    // Fallback to dark mode preference
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
      return 'dark';
    }
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    // Remove all theme classes
    const root = document.documentElement;
    Object.values(themes).forEach((themeConfig) => {
      root.classList.remove(themeConfig.cssClass);
    });
    
    // Add current theme class
    root.classList.add(themes[theme].cssClass);
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
    
    // Also update darkMode for backward compatibility
    localStorage.setItem('darkMode', theme === 'dark' ? 'true' : 'false');
  }, [theme]);

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return { theme, setTheme: setThemeValue };
}




