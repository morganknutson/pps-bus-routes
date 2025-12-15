import { useState, useEffect, useRef } from 'react';

interface ServerStatus {
  name: string;
  serverType?: string;
  status: 'checking' | 'online' | 'offline';
  lastChecked: Date | null;
  uptime?: string;
  error?: string;
}

const formatUptime = (uptimeMs: number): string => {
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);
  
  if (uptimeDays > 0) {
    return `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m`;
  } else if (uptimeHours > 0) {
    return `${uptimeHours}h ${uptimeMinutes % 60}m`;
  } else if (uptimeMinutes > 0) {
    return `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
  } else {
    return `${uptimeSeconds}s`;
  }
};

export function ServersPage() {
  // Track frontend start time for uptime calculation
  const frontendStartTime = useRef<number>(Date.now());

  const [backendStatus, setBackendStatus] = useState<ServerStatus>({
    name: 'Backend Server',
    status: 'checking',
    lastChecked: null,
  });

  const [frontendStatus, setFrontendStatus] = useState<ServerStatus>({
    name: 'Frontend Server',
    serverType: 'Frontend React App',
    status: 'online', // Frontend is always online if this page is visible
    lastChecked: new Date(),
    uptime: '0s',
  });

  const [isRestartingBackend, setIsRestartingBackend] = useState(false);
  const [isRestartingFrontend, setIsRestartingFrontend] = useState(false);

  const checkBackendStatus = async () => {
    setBackendStatus(prev => ({ ...prev, status: 'checking', lastChecked: null }));
    
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          setBackendStatus({
            name: 'Backend Server',
            serverType: data.serverType || 'Backend API Server',
            status: 'online',
            lastChecked: new Date(),
            uptime: data.uptime || 'Unknown',
          });
        } else {
          setBackendStatus({
            name: 'Backend Server',
            status: 'offline',
            lastChecked: new Date(),
            error: 'Unexpected response format',
          });
        }
      } else {
        setBackendStatus({
          name: 'Backend Server',
          status: 'offline',
          lastChecked: new Date(),
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error: any) {
      setBackendStatus({
        name: 'Backend Server',
        status: 'offline',
        lastChecked: new Date(),
        error: error.message || 'Failed to connect to backend server',
      });
    }
  };

  const restartServer = async (processName: 'pps-backend' | 'pps-frontend') => {
    const setIsRestarting = processName === 'pps-backend' ? setIsRestartingBackend : setIsRestartingFrontend;
    setIsRestarting(true);
    
    try {
      console.log(`[ServersPage] Restarting ${processName}...`);
      const response = await fetch('/api/servers/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ processName }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If server restarted before sending response, treat as success
        if (processName === 'pps-backend' && !response.ok) {
          console.log(`[ServersPage] Backend restart initiated (server may have restarted before response)`);
          setTimeout(() => {
            checkBackendStatus();
          }, 3000);
          return;
        }
        throw new Error('Invalid response from server');
      }

      if (data.success) {
        console.log(`[ServersPage] Successfully restarted ${processName}`);
        // Wait a moment for the server to restart, then check status
        setTimeout(() => {
          if (processName === 'pps-backend') {
            checkBackendStatus();
          } else {
            // For frontend, reset the uptime counter
            frontendStartTime.current = Date.now();
            setFrontendStatus(prev => ({
              ...prev,
              lastChecked: new Date(),
            }));
          }
        }, 2000);
      } else {
        console.error(`[ServersPage] Failed to restart ${processName}:`, data.message);
        alert(`Failed to restart ${processName}: ${data.message}`);
      }
    } catch (error: any) {
      console.error(`[ServersPage] Error restarting ${processName}:`, error);
      
      // For frontend restarts, network errors are expected since the frontend
      // restarts immediately and the connection is lost. Treat as success.
      if (processName === 'pps-frontend' && 
          (error.message === 'Failed to fetch' || 
           error.message.includes('network') ||
           error.name === 'TypeError')) {
        console.log(`[ServersPage] Frontend restart initiated (connection lost as expected)`);
        // Reset the uptime counter since we're restarting
        frontendStartTime.current = Date.now();
        setFrontendStatus(prev => ({
          ...prev,
          lastChecked: new Date(),
        }));
        // Don't show error alert - this is expected behavior
        return;
      }
      
      alert(`Error restarting ${processName}: ${error.message}`);
    } finally {
      setIsRestarting(false);
    }
  };

  useEffect(() => {
    // Check backend status on mount
    checkBackendStatus();
    
    // Update frontend uptime every second
    const frontendUptimeInterval = setInterval(() => {
      const uptimeMs = Date.now() - frontendStartTime.current;
      setFrontendStatus(prev => ({
        ...prev,
        uptime: formatUptime(uptimeMs),
      }));
    }, 1000);
    
    // Set up auto-refresh every 5 seconds
    const backendCheckInterval = setInterval(() => {
      checkBackendStatus();
    }, 5000);

    return () => {
      clearInterval(frontendUptimeInterval);
      clearInterval(backendCheckInterval);
    };
  }, []);

  const getStatusColor = (status: ServerStatus['status']) => {
    switch (status) {
      case 'online':
        return '#4ECDC4';
      case 'offline':
        return '#FF6B6B';
      case 'checking':
        return '#FFA500';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: ServerStatus['status']) => {
    switch (status) {
      case 'online':
        return 'fa-check-circle';
      case 'offline':
        return 'fa-times-circle';
      case 'checking':
        return 'fa-spinner fa-spin';
      default:
        return 'fa-question-circle';
    }
  };

  const formatLastChecked = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour === 1) return '1 hour ago';
    return `${diffHour} hours ago`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: 'var(--bg-primary)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        backgroundColor: 'var(--bg-secondary)',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 12px var(--shadow-large)',
      }}>
        <h1 style={{
          margin: '0 0 2rem 0',
          fontSize: '28px',
          fontWeight: '600',
          color: 'var(--text-primary)',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
        }}>
          <i className="fas fa-server" style={{ fontSize: '24px' }}></i>
          Server Status
        </h1>

        {/* Backend Server Status */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1.5rem',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <i 
                className={`fas ${getStatusIcon(backendStatus.status)}`}
                style={{
                  fontSize: '20px',
                  color: getStatusColor(backendStatus.status),
                }}
              ></i>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}>
                {backendStatus.name}
              </h2>
            </div>
            <div style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              backgroundColor: getStatusColor(backendStatus.status),
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
            }}>
              {backendStatus.status}
            </div>
          </div>
          
          {backendStatus.error && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#fee',
              color: '#c33',
              borderRadius: '6px',
              fontSize: '14px',
            }}>
              <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem' }}></i>
              {backendStatus.error}
            </div>
          )}
          
          {backendStatus.serverType && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <i className="fas fa-server" style={{ fontSize: '11px' }}></i>
              {backendStatus.serverType}
            </div>
          )}
          
          {backendStatus.uptime && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <i className="fas fa-hourglass-half" style={{ fontSize: '11px' }}></i>
              Uptime: {backendStatus.uptime}
            </div>
          )}
          
          <div style={{
            marginTop: '0.75rem',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <i className="fas fa-clock" style={{ fontSize: '10px' }}></i>
            Last checked: {formatLastChecked(backendStatus.lastChecked)}
          </div>

          {/* Restart Button */}
          <button
            onClick={() => restartServer('pps-backend')}
            disabled={isRestartingBackend}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.75rem',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: isRestartingBackend ? '#999' : '#FF6B6B',
              border: 'none',
              borderRadius: '6px',
              cursor: isRestartingBackend ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              if (!isRestartingBackend) {
                e.currentTarget.style.backgroundColor = '#e55a5a';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRestartingBackend) {
                e.currentTarget.style.backgroundColor = '#FF6B6B';
              }
            }}
          >
            <i className={`fas ${isRestartingBackend ? 'fa-spinner fa-spin' : 'fa-redo'}`}></i>
            {isRestartingBackend ? 'Restarting...' : 'Restart Server'}
          </button>
        </div>

        {/* Frontend Server Status */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1.5rem',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <i 
                className={`fas ${getStatusIcon(frontendStatus.status)}`}
                style={{
                  fontSize: '20px',
                  color: getStatusColor(frontendStatus.status),
                }}
              ></i>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}>
                {frontendStatus.name}
              </h2>
            </div>
            <div style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              backgroundColor: getStatusColor(frontendStatus.status),
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
            }}>
              {frontendStatus.status}
            </div>
          </div>
          
          {frontendStatus.serverType && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <i className="fas fa-server" style={{ fontSize: '11px' }}></i>
              {frontendStatus.serverType}
            </div>
          )}
          
          {frontendStatus.uptime && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <i className="fas fa-hourglass-half" style={{ fontSize: '11px' }}></i>
              Uptime: {frontendStatus.uptime}
            </div>
          )}
          
          <div style={{
            marginTop: '0.75rem',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <i className="fas fa-clock" style={{ fontSize: '10px' }}></i>
            Last checked: {formatLastChecked(frontendStatus.lastChecked)}
          </div>

          {/* Restart Button */}
          <button
            onClick={() => restartServer('pps-frontend')}
            disabled={isRestartingFrontend}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.75rem',
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: isRestartingFrontend ? '#999' : '#FF6B6B',
              border: 'none',
              borderRadius: '6px',
              cursor: isRestartingFrontend ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              if (!isRestartingFrontend) {
                e.currentTarget.style.backgroundColor = '#e55a5a';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRestartingFrontend) {
                e.currentTarget.style.backgroundColor = '#FF6B6B';
              }
            }}
          >
            <i className={`fas ${isRestartingFrontend ? 'fa-spinner fa-spin' : 'fa-redo'}`}></i>
            {isRestartingFrontend ? 'Restarting...' : 'Restart Server'}
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={checkBackendStatus}
          disabled={backendStatus.status === 'checking'}
          style={{
            width: '100%',
            padding: '0.875rem',
            fontSize: '16px',
            fontWeight: '600',
            color: 'white',
            backgroundColor: backendStatus.status === 'checking' ? '#999' : '#4ECDC4',
            border: 'none',
            borderRadius: '8px',
            cursor: backendStatus.status === 'checking' ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
          onMouseEnter={(e) => {
            if (backendStatus.status !== 'checking') {
              e.currentTarget.style.backgroundColor = '#3db8a8';
            }
          }}
          onMouseLeave={(e) => {
            if (backendStatus.status !== 'checking') {
              e.currentTarget.style.backgroundColor = '#4ECDC4';
            }
          }}
        >
          <i className={`fas ${backendStatus.status === 'checking' ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
          {backendStatus.status === 'checking' ? 'Checking...' : 'Refresh Status'}
        </button>

        {/* Info */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}>
          <i className="fas fa-info-circle" style={{ marginRight: '0.5rem' }}></i>
          Status updates automatically every 5 seconds
        </div>
      </div>
    </div>
  );
}

