import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { ProgressBar } from '../components/ProgressBar';
import { useIsMobile } from '../hooks/useMediaQuery';

export function DataPage() {
  console.log('[DataPage] Component rendering...');
  const isMobile = useIsMobile();
  const [pdfStatus, setPdfStatus] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, { lastModifiedPdf?: string; lastChecked?: string }>>({});
  const [processingStatus, setProcessingStatus] = useState<Record<string, boolean | { hasProcessed: boolean; lastProcessed: string | null }>>({});
  const [pdfFetchInfo, setPdfFetchInfo] = useState<Record<string, any>>({});
  const [driveLinkResults, setDriveLinkResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [allRoutes, setAllRoutes] = useState<Record<string, Record<string, any>>>({});
  const [loadingRoutes, setLoadingRoutes] = useState<Record<string, boolean>>({});

  const loadPdfStatus = async () => {
    try {
      console.log('[DataPage] Loading PDF status...');
      const response = await fetch(`/api/pdf-status/status?refresh=1&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DataPage] Failed to load PDF status:', response.status, errorText);
        const errorMsg = `Failed to load PDF status: ${response.status} ${response.statusText}`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[DataPage] Unexpected content type:', contentType);
        const errorMsg = `Unexpected response format: ${contentType}`;
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      console.log('[DataPage] PDF status loaded:', {
        totalSchools: data.totalSchools,
        summary: data.summary,
        schoolsCount: data.schools?.length
      });
      
      if (!data || !data.summary || !Array.isArray(data.schools)) {
        console.error('[DataPage] Invalid response structure:', data);
        const errorMsg = 'Invalid response structure from API';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      setPdfStatus(data);
      setError(null);
    } catch (err: any) {
      console.error('[DataPage] Error loading PDF status:', err);
      const errorMsg = `Failed to load PDF status: ${err.message || 'Network error'}`;
      setError(errorMsg);
      throw err;
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
      console.error('[DataPage] Failed to load sync status:', err);
    }
  };

  const loadPdfFetchInfo = async () => {
    try {
      console.log('[DataPage] Loading PDF fetch info...');
      const response = await fetch('/api/verification/pdf-fetch-info');
      if (response.ok) {
        const data = await response.json();
        console.log('[DataPage] PDF fetch info loaded');
        setPdfFetchInfo(data || {});
      }
    } catch (err: any) {
      console.error('[DataPage] Failed to load PDF fetch info:', err);
    }
  };

  const loadDriveLinkResults = async () => {
    try {
      const response = await fetch('/api/verification/drive-link-results');
      if (response.ok) {
        const data = await response.json();
        setDriveLinkResults(data);
      }
    } catch (err: any) {
      console.error('[DataPage] Failed to load drive link results:', err);
    }
  };

  const loadProcessingStatus = async () => {
    try {
      const response = await fetch('/api/verification/processing-status');
      if (response.ok) {
        const data = await response.json();
        setProcessingStatus(data || {});
      }
    } catch (err: any) {
      console.error('[DataPage] Failed to load processing status:', err);
    }
  };

  const loadAllRoutes = async (schoolId: string) => {
    if (allRoutes[schoolId]) return; // Already loaded
    
    setLoadingRoutes(prev => ({ ...prev, [schoolId]: true }));
    try {
      const response = await fetch(`/api/routes?schoolId=${schoolId}`);
      if (response.ok) {
        const data = await response.json();
        setAllRoutes(prev => ({ ...prev, [schoolId]: data.routes || {} }));
      }
    } catch (err: any) {
      console.error(`[DataPage] Failed to load routes for ${schoolId}:`, err);
    } finally {
      setLoadingRoutes(prev => ({ ...prev, [schoolId]: false }));
    }
  };

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadPdfStatus(),
          loadSyncStatus(),
          loadPdfFetchInfo(),
          loadDriveLinkResults(),
          loadProcessingStatus(),
        ]);
      } catch (err) {
        console.error('[DataPage] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadAll();
  }, []);

  // Load routes when row is expanded
  useEffect(() => {
    Object.keys(expandedRows).forEach(schoolId => {
      if (expandedRows[schoolId] && !allRoutes[schoolId]) {
        loadAllRoutes(schoolId);
      }
    });
  }, [expandedRows]);

  const handleRowExpand = (schoolId: string) => {
    setExpandedRows(prev => ({ ...prev, [schoolId]: !prev[schoolId] }));
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
              label="Loading data..." 
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
            <p style={{ fontSize: isMobile ? '14px' : '16px' }}>{error || 'Failed to load data'}</p>
          </div>
        </div>
      </div>
    );
  }

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
      
      {/* Header */}
      <div style={{ 
        marginBottom: '1.5rem',
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: isMobile ? '1.5rem' : '2rem', 
          fontWeight: 'bold', 
          color: 'var(--text-primary)',
        }}>
          Data
        </h1>
      </div>

      {/* Summary Stats */}
      {pdfStatus.summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Schools</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {pdfStatus.summary.totalSchools || 0}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Schools with PDFs</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4ECDC4' }}>
              {pdfStatus.summary.schoolsWithPdfs || 0}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total PDFs</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {pdfStatus.summary.totalPdfs || 0}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Schools Processed</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4ECDC4' }}>
              {pdfStatus.summary.schoolsProcessed || 0}
            </div>
          </div>
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
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Drive Link</th>
                </tr>
              </thead>
              <tbody>
                {pdfStatus.schools.map((school: any, index: number) => {
                  const isExpanded = expandedRows[school.schoolId];
                  const driveModified = pdfFetchInfo[school.schoolId]?.driveLastModified;
                  const localModified = pdfFetchInfo[school.schoolId]?.localLastModified;
                  const drivePdfCount = pdfFetchInfo[school.schoolId]?.drivePdfCount;
                  const driveResult = driveLinkResults?.results?.find((r: any) => r.schoolId === school.schoolId);
                  const actualLocalPdfCount = driveResult?.localPdfCount;
                  const hasCountMismatch = driveResult?.countMismatch === true;
                  const driveTime = driveModified ? new Date(driveModified).getTime() : 0;
                  const localTime = localModified ? new Date(localModified).getTime() : 0;
                  const diff = Math.abs(driveTime - localTime);
                  const timestampMatches = diff < 1000;
                  const needsUpdate = driveTime > localTime;
                  const fullyMatches = timestampMatches && !hasCountMismatch;
                  
                  const status = processingStatus[school.schoolId];
                  const hasProcessed = typeof status === 'object' && status !== null ? status.hasProcessed : (status === true);
                  const lastProcessed = typeof status === 'object' && status !== null ? status.lastProcessed : null;
                  
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
                          {localModified && (
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                              {new Date(localModified).toLocaleString()}
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
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                            )}
                          </div>
                          {driveModified && (
                            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                              {new Date(driveModified).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          {driveModified && localModified ? (
                            fullyMatches ? (
                              <i className="fas fa-check-circle" style={{ color: '#4ECDC4', fontSize: '18px' }} title="Dates match"></i>
                            ) : hasCountMismatch ? (
                              <i className="fas fa-exclamation-triangle" style={{ color: '#ffa500', fontSize: '18px' }} title={`PDF count mismatch`}></i>
                            ) : needsUpdate ? (
                              <i className="fas fa-exclamation-triangle" style={{ color: '#ffa500', fontSize: '18px' }} title="Drive has newer files"></i>
                            ) : (
                              <i className="fas fa-question-circle" style={{ color: '#f44', fontSize: '18px' }} title="Local is newer than Drive"></i>
                            )
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          {hasProcessed ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                              <i className="fas fa-check-circle" style={{ color: '#4ECDC4', fontSize: '18px' }}></i>
                              {lastProcessed && (
                                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                  {new Date(lastProcessed).toLocaleString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#f44' }}>No</span>
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
                            >
                              <i className="fas fa-external-link-alt" style={{ fontSize: '14px' }}></i>
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
                            <div style={{ paddingLeft: '2rem' }}>
                              {/* Routes */}
                              {allRoutes[school.schoolId] && Object.keys(allRoutes[school.schoolId]).length > 0 ? (
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '0.5rem' }}>Routes</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                                    {Object.entries(allRoutes[school.schoolId]).map(([routeId, route]: [string, any]) => (
                                      <div key={routeId} style={{ fontSize: '11px', padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                                        <div style={{ fontWeight: '600' }}>{route.name || routeId}</div>
                                        <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                          {route.stops?.length || 0} stops
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : loadingRoutes[school.schoolId] ? (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  Loading route data...
                                </div>
                              ) : null}
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

      {/* Schools List - Mobile */}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pdfStatus.schools.map((school: any) => {
            const isExpanded = expandedRows[school.schoolId];
            const driveModified = pdfFetchInfo[school.schoolId]?.driveLastModified;
            const localModified = pdfFetchInfo[school.schoolId]?.localLastModified;
            const driveResult = driveLinkResults?.results?.find((r: any) => r.schoolId === school.schoolId);
            const hasCountMismatch = driveResult?.countMismatch === true;
            const driveTime = driveModified ? new Date(driveModified).getTime() : 0;
            const localTime = localModified ? new Date(localModified).getTime() : 0;
            const diff = Math.abs(driveTime - localTime);
            const timestampMatches = diff < 1000;
            const needsUpdate = driveTime > localTime;
            const fullyMatches = timestampMatches && !hasCountMismatch;
            
            const status = processingStatus[school.schoolId];
            const hasProcessed = typeof status === 'object' && status !== null ? status.hasProcessed : (status === true);
            const lastProcessed = typeof status === 'object' && status !== null ? status.lastProcessed : null;
            
            return (
              <div
                key={school.schoolId}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', cursor: 'pointer' }}
                  onClick={() => handleRowExpand(school.schoolId)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{school.schoolName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{school.schoolId}</div>
                  </div>
                  <i 
                    className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                    style={{ fontSize: '14px', color: 'var(--text-primary)', marginLeft: '0.5rem' }}
                  ></i>
                </div>

                {/* Data Pairs */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}>
                  {/* Local PDFs */}
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

                  {/* Drive PDFs */}
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

                  {/* Processed Status */}
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
                        Last {new Date(lastProcessed).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    {/* Routes */}
                    {allRoutes[school.schoolId] && Object.keys(allRoutes[school.schoolId]).length > 0 ? (
                      <div>
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
          <h2 style={{ marginBottom: '1rem', fontSize: isMobile ? '1.25rem' : '1.5rem', color: 'var(--text-primary)' }}>Schools Without Downloaded PDFs</h2>
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

