import { useState, useEffect } from 'react';

interface BackendStatusProps {
  className?: string;
}

export function BackendStatus({ className }: BackendStatusProps) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const checkBackend = async () => {
      try {
        if (isMounted) {
          setIsChecking(true);
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch('/api/health', {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-cache',
        });
        
        clearTimeout(timeoutId);
        
        if (isMounted) {
          const isOk = response.ok;
          console.log('[BackendStatus] Health check response:', { status: response.status, ok: isOk });
          setIsOnline(isOk);
          setIsChecking(false);
        }
      } catch (error) {
        if (isMounted) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.warn('[BackendStatus] Health check timed out');
          } else {
            console.error('[BackendStatus] Health check failed:', error);
          }
          setIsOnline(false);
          setIsChecking(false);
        }
      }
    };

    // Check immediately
    checkBackend();

    // Check every 5 seconds
    const interval = setInterval(checkBackend, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isChecking && isOnline === null) {
    return (
      <div 
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '12px',
          color: 'var(--text-tertiary)',
        }}
        title="Checking backend status..."
      >
        <i className="fas fa-circle" style={{ fontSize: '8px', opacity: 0.5 }} />
        <span>Checking...</span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '12px',
        color: isOnline ? 'var(--text-primary)' : 'var(--text-tertiary)',
      }}
      title={isOnline ? 'Backend server is running' : 'Backend server is not responding'}
    >
      <i 
        className="fas fa-circle" 
        style={{ 
          fontSize: '8px', 
          color: isOnline ? '#4ade80' : '#ef4444',
        }} 
      />
      <span>{isOnline ? 'Backend Online' : 'Backend Offline'}</span>
    </div>
  );
}

