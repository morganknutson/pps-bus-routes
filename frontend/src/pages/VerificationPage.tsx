import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { ProgressBar } from '../components/ProgressBar';

export function VerificationPage() {
  console.log('[VerificationPage] Component rendering...');
  console.log('[VerificationPage] Component mounted successfully');
  const [pdfStatus, setPdfStatus] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, { lastModifiedPdf?: string; lastChecked?: string }>>({});
  const [processingStatus, setProcessingStatus] = useState<Record<string, boolean>>({});
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [pdfProcessingStatus, setPdfProcessingStatus] = useState<Record<string, Record<string, 'pending' | 'processing' | 'success' | 'error'>>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [allRoutes, setAllRoutes] = useState<Record<string, Record<string, any>>>({});
  const [loadingRoutes, setLoadingRoutes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobStatuses, setJobStatuses] = useState<Record<string, any>>({});
  const [shouldPollJobs, setShouldPollJobs] = useState(false);
  const [successMessages, setSuccessMessages] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Define all functions before useEffects
  const loadJobStatuses = async () => {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      // Get jobs for all schools that might have active jobs
      const response = await fetch('/api/jobs?status=active&limit=100', {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const statusMap: Record<string, any> = {};
        data.jobs.forEach((job: any) => {
          if (job.data.schoolId) {
            statusMap[job.data.schoolId] = job;
          }
        });
        setJobStatuses(statusMap);
      }
    } catch (err: any) {
      // Silently handle errors - job status is optional
      if (err.name !== 'AbortError') {
        // Only log non-timeout errors
        console.warn('[VerificationPage] Error loading job statuses (non-fatal):', err.message || err);
      }
    }
  };

  const loadPdfStatus = async () => {
    try {
      console.log('[VerificationPage] Loading PDF status...');
      // Use regular fetch since PDF status endpoint doesn't support Content-Length header
      // and fetchWithProgress causes issues with response body consumption
      // Always force refresh to get the latest data from disk
      // This ensures we get fresh data even if the cached file is stale
      const response = await fetch(`/api/pdf-status/status?refresh=1&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      console.log('[VerificationPage] PDF status response:', response.status, response.statusText, response.headers.get('content-type'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VerificationPage] Failed to load PDF status:', response.status, errorText);
        const errorMsg = `Failed to load PDF status: ${response.status} ${response.statusText}`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[VerificationPage] Unexpected content type:', contentType, 'Response:', text.substring(0, 200));
        const errorMsg = `Unexpected response format: ${contentType}`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      console.log('[VerificationPage] PDF status loaded:', {
        totalSchools: data.totalSchools,
        summary: data.summary,
        schoolsCount: data.schools?.length
      });
      
      // Validate response structure
      if (!data || !data.summary || !Array.isArray(data.schools)) {
        console.error('[VerificationPage] Invalid response structure:', data);
        const errorMsg = 'Invalid response structure from API';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      setPdfStatus(data);
      setError(null);
      // Enable polling once PDF status is successfully loaded
      setShouldPollJobs(true);
    } catch (err: any) {
      console.error('[VerificationPage] Error loading PDF status:', err);
      const errorMsg = `Failed to load PDF status: ${err.message || 'Network error'}`;
      setError(errorMsg);
      throw err; // Re-throw to allow outer catch to handle it
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await fetch('/api/pdf-sync/status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data || {});
      }
    } catch (err: any) {
      console.error('Failed to load sync status:', err);
    }
  };

  const loadProcessingStatus = async () => {
    try {
      const response = await fetch('/api/process-pdfs/status');
      if (response.ok) {
        const data = await response.json();
        setProcessingStatus(data || {});
      }
    } catch (err: any) {
      console.error('Failed to load processing status:', err);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    try {
      console.log('[VerificationPage] Refreshing status...');
      const response = await fetch('/api/pdf-status/refresh-status', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh status: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[VerificationPage] Refresh complete:', {
        pdfStatus: data.pdfStatus?.summary,
        processingStatusCount: Object.values(data.processingStatus || {}).filter(Boolean).length,
      });
      
      // Update PDF status
      if (data.pdfStatus) {
        setPdfStatus(data.pdfStatus);
      }
      
      // Update processing status
      if (data.processingStatus) {
        setProcessingStatus(data.processingStatus);
      }
      
      // Also reload sync status (optional, but good to have)
      await loadSyncStatus();
      
      // Show success message
      setSuccessMessages(prev => ({
        ...prev,
        _refresh: 'Status refreshed successfully!',
      }));
      
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccessMessages(prev => {
          const updated = { ...prev };
          delete updated._refresh;
          return updated;
        });
      }, 3000);
      
    } catch (err: any) {
      console.error('[VerificationPage] Error refreshing status:', err);
      setSuccessMessages(prev => ({
        ...prev,
        _refresh: `Error: ${err.message || 'Failed to refresh status'}`,
      }));
      
      // Auto-dismiss error message after 5 seconds
      setTimeout(() => {
        setSuccessMessages(prev => {
          const updated = { ...prev };
          delete updated._refresh;
          return updated;
        });
      }, 5000);
    } finally {
      setRefreshing(false);
    }
  };

  // Add style to body/html to allow scrolling on this page
  useEffect(() => {
    // Override root styles for this page
    const root = document.getElementById('root');
    if (root) {
      root.style.height = 'auto';
      root.style.minHeight = '100vh';
      root.style.overflowY = 'auto';
      root.style.overflowX = 'hidden';
    }
    
    return () => {
      // Restore original styles when component unmounts
      if (root) {
        root.style.height = '100vh';
        root.style.minHeight = '';
        root.style.overflowY = 'hidden';
        root.style.overflowX = '';
      }
    };
  }, []);

  // Load PDF status and sync status on mount
  useEffect(() => {
    const loadAll = async () => {
      console.log('[VerificationPage] Starting to load all data...');
      setLoading(true);
      setLoadingProgress(0);
      setError(null); // Clear any previous errors
      try {
        // Load PDF status first (required)
        await loadPdfStatus();
        setLoadingProgress(100);
        // Load other statuses (optional - don't fail if these fail)
        try {
          await loadSyncStatus();
        } catch (err) {
          console.error('[VerificationPage] Error loading sync status (non-fatal):', err);
        }
        try {
          await loadProcessingStatus();
        } catch (err) {
          console.error('[VerificationPage] Error loading processing status (non-fatal):', err);
        }
        try {
          await loadJobStatuses();
        } catch (err) {
          console.error('[VerificationPage] Error loading job statuses (non-fatal):', err);
        }
      } catch (err: any) {
        console.error('[VerificationPage] Error loading data:', err);
        // Error should already be set by loadPdfStatus, but ensure it's set
        setError(err?.message || 'Failed to load data');
        // Don't enable polling if there's an error
        setShouldPollJobs(false);
      } finally {
        setLoading(false);
        setLoadingProgress(null);
        // Note: pdfStatus state may not be updated yet, so we check it in the next render
        console.log('[VerificationPage] Finished loading all data');
      }
    };
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for job status updates (only if page has loaded successfully)
  useEffect(() => {
    // Only start polling if PDF status loaded successfully
    if (!shouldPollJobs) {
      return;
    }
    
    // Load once immediately
    loadJobStatuses();
    
    // Then poll every 5 seconds (less frequent to reduce load)
    const interval = setInterval(() => {
      loadJobStatuses();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPollJobs]); // Only depend on the boolean flag, not the pdfStatus object

  const handleFetchPdfs = async (schoolId: string) => {
    setFetching(prev => ({ ...prev, [schoolId]: true }));
    try {
      const response = await fetch(`/api/pdf-sync/fetch/${schoolId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        // Job has been enqueued
        alert(`PDF sync job has been queued (Job ID: ${result.jobId.substring(0, 8)}...). The job will run in the background.`);
        // Reload job statuses to show the new job
        await loadJobStatuses();
        // Reload PDF status after a delay (to allow job to complete)
        setTimeout(async () => {
          await loadPdfStatus();
          await loadSyncStatus();
        }, 5000);
      } else {
        const error = await response.json();
        if (error.existingJob) {
          alert(`A job for this school is already running. Job ID: ${error.existingJob.id.substring(0, 8)}...`);
        } else {
          alert(`Error: ${error.error}`);
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setFetching(prev => ({ ...prev, [schoolId]: false }));
    }
  };

  const getJobStatusForSchool = (schoolId: string) => {
    return jobStatuses[schoolId] || null;
  };

  const handleProcessPdfs = async (schoolId: string) => {
    setProcessing(prev => ({ ...prev, [schoolId]: true }));
    // Clear any existing success message for this school
    setSuccessMessages(prev => {
      const updated = { ...prev };
      delete updated[schoolId];
      return updated;
    });
    
    // Get the list of PDFs for this school
    const school = pdfStatus?.schools?.find((s: any) => s.schoolId === schoolId);
    const pdfFiles = school?.pdfFiles || [];
    
    // Initialize all PDFs as pending
    setPdfProcessingStatus(prev => ({
      ...prev,
      [schoolId]: pdfFiles.reduce((acc: Record<string, 'pending'>, file: string) => {
        acc[file] = 'pending';
        return acc;
      }, {})
    }));
    
    // Start polling for route updates during processing (every 2 seconds)
    // This allows routes to appear as they're processed
    let pollInterval: NodeJS.Timeout | null = null;
    pollInterval = setInterval(async () => {
      await loadAllRoutes(schoolId, true);
    }, 2000);
    
    try {
      const response = await fetch(`/api/process-pdfs/process/${schoolId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Update status for each PDF based on results
        setPdfProcessingStatus(prev => {
          const updated = { ...prev };
          if (!updated[schoolId]) {
            updated[schoolId] = {};
          }
          
          // Mark successful PDFs
          if (result.processedDetails) {
            result.processedDetails.forEach((detail: any) => {
              updated[schoolId][detail.file] = 'success';
            });
          }
          
          // Mark failed PDFs
          if (result.errorDetails) {
            result.errorDetails.forEach((detail: any) => {
              updated[schoolId][detail.file] = 'error';
            });
          }
          
          return updated;
        });
        
        // Reload processing status and routes
        await loadProcessingStatus();
        await loadAllRoutes(schoolId, true); // Force reload routes after processing
        
        // Set success message
        const message = result.errors > 0 
          ? `Processed ${result.processed} PDF(s). ${result.errors} error(s) occurred.`
          : `Successfully processed ${result.processed} PDF(s)!`;
        setSuccessMessages(prev => ({ ...prev, [schoolId]: message }));
        
        // Auto-dismiss success message after 5 seconds
        setTimeout(() => {
          setSuccessMessages(prev => {
            const updated = { ...prev };
            delete updated[schoolId];
            return updated;
          });
        }, 5000);
        
        // Clear cached routes if they exist, so they reload on next expand
        setAllRoutes(prev => {
          const updated = { ...prev };
          delete updated[schoolId];
          return updated;
        });
      } else {
        const error = await response.json();
        // Mark all PDFs as error
        setPdfProcessingStatus(prev => {
          const updated = { ...prev };
          if (updated[schoolId]) {
            Object.keys(updated[schoolId]).forEach(file => {
              updated[schoolId][file] = 'error';
            });
          }
          return updated;
        });
        setSuccessMessages(prev => ({ ...prev, [schoolId]: `Error: ${error.error}` }));
        // Auto-dismiss error message after 5 seconds
        setTimeout(() => {
          setSuccessMessages(prev => {
            const updated = { ...prev };
            delete updated[schoolId];
            return updated;
          });
        }, 5000);
      }
    } catch (err: any) {
      // Mark all PDFs as error
      setPdfProcessingStatus(prev => {
        const updated = { ...prev };
        if (updated[schoolId]) {
          Object.keys(updated[schoolId]).forEach(file => {
            updated[schoolId][file] = 'error';
          });
        }
        return updated;
      });
      setSuccessMessages(prev => ({ ...prev, [schoolId]: `Error: ${err.message}` }));
      // Auto-dismiss error message after 5 seconds
      setTimeout(() => {
        setSuccessMessages(prev => {
          const updated = { ...prev };
          delete updated[schoolId];
          return updated;
        });
      }, 5000);
    } finally {
      clearInterval(pollInterval); // Stop polling when done
      setProcessing(prev => ({ ...prev, [schoolId]: false }));
      // Final reload to ensure we have all routes
      await loadAllRoutes(schoolId, true);
    }
  };

  const loadAllRoutes = async (schoolId: string, forceReload = false) => {
    // If we already have routes cached and not forcing reload, don't reload
    if (allRoutes[schoolId] && !forceReload) {
      return;
    }

    setLoadingRoutes(prev => ({ ...prev, [schoolId]: true }));
    try {
      const response = await fetch(`/api/data/routes?schoolId=${encodeURIComponent(schoolId)}&t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        const routes = data.routes || [];
        // Store routes by filename for easy lookup
        const routesByFilename: Record<string, any> = {};
        routes.forEach((route: any) => {
          // Match by filename (route.filename should match PDF filename)
          if (route.filename) {
            routesByFilename[route.filename] = route;
          } else if (route.id) {
            // Fallback: use route ID if filename not available
            routesByFilename[route.id] = route;
          }
        });
        console.log(`[VerificationPage] Loaded ${routes.length} routes for ${schoolId}, matched ${Object.keys(routesByFilename).length} by filename`);
        setAllRoutes(prev => ({ ...prev, [schoolId]: routesByFilename }));
      } else {
        console.error('[VerificationPage] Failed to load routes for school:', schoolId);
        setAllRoutes(prev => ({ ...prev, [schoolId]: {} }));
      }
    } catch (err: any) {
      console.error('[VerificationPage] Error loading routes:', err);
      setAllRoutes(prev => ({ ...prev, [schoolId]: {} }));
    } finally {
      setLoadingRoutes(prev => ({ ...prev, [schoolId]: false }));
    }
  };

  const handleRowExpand = (schoolId: string) => {
    const isExpanding = !expandedRows[schoolId];
    setExpandedRows(prev => ({ ...prev, [schoolId]: !prev[schoolId] }));
    
    // Load all routes when expanding
    if (isExpanding) {
      loadAllRoutes(schoolId, true); // Force reload to get latest routes
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <Header />
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <div style={{ width: '300px' }}>
            <ProgressBar 
              label="Loading PDF status..." 
              height={8}
              progress={loadingProgress ?? undefined}
              showPercentage={loadingProgress !== null}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error || !pdfStatus) {
    return (
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <Header />
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%', flex: 1 }}>
          <div
            style={{
              padding: '2rem',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              color: '#c00',
              textAlign: 'center',
            }}
          >
            <h2 style={{ marginTop: 0 }}>⚠️ Error</h2>
            <p>{error || 'Failed to load PDF status'}</p>
            <p style={{ marginTop: '1rem', fontSize: '14px', color: '#666' }}>
              Run the PDF status script: <code style={{ backgroundColor: '#f0f0f0', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>node scripts/generate-pdf-status.js</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show PDF download status view
  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }}>
      <Header />
      <div style={{ 
        padding: '2rem', 
        maxWidth: '1600px', 
        margin: '0 auto', 
        width: '100%',
        flex: 1,
        position: 'relative',
        zIndex: 1,
      }}>
      
      {/* Refresh Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          color: 'var(--text-primary)',
        }}>
          Verification & Status
        </h1>
        <button
          onClick={handleRefreshStatus}
          disabled={refreshing}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: refreshing ? 'var(--bg-secondary)' : '#4ECDC4',
            color: refreshing ? 'var(--text-secondary)' : 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: refreshing ? 0.6 : 1,
            transition: 'all 0.2s',
            boxShadow: refreshing ? 'none' : 'var(--shadow-hover)',
          }}
          onMouseEnter={(e) => {
            if (!refreshing) {
              e.currentTarget.style.backgroundColor = '#5EDDD6';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!refreshing) {
              e.currentTarget.style.backgroundColor = '#4ECDC4';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
          title="Refresh status by checking filesystem for PDFs and processed routes"
        >
          <i className={`fas ${refreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
          {refreshing ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {pdfStatus.totalSchools}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Schools</div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4ECDC4', marginBottom: '0.5rem' }}>
            {pdfStatus.summary.schoolsWithPdfs}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <i className="fas fa-download"></i>
            <span>With PDFs</span>
          </div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4ECDC4', marginBottom: '0.5rem' }}>
            {pdfStatus.summary.totalPdfs}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <i className="fas fa-file-pdf"></i>
            <span>Total PDFs</span>
          </div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4ECDC4', marginBottom: '0.5rem' }}>
            {Object.values(processingStatus).filter(Boolean).length}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <i className="fas fa-check-circle"></i>
            <span>Processed</span>
          </div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f44', marginBottom: '0.5rem' }}>
            {pdfStatus.summary.schoolsWithoutPdfs}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <i className="fas fa-times-circle"></i>
            <span>No PDFs</span>
          </div>
        </div>
      </div>

      {/* Success Messages */}
      {Object.keys(successMessages).length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          {Object.entries(successMessages).map(([schoolId, message]) => {
            // Handle refresh message (no school associated)
            if (schoolId === '_refresh') {
              const isError = message.startsWith('Error:');
              return (
                <div
                  key={schoolId}
                  style={{
                    padding: '1rem 1.5rem',
                    backgroundColor: isError ? '#fee' : '#efe',
                    border: `1px solid ${isError ? '#fcc' : '#cfc'}`,
                    borderRadius: '8px',
                    color: isError ? '#c00' : '#0c0',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <i className={`fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}`} style={{ fontSize: '18px' }}></i>
                    <div>{message}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSuccessMessages(prev => {
                        const updated = { ...prev };
                        delete updated[schoolId];
                        return updated;
                      });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isError ? '#c00' : '#0c0',
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.7,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                    title="Dismiss"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              );
            }
            
            const school = pdfStatus.schools.find((s: any) => s.schoolId === schoolId);
            const schoolName = school?.schoolName || schoolId;
            const isError = message.startsWith('Error:');
            
            return (
              <div
                key={schoolId}
                style={{
                  padding: '1rem 1.5rem',
                  backgroundColor: isError ? '#fee' : '#efe',
                  border: `1px solid ${isError ? '#fcc' : '#cfc'}`,
                  borderRadius: '8px',
                  color: isError ? '#c00' : '#0c0',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  <i className={`fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}`} style={{ fontSize: '18px' }}></i>
                  <div>
                    <strong>{schoolName}:</strong> {message}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSuccessMessages(prev => {
                      const updated = { ...prev };
                      delete updated[schoolId];
                      return updated;
                    });
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isError ? '#c00' : '#0c0',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.7,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                  title="Dismiss"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Schools Table */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '2px solid var(--bg-primary)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)', width: '40px' }}></th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>School</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>PDF Count</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>PDF Files</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Last Modified in Drive</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Last Checked</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Processed</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Actions</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Drive</th>
              </tr>
            </thead>
            <tbody>
              {pdfStatus.schools.map((school: any, index: number) => {
                const isExpanded = expandedRows[school.schoolId];
                return (
                  <React.Fragment key={school.schoolId}>
                    <tr
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid var(--bg-primary)',
                        backgroundColor: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleRowExpand(school.schoolId)}
                    >
                      <td style={{ padding: '1rem', verticalAlign: 'middle', width: '40px' }}>
                        <i 
                          className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                          style={{ fontSize: '14px', color: 'var(--text-primary)' }}
                        ></i>
                      </td>
                      <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{school.schoolName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{school.schoolId}</div>
                      </td>
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        {school.hasPdfs ? (
                          <span style={{ fontWeight: 'bold', color: '#4ECDC4', fontSize: '18px' }}>
                            {school.pdfCount}
                          </span>
                        ) : (
                          <span style={{ color: '#f44', fontWeight: 'bold' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', maxWidth: '300px' }}>
                        {school.pdfFiles && school.pdfFiles.length > 0 ? (
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {school.pdfFiles.length} PDF{school.pdfFiles.length !== 1 ? 's' : ''}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', maxWidth: '200px' }}>
                    {syncStatus[school.schoolId]?.lastModifiedPdf ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(syncStatus[school.schoolId].lastModifiedPdf!).toLocaleString()}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', maxWidth: '200px' }}>
                    {syncStatus[school.schoolId]?.lastChecked ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(syncStatus[school.schoolId].lastChecked!).toLocaleString()}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                    {processingStatus[school.schoolId] ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: '#4ECDC4', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <i className="fas fa-check-circle"></i>
                          <span>Yes</span>
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProcessPdfs(school.schoolId);
                          }}
                          disabled={processing[school.schoolId]}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: processing[school.schoolId] ? 'var(--text-secondary)' : '#4ECDC4',
                            cursor: processing[school.schoolId] ? 'not-allowed' : 'pointer',
                            padding: '0.25rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            opacity: processing[school.schoolId] ? 0.6 : 1,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!processing[school.schoolId]) {
                              e.currentTarget.style.color = '#5EDDD6';
                              e.currentTarget.style.transform = 'rotate(180deg)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!processing[school.schoolId]) {
                              e.currentTarget.style.color = '#4ECDC4';
                              e.currentTarget.style.transform = 'rotate(0deg)';
                            }
                          }}
                          title="Reprocess routes for this school"
                        >
                          <i className={`fas ${processing[school.schoolId] ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
                        </button>
                      </div>
                    ) : (
                      (() => {
                        const hasPdfs = school.hasPdfs || (school.pdfCount && school.pdfCount > 0);
                        const isDisabled = processing[school.schoolId] || !hasPdfs;
                        
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasPdfs) {
                                handleProcessPdfs(school.schoolId);
                              } else {
                                alert('No PDFs available for this school. Please fetch PDFs first.');
                              }
                            }}
                            disabled={isDisabled}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: isDisabled ? 'var(--bg-secondary)' : '#ffa500',
                              color: isDisabled ? 'var(--text-secondary)' : 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              opacity: isDisabled ? 0.6 : 1,
                              minWidth: '120px',
                            }}
                            title={!hasPdfs ? 'No PDFs available - fetch PDFs first' : 'Process PDFs for this school'}
                          >
                            {processing[school.schoolId] ? 'Processing...' : 'Process'}
                          </button>
                        );
                      })()
                    )}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                    {(() => {
                      const hasDriveLink = school.driveLink || school.hasDriveLink;
                      if (!hasDriveLink) {
                        return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
                      }
                      
                      const jobStatus = getJobStatusForSchool(school.schoolId);
                      const isJobActive = jobStatus && (jobStatus.status === 'waiting' || jobStatus.status === 'active');
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFetchPdfs(school.schoolId);
                            }}
                            disabled={fetching[school.schoolId] || isJobActive}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: (fetching[school.schoolId] || isJobActive) ? 'var(--bg-secondary)' : '#4ECDC4',
                              color: (fetching[school.schoolId] || isJobActive) ? 'var(--text-secondary)' : 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: (fetching[school.schoolId] || isJobActive) ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              opacity: (fetching[school.schoolId] || isJobActive) ? 0.6 : 1,
                              minWidth: '120px',
                            }}
                          >
                            {fetching[school.schoolId] ? 'Queuing...' : isJobActive ? 'Job Running...' : 'Fetch PDFs'}
                          </button>
                          {jobStatus && (
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                              {jobStatus.status === 'active' && (
                                <div style={{ width: '100px', margin: '0.25rem auto 0' }}>
                                  <ProgressBar progress={jobStatus.progress} height={4} showPercentage={true} containerStyle={{ margin: 0 }} />
                                </div>
                              )}
                              {jobStatus.status === 'completed' && jobStatus.result && (
                                <div style={{ color: '#4ECDC4' }}>
                                  ✓ {jobStatus.result.downloaded} downloaded
                                </div>
                              )}
                              {jobStatus.status === 'failed' && (
                                <div style={{ color: '#f44' }}>
                                  ✗ Failed
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                    {school.driveLink ? (
                      <a
                        href={school.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: '#4ECDC4',
                          textDecoration: 'none',
                          fontSize: '18px',
                          display: 'inline-block',
                        }}
                        title={school.driveLink}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <i className="fas fa-external-link-alt"></i>
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr
                    key={`${school.schoolId}-expanded`}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      borderBottom: '1px solid var(--bg-primary)',
                    }}
                  >
                    <td colSpan={9} style={{ padding: '1.5rem' }}>
                      <div>
                        {/* PDF Files List with Route Info */}
                        <div>
                          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            PDF Files with Route Information ({school.pdfFiles?.length || 0})
                          </h3>
                          {school.pdfFiles && school.pdfFiles.length > 0 ? (
                            <div style={{ 
                              backgroundColor: 'var(--bg-primary)', 
                              padding: '1rem', 
                              borderRadius: '4px',
                              border: '1px solid var(--bg-primary)',
                            }}>
                              {school.pdfFiles.map((file: string, i: number) => {
                                const pdfUrl = `/api/pdfs/${school.schoolId}/${encodeURIComponent(file)}`;
                                const pdfStatus = pdfProcessingStatus[school.schoolId]?.[file];
                                const isProcessing = processing[school.schoolId] && pdfStatus === 'pending';
                                const isSuccess = pdfStatus === 'success';
                                const isError = pdfStatus === 'error';
                                
                                // Find route for this PDF by matching filename
                                // Try multiple matching strategies
                                let route = allRoutes[school.schoolId]?.[file];
                                if (!route && allRoutes[school.schoolId]) {
                                  // Try matching by route filename field
                                  const routesForSchool = Object.values(allRoutes[school.schoolId]);
                                  route = routesForSchool.find((r: any) => 
                                    r.filename === file || 
                                    r.id === file || 
                                    r.id === file.replace('.pdf', '.json') ||
                                    r.filename === file.replace('.pdf', '.json')
                                  ) as any;
                                }
                                console.log(`[VerificationPage] Looking for route for PDF "${file}":`, route ? 'FOUND' : 'NOT FOUND', route ? `(${route.name || route.id})` : '');
                                
                                let statusIcon = null;
                                let statusColor = '#4ECDC4';
                                
                                if (isProcessing) {
                                  statusIcon = <i className="fas fa-spinner fa-spin" style={{ marginLeft: '0.5rem', color: '#4ECDC4' }}></i>;
                                  statusColor = '#4ECDC4';
                                } else if (isSuccess) {
                                  statusIcon = <i className="fas fa-check-circle" style={{ marginLeft: '0.5rem', color: '#4CAF50' }}></i>;
                                  statusColor = '#4CAF50';
                                } else if (isError) {
                                  statusIcon = <i className="fas fa-times-circle" style={{ marginLeft: '0.5rem', color: '#f44336' }}></i>;
                                  statusColor = '#f44336';
                                }
                                
                                return (
                                  <div
                                    key={i}
                                    style={{ 
                                      marginBottom: '1rem',
                                      padding: '0.75rem',
                                      backgroundColor: 'var(--bg-secondary)',
                                      borderRadius: '4px',
                                      border: '1px solid var(--bg-primary)',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: route ? '0.75rem' : '0' }}>
                                      <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ 
                                          color: statusColor,
                                          fontSize: '12px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          flex: 1,
                                          textDecoration: 'none',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.textDecoration = 'underline';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.textDecoration = 'none';
                                        }}
                                        title={`Open ${file} in new tab`}
                                      >
                                        <i className="fas fa-file-pdf" style={{ marginRight: '0.5rem' }}></i>
                                        <span style={{ flex: 1 }}>{file}</span>
                                        {statusIcon}
                                      </a>
                                    </div>
                                    
                                    {/* Route Information */}
                                    {route ? (
                                      <div style={{ 
                                        marginTop: '0.75rem',
                                        padding: '0.75rem',
                                        backgroundColor: 'var(--bg-primary)',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                      }}>
                                        <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                          Route: {route.name || 'Unknown'} {route.direction && `(${route.direction})`}
                                        </div>
                                        {route.stats && (
                                          <div style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                            {route.stats.totalStops} stops, {route.stats.geocodedStops} geocoded
                                          </div>
                                        )}
                                        {route.stops && route.stops.length > 0 && (
                                          <div style={{ marginTop: '0.5rem' }}>
                                            <div style={{ color: 'var(--text-primary)', fontSize: '11px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                              Stops ({route.stops.length}):
                                            </div>
                                            <div>
                                              {route.stops.map((stop: any, stopIdx: number) => {
                                                const isSkipped = stop.skipGeocoding;
                                                const isSchoolStop = stop.isSchoolStop;
                                                const hasGeocodeError = stop.geocodeError;
                                                const isFiltered = isSkipped || hasGeocodeError;
                                                
                                                return (
                                                  <div 
                                                    key={stop.id || stopIdx} 
                                                    style={{ 
                                                      marginBottom: '0.5rem', 
                                                      padding: '0.5rem',
                                                      backgroundColor: isFiltered ? 'rgba(255, 193, 7, 0.1)' : 'var(--bg-secondary)',
                                                      borderRadius: '4px',
                                                      fontSize: '10px',
                                                      border: isFiltered ? '1px solid rgba(255, 193, 7, 0.3)' : 'none',
                                                    }}
                                                  >
                                                    {/* Status indicators */}
                                                    {(isSkipped || isSchoolStop || hasGeocodeError) && (
                                                      <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {isSkipped && (
                                                          <span style={{ 
                                                            fontSize: '9px', 
                                                            padding: '0.2rem 0.4rem', 
                                                            backgroundColor: 'rgba(255, 193, 7, 0.2)', 
                                                            color: '#856404',
                                                            borderRadius: '3px',
                                                            fontWeight: 'bold'
                                                          }}>
                                                            ⚠️ Skipped Geocoding
                                                          </span>
                                                        )}
                                                        {isSchoolStop && (
                                                          <span style={{ 
                                                            fontSize: '9px', 
                                                            padding: '0.2rem 0.4rem', 
                                                            backgroundColor: 'rgba(78, 205, 196, 0.2)', 
                                                            color: '#4ECDC4',
                                                            borderRadius: '3px',
                                                            fontWeight: 'bold'
                                                          }}>
                                                            🏫 School Stop
                                                          </span>
                                                        )}
                                                        {hasGeocodeError && (
                                                          <span style={{ 
                                                            fontSize: '9px', 
                                                            padding: '0.2rem 0.4rem', 
                                                            backgroundColor: 'rgba(244, 67, 54, 0.2)', 
                                                            color: '#f44336',
                                                            borderRadius: '3px',
                                                            fontWeight: 'bold'
                                                          }}>
                                                            ❌ Geocode Error
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                    
                                                    {/* Cleaned address (main display) */}
                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                                      {stop.address || stop.displayName || 'Unknown address'}
                                                    </div>
                                                    
                                                    {/* Raw original line */}
                                                    {stop.originalLine && stop.originalLine !== stop.address && (
                                                      <div style={{ 
                                                        color: 'var(--text-tertiary)', 
                                                        fontSize: '9px',
                                                        fontStyle: 'italic',
                                                        marginBottom: '0.25rem',
                                                        padding: '0.25rem',
                                                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                                        borderRadius: '3px',
                                                      }}>
                                                        <strong>Raw:</strong> {stop.originalLine}
                                                      </div>
                                                    )}
                                                    
                                                    {/* Display name if different from address */}
                                                    {stop.displayName && stop.displayName !== stop.address && (
                                                      <div style={{ 
                                                        color: 'var(--text-secondary)', 
                                                        fontSize: '9px',
                                                        marginBottom: '0.25rem',
                                                      }}>
                                                        <strong>Geocoded:</strong> {stop.displayName}
                                                      </div>
                                                    )}
                                                    
                                                    {stop.coordinates && (
                                                      <div style={{ color: 'var(--text-secondary)', fontSize: '9px' }}>
                                                        Coordinates: [{stop.coordinates[0]?.toFixed(6)}, {stop.coordinates[1]?.toFixed(6)}]
                                                      </div>
                                                    )}
                                                    {stop.time && (
                                                      <div style={{ color: 'var(--text-secondary)', fontSize: '9px' }}>
                                                        Time: {stop.time}
                                                      </div>
                                                    )}
                                                    {stop.neighborhood && (
                                                      <div style={{ color: 'var(--text-secondary)', fontSize: '9px' }}>
                                                        Neighborhood: {stop.neighborhood}
                                                      </div>
                                                    )}
                                                    {stop.geocodeError && (
                                                      <div style={{ color: '#f44336', fontSize: '9px', marginTop: '0.25rem' }}>
                                                        <strong>Error:</strong> {stop.geocodeError}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : loadingRoutes[school.schoolId] ? (
                                      <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '11px', fontStyle: 'italic' }}>
                                        Loading route data...
                                      </div>
                                    ) : (
                                      <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '11px', fontStyle: 'italic' }}>
                                        No processed route found
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No PDFs available</div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schools Without PDFs Section */}
      {pdfStatus.summary.schoolsWithoutPdfs > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Schools Without Downloaded PDFs</h2>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', padding: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              These schools have Drive links configured but PDFs could not be downloaded (likely due to access restrictions):
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {pdfStatus.schools
                .filter((s: any) => s.hasDriveLink && !s.hasPdfs)
                .map((school: any) => (
                  <div
                    key={school.schoolId}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '4px',
                      border: '1px solid var(--bg-primary)',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{school.schoolName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{school.schoolId}</div>
                    {school.driveLink && (
                      <a
                        href={school.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#4ECDC4',
                          fontSize: '11px',
                          textDecoration: 'none',
                          display: 'block',
                          marginTop: '0.25rem',
                          wordBreak: 'break-all',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        Drive Link
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
