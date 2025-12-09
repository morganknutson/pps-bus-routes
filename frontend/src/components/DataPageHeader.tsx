import { Link, useLocation } from 'react-router-dom';

interface SchedulerStatus {
  enabled: boolean;
  lastRun: string | null;
  lastRunStatus: 'success' | 'error' | 'running' | null;
  lastRunError: string | null;
  nextRun: string | null;
}

interface DataPageHeaderProps {
  title?: string;
  showAutoUpdate?: boolean;
  schedulerStatus?: SchedulerStatus | null;
  onToggleScheduler?: () => void;
  schedulerLoading?: boolean;
}

export function DataPageHeader({
  title = 'Data Management',
  showAutoUpdate = false,
  schedulerStatus,
  onToggleScheduler,
  schedulerLoading = false,
}: DataPageHeaderProps) {
  const location = useLocation();
  const isRoutesActive = location.pathname === '/data';
  const isAllSchoolsActive = location.pathname === '/data/schools';

  return (
    <div
      style={{
        borderBottom: '1px solid #ddd',
        backgroundColor: 'white',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ fontSize: '18px', fontWeight: '600' }}>{title}</div>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link
            to="/data"
            style={{
              color: isRoutesActive ? '#4ECDC4' : '#000',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: isRoutesActive ? '600' : '500',
              transition: 'text-decoration 0.2s ease',
              padding: '0.5rem 0',
              borderBottom: isRoutesActive ? '2px solid #4ECDC4' : '2px solid transparent',
              marginBottom: '-2px',
            }}
            onMouseEnter={(e) => {
              if (!isRoutesActive) {
                e.currentTarget.style.textDecoration = 'underline';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRoutesActive) {
                e.currentTarget.style.textDecoration = 'none';
              }
            }}
          >
            Routes
          </Link>
          <Link
            to="/data/schools"
            style={{
              color: isAllSchoolsActive ? '#4ECDC4' : '#000',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: isAllSchoolsActive ? '600' : '500',
              transition: 'text-decoration 0.2s ease',
              padding: '0.5rem 0',
              borderBottom: isAllSchoolsActive ? '2px solid #4ECDC4' : '2px solid transparent',
              marginBottom: '-2px',
            }}
            onMouseEnter={(e) => {
              if (!isAllSchoolsActive) {
                e.currentTarget.style.textDecoration = 'underline';
              }
            }}
            onMouseLeave={(e) => {
              if (!isAllSchoolsActive) {
                e.currentTarget.style.textDecoration = 'none';
              }
            }}
          >
            All Schools
          </Link>
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {/* Auto-update Toggle - only show if enabled */}
        {showAutoUpdate && schedulerStatus && onToggleScheduler && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '12px', color: '#333' }}>
              {schedulerStatus.enabled ? 'Auto-update On' : 'Auto-update Paused'}
            </span>
            <label
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '50px',
                height: '26px',
              }}
            >
              <input
                type="checkbox"
                checked={schedulerStatus.enabled || false}
                onChange={onToggleScheduler}
                disabled={schedulerLoading || !schedulerStatus}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: schedulerLoading || !schedulerStatus ? 'not-allowed' : 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: schedulerStatus.enabled ? '#4ECDC4' : '#ccc',
                  transition: '0.3s',
                  borderRadius: '26px',
                  opacity: schedulerLoading ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%',
                    transform: schedulerStatus.enabled ? 'translateX(24px)' : 'translateX(0)',
                  }}
                />
              </span>
            </label>
          </div>
        )}

        {/* Map Viewer Button */}
        <Link
          to="/"
          style={{
            fontSize: '14px',
            color: '#000',
            textDecoration: 'none',
            padding: '0.5rem 1rem',
            border: '1px solid #000',
            borderRadius: '4px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          Map Viewer
        </Link>
      </div>
    </div>
  );
}

