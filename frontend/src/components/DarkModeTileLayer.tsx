import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { useTheme } from '../hooks/useTheme';
import L from 'leaflet';

// Component that ensures map invalidates size after theme change
function TileLayerUpdater() {
  const { theme, effectiveTheme } = useTheme();
  const map = useMap();
  const prevThemeRef = useRef<string>(effectiveTheme);
  
  useEffect(() => {
    // Only update if effective theme actually changed
    if (prevThemeRef.current === effectiveTheme) {
      return;
    }
    
    console.log('[DarkModeTileLayer] Effective theme changed from', prevThemeRef.current, 'to', effectiveTheme, '(theme:', theme, ')');
    prevThemeRef.current = effectiveTheme;
    
    // Invalidate map size to ensure tiles redraw properly
    // Use a small timeout to allow the new tile layer to mount first
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [theme, effectiveTheme, map]);
  
  return null;
}

export function DarkModeTileLayer() {
  const { effectiveTheme } = useTheme();
  const isDarkMode = effectiveTheme === 'dark';
  
  return (
    <>
      <TileLayer
        key={effectiveTheme} // Force re-render when effective theme changes
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={
          isDarkMode
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        }
      />
      <TileLayerUpdater />
    </>
  );
}








