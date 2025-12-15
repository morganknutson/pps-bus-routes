import { useEffect } from 'react';

interface SchoolTypeFilters {
  elementary: boolean;
  middle: boolean;
  high: boolean;
  hybrid: boolean;
}

interface SchoolTypeFilterProps {
  filters: SchoolTypeFilters;
  onChange: (filters: SchoolTypeFilters) => void;
}

export function SchoolTypeFilter({ filters, onChange }: SchoolTypeFilterProps) {
  useEffect(() => {
    console.log('[SchoolTypeFilter] Component mounted');
    console.log('[SchoolTypeFilter] Initial filters:', filters);
    console.log('[SchoolTypeFilter] onChange function:', typeof onChange === 'function' ? 'is function' : 'NOT A FUNCTION');
  }, []);
  
  useEffect(() => {
    console.log('[SchoolTypeFilter] Filters changed:', filters);
  }, [filters]);
  
  console.log('[SchoolTypeFilter] Rendering with filters:', filters);
  
  const handleElementaryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[SchoolTypeFilter] Elementary clicked, current value:', filters.elementary);
    const newFilters = { ...filters, elementary: !filters.elementary };
    console.log('[SchoolTypeFilter] Calling onChange with:', newFilters);
    onChange(newFilters);
  };
  
  const handleMiddleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[SchoolTypeFilter] Middle clicked');
    onChange({ ...filters, middle: !filters.middle });
  };
  
  const handleHighClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[SchoolTypeFilter] High clicked');
    onChange({ ...filters, high: !filters.high });
  };
  
  return (
    <div style={{ padding: '1rem 2rem', backgroundColor: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <label 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '12px', userSelect: 'none' }}
          onClick={handleElementaryClick}
          onMouseDown={() => {
            console.log('[SchoolTypeFilter] Elementary mousedown');
          }}
          onMouseUp={() => {
            console.log('[SchoolTypeFilter] Elementary mouseup');
          }}
        >
          <input
            type="checkbox"
            checked={filters.elementary}
            onChange={(e) => {
              console.log('[SchoolTypeFilter] Input onChange triggered for elementary:', e.target.checked);
              onChange({ ...filters, elementary: e.target.checked });
            }}
            style={{ display: 'none' }}
          />
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: '2px solid #2196F3',
              backgroundColor: filters.elementary ? '#2196F3' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {filters.elementary && (
              <i className="fas fa-check" style={{ fontSize: '10px', color: 'white' }}></i>
            )}
          </div>
          <span>Elementary</span>
        </label>
        <label 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '12px', userSelect: 'none' }}
          onClick={handleMiddleClick}
        >
          <input
            type="checkbox"
            checked={filters.middle}
            onChange={(e) => {
              console.log('[SchoolTypeFilter] Input onChange triggered for middle:', e.target.checked);
              onChange({ ...filters, middle: e.target.checked });
            }}
            style={{ display: 'none' }}
          />
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: '2px solid #4CAF50',
              backgroundColor: filters.middle ? '#4CAF50' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {filters.middle && (
              <i className="fas fa-check" style={{ fontSize: '10px', color: 'white' }}></i>
            )}
          </div>
          <span>Middle</span>
        </label>
        <label 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '12px', userSelect: 'none' }}
          onClick={handleHighClick}
        >
          <input
            type="checkbox"
            checked={filters.high}
            onChange={(e) => {
              console.log('[SchoolTypeFilter] Input onChange triggered for high:', e.target.checked);
              onChange({ ...filters, high: e.target.checked });
            }}
            style={{ display: 'none' }}
          />
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: '2px solid #FF9800',
              backgroundColor: filters.high ? '#FF9800' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {filters.high && (
              <i className="fas fa-check" style={{ fontSize: '10px', color: 'white' }}></i>
            )}
          </div>
          <span>High</span>
        </label>
        <label 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '12px', userSelect: 'none' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[SchoolTypeFilter] Hybrid clicked');
            onChange({ ...filters, hybrid: !filters.hybrid });
          }}
        >
          <input
            type="checkbox"
            checked={filters.hybrid}
            onChange={(e) => {
              console.log('[SchoolTypeFilter] Input onChange triggered for hybrid:', e.target.checked);
              onChange({ ...filters, hybrid: e.target.checked });
            }}
            style={{ display: 'none' }}
          />
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: '2px solid #9C27B0',
              backgroundColor: filters.hybrid ? '#9C27B0' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {filters.hybrid && (
              <i className="fas fa-check" style={{ fontSize: '10px', color: 'white' }}></i>
            )}
          </div>
          <span>Hybrid</span>
        </label>
      </div>
    </div>
  );
}

export type { SchoolTypeFilters };
