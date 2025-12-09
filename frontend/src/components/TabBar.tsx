interface TabBarProps {
  activeTab: 'schools' | 'routes';
  onTabChange: (tab: 'schools' | 'routes') => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-primary)',
      padding: 0,
      transition: 'background-color 0.3s ease, border-color 0.3s ease',
      width: '100%',
    }}>
      <button
        onClick={() => onTabChange('schools')}
        style={{
          flex: 1,
          padding: '1.25rem 1rem',
          border: 'none',
          borderBottom: activeTab === 'schools' ? '2px solid var(--text-primary)' : '2px solid transparent',
          backgroundColor: 'transparent',
          color: activeTab === 'schools' ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontWeight: activeTab === 'schools' ? '600' : '500',
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          marginBottom: '-2px',
        }}
        onMouseEnter={(e) => {
          if (activeTab !== 'schools') {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }
        }}
        onMouseLeave={(e) => {
          if (activeTab !== 'schools') {
            e.currentTarget.style.color = 'var(--text-tertiary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <i className="fas fa-graduation-cap" style={{ fontSize: '12px' }}></i>
          Schools
        </span>
      </button>
      <button
        onClick={() => onTabChange('routes')}
        style={{
          flex: 1,
          padding: '1.25rem 1rem',
          border: 'none',
          borderBottom: activeTab === 'routes' ? '2px solid var(--text-primary)' : '2px solid transparent',
          backgroundColor: 'transparent',
          color: activeTab === 'routes' ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontWeight: activeTab === 'routes' ? '600' : '500',
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          marginBottom: '-2px',
        }}
        onMouseEnter={(e) => {
          if (activeTab !== 'routes') {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }
        }}
        onMouseLeave={(e) => {
          if (activeTab !== 'routes') {
            e.currentTarget.style.color = 'var(--text-tertiary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M3 6h18M3 18h18"></path>
            <circle cx="6" cy="12" r="2"></circle>
            <circle cx="18" cy="12" r="2"></circle>
          </svg>
          Routes
        </span>
      </button>
    </div>
  );
}

