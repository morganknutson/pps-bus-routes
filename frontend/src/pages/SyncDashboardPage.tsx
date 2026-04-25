import { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';

interface SyncState {
    lastRun: string | null;
    lastRunStatus: string | null;
    lastRunDuration: string | null;
    lastRunResults: SyncResults | null;
    running?: boolean;
}

interface SyncResults {
    startTime: string;
    endTime?: string;
    duration: string;
    totalSchools: number;
    schoolsChecked: number;
    schoolsWithUpdates: number;
    pdfsDownloaded: number;
    routesProcessed: number;
    errorCount: number;
    errors: SyncError[];
    phases: {
        driveCheck: PhaseStatus;
        pdfFetch: PhaseStatus;
        processing: PhaseStatus;
        publish?: PhaseStatus;
    };
}

interface PhaseStatus {
    status: string;
    schools?: number;
    downloaded?: number;
    processed?: number;
    queued?: number;
    completed?: number;
    failed?: number;
    filesChanged?: number;
    pushed?: boolean;
    reason?: string;
    duration: string | null;
}

interface SyncError {
    phase: string;
    schoolId?: string;
    schoolName?: string;
    file?: string;
    error: string;
}

interface SchedulerStatus {
    enabled: boolean;
    lastRun: string | null;
    lastRunStatus: string | null;
    lastRunError: string | null;
    nextRun: string | null;
    configured?: boolean;
    disabledReason?: string | null;
    running?: boolean;
    cronRunning?: boolean;
    schedule?: string;
}

interface EmailTestResult {
    success: boolean;
    message?: string;
    reason?: string;
}

export function SyncDashboardPage() {
    const [syncState, setSyncState] = useState<SyncState | null>(null);
    const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
    const [emailTestResult, setEmailTestResult] = useState<EmailTestResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const [syncRes, schedulerRes] = await Promise.all([
                fetch('/api/scheduler/sync-state'),
                fetch('/api/scheduler/status'),
            ]);

            if (syncRes.ok) {
                setSyncState(await syncRes.json());
            }
            if (schedulerRes.ok) {
                setSchedulerStatus(await schedulerRes.json());
            }
            setError(null);
        } catch (err) {
            setError('Failed to load sync status');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleRunSync = async () => {
        setIsRunning(true);
        setError(null);
        try {
            const res = await fetch('/api/scheduler/run-now', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.status) {
                    setSchedulerStatus(data.status);
                }
                await fetchStatus();
                setTimeout(fetchStatus, 2000);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to start sync');
            }
        } catch (err) {
            setError('Failed to trigger sync');
        } finally {
            setIsRunning(false);
        }
    };

    const handleToggle = async () => {
        if (!schedulerStatus) return;
        setIsToggling(true);
        try {
            const res = await fetch('/api/scheduler/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !schedulerStatus.enabled }),
            });
            if (res.ok) {
                const data = await res.json();
                setSchedulerStatus(data);
                if (data.disabledReason) {
                    setError(data.disabledReason);
                } else {
                    setError(null);
                }
            }
        } catch (err) {
            setError('Failed to toggle scheduler');
        } finally {
            setIsToggling(false);
        }
    };

    const handleTestEmail = async () => {
        setEmailTestResult(null);
        try {
            const res = await fetch('/api/scheduler/test-email');
            const data = await res.json();
            setEmailTestResult(data);
        } catch (err) {
            setEmailTestResult({ success: false, reason: 'Request failed' });
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleString();
    };

    const getStatusColor = (status: string | null) => {
        switch (status) {
            case 'success': return '#22c55e';
            case 'completed_with_errors': return '#eab308';
            case 'error': return '#ef4444';
            case 'running': return '#3b82f6';
            default: return 'var(--text-tertiary)';
        }
    };

    const getPhaseStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return '✅';
            case 'failed': return '❌';
            case 'running': return '🔄';
            case 'skipped': return '⏭️';
            case 'pending': return '⏳';
            default: return '❓';
        }
    };

    const getPhaseDetail = (phase: PhaseStatus) => {
        if (phase.queued) return `${phase.completed || 0}/${phase.queued}`;
        if (typeof phase.filesChanged === 'number' && phase.status === 'completed') {
            return `${phase.filesChanged} files${phase.pushed ? ', pushed' : ''}`;
        }
        return phase.duration || phase.reason || '-';
    };

    const syncIsRunning = isRunning || !!schedulerStatus?.running || !!syncState?.running || syncState?.lastRunStatus === 'running';
    const schedulerLabel = schedulerStatus?.configured === false
        ? 'Not configured'
        : schedulerStatus?.enabled
            ? 'Active'
            : 'Paused';
    const schedulerDotColor = schedulerStatus?.configured === false
        ? '#ef4444'
        : schedulerStatus?.enabled
            ? '#22c55e'
            : '#6b7280';

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)' }}>
            <Header />
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                    Weekly Sync Dashboard
                </h1>

                {error && (
                    <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1rem', color: '#dc2626' }}>
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Loading...
                    </div>
                ) : (
                    <>
                        {/* Scheduler Status */}
                        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color-primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>
                                    Scheduler
                                </h2>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={handleToggle}
                                        disabled={isToggling}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            backgroundColor: schedulerStatus?.enabled ? '#ef4444' : '#22c55e',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: isToggling ? 'wait' : 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {isToggling ? '...' : schedulerStatus?.enabled ? 'Pause' : 'Resume'}
                                    </button>
                                    <button
                                        onClick={handleRunSync}
                                        disabled={syncIsRunning}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            backgroundColor: 'var(--text-primary)',
                                            color: 'var(--bg-primary)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: syncIsRunning ? 'wait' : 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {syncIsRunning ? 'Running...' : 'Run Now'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: schedulerDotColor }} />
                                        <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{schedulerLabel}</span>
                                    </div>
                                    {schedulerStatus?.disabledReason && (
                                        <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{schedulerStatus.disabledReason}</div>
                                    )}
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Schedule</div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{schedulerStatus?.schedule || 'Sundays @ 2am PT'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Next Run</div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatDate(schedulerStatus?.nextRun || null)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Last Sync Results */}
                        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-color-primary)' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
                                Last Sync
                            </h2>

                            {syncState?.lastRunResults ? (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                                            <div style={{ fontSize: '14px', color: getStatusColor(syncState.lastRunStatus), fontWeight: '500' }}>
                                                {syncIsRunning ? 'running' : syncState.lastRunStatus?.replace(/_/g, ' ') || 'Unknown'}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Date</div>
                                            <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatDate(syncState.lastRun)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Duration</div>
                                            <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{syncState.lastRunDuration || '-'}</div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                        {[
                                            { label: 'Schools Checked', value: syncState.lastRunResults.schoolsChecked },
                                            { label: 'Need Updates', value: syncState.lastRunResults.schoolsWithUpdates },
                                            { label: 'PDFs Downloaded', value: syncState.lastRunResults.pdfsDownloaded },
                                            { label: 'Routes Processed', value: syncState.lastRunResults.routesProcessed },
                                            { label: 'Errors', value: syncState.lastRunResults.errorCount, color: syncState.lastRunResults.errorCount > 0 ? '#ef4444' : undefined },
                                        ].map(stat => (
                                            <div key={stat.label} style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: '600', color: stat.color || 'var(--text-primary)' }}>{stat.value}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Phases */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Phases</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {Object.entries(syncState.lastRunResults.phases).map(([name, phase]) => (
                                                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '13px' }}>
                                                    <span style={{ color: 'var(--text-primary)' }}>
                                                        {getPhaseStatusIcon(phase.status)} {name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')}
                                                    </span>
                                                    <span style={{ color: 'var(--text-tertiary)' }}>
                                                        {getPhaseDetail(phase)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Errors */}
                                    {syncState.lastRunResults.errors.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#ef4444', marginBottom: '0.5rem' }}>
                                                Errors ({syncState.lastRunResults.errors.length})
                                            </div>
                                            <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fef2f2', borderRadius: '8px', padding: '0.75rem' }}>
                                                {syncState.lastRunResults.errors.map((err, i) => (
                                                    <div key={i} style={{ fontSize: '12px', color: '#991b1b', marginBottom: '0.5rem', borderBottom: i < syncState.lastRunResults!.errors.length - 1 ? '1px solid #fecaca' : 'none', paddingBottom: '0.5rem' }}>
                                                        <strong>[{err.phase}]</strong> {err.schoolName || err.schoolId || ''}{err.file ? ` - ${err.file}` : ''}: {err.error}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    No sync has run yet. Click "Run Now" to start.
                                </div>
                            )}
                        </div>

                        {/* Email Test */}
                        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color-primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                                        Email Notifications
                                    </h2>
                                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
                                        Test your SMTP configuration
                                    </p>
                                </div>
                                <button
                                    onClick={handleTestEmail}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color-primary)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                    }}
                                >
                                    Test Email
                                </button>
                            </div>
                            {emailTestResult && (
                                <div style={{
                                    marginTop: '1rem',
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    backgroundColor: emailTestResult.success ? '#f0fdf4' : '#fef2f2',
                                    color: emailTestResult.success ? '#166534' : '#991b1b',
                                    fontSize: '13px',
                                }}>
                                    {emailTestResult.success ? (
                                        <>✅ {emailTestResult.message}</>
                                    ) : (
                                        <>❌ {emailTestResult.reason}</>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
