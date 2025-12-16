import { TileLayer } from 'react-leaflet';
import { useDarkMode } from '../hooks/useDarkMode';

export function DarkModeTileLayer() {
  const { isDarkMode } = useDarkMode();
  
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      url={
        isDarkMode
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      }
    />
  );
}







