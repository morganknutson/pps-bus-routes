import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { useDarkMode } from '../hooks/useDarkMode';
import L from 'leaflet';

// Component that ensures map invalidates size after theme change
function TileLayerUpdater() {
  const { isDarkMode } = useDarkMode();
  const map = useMap();
  const prevDarkModeRef = useRef<boolean>(isDarkMode);
  
  useEffect(() => {
    // Only update if dark mode actually changed
    if (prevDarkModeRef.current === isDarkMode) {
      return;
    }
    
    console.log('[DarkModeTileLayer] Dark mode changed from', prevDarkModeRef.current, 'to', isDarkMode);
    prevDarkModeRef.current = isDarkMode;
    
    // Invalidate map size to ensure tiles redraw properly
    // Use a small timeout to allow the new tile layer to mount first
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [isDarkMode, map]);
  
  return null;
}

export function DarkModeTileLayer() {
  const { isDarkMode } = useDarkMode();
  
  return (
    <>
      <TileLayer
        key={isDarkMode ? 'dark' : 'light'} // Force re-render when dark mode changes
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








