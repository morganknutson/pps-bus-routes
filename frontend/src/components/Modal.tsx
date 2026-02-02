import React, { useEffect, Children, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { useDarkMode } from '../hooks/useDarkMode';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  preventClickOutsideClose?: boolean;
  static?: boolean;
}

const ModalBase: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = '345px', // Exact width from Figma
  preventClickOutsideClose = false,
  static: isStatic = false
}) => {
  const { isDarkMode } = useDarkMode();
  // Prevent scrolling on the body when modal is open
  useEffect(() => {
    if (isOpen && !isStatic) {
      document.body.style.overflow = 'hidden';
    } else if (!isStatic) {
      document.body.style.overflow = 'unset';
    }
    return () => { if (!isStatic) document.body.style.overflow = 'unset'; };
  }, [isOpen, isStatic]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-floating)',
        width: '100%',
        maxWidth: maxWidth,
        boxShadow: 'var(--edge-inner-secondary), var(--drop-shadow-floating-primary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: isStatic ? 'none' : 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        border: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  if (isStatic) {
    return modalContent;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--modal-backdrop)', // Exact color from Figma
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        animation: 'modalFadeIn 0.2s ease-out'
      }}
      onClick={() => !preventClickOutsideClose && onClose()}
    >
      <style>
        {`
          @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalSlideUp { 
            from { transform: translateY(20px) scale(0.98); opacity: 0; } 
            to { transform: translateY(0) scale(1); opacity: 1; } 
          }
        `}
      </style>
      {modalContent}
    </div>,
    document.body
  );
};

// Compound Components
// STRICT: icon is REQUIRED - TypeScript will enforce this for all new modals
// Layout: Icon top-left, children (title) below the icon with spacing above title
export const ModalHeader: React.FC<{ 
  children?: React.ReactNode; // Optional - can be empty if only icon is needed
  icon: React.ReactNode; // Required prop - agents must provide this
  style?: React.CSSProperties 
}> = ({ children, icon, style }) => (
  <div style={{ 
    padding: '34px 34px 0', 
    paddingBottom: 0,
    display: 'flex', 
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '36px', // Decides space between icon and title
    ...style 
  }}>
    {icon}
    {children}
  </div>
);

export const ModalContent: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ 
    padding: '0 34px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '0px', 
    ...style 
    }}>
    {children}
  </div>
);

export const ModalTitle: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <h2 style={{
    fontSize: '18px',
    fontWeight: '400',
    margin: '0 0 .5rem',
    color: 'var(--text-primary)',
    lineHeight: '22px',
    fontFamily: "'Inter', sans-serif",
    padding: '0',
    ...style
  }}>
    {children}
  </h2>
);

export const ModalDescription: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <p style={{
    fontSize: '14px',
    fontWeight: '400',
    lineHeight: '18px',
    color: '#828282',
    margin: '0 0 1.5rem',
    fontFamily: "'Inter', sans-serif",
    padding: '0',
    ...style
  }}>
    {children}
  </p>
);

// STRICT: Automatically enforces size="large" on all Button children
export const ModalFooter: React.FC<{ 
  children: React.ReactNode; 
  twoButtons?: boolean; // When true, arranges buttons side by side with equal width
  style?: React.CSSProperties 
}> = ({ children, twoButtons = false, style }) => {
  // Clone all Button children and enforce size="large"
  const processedChildren = Children.map(children, (child) => {
    if (isValidElement(child) && child.type === Button) {
      // Enforce 'large' size, but allow variant override (default to primary)
      const props: any = { 
        size: 'large', 
        variant: child.props.variant || 'primary',
        align: 'center'
      };
      
      if (twoButtons) {
        // Remove fullWidth and add flex: 1 for equal width distribution
        props.fullWidth = false;
        props.style = {
          ...(child.props.style || {}),
          flex: 1,
          width: '100%'
        };
      }
      
      return cloneElement(child as React.ReactElement<any>, props);
    }
    return child;
  });

  return (
    <div style={{ 
      padding: '10px 30px 30px', 
      width: '100%', 
      boxSizing: 'border-box',
      display: twoButtons ? 'flex' : 'block',
      gap: twoButtons ? '12px' : undefined,
      ...style 
    }}>
      {processedChildren}
    </div>
  );
};

// Map compound components to ModalBase
export const Modal = Object.assign(ModalBase, {
  Header: ModalHeader,
  Content: ModalContent,
  Title: ModalTitle,
  Description: ModalDescription,
  Footer: ModalFooter,
});
