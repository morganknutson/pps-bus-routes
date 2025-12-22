import React from 'react';

interface RouteIconProps {
  color?: string;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const RouteIcon: React.FC<RouteIconProps> = ({ 
  color = 'currentColor', 
  size = 12, 
  className,
  style 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 12 12" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path 
        d="M2 0C2.93171 0 3.71235 0.637683 3.93457 1.5H8C9.38071 1.5 10.5 2.61929 10.5 4C10.5 5.38071 9.38071 6.5 8 6.5H4C3.17157 6.5 2.5 7.17157 2.5 8C2.5 8.82843 3.17157 9.5 4 9.5H8.06543C8.28765 8.63768 9.06829 8 10 8C11.1046 8 12 8.89543 12 10C12 11.1046 11.1046 12 10 12C9.06829 12 8.28765 11.3623 8.06543 10.5H4C2.61929 10.5 1.5 9.38071 1.5 8C1.5 6.61929 2.61929 5.5 4 5.5H8C8.82843 5.5 9.5 4.82843 9.5 4C9.5 3.17157 8.82843 2.5 8 2.5H3.93457C3.71235 3.36232 2.93171 4 2 4C0.895431 4 0 3.10457 0 2C0 0.895431 0.895431 0 2 0ZM10 9C9.44772 9 9 9.44772 9 10C9 10.5523 9.44772 11 10 11C10.5523 11 11 10.5523 11 10C11 9.44772 10.5523 9 10 9ZM2 1C1.44772 1 1 1.44772 1 2C1 2.55228 1.44772 3 2 3C2.55228 3 3 2.55228 3 2C3 1.44772 2.55228 1 2 1Z" 
        fill={color}
      />
    </svg>
  );
};


