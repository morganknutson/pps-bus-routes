import React from 'react';

interface XIconProps {
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Custom X icon component using pixelated SVG
 * This uses a custom pixelated X SVG design
 */
export function XIcon({ size = 10, color = '#777777', style, className }: XIconProps) {
  const sizeValue = typeof size === 'number' ? `${size}px` : size;
  
  return (
    <svg
      width={sizeValue}
      height={sizeValue}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {/* Custom pixelated X icon - replace the path below with your custom SVG path */}
      {/* For now using a simple X - replace with your pixelated X SVG path */}
      <path
        d="M2 2 L14 14 M14 2 L2 14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/**
 * X icon as a React component for use in JSX
 * Default size: 8.5x8.5, Default color: #777777
 * Usage: <XIcon /> or <XIcon size={8.5} color="#777777" />
 */
export default XIcon;

