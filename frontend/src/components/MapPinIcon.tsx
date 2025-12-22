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
  width = 10, 
  height = 13, 
  style,
  className 
}) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 10 13" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
    >
      <path 
        d="M5 0C7.76142 3.5792e-08 10 2.23858 10 5C10 6.35979 9.47776 7.89684 8.63965 9.24902C7.80007 10.6036 6.61152 11.8246 5.22363 12.5186L5 12.6299L4.77637 12.5186C3.38848 11.8246 2.19993 10.6036 1.36035 9.24902C0.574601 7.98131 0.0663157 6.55109 0.00585938 5.25684L0 5C0 2.23858 2.23858 0 5 0ZM5 1C2.79086 1 1 2.79086 1 5L1.00488 5.21387C1.05627 6.29462 1.4901 7.55866 2.21094 8.72168C2.92985 9.88153 3.90662 10.8958 5 11.5059C6.09338 10.8958 7.07015 9.88153 7.78906 8.72168C8.55801 7.48103 9 6.1254 9 5C9 2.85996 7.31944 1.11211 5.20605 1.00488L5 1ZM5 3.5C5.82842 3.5 6.5 4.17158 6.5 5C6.49999 5.82841 5.82842 6.5 5 6.5C4.17159 6.49999 3.50001 5.82841 3.5 5C3.5 4.17159 4.17159 3.50001 5 3.5Z" 
        fill="currentColor"
      />
    </svg>
  );
};

