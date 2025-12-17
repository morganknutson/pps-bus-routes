import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { useTheme } from '../hooks/useTheme';
import L from 'leaflet';

// Component that ensures map invalidates size after theme change
function TileLayerUpdater() {
  const { theme } = useTheme();
  const map = useMap();
  const prevThemeRef = useRef<string>(theme);
  
  useEffect(() => {
    // Only update if theme actually changed
    if (prevThemeRef.current === theme) {
      return;
    }
    
    console.log('[DarkModeTileLayer] Theme changed from', prevThemeRef.current, 'to', theme);
    prevThemeRef.current = theme;
    
    // Invalidate map size to ensure tiles redraw properly
    // Use a small timeout to allow the new tile layer to mount first
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [theme, map]);
  
  return null;
}

export function DarkModeTileLayer() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  
  return (
    <>
      <TileLayer
        key={theme} // Force re-render when theme changes
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








