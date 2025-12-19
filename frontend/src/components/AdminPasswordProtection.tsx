import { useState, useEffect } from 'react';

interface AdminPasswordProtectionProps {
  children: React.ReactNode;
}

/**
 * Password protection component for admin routes
 * Checks for authentication in sessionStorage and prompts for password if not authenticated
 */
export function AdminPasswordProtection({ children }: AdminPasswordProtectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  // Check if already authenticated in this session
  useEffect(() => {
    const authStatus = sessionStorage.getItem('adminAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Get password from environment variable or use default
    // In production, this should be set via environment variable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expectedPassword = (import.meta as any).env?.VITE_ADMIN_PASSWORD || 'admin123';

    if (password === expectedPassword) {
      sessionStorage.setItem('adminAuthenticated', 'true');
      setIsAuthenticated(true);
      setPassword('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  // Show loading state while checking authentication
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <div style={{
          fontSize: '16px',
          color: 'var(--text-secondary)',
        }}>
          Checking authentication...
        </div>
      </div>
    );
  }

  // If authenticated, render children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Show password prompt
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-primary)',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 12px var(--shadow-large)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <div style={{
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          <i 
            className="fas fa-lock" 
            style={{ 
              fontSize: '48px',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}
          />
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}>
            Admin Access
          </h1>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-tertiary)',
          }}>
            Please enter the password to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter password"
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '16px',
                border: `1px solid ${error ? '#ff4444' : 'var(--text-tertiary)'}`,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--text-secondary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--text-tertiary)';
              }}
            />
            {error && (
              <div style={{
                marginTop: '0.5rem',
                fontSize: '14px',
                color: '#ff4444',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <i className="fas fa-exclamation-circle" style={{ fontSize: '14px' }} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '16px',
              fontWeight: '500',
              backgroundColor: 'var(--text-secondary)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <i className="fas fa-sign-in-alt" style={{ marginRight: '0.5rem' }} />
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}







