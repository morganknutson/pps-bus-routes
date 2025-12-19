import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { ProgressBar } from '../components/ProgressBar';

export function VerificationPage() {
  console.log('[VerificationPage] Component rendering...');
  console.log('[VerificationPage] Component mounted successfully');
  const [pdfStatus, setPdfStatus] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, { lastModifiedPdf?: string; lastChecked?: string }>>({});
  const [processingStatus, setProcessingStatus] = useState<Record<string, boolean | { hasProcessed: boolean; lastProcessed: string | null }>>({});
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
  const [pdfFetchInfo, setPdfFetchInfo] = useState<Record<string, any>>({});
  const [driveLinkResults, setDriveLinkResults] = useState<any>(null);
  const [checkingDriveLinks, setCheckingDriveLinks] = useState(false);
  const [checkingSchool, setCheckingSchool] = useState<Record<string, boolean>>({});
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchAllProgress, setFetchAllProgress] = useState<{ queued: number; total: number } | null>(null);
  const [fixingAll, setFixingAll] = useState(false);
  const [fixAllStatus, setFixAllStatus] = useState<{
    phase: 'idle' | 'fetching' | 'waiting-fetch' | 'processing' | 'waiting-process' | 'complete';
    fetchQueued: number;
    fetchTotal: number;
    processQueued: number;
    processTotal: number;
    message: string;
  }>({ phase: 'idle', fetchQueued: 0, fetchTotal: 0, processQueued: 0, processTotal: 0, message: '' });
  const [jobQueueStats, setJobQueueStats] = useState<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
    isRedisAvailable?: boolean;
  } | null>(null);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [fetchMessages, setFetchMessages] = useState<Record<string, { type: 'info' | 'success' | 'error'; message: string }>>({});

  // Define all functions before useEffects
  const loadJobQueueStats = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('/api/jobs/stats', { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const stats = await response.json();
        setJobQueueStats(stats);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[VerificationPage] Error loading job stats (non-fatal):', err.message || err);
      }
    }
  };

  const loadJobStatuses = async () => {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      // Get all active and waiting jobs
      const response = await fetch('/api/jobs?limit=100', {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const statusMap: Record<string, any> = {};
        const activeJobsList: any[] = [];
        
        data.jobs.forEach((job: any) => {
          if (job.data.schoolId) {
            statusMap[job.data.schoolId] = job;
          }
          // Track active/waiting jobs for the queue panel
          if (job.status === 'active' || job.status === 'waiting') {
            activeJobsList.push(job);
          }
        });
        
        setJobStatuses(statusMap);
        setActiveJobs(activeJobsList);
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

  const loadPdfFetchInfo = async () => {
    try {
      // Backend always includes cached Drive data (no API calls, cache only)
      console.log('[VerificationPage] Loading PDF fetch info...');
      const response = await fetch('/api/verification/pdf-fetch-info');
      if (response.ok) {
        const data = await response.json();
        console.log('[VerificationPage] PDF fetch info loaded:', {
          schoolCount: Object.keys(data || {}).length,
          sampleSchool: Object.keys(data || {})[0],
          sampleData: data ? data[Object.keys(data)[0]] : null,
        });
        
        // Set state directly - backend already merges cached Drive data
        setPdfFetchInfo(data || {});
      } else {
        console.error(`[VerificationPage] Failed to load PDF fetch info: ${response.status} ${response.statusText}`);
      }
    } catch (err: any) {
      console.error('[VerificationPage] Failed to load PDF fetch info:', err);
    }
  };

  const checkSingleSchoolDriveLink = async (schoolId: string) => {
    try {
      console.log(`[VerificationPage] Checking Drive link for ${schoolId}...`);
      setCheckingSchool(prev => ({ ...prev, [schoolId]: true }));
      
      const response = await fetch(`/api/verification/check-drive-link/${schoolId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[VerificationPage] Drive check result for ${schoolId}:`, result);
        
        // Update the pdfFetchInfo state with the new Drive data
        setPdfFetchInfo(prev => ({
          ...prev,
          [schoolId]: {
            ...prev[schoolId],
            driveLastModified: result.driveLastModified,
            driveAccessible: result.accessible,
            driveHasPdfs: result.hasPdfs,
            drivePdfCount: result.pdfCount,
            localLastModified: result.localLastModified || prev[schoolId]?.localLastModified,
          },
        }));
        
        // Show success message with match status
        const school = pdfStatus?.schools?.find((s: any) => s.schoolId === schoolId);
        const schoolName = school?.schoolName || schoolId;
        let message = result.hasPdfs 
          ? `${result.pdfCount} PDFs on Drive` 
          : 'No PDFs on Drive';
        
        if (result.matches) {
          message += ' ✓ Up to date';
        } else if (result.needsUpdate) {
          message += ' ⚠️ Needs update';
        }
        
        setSuccessMessages(prev => ({
          ...prev,
          [schoolId]: message,
        }));
        
        // Auto-dismiss after 4 seconds
        setTimeout(() => {
          setSuccessMessages(prev => {
            const updated = { ...prev };
            delete updated[schoolId];
            return updated;
          });
        }, 4000);
        
        return result;
      } else {
        const error = await response.json();
        console.error(`[VerificationPage] Error checking Drive link for ${schoolId}:`, error);
        
        // Show error message
        setSuccessMessages(prev => ({
          ...prev,
          [schoolId]: `Error: ${error.error || 'Failed to check Drive link'}`,
        }));
        
        setTimeout(() => {
          setSuccessMessages(prev => {
            const updated = { ...prev };
            delete updated[schoolId];
            return updated;
          });
        }, 5000);
        
        throw new Error(error.error || 'Failed to check Drive link');
      }
    } catch (err: any) {
      console.error(`[VerificationPage] Error checking Drive link for ${schoolId}:`, err);
      
      // Show error message
      setSuccessMessages(prev => ({
        ...prev,
        [schoolId]: `Error: ${err.message || 'Failed to check Drive link'}`,
      }));
      
      setTimeout(() => {
        setSuccessMessages(prev => {
          const updated = { ...prev };
          delete updated[schoolId];
          return updated;
        });
      }, 5000);
      
      throw err;
    } finally {
      setCheckingSchool(prev => ({ ...prev, [schoolId]: false }));
    }
  };

  const loadDriveLinkResults = async () => {
    try {
      const response = await fetch('/api/verification/drive-link-results');
      if (response.ok) {
        const data = await response.json();
        setDriveLinkResults(data);
      } else if (response.status === 404) {
        // No results yet - that's okay
        setDriveLinkResults(null);
      }
    } catch (err: any) {
      console.error('[VerificationPage] Failed to load Drive link results:', err);
      setDriveLinkResults(null);
    }
  };

  const handleCheckDriveLinks = async () => {
    setCheckingDriveLinks(true);
    const startTime = Date.now(); // Track when we started to detect NEW results
    
    try {
      // Use async mode (wait=false) for better UX - don't block the UI
      const response = await fetch('/api/verification/check-drive-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wait: false }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // If results are returned immediately (shouldn't happen with wait=false, but handle it)
        if (data.results) {
          setDriveLinkResults(data);
          await loadPdfFetchInfo(); // Reload to show Drive data in table
          setCheckingDriveLinks(false);
          setSuccessMessages(prev => ({
            ...prev,
            _driveCheck: `Drive link verification completed! Checked ${data.results?.length || 0} schools.`,
          }));
          setTimeout(() => {
            setSuccessMessages(prev => {
              const updated = { ...prev };
              delete updated._driveCheck;
              return updated;
            });
          }, 5000);
        } else {
          // Background mode - start polling
          const totalSchools = data.totalSchools || '?';
          setSuccessMessages(prev => ({
            ...prev,
            _driveCheck: `Checking Drive links for ${totalSchools} schools... This may take a few minutes.`,
          }));
          
          // Poll for results (check every 3 seconds)
          const pollInterval = setInterval(async () => {
            try {
              const resultsResponse = await fetch('/api/verification/drive-link-results');
              if (resultsResponse.ok) {
                const results = await resultsResponse.json();
                
                // Only consider results complete if timestamp is AFTER we started
                // This ensures we wait for the new verification to complete
                const resultsTime = results.timestamp ? new Date(results.timestamp).getTime() : 0;
                
                if (resultsTime > startTime) {
                  // New results are ready!
                  setDriveLinkResults(results);
                  clearInterval(pollInterval);
                  setCheckingDriveLinks(false);
                  
                  // Reload PDF fetch info to show updated Drive data in table
                  await loadPdfFetchInfo();
                  
                  const schoolsChecked = results.results?.length || 0;
                  const needsUpdate = results.summary?.needsUpdate || 0;
                  const errors = results.summary?.errors || 0;
                  
                  let message = `Drive link verification completed! Checked ${schoolsChecked} schools.`;
                  if (needsUpdate > 0) {
                    message += ` ${needsUpdate} need updates.`;
                  }
                  if (errors > 0) {
                    message += ` ${errors} errors.`;
                  }
                  
                  setSuccessMessages(prev => ({
                    ...prev,
                    _driveCheck: message,
                  }));
                  setTimeout(() => {
                    setSuccessMessages(prev => {
                      const updated = { ...prev };
                      delete updated._driveCheck;
                      return updated;
                    });
                  }, 8000);
                } else {
                  // Results are old, keep polling
                  // Update progress message
                  const elapsed = Math.round((Date.now() - startTime) / 1000);
                  setSuccessMessages(prev => ({
                    ...prev,
                    _driveCheck: `Checking Drive links for ${totalSchools} schools... (${elapsed}s elapsed)`,
                  }));
                }
              }
            } catch (err) {
              // Keep polling on error
              console.error('[VerificationPage] Polling error:', err);
            }
          }, 3000);
          
          // Stop polling after 10 minutes
          setTimeout(() => {
            clearInterval(pollInterval);
            setCheckingDriveLinks(false);
            setSuccessMessages(prev => ({
              ...prev,
              _driveCheck: 'Verification timed out. Check the console for errors.',
            }));
            setTimeout(() => {
              setSuccessMessages(prev => {
                const updated = { ...prev };
                delete updated._driveCheck;
                return updated;
              });
            }, 5000);
          }, 600000);
        }
      } else {
        const error = await response.json();
        setCheckingDriveLinks(false);
        setSuccessMessages(prev => ({
          ...prev,
          _driveCheck: `Error: ${error.error || 'Failed to start verification'}`,
        }));
        setTimeout(() => {
          setSuccessMessages(prev => {
            const updated = { ...prev };
            delete updated._driveCheck;
            return updated;
          });
        }, 5000);
      }
    } catch (err: any) {
      setCheckingDriveLinks(false);
      setSuccessMessages(prev => ({
        ...prev,
        _driveCheck: `Error: ${err.message || 'Failed to start verification'}`,
      }));
      setTimeout(() => {
        setSuccessMessages(prev => {
          const updated = { ...prev };
          delete updated._driveCheck;
          return updated;
        });
      }, 5000);
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
      
      // Also reload sync status and PDF fetch info
      await loadSyncStatus();
      await loadPdfFetchInfo();
      
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
        try {
          // Load PDF fetch info (uses only cached Drive data, no API calls)
          await loadPdfFetchInfo();
        } catch (err) {
          console.error('[VerificationPage] Error loading PDF fetch info (non-fatal):', err);
        }
        try {
          await loadDriveLinkResults();
        } catch (err) {
          console.error('[VerificationPage] Error loading Drive link results (non-fatal):', err);
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
    loadJobQueueStats();
    
    // Then poll every 3 seconds for more responsive updates
    const interval = setInterval(() => {
      loadJobStatuses();
      loadJobQueueStats();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPollJobs]); // Only depend on the boolean flag, not the pdfStatus object

  const handleFetchPdfs = async (schoolId: string) => {
    setFetching(prev => ({ ...prev, [schoolId]: true }));
    // Clear any previous message for this school
    setFetchMessages(prev => {
      const updated = { ...prev };
      delete updated[schoolId];
      return updated;
    });
    
    try {
      const response = await fetch(`/api/pdf-sync/fetch/${schoolId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        // Job has been enqueued - show inline message instead of alert
        setFetchMessages(prev => ({
          ...prev,
          [schoolId]: { type: 'info', message: `Queued (Job #${result.jobId.substring(0, 6)}...)` }
        }));
        
        // Reload job statuses to show the new job
        await loadJobStatuses();
        await loadJobQueueStats();
        
        // Start polling for job completion
        let pollCount = 0;
        const maxPolls = 60; // Poll for up to 5 minutes (60 * 5 seconds)
        const pollInterval = setInterval(async () => {
          pollCount++;
          await loadJobStatuses();
          await loadJobQueueStats();
          
          // Get current job status from the API
          const statusResponse = await fetch(`/api/jobs/school/${schoolId}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const jobs = statusData.jobs || [];
            const activeJob = jobs.find((j: any) => j.status === 'waiting' || j.status === 'active');
            const completedJob = jobs.find((j: any) => j.status === 'completed');
            const failedJob = jobs.find((j: any) => j.status === 'failed');
            
            if (completedJob) {
              clearInterval(pollInterval);
              setFetchMessages(prev => ({
                ...prev,
                [schoolId]: { 
                  type: 'success', 
                  message: `Done! ${completedJob.result?.pdfCount || 0} PDFs synced`
                }
              }));
              // Auto-clear success message after 10 seconds
              setTimeout(() => {
                setFetchMessages(prev => {
                  const updated = { ...prev };
                  delete updated[schoolId];
                  return updated;
                });
              }, 10000);
              // Reload PDF status and fetch info after job completes
              await loadPdfStatus();
              await loadSyncStatus();
              await loadPdfFetchInfo();
            } else if (failedJob) {
              clearInterval(pollInterval);
              setFetchMessages(prev => ({
                ...prev,
                [schoolId]: { 
                  type: 'error', 
                  message: `Failed: ${failedJob.error?.substring(0, 30) || 'Unknown error'}...`
                }
              }));
            } else if (!activeJob && pollCount > 2) {
              clearInterval(pollInterval);
              // Reload PDF status and fetch info
              await loadPdfStatus();
              await loadSyncStatus();
              await loadPdfFetchInfo();
              // Clear the message since job completed
              setFetchMessages(prev => {
                const updated = { ...prev };
                delete updated[schoolId];
                return updated;
              });
            } else if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
              console.warn(`[VerificationPage] Job polling timeout for ${schoolId}`);
              setFetchMessages(prev => ({
                ...prev,
                [schoolId]: { type: 'error', message: 'Timeout - check back later' }
              }));
            }
          }
        }, 3000); // Poll every 3 seconds for faster updates
      } else {
        const error = await response.json();
        if (error.existingJob) {
          setFetchMessages(prev => ({
            ...prev,
            [schoolId]: { type: 'info', message: 'Already running...' }
          }));
        } else {
          setFetchMessages(prev => ({
            ...prev,
            [schoolId]: { type: 'error', message: error.error || 'Failed to queue' }
          }));
        }
      }
    } catch (err: any) {
      setFetchMessages(prev => ({
        ...prev,
        [schoolId]: { type: 'error', message: err.message || 'Network error' }
      }));
    } finally {
      setFetching(prev => ({ ...prev, [schoolId]: false }));
    }
  };

  const handleFetchAllPdfs = async () => {
    if (!pdfStatus?.schools) return;
    
    // Get all schools with Drive links
    const schoolsWithDriveLinks = pdfStatus.schools.filter((school: any) => school.driveLink);
    
    if (schoolsWithDriveLinks.length === 0) {
      alert('No schools with Drive links found');
      return;
    }
    
    setFetchingAll(true);
    setFetchAllProgress({ queued: 0, total: schoolsWithDriveLinks.length });
    
    try {
      let queued = 0;
      
      // Queue fetch jobs for all schools
      for (const school of schoolsWithDriveLinks) {
        try {
          const response = await fetch(`/api/pdf-sync/fetch/${school.schoolId}`, {
            method: 'POST',
          });
          
          if (response.ok) {
            queued++;
            setFetchAllProgress({ queued, total: schoolsWithDriveLinks.length });
          }
        } catch (err) {
          console.error(`[VerificationPage] Error queuing fetch for ${school.schoolId}:`, err);
        }
      }
      
      // Reload job statuses
      await loadJobStatuses();
      await loadJobQueueStats();
      
      setFetchAllProgress(null);
      
      // Show success message
      setSuccessMessages(prev => ({
        ...prev,
        _fetchAll: `Queued ${queued} fetch jobs! Polling for completion...`,
      }));
      
      // Poll for all jobs to complete, then refresh data
      let pollCount = 0;
      const maxPolls = 300; // 25 minutes max (300 * 5 seconds)
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        // Check job queue stats
        try {
          const statsResponse = await fetch('/api/jobs/stats');
          if (statsResponse.ok) {
            const stats = await statsResponse.json();
            setJobQueueStats(stats);
            
            // Update progress message
            const activeCount = (stats.waiting || 0) + (stats.active || 0);
            if (activeCount > 0) {
              setSuccessMessages(prev => ({
                ...prev,
                _fetchAll: `Processing ${activeCount} remaining jobs...`,
              }));
            }
            
            // If no more jobs waiting or active, we're done
            if (stats.waiting === 0 && stats.active === 0) {
              clearInterval(pollInterval);
              
              // Reload all data to update Last Fetch column
              await loadPdfStatus();
              await loadSyncStatus();
              await loadPdfFetchInfo();
              await loadJobStatuses();
              
              setSuccessMessages(prev => ({
                ...prev,
                _fetchAll: `All ${queued} fetch jobs completed! Data refreshed.`,
              }));
              
              // Auto-dismiss after 10 seconds
              setTimeout(() => {
                setSuccessMessages(prev => {
                  const updated = { ...prev };
                  delete updated._fetchAll;
                  return updated;
                });
              }, 10000);
            }
          }
        } catch (err) {
          console.error('[VerificationPage] Error polling job stats:', err);
        }
        
        // Timeout after maxPolls
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setSuccessMessages(prev => ({
            ...prev,
            _fetchAll: 'Polling timeout - some jobs may still be running. Refresh page to see latest data.',
          }));
          setTimeout(() => {
            setSuccessMessages(prev => {
              const updated = { ...prev };
              delete updated._fetchAll;
              return updated;
            });
          }, 10000);
        }
      }, 5000); // Poll every 5 seconds
      
    } catch (err: any) {
      console.error('[VerificationPage] Error in fetch all:', err);
      alert(`Error: ${err.message || 'Failed to queue fetch jobs'}`);
    } finally {
      setFetchingAll(false);
      setFetchAllProgress(null);
    }
  };

  /**
   * Fix all mismatched schools by fetching PDFs and then reprocessing them
   */
  const handleFixAllMismatched = async () => {
    if (!driveLinkResults?.results) return;

    // Get all schools needing attention (either needsUpdate or error)
    const schoolsNeedingFix = driveLinkResults.results.filter((r: any) => r.needsUpdate || r.countMismatch);

    if (schoolsNeedingFix.length === 0) {
      alert('No schools need fixing!');
      return;
    }

    const confirmFix = window.confirm(
      `This will fetch PDFs and reprocess routes for ${schoolsNeedingFix.length} schools. This may take several minutes. Continue?`
    );
    if (!confirmFix) return;

    setFixingAll(true);
    setFixAllStatus({
      phase: 'fetching',
      fetchQueued: 0,
      fetchTotal: schoolsNeedingFix.length,
      processQueued: 0,
      processTotal: 0,
      message: 'Queuing fetch jobs...',
    });

    try {
      // Phase 1: Queue fetch jobs for all mismatched schools
      let fetchQueued = 0;
      for (const school of schoolsNeedingFix) {
        try {
          const response = await fetch(`/api/pdf-sync/fetch/${school.schoolId}`, {
            method: 'POST',
          });
          if (response.ok) {
            fetchQueued++;
            setFixAllStatus(prev => ({
              ...prev,
              fetchQueued,
              message: `Queued fetch for ${school.schoolName || school.schoolId}...`,
            }));
          }
        } catch (err) {
          console.error(`[VerificationPage] Error queuing fetch for ${school.schoolId}:`, err);
        }
      }

      // Phase 2: Wait for all fetch jobs to complete
      setFixAllStatus(prev => ({
        ...prev,
        phase: 'waiting-fetch',
        message: `Waiting for ${fetchQueued} fetch jobs to complete...`,
      }));

      // Poll until all jobs complete
      let fetchComplete = false;
      let pollAttempts = 0;
      const maxPollAttempts = 120; // 10 minutes max (5 sec intervals)

      while (!fetchComplete && pollAttempts < maxPollAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        pollAttempts++;

        try {
          const statsResponse = await fetch('/api/jobs/stats');
          if (statsResponse.ok) {
            const stats = await statsResponse.json();
            setJobQueueStats(stats);
            setFixAllStatus(prev => ({
              ...prev,
              message: `Fetching PDFs... ${stats.active || 0} active, ${stats.waiting || 0} waiting`,
            }));

            // Check if no more active or waiting jobs
            if ((stats.active || 0) === 0 && (stats.waiting || 0) === 0) {
              fetchComplete = true;
            }
          }
        } catch (err) {
          console.warn('[VerificationPage] Error polling job stats:', err);
        }
      }

      // Refresh data after fetching
      await loadPdfStatus();
      await loadSyncStatus();
      await loadPdfFetchInfo();
      await loadDriveLinkResults();

      // Phase 3: Process PDFs for all schools that were fetched
      setFixAllStatus(prev => ({
        ...prev,
        phase: 'processing',
        processTotal: schoolsNeedingFix.length,
        message: 'Processing PDFs...',
      }));

      let processQueued = 0;
      for (const school of schoolsNeedingFix) {
        try {
          // Get updated PDF list for this school
          const schoolData = pdfStatus?.schools?.find((s: any) => s.schoolId === school.schoolId);
          const pdfFiles = schoolData?.pdfFiles || [];

          if (pdfFiles.length === 0) {
            console.log(`[VerificationPage] No PDFs to process for ${school.schoolId}`);
            continue;
          }

          const response = await fetch('/api/process-pdfs/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schoolId: school.schoolId,
              pdfFilenames: pdfFiles,
            }),
          });

          if (response.ok) {
            processQueued++;
            setFixAllStatus(prev => ({
              ...prev,
              processQueued,
              message: `Processing ${school.schoolName || school.schoolId}...`,
            }));
          }
        } catch (err) {
          console.error(`[VerificationPage] Error processing ${school.schoolId}:`, err);
        }

        // Small delay between process requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Phase 4: Wait for processing to complete and refresh all data
      setFixAllStatus(prev => ({
        ...prev,
        phase: 'waiting-process',
        message: 'Finishing up...',
      }));

      // Give some time for processing to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Final refresh of all data
      await loadPdfStatus();
      await loadSyncStatus();
      await loadPdfFetchInfo();
      await loadDriveLinkResults();
      await loadProcessingStatus();

      setFixAllStatus({
        phase: 'complete',
        fetchQueued,
        fetchTotal: schoolsNeedingFix.length,
        processQueued,
        processTotal: schoolsNeedingFix.length,
        message: `Done! Fetched ${fetchQueued} schools, processed ${processQueued} schools.`,
      });

      // Show success message
      setSuccessMessages(prev => ({
        ...prev,
        _fixAll: `Successfully fixed ${fetchQueued} schools!`,
      }));

      // Clear the success message after 10 seconds
      setTimeout(() => {
        setSuccessMessages(prev => {
          const updated = { ...prev };
          delete updated._fixAll;
          return updated;
        });
        setFixAllStatus({ phase: 'idle', fetchQueued: 0, fetchTotal: 0, processQueued: 0, processTotal: 0, message: '' });
      }, 10000);

    } catch (err: any) {
      console.error('[VerificationPage] Error in fix all:', err);
      setFixAllStatus(prev => ({
        ...prev,
        phase: 'idle',
        message: `Error: ${err.message || 'Unknown error'}`,
      }));
      alert(`Error: ${err.message || 'Failed to fix schools'}`);
    } finally {
      setFixingAll(false);
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
      
      {/* Header with Actions */}
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
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleCheckDriveLinks}
            disabled={checkingDriveLinks}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: checkingDriveLinks ? 'var(--bg-secondary)' : '#ffa500',
              color: checkingDriveLinks ? 'var(--text-secondary)' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: checkingDriveLinks ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: checkingDriveLinks ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: checkingDriveLinks ? 'none' : 'var(--shadow-hover)',
            }}
            onMouseEnter={(e) => {
              if (!checkingDriveLinks) {
                e.currentTarget.style.backgroundColor = '#ffb733';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!checkingDriveLinks) {
                e.currentTarget.style.backgroundColor = '#ffa500';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
            title="Refresh Drive status for all schools to see if latest modified dates match local dates"
          >
            <i className={`fas ${checkingDriveLinks ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
            {checkingDriveLinks ? 'Refreshing...' : 'Refresh All Drive Status'}
          </button>
          <button
            onClick={handleFetchAllPdfs}
            disabled={fetchingAll}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: fetchingAll ? 'var(--bg-secondary)' : '#4ECDC4',
              color: fetchingAll ? 'var(--text-secondary)' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: fetchingAll ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: fetchingAll ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: fetchingAll ? 'none' : 'var(--shadow-hover)',
            }}
            onMouseEnter={(e) => {
              if (!fetchingAll) {
                e.currentTarget.style.backgroundColor = '#5EDDD6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!fetchingAll) {
                e.currentTarget.style.backgroundColor = '#4ECDC4';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
            title="Queue fetch jobs for all schools with Drive links"
          >
            <i className={`fas ${fetchingAll ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
            {fetchingAll 
              ? (fetchAllProgress 
                  ? `Queuing ${fetchAllProgress.queued}/${fetchAllProgress.total}...` 
                  : 'Queuing...') 
              : 'Fetch All PDFs'}
          </button>
        </div>
      </div>

      {/* Job Queue Status Panel - Show when there are active/waiting jobs */}
      {(activeJobs.length > 0 || (jobQueueStats && (jobQueueStats.waiting > 0 || jobQueueStats.active > 0))) && (
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid #4ECDC4',
          boxShadow: '0 2px 8px rgba(78, 205, 196, 0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-tasks" style={{ color: '#4ECDC4', fontSize: '1.1rem' }}></i>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  Job Queue
                </span>
              </div>
              {jobQueueStats && (
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                  {jobQueueStats.waiting > 0 && (
                    <span style={{ 
                      backgroundColor: 'rgba(255, 165, 0, 0.15)', 
                      color: '#ffa500',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '12px',
                      fontWeight: '600',
                    }}>
                      <i className="fas fa-clock" style={{ marginRight: '0.35rem' }}></i>
                      {jobQueueStats.waiting} waiting
                    </span>
                  )}
                  {jobQueueStats.active > 0 && (
                    <span style={{ 
                      backgroundColor: 'rgba(78, 205, 196, 0.15)', 
                      color: '#4ECDC4',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '12px',
                      fontWeight: '600',
                    }}>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.35rem' }}></i>
                      {jobQueueStats.active} running
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Active Jobs List */}
          {activeJobs.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activeJobs.slice(0, 5).map((job: any) => {
                const school = pdfStatus?.schools?.find((s: any) => s.schoolId === job.data.schoolId);
                const schoolName = school?.schoolName || job.data.schoolId;
                const progress = job.progress || 0;
                const isActive = job.status === 'active';
                
                return (
                  <div key={job.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}>
                    <i className={`fas ${isActive ? 'fa-sync fa-spin' : 'fa-clock'}`} 
                       style={{ color: isActive ? '#4ECDC4' : '#ffa500', width: '16px' }}></i>
                    <span style={{ 
                      fontWeight: '500', 
                      color: 'var(--text-primary)',
                      minWidth: '150px',
                    }}>
                      {schoolName}
                    </span>
                    <span style={{ 
                      color: 'var(--text-secondary)', 
                      fontSize: '0.8rem',
                      minWidth: '60px',
                    }}>
                      {isActive ? 'Running' : 'Queued'}
                    </span>
                    {isActive && (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          flex: 1,
                          height: '6px',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: '#4ECDC4',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease',
                          }}></div>
                        </div>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: 'var(--text-secondary)',
                          minWidth: '35px',
                          textAlign: 'right',
                        }}>
                          {progress}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {activeJobs.length > 5 && (
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: 'var(--text-secondary)', 
                  textAlign: 'center',
                  paddingTop: '0.25rem',
                }}>
                  +{activeJobs.length - 5} more jobs in queue
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Drive Link Verification Results - Only show if there are schools needing attention */}
      {driveLinkResults && driveLinkResults.results && (() => {
        const schoolsNeedingAttention = driveLinkResults.results.filter((r: any) => r.needsUpdate || r.error);
        const hasSchoolsNeedingAttention = schoolsNeedingAttention.length > 0;
        const hasSummary = driveLinkResults.summary && (
          driveLinkResults.summary.needsUpdate > 0 || 
          driveLinkResults.summary.errors > 0
        );
        
        // Only show this section if there are schools needing attention
        if (!hasSchoolsNeedingAttention && !hasSummary) {
          return null;
        }
        
        return (
          <div style={{ 
            marginBottom: '2rem', 
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '8px', 
            boxShadow: 'var(--shadow-large)', 
            padding: '1.5rem' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                <i className="fas fa-exclamation-triangle" style={{ color: '#ffa500', marginRight: '0.5rem' }}></i>
                Schools Needing Attention
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                  onClick={handleFixAllMismatched}
                  disabled={fixingAll}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: fixingAll ? 'var(--bg-secondary)' : '#FF6B6B',
                    color: fixingAll ? 'var(--text-secondary)' : 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: fixingAll ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    boxShadow: fixingAll ? 'none' : '0 2px 4px rgba(255, 107, 107, 0.3)',
                  }}
                  title="Fetch PDFs and reprocess all schools needing attention"
                >
                  <i className={`fas ${fixingAll ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
                  {fixingAll ? (
                    <span>{fixAllStatus.message || 'Working...'}</span>
                  ) : (
                    <span>Fix All ({schoolsNeedingAttention.length})</span>
                  )}
                </button>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Last checked: {new Date(driveLinkResults.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
            
            {/* Fix All Progress */}
            {fixingAll && fixAllStatus.phase !== 'idle' && (
              <div style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '6px',
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <i className="fas fa-spinner fa-spin" style={{ color: '#4ECDC4' }}></i>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {fixAllStatus.phase === 'fetching' && 'Queuing fetch jobs...'}
                    {fixAllStatus.phase === 'waiting-fetch' && 'Fetching PDFs from Drive...'}
                    {fixAllStatus.phase === 'processing' && 'Processing PDFs...'}
                    {fixAllStatus.phase === 'waiting-process' && 'Finishing up...'}
                    {fixAllStatus.phase === 'complete' && 'Complete!'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '2rem', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div>
                    <i className="fas fa-download" style={{ marginRight: '0.5rem' }}></i>
                    Fetched: {fixAllStatus.fetchQueued}/{fixAllStatus.fetchTotal}
                  </div>
                  {(fixAllStatus.phase === 'processing' || fixAllStatus.phase === 'waiting-process' || fixAllStatus.phase === 'complete') && (
                    <div>
                      <i className="fas fa-cogs" style={{ marginRight: '0.5rem' }}></i>
                      Processed: {fixAllStatus.processQueued}/{fixAllStatus.processTotal}
                    </div>
                  )}
                </div>
                {fixAllStatus.message && (
                  <div style={{ marginTop: '0.5rem', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {fixAllStatus.message}
                  </div>
                )}
              </div>
            )}
            
            {driveLinkResults.summary && (hasSummary) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffa500' }}>
                    {driveLinkResults.summary.needsUpdate || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Needs Update</div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f44' }}>
                    {driveLinkResults.summary.errors || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Errors</div>
                </div>
              </div>
            )}

            {hasSchoolsNeedingAttention && (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--bg-primary)' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>School</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Drive Modified</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Local Modified</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolsNeedingAttention.map((result: any, idx: number) => (
                      <tr key={result.schoolId} style={{ 
                        borderBottom: '1px solid var(--bg-primary)',
                        backgroundColor: idx % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 'bold' }}>{result.schoolName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{result.schoolId}</div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {result.error ? (
                            <span style={{ color: '#f44' }}>
                              <i className="fas fa-times-circle" style={{ marginRight: '0.25rem' }}></i>
                              Error
                            </span>
                          ) : result.needsUpdate ? (
                            <span style={{ color: '#ffa500' }}>
                              <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.25rem' }}></i>
                              Needs Update
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '11px' }}>
                          {result.driveLastModified ? new Date(result.driveLastModified).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '11px' }}>
                          {result.localLastModified ? new Date(result.localLastModified).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {(() => {
                            const jobStatus = getJobStatusForSchool(result.schoolId);
                            const isJobActive = jobStatus && (jobStatus.status === 'waiting' || jobStatus.status === 'active');
                            const fetchMsg = fetchMessages[result.schoolId];
                            
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                <button
                                  onClick={() => handleFetchPdfs(result.schoolId)}
                                  disabled={fetching[result.schoolId] || isJobActive}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    backgroundColor: (fetching[result.schoolId] || isJobActive) ? 'var(--bg-secondary)' : '#4ECDC4',
                                    color: (fetching[result.schoolId] || isJobActive) ? 'var(--text-secondary)' : 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: (fetching[result.schoolId] || isJobActive) ? 'not-allowed' : 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {fetching[result.schoolId] ? 'Queuing...' : isJobActive ? 'Running...' : 'Fetch PDFs'}
                                </button>
                                {isJobActive && jobStatus.progress > 0 && (
                                  <div style={{ width: '80px' }}>
                                    <ProgressBar progress={jobStatus.progress} height={3} showPercentage={false} containerStyle={{ margin: 0 }} />
                                  </div>
                                )}
                                {fetchMsg && (
                                  <span style={{ 
                                    fontSize: '9px', 
                                    color: fetchMsg.type === 'error' ? '#f44' : fetchMsg.type === 'success' ? '#4ECDC4' : 'var(--text-secondary)',
                                  }}>
                                    {fetchMsg.type === 'success' && '✓ '}
                                    {fetchMsg.type === 'error' && '✗ '}
                                    {fetchMsg.message}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

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
            {Object.values(processingStatus).filter(status => {
              if (typeof status === 'object' && status !== null) {
                return status.hasProcessed === true;
              }
              return status === true;
            }).length}
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
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Local PDFs</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Local Modified</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Drive PDFs</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Drive Modified</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Match</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Processed</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Last Processed</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Fetch</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Last Fetch</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Drive</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Last Checked</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Check Drive</th>
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
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', maxWidth: '200px' }}>
                    {pdfFetchInfo[school.schoolId]?.localLastModified ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(pdfFetchInfo[school.schoolId].localLastModified).toLocaleString()}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        {pdfFetchInfo[school.schoolId]?.driveHasPdfs !== undefined ? (
                          pdfFetchInfo[school.schoolId].driveHasPdfs ? (
                            <span style={{ fontWeight: 'bold', color: '#4ECDC4', fontSize: '18px' }}>
                              {pdfFetchInfo[school.schoolId].drivePdfCount || '?'}
                            </span>
                          ) : (
                            <span style={{ color: '#f44', fontWeight: 'bold' }}>0</span>
                          )
                        ) : pdfFetchInfo[school.schoolId]?.driveAccessible === false ? (
                          <span style={{ color: '#f44', fontSize: '12px' }}>Not accessible</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', maxWidth: '200px' }}>
                    {pdfFetchInfo[school.schoolId]?.driveLastModified ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(pdfFetchInfo[school.schoolId].driveLastModified).toLocaleString()}
                      </div>
                    ) : pdfFetchInfo[school.schoolId]?.driveAccessible === false ? (
                      <span style={{ color: '#f44', fontSize: '12px' }}>Not accessible</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                    {(() => {
                      const driveModified = pdfFetchInfo[school.schoolId]?.driveLastModified;
                      const localModified = pdfFetchInfo[school.schoolId]?.localLastModified;
                      const drivePdfCount = pdfFetchInfo[school.schoolId]?.drivePdfCount;
                      
                      // Get the actual local PDF count from driveLinkResults (filesystem count, not cached)
                      const driveResult = driveLinkResults?.results?.find((r: any) => r.schoolId === school.schoolId);
                      const actualLocalPdfCount = driveResult?.localPdfCount;
                      const hasCountMismatch = driveResult?.countMismatch === true;
                      
                      if (!driveModified || !localModified) {
                        return <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>;
                      }
                      
                      const driveTime = new Date(driveModified).getTime();
                      const localTime = new Date(localModified).getTime();
                      const diff = Math.abs(driveTime - localTime);
                      const timestampMatches = diff < 1000; // Within 1 second
                      const needsUpdate = driveTime > localTime;
                      
                      // Both timestamps must match AND counts must match
                      const fullyMatches = timestampMatches && !hasCountMismatch;
                      
                      if (fullyMatches) {
                        return (
                          <i className="fas fa-check-circle" style={{ color: '#4ECDC4', fontSize: '12px' }} title="Dates match"></i>
                        );
                      } else if (hasCountMismatch) {
                        return (
                          <i className="fas fa-exclamation-triangle" style={{ color: '#ffa500', fontSize: '12px' }} title={`PDF count mismatch: ${actualLocalPdfCount} local vs ${drivePdfCount} on Drive`}></i>
                        );
                      } else if (needsUpdate) {
                        return (
                          <i className="fas fa-exclamation-triangle" style={{ color: '#ffa500', fontSize: '12px' }} title="Drive has newer files"></i>
                        );
                      } else {
                        return (
                          <i className="fas fa-question-circle" style={{ color: '#f44', fontSize: '12px' }} title="Local is newer than Drive"></i>
                        );
                      }
                    })()}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                    {(() => {
                      const status = processingStatus[school.schoolId];
                      const hasProcessed = typeof status === 'object' && status !== null ? status.hasProcessed : (status === true);
                      
                      return hasProcessed ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <i className="fas fa-check-circle" style={{ color: '#4ECDC4', fontSize: '12px' }}></i>
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
                              fontSize: '12px',
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
                            <i className={`fas ${processing[school.schoolId] ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} style={{ fontSize: '12px' }}></i>
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
                              {processing[school.schoolId] ? 'Processing...' : (!hasPdfs ? 'None' : 'Process')}
                            </button>
                          );
                        })()
                      );
                    })()}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', maxWidth: '200px' }}>
                    {(() => {
                      const status = processingStatus[school.schoolId];
                      const lastProcessed = typeof status === 'object' && status !== null ? status.lastProcessed : null;
                      
                      if (lastProcessed) {
                        return (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {new Date(lastProcessed).toLocaleString()}
                          </div>
                        );
                      } else {
                        return <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>;
                      }
                    })()}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                    {(() => {
                      const hasDriveLink = school.driveLink || school.hasDriveLink;
                      if (!hasDriveLink) {
                        return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
                      }
                      
                      const jobStatus = getJobStatusForSchool(school.schoolId);
                      const isJobActive = jobStatus && (jobStatus.status === 'waiting' || jobStatus.status === 'active');
                      
                      const fetchMsg = fetchMessages[school.schoolId];
                      
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
                            {fetching[school.schoolId] ? 'Queuing...' : isJobActive ? 'Running...' : 'Fetch'}
                          </button>
                          {/* Progress bar for active jobs */}
                          {jobStatus && jobStatus.status === 'active' && (
                            <div style={{ width: '100px', margin: '0.25rem auto 0' }}>
                              <ProgressBar progress={jobStatus.progress} height={4} showPercentage={true} containerStyle={{ margin: 0 }} />
                            </div>
                          )}
                          {/* Status message */}
                          {(fetchMsg || (jobStatus && (jobStatus.status === 'completed' || jobStatus.status === 'failed'))) && (
                            <div style={{ 
                              fontSize: '10px', 
                              textAlign: 'center',
                              color: fetchMsg?.type === 'error' || jobStatus?.status === 'failed' 
                                ? '#f44' 
                                : fetchMsg?.type === 'success' || jobStatus?.status === 'completed'
                                  ? '#4ECDC4'
                                  : 'var(--text-secondary)',
                              maxWidth: '120px',
                            }}>
                              {fetchMsg ? (
                                <span>
                                  {fetchMsg.type === 'success' && '✓ '}
                                  {fetchMsg.type === 'error' && '✗ '}
                                  {fetchMsg.message}
                                </span>
                              ) : jobStatus?.status === 'completed' && jobStatus.result ? (
                                <span>✓ {jobStatus.result.downloaded || jobStatus.result.pdfCount || 0} synced</span>
                              ) : jobStatus?.status === 'failed' ? (
                                <span>✗ Failed</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', maxWidth: '200px' }}>
                    {pdfFetchInfo[school.schoolId]?.lastFetch ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(pdfFetchInfo[school.schoolId].lastFetch).toLocaleString()}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                    )}
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
                        <i className="fas fa-external-link-alt" style={{ fontSize: '12px' }}></i>
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', fontSize: '12px', maxWidth: '200px' }}>
                    {pdfFetchInfo[school.schoolId]?.driveLastChecked ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(pdfFetchInfo[school.schoolId].driveLastChecked).toLocaleString()}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                    {school.driveLink && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await checkSingleSchoolDriveLink(school.schoolId);
                          } catch (err: any) {
                            console.error(`[VerificationPage] Error checking ${school.schoolId}:`, err);
                          }
                        }}
                        disabled={checkingSchool[school.schoolId]}
                        style={{
                          background: checkingSchool[school.schoolId] ? 'var(--bg-primary)' : 'none',
                          border: checkingSchool[school.schoolId] ? '1px solid var(--bg-primary)' : 'none',
                          color: checkingSchool[school.schoolId] ? 'var(--text-secondary)' : '#4ECDC4',
                          cursor: checkingSchool[school.schoolId] ? 'not-allowed' : 'pointer',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          opacity: checkingSchool[school.schoolId] ? 0.6 : 1,
                          transition: 'all 0.2s',
                          minWidth: '32px',
                        }}
                        title={checkingSchool[school.schoolId] ? 'Checking Drive link...' : 'Check Drive link for this school'}
                      >
                        <i className={`fas ${checkingSchool[school.schoolId] ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} style={{ fontSize: '12px' }}></i>
                      </button>
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
                    <td colSpan={11} style={{ padding: '1.5rem' }}>
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
