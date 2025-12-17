import { useTheme } from '../hooks/useTheme';

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const toggleDarkMode = () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  };

  return (
    <button
      className="dark-mode-toggle"
      onClick={toggleDarkMode}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'none',
        border: 'none',
        fontSize: '1.25rem',
        cursor: 'pointer',
        padding: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        borderRadius: '4px',
      }}
    >
      <i 
        className="fas fa-lightbulb" 
        style={{
          opacity: isDarkMode ? 0.4 : 1,
          filter: isDarkMode ? 'grayscale(1)' : 'none',
        }}
      />
    </button>
  );
}

