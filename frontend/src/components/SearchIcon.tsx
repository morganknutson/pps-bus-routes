import React from 'react';

interface SearchIconProps {
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Search icon component using custom SVG
 */
export function SearchIcon({ size = 11, color = 'var(--text-primary)', style, className }: SearchIconProps) {
  const sizeValue = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      width={sizeValue}
      height={sizeValue}
      viewBox="0 0 11 11"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M1.31803 1.31802C3.07539 -0.43934 5.92463 -0.43934 7.68199 1.31802C9.3198 2.95583 9.42979 5.54087 8.01483 7.30771L10.5104 9.8033C10.7057 9.99856 10.7057 10.3151 10.5104 10.5104C10.3152 10.7057 9.99857 10.7057 9.80331 10.5104L7.30772 8.01482C5.54088 9.42978 2.95583 9.31979 1.31803 7.68198C-0.439331 5.92462 -0.439331 3.07538 1.31803 1.31802ZM2.02513 2.02513C0.6583 3.39196 0.6583 5.60804 2.02513 6.97487C3.39197 8.34171 5.60805 8.34171 6.97488 6.97487C8.34172 5.60804 8.34172 3.39196 6.97488 2.02513C5.60805 0.658291 3.39197 0.658291 2.02513 2.02513Z"
        fill={color}
      />
    </svg>
  );
}

export default SearchIcon;
