import React from 'react';

interface ChevronIconProps {
  direction?: 'down' | 'up' | 'left' | 'right';
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Custom chevron icon component using custom SVG
 * Supports rotation for different directions
 */
export function ChevronIcon({ 
  direction = 'down', 
  size = 11, 
  color = '#777777', 
  style, 
  className 
}: ChevronIconProps) {
  // Calculate dimensions maintaining 11:5 aspect ratio
  const width = typeof size === 'number' ? size : parseFloat(size);
  const height = (width * 5) / 11; // Maintain 11:5 aspect ratio
  const widthValue = typeof size === 'number' ? `${width}px` : size;
  const heightValue = `${height}px`;
  
  // Calculate rotation based on direction
  const rotations: Record<string, number> = {
    down: 0,
    right: -90,
    up: 180,
    left: 90,
  };
  
  const rotation = rotations[direction] || 0;
  
  return (
    <svg
      width={widthValue}
      height={heightValue}
      viewBox="0 0 11 5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center',
        transition: 'transform 0.2s',
        ...style,
      }}
      className={className}
      aria-hidden="true"
    >
      <path 
        d="M0.750061 0.750122L5.25006 3.75012L9.75006 0.750122" 
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Chevron icon as a React component for use in JSX
 * Default size: 11x5, Default color: #777777, Default direction: down
 * Usage: <ChevronIcon /> or <ChevronIcon direction="right" size={11} color="#777777" />
 */
export default ChevronIcon;


