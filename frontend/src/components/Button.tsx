import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { ChevronIcon } from './ChevronIcon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'dropdown';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  align?: 'left' | 'center';
  icon?: React.ReactNode;
  showChevron?: boolean;
  chevronDirection?: 'right' | 'down';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  align = 'left',
  icon,
  showChevron = false,
  chevronDirection,
  style,
  onMouseEnter,
  onMouseLeave,
  disabled,
  ...props
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const { isDarkMode } = useDarkMode();

  const getVariantStyles = () => {
    const baseStyles = {
      boxShadow: 'var(--shadow-button)',
      border: 'none',
      transition: 'all 0.2s ease',
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' as const : 'auto' as const,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          backgroundColor: isDarkMode
            ? (isHovered ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)') // Brighter in dark mode (swapped)
            : (isHovered ? '#3071da' : 'var(--brand-primary)'),
          color: isDarkMode ? 'var(--text-primary)' : 'var(--btn-primary-text)',
          boxShadow: isDarkMode ? 'inset 0px 0px 1px rgba(255, 255, 255, 0.25)' : 'var(--shadow-button)',
        };
      case 'secondary':
        return {
          ...baseStyles,
          backgroundColor: isDarkMode
            ? (isHovered ? 'var(--bg-tertiary)' : 'var(--bg-secondary)') // Less prominent in dark mode (swapped)
            : (isHovered ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.05)'),
          color: 'var(--text-primary)',
          boxShadow: isDarkMode ? 'inset 0px 0px 1px rgba(255, 255, 255, 0.25)' : 'var(--shadow-button)',
        };
      case 'tertiary':
      case 'dropdown':
        return {
          ...baseStyles,
          backgroundColor: isHovered
            ? (isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)') // Reduced opacity
            : 'transparent',
          color: 'var(--text-secondary)',
          boxShadow: isDarkMode ? 'inset 0px 0px 1px rgba(255, 255, 255, 0.25)' : 'var(--shadow-button)',
        };
      default:
        return baseStyles;
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      setIsHovered(true);
      if (onMouseEnter) onMouseEnter(e);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      setIsHovered(false);
      if (onMouseLeave) onMouseLeave(e);
    }
  };

  const fontSize = size === 'large' ? '14px' : size === 'medium' ? '12px' : '12px';
  const iconSize = `${parseInt(fontSize) - 2}px`; // Match typeface size - 2px

  // Centralized padding logic
  const verticalPadding = size === 'large' ? 14 : size === 'medium' ? 10 : 8;
  const baseHorizontalPadding = size === 'large' ? 34 : size === 'medium' ? 28 : 16;

  let leftPadding = (icon && (size === 'large' || size === 'medium'))
    ? (size === 'large' ? 23 : 20)
    : baseHorizontalPadding;

  let rightPadding = baseHorizontalPadding;

  // Specific override for left-aligned chevrons
  if ((showChevron || variant === 'dropdown') && align === 'left' && (size === 'large' || size === 'medium')) {
    const isDown = (chevronDirection as string) === 'down' || (variant === 'dropdown' && (!chevronDirection || (chevronDirection as string) === 'down'));

    leftPadding = size === 'large' ? 24 : 20;

    if (isDown) {
      rightPadding = size === 'large' ? 24 : 20;
    } else {
      rightPadding = size === 'large' ? 22 : 18;
    }
  }

  return (
    <button
      style={{
        width: fullWidth ? '100%' : 'auto',
        padding: `${verticalPadding}px ${rightPadding}px`, // Using symmetric vertical, asymmetric horizontal
        paddingLeft: `${leftPadding}px`,
        paddingRight: `${rightPadding}px`,
        borderRadius: 'var(--radius-pill)',
        fontSize: fontSize,
        fontWeight: '500', // Reduced from 600
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        gap: size === 'large' ? '16px' : '12px',
        outline: 'none',
        ...getVariantStyles(),
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      {...props}
    >
      {icon && (
        <div style={{
          fontSize: iconSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'inherit',
          flexShrink: 0,
        }}>
          {typeof icon === 'string' ? <i className={icon} /> : icon}
        </div>
      )}
      <span style={{
        flex: align === 'left' ? 1 : undefined,
        textAlign: align === 'left' ? 'left' : 'center'
      }}>
        {children}
      </span>
      {(showChevron || variant === 'dropdown') && (
        <ChevronIcon
          direction={chevronDirection || (variant === 'dropdown' ? 'down' : 'right')}
          size={size === 'large' ? 12 : 10}
          color="currentColor"
          style={{
            opacity: 0.6,
            marginLeft: '4px',
            flexShrink: 0
          }}
        />
      )}
    </button>
  );
};

