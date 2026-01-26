import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDarkMode } from '../hooks/useDarkMode';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  preventClickOutsideClose?: boolean;
}

const ModalBase: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = '345px', // Exact width from Figma
  preventClickOutsideClose = false
}) => {
  const { isDarkMode } = useDarkMode();
  // Prevent scrolling on the body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

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
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-floating)',
          width: '100%',
          maxWidth: maxWidth,
          boxShadow: 'var(--edge-inner-secondary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          border: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

// Compound Components
export const ModalHeader: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ padding: 'var(--floating-header-padding)', display: 'flex', alignItems: 'flex-start', ...style }}>
    {children}
  </div>
);

export const ModalContent: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ padding: 'var(--floating-content-padding)', display: 'flex', flexDirection: 'column', gap: '16px', ...style }}>
    {children}
  </div>
);

export const ModalTitle: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <h2 style={{
    fontSize: '18px',
    fontWeight: '400',
    margin: 0,
    color: 'var(--text-primary)',
    lineHeight: '22px',
    fontFamily: "'Inter', sans-serif",
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
    margin: 0,
    fontFamily: "'Inter', sans-serif",
    ...style
  }}>
    {children}
  </p>
);

export const ModalFooter: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ padding: '10px 30px 30px', width: '100%', boxSizing: 'border-box', ...style }}>
    {children}
  </div>
);

// Map compound components to ModalBase
export const Modal = Object.assign(ModalBase, {
  Header: ModalHeader,
  Content: ModalContent,
  Title: ModalTitle,
  Description: ModalDescription,
  Footer: ModalFooter,
});
