interface SchoolTypeFilters {
  elementary: boolean;
  middle: boolean;
  high: boolean;
}

interface SchoolTypeFilterProps {
  filters: SchoolTypeFilters;
  onChange: (filters: SchoolTypeFilters) => void;
}

export function SchoolTypeFilter({ filters, onChange }: SchoolTypeFilterProps) {
  return (
    <div style={{ padding: '1rem 2rem', backgroundColor: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={filters.elementary}
            onChange={(e) => onChange({ ...filters, elementary: e.target.checked })}
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={filters.middle}
            onChange={(e) => onChange({ ...filters, middle: e.target.checked })}
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={filters.high}
            onChange={(e) => onChange({ ...filters, high: e.target.checked })}
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
      </div>
    </div>
  );
}

export type { SchoolTypeFilters };



