import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, Theme, themes } from '../hooks/useTheme';

interface ThemePickerProps {
  /** If true, renders as a simple inline picker (for sidebar) */
  inline?: boolean;
}

export function ThemePicker({ inline = false }: ThemePickerProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isOpeningRef = useRef(false);

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (isOpen && buttonRef.current && !inline) {
      const rect = buttonRef.current.getBoundingClientRect();
      const position = {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      };
      console.log('[ThemePicker] Calculating dropdown position:', position, 'button rect:', rect);
      setDropdownPosition(position);
    }
  }, [isOpen, inline]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) {
      isOpeningRef.current = false;
      return;
    }

    // Set flag that we're opening, clear after delay
    isOpeningRef.current = true;
    const openingTimeout = setTimeout(() => {
      isOpeningRef.current = false;
      console.log('[ThemePicker] Opening delay complete');
    }, 300);

    const handleClickOutside = (event: MouseEvent) => {
      // Ignore clicks during opening delay
      if (isOpeningRef.current) {
        console.log('[ThemePicker] Ignoring click - still in opening delay');
        return;
      }

      const target = event.target as Node;
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(target) &&
        !buttonRef.current.contains(target)
      ) {
        console.log('[ThemePicker] Click outside detected, closing dropdown');
        setIsOpen(false);
      }
    };

    // Add listener AFTER opening delay completes (NOT in capture phase)
    const listenerTimeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      console.log('[ThemePicker] Click-outside listener attached');
    }, 300);

    return () => {
      clearTimeout(openingTimeout);
      clearTimeout(listenerTimeout);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown when theme changes
  useEffect(() => {
    if (isOpen && !inline) {
      setIsOpen(false);
    }
  }, [theme, isOpen, inline]);

  const handleThemeSelect = (themeKey: Theme) => {
    setTheme(themeKey);
  };

  // Inline version (for sidebar)
  if (inline) {
    return (
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <label style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: '500',
          color: 'var(--text-secondary)',
          marginBottom: '0.75rem',
        }}>
          <i className="fas fa-palette" style={{ marginRight: '0.5rem' }}></i>
          Theme
        </label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
        }}>
          {(Object.keys(themes) as Theme[]).map((themeKey) => {
            const themeConfig = themes[themeKey];
            const isSelected = theme === themeKey;
            
            return (
              <button
                key={themeKey}
                onClick={() => handleThemeSelect(themeKey)}
                style={{
                  padding: '0.75rem',
                  border: `2px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  backgroundColor: isSelected ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '12px',
                  fontWeight: isSelected ? '600' : '400',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
                title={themeConfig.displayName}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: getThemePreviewColor(themeKey),
                    border: '1px solid var(--border-color)',
                    marginBottom: '0.25rem',
                  }}
                />
                <span>{themeConfig.displayName}</span>
                {isSelected && (
                  <i 
                    className="fas fa-check" 
                    style={{
                      position: 'absolute',
                      top: '0.25rem',
                      right: '0.25rem',
                      fontSize: '10px',
                      color: 'var(--text-primary)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Dropdown version (for header)
  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          const newIsOpen = !isOpen;
          console.log('[ThemePicker] Button clicked, isOpen:', isOpen, 'newIsOpen:', newIsOpen);
          
          if (newIsOpen && buttonRef.current) {
            // Calculate position immediately when opening
            const rect = buttonRef.current.getBoundingClientRect();
            const position = {
              top: rect.bottom + 8,
              right: window.innerWidth - rect.right,
            };
            setDropdownPosition(position);
            console.log('[ThemePicker] Set position:', position);
            setIsOpen(true);
          } else {
            setIsOpen(false);
          }
        }}
        className="theme-picker-button"
        aria-label="Select theme"
        title="Select theme"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          borderRadius: '4px',
          position: 'relative',
        }}
      >
        <i 
          className="fas fa-palette"
          style={{ fontSize: '12px' }}
        />
      </button>

      {isOpen && dropdownPosition.top > 0 && (() => {
        console.log('[ThemePicker] Rendering dropdown at position:', dropdownPosition);
        return createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px var(--shadow-large)',
              padding: '1rem',
              minWidth: '280px',
              zIndex: 10000,
            }}
          >
          <div style={{
            fontSize: '12px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <i className="fas fa-palette"></i>
            <span>Theme</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
          }}>
            {(Object.keys(themes) as Theme[]).map((themeKey) => {
              const themeConfig = themes[themeKey];
              const isSelected = theme === themeKey;
              
              return (
                <button
                  key={themeKey}
                  onClick={() => handleThemeSelect(themeKey)}
                  style={{
                    padding: '0.75rem',
                    border: `2px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-color)'}`,
                    borderRadius: '6px',
                    backgroundColor: isSelected ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '12px',
                    fontWeight: isSelected ? '600' : '400',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }
                  }}
                  title={themeConfig.displayName}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: getThemePreviewColor(themeKey),
                      border: '1px solid var(--border-color)',
                      marginBottom: '0.25rem',
                    }}
                  />
                  <span>{themeConfig.displayName}</span>
                  {isSelected && (
                    <i 
                      className="fas fa-check" 
                      style={{
                        position: 'absolute',
                        top: '0.25rem',
                        right: '0.25rem',
                        fontSize: '10px',
                        color: 'var(--text-primary)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
        );
      })()}
    </div>
  );
}

function getThemePreviewColor(theme: Theme): string {
  switch (theme) {
    case 'light':
      return '#ffffff';
    case 'dark':
      return '#1a1a1a';
    case 'blue':
      return '#2563eb';
    case 'green':
      return '#16a34a';
    case 'purple':
      return '#9333ea';
    case 'orange':
      return '#ea580c';
    default:
      return '#ffffff';
  }
}

