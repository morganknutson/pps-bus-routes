/**
 * Reusable job list component
 * Displays jobs with filtering, sorting, and actions
 */

import { useState, useEffect } from 'react';

export interface Job {
  id: string;
  name: string;
  data: any;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
  progress: number;
  result: any;
  error: string | null;
  createdAt: Date | string;
  processedAt: Date | string | null;
  finishedAt: Date | string | null;
  attemptsMade: number;
  attemptsTotal: number;
}

interface JobListProps {
  jobs: Job[];
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  showSchoolName?: boolean;
  schools?: Array<{ id: string; name: string }>;
}

export function JobList({ jobs, onRetry, onCancel, showSchoolName = false, schools = [] }: JobListProps) {
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#FFFFFF';
      case 'active':
        return '#ffa500';
      case 'failed':
        return '#f44';
      case 'waiting':
        return '#888';
      case 'delayed':
        return '#ffa500';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'fa-check-circle';
      case 'active':
        return 'fa-spinner fa-spin';
      case 'failed':
        return 'fa-times-circle';
      case 'waiting':
        return 'fa-clock';
      case 'delayed':
        return 'fa-pause-circle';
      default:
        return 'fa-question-circle';
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  };

  const getSchoolName = (schoolId: string) => {
    const school = schools.find(s => s.id === schoolId);
    return school ? school.name : schoolId;
  };

  if (jobs.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No jobs found
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '2px solid var(--bg-primary)' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Job ID</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Type</th>
              {showSchoolName && (
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>School</th>
              )}
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Progress</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Created</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job, index) => (
              <>
                <tr
                  key={job.id}
                  style={{
                    borderBottom: '1px solid var(--bg-primary)',
                    backgroundColor: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedJobs(prev => ({ ...prev, [job.id]: !prev[job.id] }))}
                >
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', fontFamily: 'monospace' }}>
                    {job.id.substring(0, 8)}...
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px' }}>
                    {job.name}
                  </td>
                  {showSchoolName && (
                    <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px' }}>
                      {job.data.schoolId ? getSchoolName(job.data.schoolId) : '—'}
                    </td>
                  )}
                  <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i 
                        className={`fas ${getStatusIcon(job.status)}`}
                        style={{ color: getStatusColor(job.status), fontSize: '16px' }}
                      ></i>
                      <span style={{ 
                        color: getStatusColor(job.status), 
                        fontWeight: 'bold',
                        textTransform: 'capitalize',
                      }}>
                        {job.status}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', minWidth: '150px' }}>
                    {job.status === 'active' || job.status === 'waiting' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          flex: 1, 
                          height: '8px', 
                          backgroundColor: 'var(--bg-primary)', 
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${job.progress}%`,
                            height: '100%',
                            backgroundColor: getStatusColor(job.status),
                            transition: 'width 0.3s',
                          }}></div>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '35px' }}>
                          {job.progress}%
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {job.status === 'completed' ? '100%' : '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDate(job.createdAt)}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {job.status === 'failed' && onRetry && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetry(job.id);
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#FFFFFF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          Retry
                        </button>
                      )}
                      {(job.status === 'waiting' || job.status === 'active') && onCancel && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancel(job.id);
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#f44',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      <i 
                        className={`fas ${expandedJobs[job.id] ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                        style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}
                      ></i>
                    </div>
                  </td>
                </tr>
                {expandedJobs[job.id] && (
                  <tr>
                    <td colSpan={showSchoolName ? 7 : 6} style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
                      <div style={{ paddingLeft: '1rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>Job ID:</strong> <code style={{ fontSize: '11px', fontFamily: 'monospace' }}>{job.id}</code>
                        </div>
                        {job.data && Object.keys(job.data).length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Data:</strong>
                            <pre style={{ 
                              fontSize: '11px', 
                              backgroundColor: 'var(--bg-secondary)', 
                              padding: '0.5rem', 
                              borderRadius: '4px',
                              overflow: 'auto',
                              marginTop: '0.25rem',
                            }}>
                              {JSON.stringify(job.data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {job.result && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Result:</strong>
                            <pre style={{ 
                              fontSize: '11px', 
                              backgroundColor: 'var(--bg-secondary)', 
                              padding: '0.5rem', 
                              borderRadius: '4px',
                              overflow: 'auto',
                              marginTop: '0.25rem',
                            }}>
                              {JSON.stringify(job.result, null, 2)}
                            </pre>
                          </div>
                        )}
                        {job.error && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong style={{ color: '#f44' }}>Error:</strong>
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#f44',
                              backgroundColor: 'var(--bg-secondary)', 
                              padding: '0.5rem', 
                              borderRadius: '4px',
                              marginTop: '0.25rem',
                            }}>
                              {job.error}
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.5rem', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <div><strong>Created:</strong> {formatDate(job.createdAt)}</div>
                          {job.processedAt && <div><strong>Started:</strong> {formatDate(job.processedAt)}</div>}
                          {job.finishedAt && <div><strong>Finished:</strong> {formatDate(job.finishedAt)}</div>}
                          <div><strong>Attempts:</strong> {job.attemptsMade} / {job.attemptsTotal}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}












