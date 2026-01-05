import { useState, useEffect } from 'react';

interface ApiStats {
  requests: number;
  successes: number;
  failures: number;
  cost: number;
  sku: string;
}

interface ServiceStats {
  [key: string]: any;
}

interface UsageStats {
  timestamp: string;
  services: ServiceStats;
  totals: {
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    estimatedCost: number;
    freeTierRemaining: number;
    freeTierUsed: number;
    freeTierPercentage: number;
    successRate: string;
  };
  apis: {
    [apiName: string]: ApiStats;
  };
}

export function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchUsageStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/usage');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[UsagePage] Error fetching usage stats:', err);
      setError(err.message || 'Failed to fetch usage statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageStats();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchUsageStats, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getCostColor = (cost: number) => {
    if (cost === 0) return 'var(--text-tertiary)';
    if (cost < 1) return 'var(--text-primary)';
    if (cost < 10) return '#FFA500';
    return '#FF6B6B';
  };

  const getFreeTierColor = (percentage: number) => {
    if (percentage < 50) return '#4ECDC4';
    if (percentage < 80) return '#FFA500';
    return '#FF6B6B';
  };

  const pageStyle: React.CSSProperties = {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
    color: 'var(--text-primary)',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '2rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: 'var(--text-primary)',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '0.9rem',
    color: 'var(--text-tertiary)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: 'var(--shadow-large)',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  };

  const statCardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: 'var(--shadow-large)',
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    color: 'var(--text-tertiary)',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '0.75rem',
    borderBottom: '2px solid var(--bg-primary)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    fontSize: '0.9rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderBottom: '1px solid var(--bg-primary)',
    color: 'var(--text-primary)',
  };

  const buttonStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--bg-primary)',
    borderRadius: '4px',
    padding: '0.5rem 1rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
  };

  if (loading && !stats) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>API Usage & Costs</h1>
        </div>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
            <div>Loading usage statistics...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>API Usage & Costs</h1>
        </div>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '2rem', color: '#FF6B6B' }}>
            <i className="fas fa-exclamation-circle" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
            <div style={{ marginBottom: '1rem' }}>Error loading usage statistics</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>{error}</div>
            <button style={buttonStyle} onClick={fetchUsageStats}>
              <i className="fas fa-sync-alt"></i> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>API Usage & Costs</h1>
        <div style={subtitleStyle}>
          <i className="fas fa-clock"></i>
          {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
          <button 
            style={{ ...buttonStyle, marginLeft: '1rem' }}
            onClick={fetchUsageStats}
            disabled={loading}
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={gridStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Total Requests</div>
          <div style={statValueStyle}>{formatNumber(stats.totals.totalRequests)}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Success Rate</div>
          <div style={statValueStyle}>{stats.totals.successRate}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Estimated Cost</div>
          <div style={{ ...statValueStyle, color: getCostColor(stats.totals.estimatedCost) }}>
            {formatCurrency(stats.totals.estimatedCost)}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Free Tier Used</div>
          <div style={{ ...statValueStyle, color: getFreeTierColor(stats.totals.freeTierPercentage) }}>
            {formatCurrency(stats.totals.freeTierUsed)} ({stats.totals.freeTierPercentage.toFixed(1)}%)
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
            {formatCurrency(stats.totals.freeTierRemaining)} remaining
          </div>
        </div>
      </div>

      {/* API Breakdown Table */}
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          <i className="fas fa-table"></i> API Usage Breakdown
        </h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>API Service</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Requests</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Successes</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Failures</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Success Rate</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Estimated Cost</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.apis).map(([apiName, apiStats]) => {
              const successRate = apiStats.requests > 0
                ? ((apiStats.successes / apiStats.requests) * 100).toFixed(1) + '%'
                : 'N/A';
              
              return (
                <tr key={apiName}>
                  <td style={tdStyle}>
                    <strong>{apiStats.sku || apiName}</strong>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {formatNumber(apiStats.requests)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#4ECDC4' }}>
                    {formatNumber(apiStats.successes)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: apiStats.failures > 0 ? '#FF6B6B' : 'var(--text-tertiary)' }}>
                    {formatNumber(apiStats.failures)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {successRate}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: getCostColor(apiStats.cost) }}>
                    {formatCurrency(apiStats.cost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--bg-primary)' }}>
              <td style={{ ...tdStyle, fontWeight: 'bold' }}>Total</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>
                {formatNumber(stats.totals.totalRequests)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>
                {formatNumber(stats.totals.totalSuccesses)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>
                {formatNumber(stats.totals.totalFailures)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>
                {stats.totals.successRate}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: getCostColor(stats.totals.estimatedCost) }}>
                {formatCurrency(stats.totals.estimatedCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Service Details */}
      {Object.keys(stats.services).length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            <i className="fas fa-info-circle"></i> Service Details
          </h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <pre style={{ 
              background: 'var(--bg-primary)', 
              padding: '1rem', 
              borderRadius: '4px',
              overflow: 'auto',
              margin: 0,
            }}>
              {JSON.stringify(stats.services, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div style={{
        ...cardStyle,
        background: 'rgba(78, 205, 196, 0.1)',
        border: '1px solid rgba(78, 205, 196, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
          <i className="fas fa-info-circle" style={{ color: '#4ECDC4', fontSize: '1.5rem', marginTop: '0.2rem' }}></i>
          <div>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
              About Usage Tracking
            </strong>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                These statistics track API usage across all services since the server last restarted. 
                Cost estimates are based on Google's published pricing and may not reflect actual billing.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Free Tier:</strong> Google Cloud provides $200/month in free credits for new accounts, 
                which typically covers 40,000+ requests for most APIs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

