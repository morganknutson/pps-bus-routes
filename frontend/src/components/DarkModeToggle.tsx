import { useDarkMode } from '../hooks/useDarkMode';

export function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      className="dark-mode-toggle"
      onClick={toggleDarkMode}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'relative',
        width: '61.2px',
        height: '27.2px',
        borderRadius: '13.6px',
        border: 'none',
        cursor: 'pointer',
        padding: '0',
        margin: '0',
        background: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)',
        transition: 'background 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.9';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      {/* Switch track */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '13.6px',
        }}
      >
        {/* Sun icon (left side - centered where thumb is in light mode) */}
        <i
          className="fas fa-sun"
          style={{
            position: 'absolute',
            left: '16.15px',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '10px',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.9)',
            transition: 'color 0.3s ease',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
        {/* Moon icon (right side - centered where thumb is in dark mode) */}
        <i
          className="fas fa-moon"
          style={{
            position: 'absolute',
            left: '45.05px',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '10px',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.3)',
            transition: 'color 0.3s ease',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </div>
      
      {/* Switch thumb */}
      <div
        style={{
          position: 'absolute',
          width: '27.2px',
          height: '22.1px',
          borderRadius: '11.05px',
          background: 'white',
          left: isDarkMode ? 'calc(100% - 29.75px)' : '2.55px',
          top: '2.55px',
          transition: 'left 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          zIndex: 2,
        }}
      >
        {/* Icon inside thumb */}
        <i
          className={isDarkMode ? 'fas fa-moon' : 'fas fa-sun'}
          style={{
            fontSize: '10px',
            color: 'var(--brand-primary)',
            transition: 'transform 0.3s ease',
          }}
        />
      </div>
    </button>
  );
}

