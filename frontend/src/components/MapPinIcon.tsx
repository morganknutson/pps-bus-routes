import React from 'react';

interface MapPinIconProps {
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Custom map pin icon component used throughout the app.
 * This is the same icon used on the "Find my stop" button on the map.
 */
export const MapPinIcon: React.FC<MapPinIconProps> = ({ 
  width = 9, 
  height = 12, 
  style,
  className 
}) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 9 12" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
    >
      <path 
        d="M4.5 0C6.98528 3.22128e-08 9 2.01472 9 4.5C9 6.98526 7.0714 10.2856 4.5 11.5713C1.9286 10.2856 3.08342e-08 6.98526 0 4.5C0 2.01472 2.01472 0 4.5 0ZM4.5 2.57129C3.43488 2.57129 2.57129 3.43488 2.57129 4.5C2.57129 5.56512 3.43488 6.42871 4.5 6.42871C5.56512 6.42871 6.42871 5.56512 6.42871 4.5C6.42871 3.43488 5.56512 2.57129 4.5 2.57129Z" 
        fill="currentColor"
      />
    </svg>
  );
};

