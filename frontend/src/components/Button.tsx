import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useIsMobile } from '../hooks/useMediaQuery';
import { ChevronIcon } from './ChevronIcon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'dropdown';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  align?: 'left' | 'center';
  icon?: React.ReactNode;
  showChevron?: boolean;
  chevronDirection?: 'right' | 'down';
  floating?: boolean;
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
  floating = false,
  style,
  onMouseEnter,
  onMouseLeave,
  disabled,
  ...props
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const { isDarkMode } = useDarkMode();
  const isMobile = useIsMobile();

  /* 
   * Dynamic variant styles based on theme and hover state.
   * This logic centralizes background, text color, and shadow definitions for consistency.
   */
  const getVariantStyles = () => {
    const baseStyles = {
      border: 'none',
      transition: 'all 0.2s ease',
      opacity: disabled ? 0.5 : 1, // Visual feedback for disabled state
      pointerEvents: disabled ? 'none' as const : 'auto' as const,
    };

    switch (variant) {
      case 'primary':
        /* Primary button: strong color in light mode, subtle glass effect in dark mode */
        return {
          ...baseStyles,
          backgroundColor: 
            isDarkMode ? (
              isHovered ? 'var(--bg-hover)' : 'var(--bg-primary)') : (
              isHovered ? 'var(--bg-hover)' : 'var(--bg-primary)'),
          color: 'var(--text-primary)',
          boxShadow: floating 
            ? 'var(--edge-inner-primary), var(--drop-shadow-floating-primary)' 
            : 'var(--edge-inner-primary), var(--drop-shadow-primary)', 
        };
      case 'secondary':
        /* Secondary button: subtle background that brightens on hover */
        return {
          ...baseStyles,
          backgroundColor: (isHovered ? 'var(--bg-primary)' : 'var(--bg-secondary)'),
          color: 'var(--text-primary)',
          boxShadow: floating
            ? 'var(--edge-inner-secondary), var(--drop-shadow-floating-secondary)'
            : 'var(--edge-inner-secondary), var(--drop-shadow-secondary)',
        };
      case 'tertiary':
        return {
          ...baseStyles,
          backgroundColor: (isHovered ? 'var(--bg-secondary)' : 'var(--bg-tertiary)'),
          color: 'var(--text-primary)',
          boxShadow: floating
            ? (isHovered ? 'var(--edge-inner-secondary), var(--drop-shadow-floating-secondary)' 
                        : 'var(--edge-inner-tertiary), var(--drop-shadow-floating-tertiary)')
            : (isHovered ? 'var(--edge-inner-secondary), var(--drop-shadow-secondary)' 
                        : 'var(--edge-inner-tertiary), var(--drop-shadow-tertiary)'),
        };
      case 'dropdown':
        /* Tertiary/Dropdown: Minimal styling, uses theme-based background variables */
        return {
          ...baseStyles,
          padding: '',
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

  /* 
   * SIZING LOGIC
   * We adjust font, icons, and padding dynamically between mobile and desktop
   * to maintain a premium feel on all screen sizes.
   */
  const fontSize = isMobile
    ? (size === 'large' ? '16px' : '14px')
    : (size === 'large' ? '14px' : '12px');

  const iconSize = isMobile ? fontSize : `${parseInt(fontSize) - 2}px`;

  // Dynamic vertical padding based on size and device
  const verticalPadding = isMobile
    ? (size === 'large' ? 18 : size === 'medium' ? 14 : 10)
    : (size === 'large' ? 14 : size === 'medium' ? 13 : 8);

  const chevronSize = isMobile
    ? (size === 'large' ? 14 : 12)
    : (size === 'large' ? 12 : 10);

  // Horizontal padding logic - usually symmetric unless an icon is present
  const baseHorizontalPadding = size === 'large' ? 34 : size === 'medium' ? 28 : 16;

  let leftPadding = (icon && (size === 'large' || size === 'medium'))
    ? (size === 'large' ? 23 : 20)
    : baseHorizontalPadding;

  let rightPadding = baseHorizontalPadding;

  /* 
   * Specific layout adjustments for dropdown-style buttons or buttons with chevrons.
   * Ensures the text remains well-balanced when extra visual weight is added to one side.
   */
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
        /* Consolidated padding from all the dynamic logic above */
        padding: `${verticalPadding}px ${rightPadding}px`,
        paddingLeft: `${leftPadding}px`,
        paddingRight: `${rightPadding}px`,
        borderRadius: 'var(--radius-pill)',
        fontSize: fontSize,
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        alignItems: 'center',
        /* Justification depends on alignment prop */
        justifyContent: align === 'left' ? 'flex-start' : 'center',
        gap: size === 'large' ? '16px' : '12px',
        outline: 'none',
        ...getVariantStyles(), // Merge variant-specific styles (bg, color, shadow)
        ...style, // Allow consumer to override anything
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
          {typeof icon === 'string' ? (
            <i className={icon} style={{ fontSize: iconSize }} />
          ) : React.isValidElement(icon) ? (
            React.cloneElement(icon as React.ReactElement<any>, {
              // Priority: if it's mobile, we want our larger size. 
              // If it's not mobile, we respect the passed size if it exists, otherwise use our default.
              size: isMobile ? parseInt(iconSize) : ((icon as React.ReactElement<any>).props.size || parseInt(iconSize)),
              style: {
                ...(icon as React.ReactElement<any>).props.style,
                ...(isMobile ? { fontSize: iconSize } : {}),
              }
            })
          ) : (
            icon
          )}
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
          size={chevronSize}
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

