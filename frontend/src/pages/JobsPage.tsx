/**
 * Job management page
 * Shows job history, status, and upcoming jobs
 */

import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { JobList, Job } from '../components/JobList';
import { ProgressBar } from '../components/ProgressBar';
import { fetchWithProgress } from '../utils/fetchWithProgress';

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ jobType: string | null; status: string | null }>({
    jobType: null,
    status: null,
  });
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);

  // Add style to body/html to allow scrolling on this page
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      root.style.height = 'auto';
      root.style.minHeight = '100vh';
      root.style.overflowY = 'auto';
      root.style.overflowX = 'hidden';
    }
    
    return () => {
      if (root) {
        root.style.height = '100vh';
        root.style.minHeight = '';
        root.style.overflowY = 'hidden';
        root.style.overflowX = '';
      }
    };
  }, []);

  // Load jobs and stats
  useEffect(() => {
    const isInitialLoad = loading && jobs.length === 0;
    
    if (isInitialLoad) {
      setLoadingProgress(0);
    }
    
    loadJobs(isInitialLoad ? (progress) => {
      setLoadingProgress(progress);
      if (progress === 100) {
        // Small delay to show 100% before hiding
        setTimeout(() => setLoadingProgress(null), 200);
      }
    } : undefined);
    loadStats();
    loadSchools();
    
    // Poll for updates every 3 seconds (no progress tracking for polling)
    const interval = setInterval(() => {
      loadJobs();
      loadStats();
    }, 3000);

    return () => clearInterval(interval);
  }, [filter]);

  const loadJobs = async (onProgress?: (progress: number) => void) => {
    try {
      const params = new URLSearchParams();
      if (filter.jobType) params.append('jobType', filter.jobType);
      if (filter.status) params.append('status', filter.status);
      params.append('limit', '100');

      const response = await fetchWithProgress(`/api/jobs?${params.toString()}`, {}, onProgress);
      if (response.ok) {
        const data = await response.json();
        // Convert date strings to Date objects
        const jobsWithDates = data.jobs.map((job: any) => ({
          ...job,
          createdAt: new Date(job.createdAt),
          processedAt: job.processedAt ? new Date(job.processedAt) : null,
          finishedAt: job.finishedAt ? new Date(job.finishedAt) : null,
        }));
        setJobs(jobsWithDates);
        setError(null);
      } else {
        setError('Failed to load jobs');
      }
    } catch (err: any) {
      console.error('Error loading jobs:', err);
      setError('Failed to load jobs');
    } finally {
      if (loading && jobs.length === 0) {
        // Only update progress on initial load
        setLoadingProgress(null);
      }
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/jobs/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err: any) {
      console.error('Error loading stats:', err);
    }
  };

  const loadSchools = async () => {
    try {
      const response = await fetch('/api/schools');
      if (response.ok) {
        const data = await response.json();
        setSchools(data.schools || []);
      }
    } catch (err: any) {
      console.error('Error loading schools:', err);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      if (response.ok) {
        await loadJobs();
        await loadStats();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
      if (response.ok) {
        await loadJobs();
        await loadStats();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      {loading && jobs.length === 0 ? (
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <div style={{ width: '300px' }}>
            <ProgressBar 
              label="Loading jobs..." 
              height={8}
              progress={loadingProgress ?? undefined}
              showPercentage={loadingProgress !== null}
            />
          </div>
        </div>
      ) : (
      <div style={{ 
        padding: '2rem', 
        maxWidth: '1600px', 
        margin: '0 auto', 
        width: '100%',
        flex: 1,
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Job Management</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          Monitor and manage background jobs for PDF syncing and processing.
        </p>
        {stats && (
          <div style={{ marginBottom: '1rem' }}>
            {stats.isRedisAvailable ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>
                ✅ Redis connected - Production mode
              </p>
            ) : (
              <div style={{
                padding: '1rem',
                backgroundColor: '#d1ecf1',
                border: '1px solid #bee5eb',
                borderRadius: '8px',
                color: '#0c5460',
                marginBottom: '1rem',
              }}>
                <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  🔄 Polling Mode (Development)
                </p>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Redis is not configured. Jobs are running in polling mode and are tracked in persistent history.
                  All job events are saved to <code>data/jobs-history/jobs.json</code>.
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '12px', fontStyle: 'italic' }}>
                  💡 To enable Redis for production mode, set the REDIS_URL environment variable in your backend configuration.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#888', marginBottom: '0.5rem' }}>
              {stats.waiting}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>⏳ Waiting</div>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ffa500', marginBottom: '0.5rem' }}>
              {stats.active}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>🔄 Active</div>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4ECDC4', marginBottom: '0.5rem' }}>
              {stats.completed}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>✅ Completed</div>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f44', marginBottom: '0.5rem' }}>
              {stats.failed}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>❌ Failed</div>
          </div>
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {stats.total}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ 
        backgroundColor: 'var(--bg-secondary)', 
        borderRadius: '8px', 
        padding: '1rem', 
        marginBottom: '1rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px' }}>
          <span>Job Type:</span>
          <select
            value={filter.jobType || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, jobType: e.target.value || null }))}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--bg-primary)',
              borderRadius: '4px',
            }}
          >
            <option value="">All</option>
            <option value="pdf-sync">PDF Sync</option>
            <option value="pdf-process">PDF Process</option>
            <option value="drive-check">Drive Check</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px' }}>
          <span>Status:</span>
          <select
            value={filter.status || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value || null }))}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--bg-primary)',
              borderRadius: '4px',
            }}
          >
            <option value="">All</option>
            <option value="waiting">Waiting</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="delayed">Delayed</option>
          </select>
        </label>
        <button
          onClick={() => {
            setFilter({ jobType: null, status: null });
            loadJobs();
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--bg-primary)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Clear Filters
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c00',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* No Jobs Message */}
      {stats && jobs.length === 0 && !loading && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          color: 'var(--text-secondary)',
        }}>
          <p style={{ fontSize: '18px', marginBottom: '0.5rem' }}>
            No jobs found
          </p>
          <p style={{ fontSize: '14px' }}>
            {stats.isRedisAvailable 
              ? 'No jobs have been queued yet. Jobs will appear here when you trigger PDF sync or other background tasks.'
              : 'No jobs in history. Jobs will appear here when you trigger PDF sync or other background tasks. Job history is persisted to data/jobs-history/jobs.json.'}
          </p>
        </div>
      )}

      {/* Job List */}
      <JobList
        jobs={jobs}
        onRetry={handleRetry}
        onCancel={handleCancel}
        showSchoolName={true}
        schools={schools}
      />
      </div>
      )}
    </div>
  );
}
