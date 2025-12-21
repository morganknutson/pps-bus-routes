import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { ProgressBar } from '../components/ProgressBar';
import { useIsMobile } from '../hooks/useMediaQuery';
import { analyticsService } from '../services/analytics';

export function VerificationPage() {
  console.log('[VerificationPage] Component rendering...');
  console.log('[VerificationPage] Component mounted successfully');
  const isMobile = useIsMobile();
  const [pdfStatus, setPdfStatus] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, { lastModifiedPdf?: string; lastChecked?: string }>>({});
  const [processingStatus, setProcessingStatus] = useState<Record<string, boolean | { hasProcessed: boolean; lastProcessed: string | null }>>({});
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [processMessages, setProcessMessages] = useState<Record<string, { type: 'info' | 'success' | 'error'; message: string }>>({});
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
  const [checkAllProgress, setCheckAllProgress] = useState<{ queued: number; total: number } | null>(null);
  const [checkingSchool, setCheckingSchool] = useState<Record<string, boolean>>({});
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchAllProgress, setFetchAllProgress] = useState<{ queued: number; total: number } | null>(null);
  const [fixingAll, setFixingAll] = useState(false);
  const [findingStrangeStops, setFindingStrangeStops] = useState(false);
  const [strangeStopsReport, setStrangeStopsReport] = useState<any>(null);
  const [verifyingSchoolStops, setVerifyingSchoolStops] = useState(false);
  const [schoolStopsReport, setSchoolStopsReport] = useState<any>(null);
  const [fixingStops, setFixingStops] = useState(false);
  const [fixStopsResult, setFixStopsResult] = useState<any>(null);
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
  const [activeTab, setActiveTab] = useState<'attention' | 'all'>('attention');

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

  const checkSingleSchoolDriveLink = async (schoolId: string) => {
    try {
      console.log(`[VerificationPage] Queuing Drive check for ${schoolId}...`);
      setCheckingSchool(prev => ({ ...prev, [schoolId]: true }));
      
      const response = await fetch(`/api/verification/check-drive-link/${schoolId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[VerificationPage] Drive check queued for ${schoolId}:`, result);
        
        // Show queuing message
        setSuccessMessages(prev => ({
          ...prev,
          [schoolId]: 'Drive check queued...',
        }));
        
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
          setSuccessMessages(prev => {
            const updated = { ...prev };
            if (updated[schoolId] === 'Drive check queued...') {
              delete updated[schoolId];
            }
            return updated;
          });
        }, 3000);
        
        return result;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to queue Drive check');
      }
    } catch (err: any) {
      console.error(`[VerificationPage] Error checking Drive link for ${schoolId}:`, err);
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

  const handleCheckDriveLinks = async () => {
    analyticsService.trackAdminAction('drive_check_all');
    if (!pdfStatus?.schools) return;
    
    // Get all schools with Drive links
    const schoolsWithDriveLinks = pdfStatus.schools.filter((school: any) => school.driveLink);
    
    if (schoolsWithDriveLinks.length === 0) {
      alert('No schools with Drive links found');
      return;
    }
    
    setCheckingDriveLinks(true);
    setCheckAllProgress({ queued: 0, total: schoolsWithDriveLinks.length });
    
    try {
      let queued = 0;
      
      // Queue check jobs for all schools
      for (const school of schoolsWithDriveLinks) {
        try {
          const response = await fetch(`/api/verification/check-drive-link/${school.schoolId}`, {
            method: 'POST',
          });
          
          if (response.ok) {
            queued++;
            setCheckAllProgress({ queued, total: schoolsWithDriveLinks.length });
          }
        } catch (err) {
          console.error(`[VerificationPage] Error queuing check for ${school.schoolId}:`, err);
        }
      }
      
      // Reload job statuses
      await loadJobStatuses();
      await loadJobQueueStats();
      
      setCheckAllProgress(null);
      
      // Show success message
      setSuccessMessages(prev => ({
        ...prev,
        _driveCheck: `Queued ${queued} Drive check jobs! Polling for completion...`,
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
                _driveCheck: `Processing ${activeCount} remaining jobs...`,
              }));
            }
            
            // If no more jobs waiting or active, we're done
            if (stats.waiting === 0 && stats.active === 0) {
              clearInterval(pollInterval);
              setCheckingDriveLinks(false);
              
              // Reload all data
              await loadPdfStatus();
              await loadSyncStatus();
              await loadPdfFetchInfo();
              await loadDriveLinkResults();
              await loadJobStatuses();
              
              setSuccessMessages(prev => ({
                ...prev,
                _driveCheck: `All ${queued} Drive check jobs completed! Data refreshed.`,
              }));
              
              // Auto-dismiss after 10 seconds
              setTimeout(() => {
                setSuccessMessages(prev => {
                  const updated = { ...prev };
                  delete updated._driveCheck;
                  return updated;
                });
              }, 10000);
            }
          }
        } catch (err) {
          console.warn('[VerificationPage] Error polling job stats:', err);
        }
        
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setCheckingDriveLinks(false);
        }
      }, 5000);
      
    } catch (err: any) {
      console.error('[VerificationPage] Error starting Drive link verification:', err);
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

  const handleFindStrangeStops = async () => {
    setFindingStrangeStops(true);
    setStrangeStopsReport(null);
    try {
      const response = await fetch('/api/verification/find-strange-stops', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setStrangeStopsReport(data);
        if (data.summary.totalIssues === 0) {
          setSuccessMessages(prev => ({ ...prev, _strange: 'No strange stops found!' }));
        } else {
          setSuccessMessages(prev => ({ ...prev, _strange: `Found ${data.summary.totalIssues} strange stops!` }));
        }
      } else {
        throw new Error('Failed to search for strange stops');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFindingStrangeStops(false);
      setTimeout(() => setSuccessMessages(prev => {
        const updated = { ...prev };
        delete updated._strange;
        return updated;
      }), 5000);
    }
  };

  const handleVerifySchoolStops = async () => {
    setVerifyingSchoolStops(true);
    setSchoolStopsReport(null);
    try {
      const response = await fetch('/api/verification/verify-school-stops', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setSchoolStopsReport(data);
        if (data.summary.invalid === 0 && data.summary.missingSchoolStop === 0) {
          setSuccessMessages(prev => ({ ...prev, _verifySchool: 'All school stops are valid!' }));
        } else {
          setSuccessMessages(prev => ({ ...prev, _verifySchool: `Found issues in ${data.summary.invalid + data.summary.missingSchoolStop} routes!` }));
        }
      } else {
        throw new Error('Failed to verify school stops');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifyingSchoolStops(false);
      setTimeout(() => setSuccessMessages(prev => {
        const updated = { ...prev };
        delete updated._verifySchool;
        return updated;
      }), 5000);
    }
  };

  const handleFixStrangeStops = async () => {
    if (!window.confirm('This will modify processed route files and clear their geometry. Are you sure?')) {
      return;
    }
    setFixingStops(true);
    try {
      const response = await fetch('/api/verification/fix-strange-stops', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setFixStopsResult(data);
        setSuccessMessages(prev => ({ ...prev, _fix: `Fixed ${data.summary.totalFixed} stops!` }));
        // Refresh data
        await handleRefreshStatus();
      } else {
        throw new Error('Failed to fix strange stops');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFixingStops(false);
      setTimeout(() => setSuccessMessages(prev => {
        const updated = { ...prev };
        delete updated._fix;
        return updated;
      }), 5000);
    }
  };

  // Add style to body/html to allow scrolling on this page
  useEffect(() => {
    // Override root styles for this page
    const root = document.getElementById('root');
    if (root) {
      root.style.height = '100vh';
      root.style.overflowY = 'auto';
      root.style.overflowX = 'hidden';
    }
    
    return () => {
      // Restore original styles when component unmounts
      if (root) {
        root.style.height = '100vh';
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

  // Refresh data when jobs complete
  const [lastCompletedJobIds, setLastCompletedJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const completedJobs = Object.values(jobStatuses).filter(job => job.status === 'completed');
    if (completedJobs.length === 0) return;

    const currentCompletedIds = new Set(completedJobs.map(j => j.id));
    
    // Find if there are any NEWLY completed jobs
    const newCompletedJobs = completedJobs.filter(job => !lastCompletedJobIds.has(job.id));
    
    if (newCompletedJobs.length > 0) {
      console.log(`[VerificationPage] Found ${newCompletedJobs.length} newly completed jobs, refreshing data...`);
      
      const hasCompletedDriveCheck = newCompletedJobs.some(job => job.name === 'drive-check');
      const hasCompletedPdfSync = newCompletedJobs.some(job => job.name === 'pdf-sync');
      
      if (hasCompletedDriveCheck) {
        loadDriveLinkResults();
        loadPdfFetchInfo();
      }
      
      if (hasCompletedPdfSync) {
        // Add a small delay to ensure backend has finished writing cache files
        setTimeout(async () => {
          await Promise.all([
            loadPdfStatus(),
            loadSyncStatus(),
            loadPdfFetchInfo(),
            loadDriveLinkResults()
          ]);
        }, 500);
      }
      
      setLastCompletedJobIds(currentCompletedIds);
    }
  }, [jobStatuses, lastCompletedJobIds]);

  const handleFetchPdfs = async (schoolId: string) => {
    analyticsService.trackAdminAction('pdf_sync', schoolId);
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
              setTimeout(async () => {
                await Promise.all([
                  loadPdfStatus(),
                  loadSyncStatus(),
                  loadPdfFetchInfo(),
                  loadDriveLinkResults()
                ]);
              }, 500);
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
              setTimeout(async () => {
                await Promise.all([
                  loadPdfStatus(),
                  loadSyncStatus(),
                  loadPdfFetchInfo(),
                  loadDriveLinkResults()
                ]);
              }, 500);
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
    analyticsService.trackAdminAction('pdf_sync_all');
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
    setProcessMessages(prev => {
      const updated = { ...prev };
      delete updated[schoolId];
      return updated;
    });
    
    try {
      const response = await fetch(`/api/process-pdfs/process/${schoolId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Show info message about queuing
        setProcessMessages(prev => ({
          ...prev,
          [schoolId]: { type: 'info', message: `Queued (Job #${result.jobId.substring(0, 6)}...)` }
        }));

        // Reload job statuses
        await loadJobStatuses();
        await loadJobQueueStats();

        // Start polling for completion
        let pollCount = 0;
        const maxPolls = 60; // 5 minutes
        const pollInterval = setInterval(async () => {
          pollCount++;
          await loadJobStatuses();
          
          const statusResponse = await fetch(`/api/jobs/school/${schoolId}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const jobs = statusData.jobs || [];
            const processJob = jobs.find((j: any) => j.id === result.jobId);
            
            if (processJob && processJob.status === 'completed') {
              clearInterval(pollInterval);
              setProcessing(prev => ({ ...prev, [schoolId]: false }));
              setProcessMessages(prev => ({
                ...prev,
                [schoolId]: { 
                  type: 'success', 
                  message: `Done! Processed ${processJob.result?.processed || 0} routes`
                }
              }));
              
              await Promise.all([
                loadProcessingStatus(),
                loadAllRoutes(schoolId, true)
              ]);

              setTimeout(() => {
                setProcessMessages(prev => {
                  const updated = { ...prev };
                  delete updated[schoolId];
                  return updated;
                });
              }, 10000);
            } else if (processJob && processJob.status === 'failed') {
              clearInterval(pollInterval);
              setProcessing(prev => ({ ...prev, [schoolId]: false }));
              setProcessMessages(prev => ({
                ...prev,
                [schoolId]: { type: 'error', message: `Failed: ${processJob.error || 'Unknown error'}` }
              }));
            } else if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
              setProcessing(prev => ({ ...prev, [schoolId]: false }));
            }
          }
        }, 5000);

      } else {
        const error = await response.json();
        setProcessMessages(prev => ({ ...prev, [schoolId]: { type: 'error', message: `Error: ${error.error}` } }));
        setProcessing(prev => ({ ...prev, [schoolId]: false }));
      }
    } catch (err: any) {
      console.error(`[VerificationPage] Error processing PDFs:`, err);
      setProcessMessages(prev => ({ ...prev, [schoolId]: { type: 'error', message: `Network error: ${err.message}` } }));
      setProcessing(prev => ({ ...prev, [schoolId]: false }));
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
        <div style={{ padding: isMobile ? '1rem' : '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <div style={{ width: isMobile ? '100%' : '300px', maxWidth: '300px' }}>
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
        <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%', flex: 1 }}>
          <div
            style={{
              padding: isMobile ? '1rem' : '2rem',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              color: '#c00',
              textAlign: 'center',
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: isMobile ? '1.25rem' : '1.5rem' }}>⚠️ Error</h2>
            <p style={{ fontSize: isMobile ? '14px' : '16px' }}>{error || 'Failed to load PDF status'}</p>
            <p style={{ marginTop: '1rem', fontSize: isMobile ? '12px' : '14px', color: '#666', wordBreak: 'break-word' }}>
              Run the PDF status script: <code style={{ backgroundColor: '#f0f0f0', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: isMobile ? '11px' : '12px' }}>node scripts/generate-pdf-status.js</code>
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
        padding: isMobile ? '1rem' : '2rem', 
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
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: isMobile ? '1.5rem' : '2rem', 
          fontWeight: 'bold', 
          color: 'var(--text-primary)',
        }}>
          Verification & Status
        </h1>
        <div style={{ display: 'flex', gap: isMobile ? '0.5rem' : '1rem', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={handleCheckDriveLinks}
            disabled={checkingDriveLinks}
            style={{
              padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.5rem',
              backgroundColor: checkingDriveLinks ? 'var(--bg-secondary)' : '#ffa500',
              color: checkingDriveLinks ? 'var(--text-secondary)' : 'white',
              border: 'none',
              borderRadius: '999px',
              cursor: checkingDriveLinks ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: checkingDriveLinks ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: checkingDriveLinks ? 'none' : 'var(--shadow-hover)',
              flex: isMobile ? '1 1 auto' : 'none',
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
            {checkingDriveLinks 
              ? (checkAllProgress 
                  ? `Queuing ${checkAllProgress.queued}/${checkAllProgress.total}...` 
                  : 'Refreshing...') 
              : 'Refresh All Drive Status'}
          </button>
          <button
            onClick={handleFetchAllPdfs}
            disabled={fetchingAll}
            style={{
              padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.5rem',
              backgroundColor: fetchingAll ? 'var(--bg-secondary)' : '#4ECDC4',
              color: fetchingAll ? 'var(--text-secondary)' : 'white',
              border: 'none',
              borderRadius: '999px',
              cursor: fetchingAll ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: fetchingAll ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: fetchingAll ? 'none' : 'var(--shadow-hover)',
              flex: isMobile ? '1 1 auto' : 'none',
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
          
          <button
            onClick={handleFindStrangeStops}
            disabled={findingStrangeStops}
            style={{
              padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.5rem',
              backgroundColor: findingStrangeStops ? 'var(--bg-secondary)' : '#f39c12',
              color: 'white',
              border: 'none',
              borderRadius: '999px',
              cursor: findingStrangeStops ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: findingStrangeStops ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow-hover)',
              flex: isMobile ? '1 1 auto' : 'none',
            }}
            title="Scan all routes for stops with incorrect coordinates or missing data"
          >
            <i className={`fas ${findingStrangeStops ? 'fa-spinner fa-spin' : 'fa-search-location'}`}></i>
            Find Strange Stops
          </button>

          <button
            onClick={handleVerifySchoolStops}
            disabled={verifyingSchoolStops}
            style={{
              padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.5rem',
              backgroundColor: verifyingSchoolStops ? 'var(--bg-secondary)' : '#9b59b6',
              color: 'white',
              border: 'none',
              borderRadius: '999px',
              cursor: verifyingSchoolStops ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: verifyingSchoolStops ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow-hover)',
              flex: isMobile ? '1 1 auto' : 'none',
            }}
            title="Verify that all routes have correct school stops with matching addresses"
          >
            <i className={`fas ${verifyingSchoolStops ? 'fa-spinner fa-spin' : 'fa-graduation-cap'}`}></i>
            Verify School Stops
          </button>

          <button
            onClick={handleFixStrangeStops}
            disabled={fixingStops}
            style={{
              padding: isMobile ? '0.5rem 1rem' : '0.75rem 1.5rem',
              backgroundColor: fixingStops ? 'var(--bg-secondary)' : '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '999px',
              cursor: fixingStops ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '12px' : '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: fixingStops ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow-hover)',
              flex: isMobile ? '1 1 auto' : 'none',
            }}
            title="Automatically fix common stop errors (Loading Zones, I-5 errors)"
          >
            <i className={`fas ${fixingStops ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
            Fix All Stops
          </button>
        </div>
      </div>

      {/* Verification Reports Display */}
      {(strangeStopsReport || schoolStopsReport || fixStopsResult) && (
        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {strangeStopsReport && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid #f39c12',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#f39c12' }}>Strange Stops Report</h3>
                <button 
                  onClick={() => setStrangeStopsReport(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Scanned {strangeStopsReport.summary.totalRoutes} routes. Found <strong>{strangeStopsReport.summary.totalIssues}</strong> issues.
              </div>
              {strangeStopsReport.issues.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  {strangeStopsReport.issues.slice(0, 50).map((issue: any, idx: number) => (
                    <div key={idx} style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--bg-primary)' }}>
                      <strong>{issue.schoolId}</strong>: {issue.routeName} - {issue.stopAddress} ({issue.reasons.join(', ')})
                    </div>
                  ))}
                  {strangeStopsReport.issues.length > 50 && <div>...and {strangeStopsReport.issues.length - 50} more.</div>}
                </div>
              )}
            </div>
          )}

          {schoolStopsReport && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid #9b59b6',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#9b59b6' }}>School Stops Report</h3>
                <button 
                  onClick={() => setSchoolStopsReport(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Valid: {schoolStopsReport.summary.valid} / Total: {schoolStopsReport.summary.total}.
                {schoolStopsReport.summary.invalid > 0 && <span style={{ color: '#e74c3c', marginLeft: '0.5rem' }}>Invalid: {schoolStopsReport.summary.invalid}</span>}
                {schoolStopsReport.summary.missingSchoolStop > 0 && <span style={{ color: '#e74c3c', marginLeft: '0.5rem' }}>Missing: {schoolStopsReport.summary.missingSchoolStop}</span>}
              </div>
              {schoolStopsReport.issues.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  {schoolStopsReport.issues.slice(0, 50).map((issue: any, idx: number) => (
                    <div key={idx} style={{ padding: '0.25rem 0', borderBottom: '1px solid var(--bg-primary)' }}>
                      <strong>{issue.file}</strong>: {issue.issue || 'Data mismatch'} - {issue.message || 'Check school name/coordinates'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {fixStopsResult && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid #e74c3c',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#e74c3c' }}>Fix Results</h3>
                <button 
                  onClick={() => setFixStopsResult(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Fixed <strong>{fixStopsResult.summary.totalFixed}</strong> stops. {fixStopsResult.summary.remainingIssues > 0 && `Remaining issues: ${fixStopsResult.summary.remainingIssues}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Job Queue Status Panel - Show when there are active/waiting jobs */}
      {(activeJobs.length > 0 || (jobQueueStats && (jobQueueStats.waiting > 0 || jobQueueStats.active > 0))) && (
        <div style={{
          marginBottom: '1.5rem',
          padding: isMobile ? '0.75rem' : '1rem 1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid #4ECDC4',
          boxShadow: '0 2px 8px rgba(78, 205, 196, 0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: isMobile ? '0.75rem' : '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-tasks" style={{ color: '#4ECDC4', fontSize: isMobile ? '1rem' : '1.1rem' }}></i>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
                  Job Queue
                </span>
              </div>
              {jobQueueStats && (
                <div style={{ display: 'flex', gap: isMobile ? '0.5rem' : '1rem', fontSize: isMobile ? '0.75rem' : '0.85rem', flexWrap: 'wrap' }}>
                  {jobQueueStats.waiting > 0 && (
                    <span style={{ 
                      backgroundColor: 'rgba(255, 165, 0, 0.15)', 
                      color: '#ffa500',
                      padding: isMobile ? '0.2rem 0.5rem' : '0.25rem 0.6rem',
                      borderRadius: '12px',
                      fontWeight: '600',
                    }}>
                      <i className="fas fa-clock" style={{ marginRight: '0.25rem' }}></i>
                      {jobQueueStats.waiting} waiting
                    </span>
                  )}
                  {jobQueueStats.active > 0 && (
                    <span style={{ 
                      backgroundColor: 'rgba(78, 205, 196, 0.15)', 
                      color: '#4ECDC4',
                      padding: isMobile ? '0.2rem 0.5rem' : '0.25rem 0.6rem',
                      borderRadius: '12px',
                      fontWeight: '600',
                    }}>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.25rem' }}></i>
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
                if (!job || !job.data) return null;
                const school = pdfStatus?.schools?.find((s: any) => s.schoolId === job.data.schoolId);
                const schoolName = school?.schoolName || job.data.schoolId || 'Unknown School';
                const progress = job.progress || 0;
                const isActive = job.status === 'active';
                const isDriveCheck = job.name === 'drive-check';
                
                return (
                  <div key={job.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '0.5rem' : '0.75rem',
                    padding: isMobile ? '0.5rem' : '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '6px',
                    fontSize: isMobile ? '0.75rem' : '0.85rem',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}>
                    <i className={`fas ${isActive ? 'fa-sync fa-spin' : 'fa-clock'}`} 
                       style={{ color: isActive ? (isDriveCheck ? '#9B59B6' : '#4ECDC4') : '#ffa500', width: isMobile ? '14px' : '16px' }}></i>
                    <span style={{ 
                      fontWeight: '500', 
                      color: 'var(--text-primary)',
                      minWidth: isMobile ? 'auto' : '150px',
                      flex: isMobile ? '1 1 100%' : 'none',
                    }}>
                      {schoolName}
                    </span>
                    <span style={{ 
                      color: isDriveCheck ? '#9B59B6' : 'var(--text-secondary)', 
                      fontSize: isMobile ? '0.7rem' : '0.8rem',
                      minWidth: isMobile ? 'auto' : '100px',
                      fontWeight: isDriveCheck ? '600' : 'normal',
                    }}>
                      {isDriveCheck ? 'Drive Check' : 'PDF Sync'}
                    </span>
                    <span style={{ 
                      color: 'var(--text-secondary)', 
                      fontSize: isMobile ? '0.7rem' : '0.8rem',
                      minWidth: isMobile ? 'auto' : '60px',
                    }}>
                      {isActive ? 'Running' : 'Queued'}
                    </span>
                    {isActive && (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', width: isMobile ? '100%' : 'auto', minWidth: isMobile ? '100%' : 'auto' }}>
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
                          fontSize: isMobile ? '0.7rem' : '0.75rem', 
                          color: 'var(--text-secondary)',
                          minWidth: isMobile ? 'auto' : '35px',
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
            padding: isMobile ? '1rem' : '1.5rem' 
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: isMobile ? 'flex-start' : 'center', 
              marginBottom: '1rem',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '0.75rem' : '1rem',
            }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                <i className="fas fa-exclamation-triangle" style={{ color: '#ffa500', marginRight: '0.5rem' }}></i>
                Schools Needing Attention
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1rem', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                <button
                  onClick={handleFixAllMismatched}
                  disabled={fixingAll}
                  style={{
                    padding: isMobile ? '0.5rem' : '0.5rem 1rem',
                    backgroundColor: fixingAll ? 'var(--bg-secondary)' : '#FF6B6B',
                    color: fixingAll ? 'var(--text-secondary)' : 'white',
                    border: 'none',
                    borderRadius: '999px',
                    cursor: fixingAll ? 'not-allowed' : 'pointer',
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    boxShadow: fixingAll ? 'none' : '0 2px 4px rgba(255, 107, 107, 0.3)',
                    flex: isMobile ? '1 1 auto' : 'none',
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
                    Fetched {fixAllStatus.fetchQueued}/{fixAllStatus.fetchTotal}
                  </div>
                  {(fixAllStatus.phase === 'processing' || fixAllStatus.phase === 'waiting-process' || fixAllStatus.phase === 'complete') && (
                    <div>
                      <i className="fas fa-cogs" style={{ marginRight: '0.5rem' }}></i>
                      Processed {fixAllStatus.processQueued}/{fixAllStatus.processTotal}
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
                {isMobile ? (
                  // Mobile card layout
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {schoolsNeedingAttention.map((result: any) => {
                      const jobStatus = getJobStatusForSchool(result.schoolId);
                      const isJobActive = jobStatus && (jobStatus.status === 'waiting' || jobStatus.status === 'active');
                      const fetchMsg = fetchMessages[result.schoolId];
                      
                      return (
                        <div key={result.schoolId} style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                        }}>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '0.25rem' }}>
                            {result.schoolName}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            {result.schoolId}
                          </div>
                          <div style={{ fontSize: '11px', marginBottom: '0.5rem' }}>
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
                            ) : null}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            <div>Local PDFs: {result.localPdfCount || 0} | Drive PDFs: {result.pdfCount || 0}</div>
                            <div>Local: {result.localLastModified ? new Date(result.localLastModified).toLocaleString() : '—'}</div>
                            <div>Drive: {result.driveLastModified ? new Date(result.driveLastModified).toLocaleString() : '—'}</div>
                          </div>
                          <button
                            onClick={() => handleFetchPdfs(result.schoolId)}
                            disabled={fetching[result.schoolId] || isJobActive}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: (fetching[result.schoolId] || isJobActive) ? 'var(--bg-secondary)' : '#4ECDC4',
                              color: (fetching[result.schoolId] || isJobActive) ? 'var(--text-secondary)' : 'white',
                              border: 'none',
                              borderRadius: '999px',
                              cursor: (fetching[result.schoolId] || isJobActive) ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              width: '100%',
                              marginTop: '0.5rem',
                              textAlign: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {fetching[result.schoolId] ? 'Queuing...' : isJobActive ? 'Running...' : 'Fetch PDFs'}
                          </button>
                          {isJobActive && jobStatus.progress > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <ProgressBar progress={jobStatus.progress} height={3} showPercentage={false} containerStyle={{ margin: 0 }} />
                            </div>
                          )}
                          {fetchMsg && (
                            <div style={{ 
                              fontSize: '9px', 
                              color: fetchMsg.type === 'error' ? '#f44' : fetchMsg.type === 'success' ? '#4ECDC4' : 'var(--text-secondary)',
                              marginTop: '0.5rem',
                            }}>
                              {fetchMsg.type === 'success' && '✓ '}
                              {fetchMsg.type === 'error' && '✗ '}
                              {fetchMsg.message}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Desktop table layout
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--bg-primary)' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>School</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>Local PDFs</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>Drive PDFs</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Local Modified</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Drive Modified</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolsNeedingAttention.map((result: any, idx: number) => {
                        const jobStatus = getJobStatusForSchool(result.schoolId);
                        const isJobActive = jobStatus && (jobStatus.status === 'waiting' || jobStatus.status === 'active');
                        const fetchMsg = fetchMessages[result.schoolId];
                        
                        return (
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
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '500' }}>
                              {result.localPdfCount || 0}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '500' }}>
                              {result.pdfCount || 0}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '11px' }}>
                              {result.localLastModified ? new Date(result.localLastModified).toLocaleString() : '—'}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '11px' }}>
                              {result.driveLastModified ? new Date(result.driveLastModified).toLocaleString() : '—'}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                <button
                                  onClick={() => handleFetchPdfs(result.schoolId)}
                                  disabled={fetching[result.schoolId] || isJobActive}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    backgroundColor: (fetching[result.schoolId] || isJobActive) ? 'var(--bg-secondary)' : '#4ECDC4',
                                    color: (fetching[result.schoolId] || isJobActive) ? 'var(--text-secondary)' : 'white',
                                    border: 'none',
                                    borderRadius: '999px',
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: isMobile ? '0.75rem' : '1rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{ padding: isMobile ? '1rem' : '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {pdfStatus.totalSchools}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '12px' : '14px' }}>Total Schools</div>
        </div>
        <div style={{ padding: isMobile ? '1rem' : '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold', color: '#4ECDC4', marginBottom: '0.5rem' }}>
            {pdfStatus.summary.schoolsWithPdfs}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '12px' : '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <i className="fas fa-download"></i>
            <span>With PDFs</span>
          </div>
        </div>
        <div style={{ padding: isMobile ? '1rem' : '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold', color: '#4ECDC4', marginBottom: '0.5rem' }}>
            {pdfStatus.summary.totalPdfs}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '12px' : '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <i className="fas fa-file-pdf"></i>
            <span>Total PDFs</span>
          </div>
        </div>
        <div style={{ padding: isMobile ? '1rem' : '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold', color: '#4ECDC4', marginBottom: '0.5rem' }}>
            {Object.values(processingStatus).filter(status => {
              if (typeof status === 'object' && status !== null) {
                return status.hasProcessed === true;
              }
              return status === true;
            }).length}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '12px' : '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <i className="fas fa-check-circle"></i>
            <span>Processed</span>
          </div>
        </div>
        <div style={{ padding: isMobile ? '1rem' : '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? '1.75rem' : '2.5rem', fontWeight: 'bold', color: '#f44', marginBottom: '0.5rem' }}>
            {pdfStatus.summary.schoolsWithoutPdfs}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '12px' : '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
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
                    padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
                    backgroundColor: isError ? '#fee' : '#efe',
                    border: `1px solid ${isError ? '#fcc' : '#cfc'}`,
                    borderRadius: '8px',
                    color: isError ? '#c00' : '#0c0',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? '0.5rem' : '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem', flex: 1 }}>
                    <i className={`fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}`} style={{ fontSize: isMobile ? '16px' : '18px' }}></i>
                    <div style={{ fontSize: isMobile ? '12px' : '14px', wordBreak: 'break-word' }}>{message}</div>
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
                  padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
                  backgroundColor: isError ? '#fee' : '#efe',
                  border: `1px solid ${isError ? '#fcc' : '#cfc'}`,
                  borderRadius: '8px',
                  color: isError ? '#c00' : '#0c0',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '0.5rem' : '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem', flex: 1 }}>
                  <i className={`fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}`} style={{ fontSize: isMobile ? '16px' : '18px' }}></i>
                  <div style={{ fontSize: isMobile ? '12px' : '14px', wordBreak: 'break-word' }}>
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

      {/* Schools Table - Desktop */}
      {!isMobile && (
        <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '2px solid var(--bg-primary)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)', width: '40px' }}></th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>School</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Local PDFs</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Drive PDFs</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Match</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Processed</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Fetch</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Drive</th>
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
                        <div>
                          {school.hasPdfs ? (
                            <span style={{ fontWeight: 'bold', color: '#4ECDC4', fontSize: '18px' }}>
                              {school.pdfCount}
                            </span>
                          ) : (
                            <span style={{ color: '#f44', fontWeight: 'bold' }}>0</span>
                          )}
                        </div>
                        {pdfFetchInfo[school.schoolId]?.localLastModified && (
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                            {new Date(pdfFetchInfo[school.schoolId].localLastModified).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div>
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
                        </div>
                        {pdfFetchInfo[school.schoolId]?.driveLastModified && (
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                            {new Date(pdfFetchInfo[school.schoolId].driveLastModified).toLocaleString()}
                          </div>
                        )}
                        {pdfFetchInfo[school.schoolId]?.driveAccessible === false && !pdfFetchInfo[school.schoolId]?.driveLastModified && (
                          <div style={{ fontSize: '10px', color: '#f44', marginTop: '0.25rem' }}>
                            Not accessible
                          </div>
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
                      const lastProcessed = typeof status === 'object' && status !== null ? status.lastProcessed : null;
                      
                      const processMsg = processMessages[school.schoolId];
                      const jobStatus = getJobStatusForSchool(school.schoolId);
                      const isProcessJobActive = jobStatus && jobStatus.name === 'pdf-process' && (jobStatus.status === 'waiting' || jobStatus.status === 'active');

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                          {hasProcessed ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                <i className="fas fa-check-circle" style={{ color: '#4ECDC4', fontSize: '12px' }}></i>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleProcessPdfs(school.schoolId);
                                  }}
                                  disabled={processing[school.schoolId] || isProcessJobActive}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: (processing[school.schoolId] || isProcessJobActive) ? 'var(--text-secondary)' : '#4ECDC4',
                                    cursor: (processing[school.schoolId] || isProcessJobActive) ? 'not-allowed' : 'pointer',
                                    padding: '0.25rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    opacity: (processing[school.schoolId] || isProcessJobActive) ? 0.6 : 1,
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!processing[school.schoolId] && !isProcessJobActive) {
                                      e.currentTarget.style.color = '#5EDDD6';
                                      e.currentTarget.style.transform = 'rotate(180deg)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!processing[school.schoolId] && !isProcessJobActive) {
                                      e.currentTarget.style.color = '#4ECDC4';
                                      e.currentTarget.style.transform = 'rotate(0deg)';
                                    }
                                  }}
                                  title="Reprocess routes for this school"
                                >
                                  <i className={`fas ${(processing[school.schoolId] || isProcessJobActive) ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} style={{ fontSize: '12px' }}></i>
                                </button>
                              </div>
                              {lastProcessed && !isProcessJobActive && (
                                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                  {lastProcessed && new Date(lastProcessed).toLocaleString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            (() => {
                              const hasPdfs = school.hasPdfs || (school.pdfCount && school.pdfCount > 0);
                              const isDisabled = processing[school.schoolId] || isProcessJobActive || !hasPdfs;
                              
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
                                    borderRadius: '999px',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    opacity: isDisabled ? 0.6 : 1,
                                    minWidth: '120px',
                                    textAlign: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title={!hasPdfs ? 'No PDFs available - fetch PDFs first' : 'Process PDFs for this school'}
                                >
                                  {(processing[school.schoolId] || isProcessJobActive) ? 'Processing...' : (!hasPdfs ? 'None' : 'Process')}
                                </button>
                              );
                            })()
                          )}

                          {/* Progress bar for active process jobs */}
                          {jobStatus && jobStatus.name === 'pdf-process' && jobStatus.status === 'active' && (
                            <div style={{ width: '100px', margin: '0.25rem auto 0' }}>
                              <ProgressBar progress={jobStatus.progress} height={4} showPercentage={true} containerStyle={{ margin: 0 }} />
                            </div>
                          )}

                          {/* Status message */}
                          {(processMsg || (jobStatus && jobStatus.name === 'pdf-process' && (jobStatus.status === 'completed' || jobStatus.status === 'failed'))) && (
                            <div style={{ 
                              fontSize: '10px', 
                              textAlign: 'center',
                              color: processMsg?.type === 'error' || (jobStatus?.name === 'pdf-process' && jobStatus?.status === 'failed')
                                ? '#f44' 
                                : processMsg?.type === 'success' || (jobStatus?.name === 'pdf-process' && jobStatus?.status === 'completed')
                                  ? '#4ECDC4'
                                  : 'var(--text-secondary)',
                              maxWidth: '120px',
                            }}>
                              {processMsg ? (
                                <span>
                                  {processMsg.type === 'success' && '✓ '}
                                  {processMsg.type === 'error' && '✗ '}
                                  {processMsg.message}
                                </span>
                              ) : jobStatus?.status === 'completed' && jobStatus.result ? (
                                <span>✓ Done</span>
                              ) : jobStatus?.status === 'failed' ? (
                                <span>✗ Failed</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
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
                      
                      const lastFetch = pdfFetchInfo[school.schoolId]?.lastFetch || pdfFetchInfo[school.schoolId]?.lastFetchTime;
                      
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
                              borderRadius: '999px',
                              cursor: (fetching[school.schoolId] || isJobActive) ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              opacity: (fetching[school.schoolId] || isJobActive) ? 0.6 : 1,
                              minWidth: '120px',
                              textAlign: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {fetching[school.schoolId] ? 'Queuing...' : isJobActive ? 'Running...' : 'Fetch'}
                          </button>
                          {lastFetch && (
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                              {new Date(lastFetch).toLocaleString()}
                            </div>
                          )}
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
                                <span>
                                  ✓ {jobStatus.result.downloaded || 0} fetched
                                  {jobStatus.result.deleted > 0 && ` (${jobStatus.result.deleted} removed)`}
                                  {jobStatus.result.downloaded === 0 && jobStatus.result.deleted === 0 && ' (up to date)'}
                                </span>
                              ) : jobStatus?.status === 'failed' ? (
                                <span>✗ Failed</span>
                              ) : null}
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
                        <i className="fas fa-external-link-alt" style={{ fontSize: '12px' }}></i>
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                    {school.driveLink && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
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
                            background: checkingSchool[school.schoolId] ? 'var(--bg-primary)' : '#9B59B6',
                            border: 'none',
                            color: checkingSchool[school.schoolId] ? 'var(--text-secondary)' : 'white',
                            cursor: checkingSchool[school.schoolId] ? 'not-allowed' : 'pointer',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '999px',
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
                        {(pdfFetchInfo[school.schoolId]?.driveLastChecked || syncStatus[school.schoolId]?.lastChecked) && (
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                            {pdfFetchInfo[school.schoolId]?.driveLastChecked 
                              ? new Date(pdfFetchInfo[school.schoolId].driveLastChecked!).toLocaleString()
                              : syncStatus[school.schoolId]?.lastChecked
                                ? new Date(syncStatus[school.schoolId].lastChecked!).toLocaleString()
                                : null}
                          </div>
                        )}
                      </div>
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
      )}

      {/* Schools Cards - Mobile */}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pdfStatus.schools.map((school: any, index: number) => {
            const isExpanded = expandedRows[school.schoolId];
            const driveModified = pdfFetchInfo[school.schoolId]?.driveLastModified;
            const localModified = pdfFetchInfo[school.schoolId]?.localLastModified;
            const drivePdfCount = pdfFetchInfo[school.schoolId]?.drivePdfCount;
            const driveResult = driveLinkResults?.results?.find((r: any) => r.schoolId === school.schoolId);
            const actualLocalPdfCount = driveResult?.localPdfCount;
            const hasCountMismatch = driveResult?.countMismatch === true;
            const driveTime = driveModified ? new Date(driveModified).getTime() : null;
            const localTime = localModified ? new Date(localModified).getTime() : null;
            const diff = driveTime && localTime ? Math.abs(driveTime - localTime) : null;
            const timestampMatches = diff !== null && diff < 1000;
            const needsUpdate = driveTime && localTime ? driveTime > localTime : false;
            const fullyMatches = timestampMatches && !hasCountMismatch;
            const jobStatus = getJobStatusForSchool(school.schoolId);
            const isJobActive = jobStatus && (jobStatus.status === 'waiting' || jobStatus.status === 'active');
            const fetchMsg = fetchMessages[school.schoolId];
            const processingStatusForSchool = processingStatus[school.schoolId];
            const hasProcessed = typeof processingStatusForSchool === 'object' && processingStatusForSchool !== null 
              ? processingStatusForSchool.hasProcessed 
              : (processingStatusForSchool === true);
            const lastProcessed = typeof processingStatusForSchool === 'object' && processingStatusForSchool !== null 
              ? processingStatusForSchool.lastProcessed 
              : null;
            const hasDriveLink = school.driveLink || school.hasDriveLink;

            return (
              <div
                key={school.schoolId}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-large)',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                {/* School Header */}
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleRowExpand(school.schoolId)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '0.25rem' }}>
                      {school.schoolName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {school.schoolId}
                    </div>
                  </div>
                  <i 
                    className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                    style={{ fontSize: '14px', color: 'var(--text-primary)', marginLeft: '0.5rem' }}
                  ></i>
                </div>

                {/* Data Pairs with Timestamps */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}>
                  {/* Local PDFs with Local Modified */}
                  <div style={{ 
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600' }}>Local PDFs</span>{' '}
                      {school.hasPdfs ? (
                        <span style={{ color: '#4ECDC4', fontWeight: 'bold' }}>{school.pdfCount}</span>
                      ) : (
                        <span style={{ color: '#f44', fontWeight: 'bold' }}>0</span>
                      )}
                    </div>
                    {localModified && (
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                        Modified {new Date(localModified).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Drive PDFs with Drive Modified */}
                  <div style={{ 
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600' }}>Drive PDFs</span>{' '}
                      {pdfFetchInfo[school.schoolId]?.driveHasPdfs !== undefined ? (
                        pdfFetchInfo[school.schoolId].driveHasPdfs ? (
                          <span style={{ color: '#4ECDC4', fontWeight: 'bold' }}>
                            {pdfFetchInfo[school.schoolId].drivePdfCount || '?'}
                          </span>
                        ) : (
                          <span style={{ color: '#f44', fontWeight: 'bold' }}>0</span>
                        )
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    {driveModified && (
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                        Modified {new Date(driveModified).toLocaleString()}
                      </div>
                    )}
                    {pdfFetchInfo[school.schoolId]?.driveAccessible === false && (
                      <div style={{ fontSize: '10px', color: '#f44', marginTop: '0.25rem' }}>
                        Not accessible
                      </div>
                    )}
                  </div>

                  {/* Match Status */}
                  {driveModified && localModified && (
                    <div style={{ 
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: '600' }}>Match Status</span>{' '}
                        {fullyMatches ? (
                          <span style={{ color: '#4ECDC4' }}>
                            <i className="fas fa-check-circle"></i> Matched
                          </span>
                        ) : hasCountMismatch ? (
                          <span style={{ color: '#ffa500' }}>
                            <i className="fas fa-exclamation-triangle"></i> Count Mismatch
                          </span>
                        ) : needsUpdate ? (
                          <span style={{ color: '#ffa500' }}>
                            <i className="fas fa-exclamation-triangle"></i> Drive Newer
                          </span>
                        ) : (
                          <span style={{ color: '#f44' }}>
                            <i className="fas fa-question-circle"></i> Local Newer
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Processed Status with Last Processed */}
                  <div style={{ 
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600' }}>Processed</span>{' '}
                      {hasProcessed ? (
                        <span style={{ color: '#4ECDC4' }}>
                          <i className="fas fa-check-circle"></i> Yes
                        </span>
                      ) : (
                        <span style={{ color: '#f44' }}>No</span>
                      )}
                    </div>
                    {lastProcessed && (
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                        Last {new Date(lastProcessed!).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {hasDriveLink && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFetchPdfs(school.schoolId);
                      }}
                      disabled={fetching[school.schoolId] || isJobActive}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: (fetching[school.schoolId] || isJobActive) ? 'var(--bg-primary)' : '#4ECDC4',
                        color: (fetching[school.schoolId] || isJobActive) ? 'var(--text-secondary)' : 'white',
                        border: 'none',
                        borderRadius: '999px',
                        cursor: (fetching[school.schoolId] || isJobActive) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        width: '100%',
                        textAlign: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {fetching[school.schoolId] ? 'Queuing...' : isJobActive ? 'Running...' : 'Fetch PDFs'}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (school.hasPdfs || (school.pdfCount && school.pdfCount > 0)) {
                        handleProcessPdfs(school.schoolId);
                      }
                    }}
                    disabled={processing[school.schoolId] || !(school.hasPdfs || (school.pdfCount && school.pdfCount > 0))}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: (processing[school.schoolId] || !(school.hasPdfs || (school.pdfCount && school.pdfCount > 0))) ? 'var(--bg-primary)' : '#ffa500',
                      color: (processing[school.schoolId] || !(school.hasPdfs || (school.pdfCount && school.pdfCount > 0))) ? 'var(--text-secondary)' : 'white',
                      border: 'none',
                      borderRadius: '999px',
                      cursor: (processing[school.schoolId] || !(school.hasPdfs || (school.pdfCount && school.pdfCount > 0))) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      width: '100%',
                      textAlign: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {processing[school.schoolId] ? 'Processing...' : hasProcessed ? 'Reprocess' : 'Process PDFs'}
                  </button>
                  {hasDriveLink && (
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
                        padding: '0.5rem',
                        backgroundColor: checkingSchool[school.schoolId] ? 'var(--bg-primary)' : '#9B59B6',
                        color: checkingSchool[school.schoolId] ? 'var(--text-secondary)' : 'white',
                        border: 'none',
                        borderRadius: '999px',
                        cursor: checkingSchool[school.schoolId] ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        width: '100%',
                        textAlign: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {checkingSchool[school.schoolId] ? 'Checking...' : 'Check Drive'}
                    </button>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    {/* Additional Timestamps */}
                    {(pdfFetchInfo[school.schoolId]?.lastFetchTime || syncStatus[school.schoolId]?.lastChecked) && (
                      <div style={{ 
                        padding: '0.75rem',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: '6px',
                        marginBottom: '0.75rem',
                      }}>
                        {pdfFetchInfo[school.schoolId]?.lastFetchTime && (
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            <strong>Last Fetch</strong> {new Date(pdfFetchInfo[school.schoolId].lastFetchTime!).toLocaleString()}
                          </div>
                        )}
                        {syncStatus[school.schoolId]?.lastChecked && (
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            <strong>Last Checked</strong> {new Date(syncStatus[school.schoolId].lastChecked!).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Routes */}
                    {allRoutes[school.schoolId] && Object.keys(allRoutes[school.schoolId]).length > 0 ? (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '0.5rem' }}>Routes</div>
                        {Object.entries(allRoutes[school.schoolId]).map(([routeId, route]: [string, any]) => (
                          <div key={routeId} style={{ fontSize: '11px', marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px' }}>
                            <div style={{ fontWeight: '600' }}>{route.name || routeId}</div>
                            <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                              {route.stops?.length || 0} stops
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : loadingRoutes[school.schoolId] ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Loading route data...
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Schools Without PDFs Section */}
      {pdfStatus.summary.schoolsWithoutPdfs > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: isMobile ? '1.25rem' : '1.5rem' }}>Schools Without Downloaded PDFs</h2>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--shadow-large)', padding: isMobile ? '1rem' : '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: isMobile ? '12px' : '14px' }}>
              These schools have Drive links configured but PDFs could not be downloaded (likely due to access restrictions):
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
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
