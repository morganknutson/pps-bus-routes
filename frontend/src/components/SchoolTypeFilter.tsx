import { useEffect, useState, useRef } from 'react';
import { ChevronIcon } from './ChevronIcon';

interface SchoolTypeFilters {
  elementary: boolean;
  middle: boolean;
  high: boolean;
  hybrid: boolean;
  noRoutes: boolean;
}

interface SchoolTypeFilterProps {
  filters: SchoolTypeFilters;
  onChange: (filters: SchoolTypeFilters) => void;
}

const FILTER_COLORS = {
  elementary: '#2196F3',
  middle: '#4CAF50',
  high: '#FF9800',
  hybrid: '#9C27B0',
  noRoutes: '#f44'
};

export function SchoolTypeFilter({ filters, onChange }: SchoolTypeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFilterChange = (key: keyof SchoolTypeFilters) => {
    onChange({ ...filters, [key]: !filters[key] });
  };
  
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const isAllSelected = activeFilterCount === 5;

  const CustomCheckbox = ({ checked, color, size = 18 }: { checked: boolean; color: string; size?: number }) => (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        border: `2px solid ${checked ? color : 'var(--text-tertiary)'}`,
        backgroundColor: checked ? color : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s ease',
      }}
    >
      {checked && (
        <i className="fas fa-check" style={{ fontSize: `${size * 0.55}px`, color: 'white' }}></i>
      )}
    </div>
  );

  return (
    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-route-list)' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.25rem',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: '9999px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            height: '44px',
            boxSizing: 'border-box',
            boxShadow: '0 1px 3px var(--shadow-large)',
            transition: 'background-color 0.2s, transform 0.1s',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span style={{ color: 'var(--text-primary)' }}>Filters</span>
          {!isAllSelected && (
            <span style={{
              color: 'var(--text-tertiary)',
              fontSize: '11px',
              fontWeight: '400',
              marginLeft: '0.5rem',
              opacity: 0.8
            }}>
              ({activeFilterCount} active)
            </span>
          )}
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
          }}>
            <ChevronIcon direction={isOpen ? 'up' : 'down'} size={10} />
          </div>
        </button>

        {isOpen && (
          <div
            ref={popoverRef}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 4px 20px var(--shadow-large)',
              padding: '0.5rem',
              zIndex: 1000,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  padding: '0.75rem',
                  borderRadius: '8px',
                  userSelect: 'none',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={filters.elementary}
                  onChange={() => handleFilterChange('elementary')}
                  style={{ display: 'none' }}
                />
                <CustomCheckbox checked={filters.elementary} color={FILTER_COLORS.elementary} />
                <span style={{ flex: 1 }}>Elementary Schools</span>
              </label>

              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  padding: '0.75rem',
                  borderRadius: '8px',
                  userSelect: 'none',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={filters.middle}
                  onChange={() => handleFilterChange('middle')}
                  style={{ display: 'none' }}
                />
                <CustomCheckbox checked={filters.middle} color={FILTER_COLORS.middle} />
                <span style={{ flex: 1 }}>Middle Schools</span>
              </label>

              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  padding: '0.75rem',
                  borderRadius: '8px',
                  userSelect: 'none',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={filters.high}
                  onChange={() => handleFilterChange('high')}
                  style={{ display: 'none' }}
                />
                <CustomCheckbox checked={filters.high} color={FILTER_COLORS.high} />
                <span style={{ flex: 1 }}>High Schools</span>
              </label>
              
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  padding: '0.75rem',
                  borderRadius: '8px',
                  userSelect: 'none',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={filters.hybrid}
                  onChange={() => handleFilterChange('hybrid')}
                  style={{ display: 'none' }}
                />
                <CustomCheckbox checked={filters.hybrid} color={FILTER_COLORS.hybrid} />
                <span style={{ flex: 1 }}>Hybrid Schools</span>
              </label>

              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0.25rem 0' }}></div>

              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  padding: '0.75rem',
                  borderRadius: '8px',
                  userSelect: 'none',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={filters.noRoutes}
                  onChange={() => handleFilterChange('noRoutes')}
                  style={{ display: 'none' }}
                />
                <CustomCheckbox checked={filters.noRoutes} color={FILTER_COLORS.noRoutes} />
                <span style={{ flex: 1 }}>School without route data</span>
                <i className="fas fa-exclamation-circle" style={{ color: '#f44', fontSize: '12px' }}></i>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { SchoolTypeFilters };
