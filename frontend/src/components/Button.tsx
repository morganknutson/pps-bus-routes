import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'medium',
  fullWidth = false,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props 
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const { isDarkMode } = useDarkMode();

  const getVariantStyles = () => {
    // Special styling for all buttons in dark mode
    if (isDarkMode) {
      return {
        backgroundColor: '#1C1C1C',
        color: 'var(--btn-primary-text)',
        border: 'none',
        boxShadow: 'inset 0px 0px 1px rgba(255, 255, 255, 0.25)',
      };
    }

    // Standard visual language for all buttons based on Figma "Button Base"
    const baseStyles = {
      backgroundColor: isHovered ? 'var(--text-tertiary)' : 'var(--btn-primary-bg)',
      color: 'var(--btn-primary-text)',
      border: 'none',
      boxShadow: 'var(--btn-primary-shadow)',
    };

    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'outline':
      case 'ghost':
        return baseStyles;
      default:
        return {};
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(true);
    if (onMouseEnter) onMouseEnter(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(false);
    if (onMouseLeave) onMouseLeave(e);
  };

  return (
    <button
      style={{
        width: fullWidth ? '100%' : 'auto',
        padding: size === 'large' ? '18px 24px' : size === 'medium' ? '14px 20px' : '8px 16px',
        borderRadius: '46px',
        fontSize: size === 'large' ? '18px' : size === 'medium' ? '16px' : '14px',
        fontWeight: '400',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        outline: 'none',
        ...getVariantStyles(),
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
};

