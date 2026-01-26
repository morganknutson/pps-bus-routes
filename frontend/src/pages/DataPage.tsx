import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { SEO } from '../components/SEO';
import { ProgressBar } from '../components/ProgressBar';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Footer } from '../components/Footer';
import { ChevronIcon } from '../components/ChevronIcon';

export function DataPage() {
  console.log('[DataPage] Component rendering...');
  const isMobile = useIsMobile();

  // Enable scrolling on this page (similar to VerificationPage)
  useEffect(() => {
    const root = document.getElementById('root');
    const originalOverflowX = root?.style.overflowX;
    const originalOverflowY = root?.style.overflowY;
    
    if (root) {
      root.style.overflowX = 'hidden';
    }
    
    if (root) {
      root.style.overflowY = 'auto';
    }

    return () => {
      if (root) {
        root.style.overflowX = originalOverflowX || '';
        root.style.overflowY = originalOverflowY || '';
      }
    };
  }, []);
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
      const response = await fetch(`/api/data/routes?schoolId=${encodeURIComponent(schoolId)}&t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        const routes = data.routes || [];
        // Store routes by filename for easy lookup (matching VerificationPage format)
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
        console.log(`[DataPage] Loaded ${routes.length} routes for ${schoolId}, matched ${Object.keys(routesByFilename).length} by filename`);
        setAllRoutes(prev => ({ ...prev, [schoolId]: routesByFilename }));
      } else {
        console.error('[DataPage] Failed to load routes for school:', schoolId);
        setAllRoutes(prev => ({ ...prev, [schoolId]: {} }));
      }
    } catch (err: any) {
      console.error('[DataPage] Error loading routes:', err);
      setAllRoutes(prev => ({ ...prev, [schoolId]: {} }));
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
      <SEO 
        title="Bus Route Data Status" 
        description="Live status of Portland Public Schools bus route data. Track PDF synchronization, geocoding progress, and route processing across the district."
      />
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
        <p style={{ 
          marginTop: '0.5rem', 
          fontSize: '1rem', 
          color: 'var(--text-secondary)',
          lineHeight: '1.5'
        }}>
          This data is gathered regularly from the publicly available PDFs provided by the Portland Public School District
        </p>
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
            border: '1px solid var(--border-color-primary)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Schools</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {pdfStatus.summary.totalSchools || pdfStatus.totalSchools || pdfStatus.schools?.length || 0}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color-primary)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Schools with PDFs</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FFFFFF' }}>
              {pdfStatus.summary.schoolsWithPdfs || 0}
            </div>
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color-primary)',
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
            border: '1px solid var(--border-color-primary)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Schools Processed</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FFFFFF' }}>
              {pdfStatus.summary.schoolsProcessed ?? (() => {
                // Calculate from processingStatus if not in summary
                if (Object.keys(processingStatus).length > 0) {
                  return Object.values(processingStatus).filter(status => {
                    const hasProcessed = typeof status === 'object' && status !== null ? status.hasProcessed : (status === true);
                    return hasProcessed;
                  }).length;
                }
                return 0;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Schools Table - Desktop */}
      {!isMobile && (
        <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--drop-shadow-floating-primary)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '2px solid var(--bg-primary)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)', width: '40px' }}></th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>School</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>PDFs</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Last Checked</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>Drive Link</th>
                </tr>
              </thead>
              <tbody>
                {pdfStatus.schools.map((school: any, index: number) => {
                  const isExpanded = expandedRows[school.schoolId];
                  const fetchInfo = pdfFetchInfo[school.schoolId];
                  const lastSyncCheck = fetchInfo?.lastChecked;
                  const lastDriveCheck = fetchInfo?.driveLastChecked;
                  
                  // Determine the most recent check time
                  let mostRecentCheck = null;
                  if (lastSyncCheck && lastDriveCheck) {
                    mostRecentCheck = new Date(lastSyncCheck).getTime() > new Date(lastDriveCheck).getTime() ? lastSyncCheck : lastDriveCheck;
                  } else {
                    mostRecentCheck = lastSyncCheck || lastDriveCheck;
                  }
                  
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
                          <ChevronIcon direction={isExpanded ? 'down' : 'right'} size={14} color="var(--text-primary)" />
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 'bold' }}>{school.schoolName}</div>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div>
                            {school.hasPdfs ? (
                              <span style={{ fontWeight: 'bold', color: '#FFFFFF', fontSize: '18px' }}>
                                {school.pdfCount}
                              </span>
                            ) : (
                              <span style={{ color: '#f44', fontWeight: 'bold' }}>0</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          {mostRecentCheck ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                              {new Date(mostRecentCheck).toLocaleString()}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          {school.hasPdfs ? (
                            school.driveLink ? (
                              <a
                                href={school.driveLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  color: '#FFFFFF',
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
                            )
                          ) : (
                            <div style={{ 
                              fontSize: '10px', 
                              color: '#f44', 
                              fontWeight: '600',
                              lineHeight: '1.2',
                              maxWidth: '150px',
                              margin: '0 auto'
                            }}>
                              Route information not provided on the web by school district.
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
                            <div>
                              {/* PDF Files List with Route Info */}
                              <div>
                                <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                  PDF Files with Route Information ({school.pdfFiles?.length || 0})
                                </h3>
                                {school.pdfFiles && school.pdfFiles.length > 0 ? (
                                  <div style={{ 
                                    backgroundColor: 'var(--bg-secondary)', 
                                    padding: '1rem', 
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-color-primary)',
                                  }}>
                                    {school.pdfFiles.map((file: string, i: number) => {
                                      const pdfUrl = `/api/pdfs/${school.schoolId}/${encodeURIComponent(file)}`;
                                      
                                      // Find route for this PDF by matching filename
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
                                      
                                      return (
                                        <div
                                          key={i}
                                          style={{ 
                                            marginBottom: '1rem',
                                            padding: '0.75rem',
                                            backgroundColor: 'var(--bg-primary)',
                                            borderRadius: '4px',
                                            border: '1px solid var(--border-color-primary)',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: route ? '0.75rem' : '0' }}>
                                            <a
                                              href={pdfUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              style={{ 
                                                color: '#FFFFFF',
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                flex: 1,
                                                textDecoration: 'none',
                                                cursor: 'pointer',
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
                                            </a>
                                          </div>
                                          
                                          {/* Route Information */}
                                          {route ? (
                                            <div style={{ 
                                              marginTop: '0.75rem',
                                              padding: '0.75rem',
                                              backgroundColor: 'var(--bg-secondary)',
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
                                                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                    {route.stops.slice(0, 20).map((stop: any, stopIdx: number) => (
                                                      <div 
                                                        key={stop.id || stopIdx} 
                                                        style={{ 
                                                          marginBottom: '0.5rem', 
                                                          padding: '0.5rem',
                                                          backgroundColor: 'var(--bg-primary)',
                                                          borderRadius: '4px',
                                                          fontSize: '10px',
                                                        }}
                                                      >
                                                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                                          {stop.address}
                                                        </div>
                                                        {stop.coordinates && (
                                                          <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '9px' }}>
                                                            {stop.coordinates[1].toFixed(6)}, {stop.coordinates[0].toFixed(6)}
                                                          </div>
                                                        )}
                                                      </div>
                                                    ))}
                                                    {route.stops.length > 20 && (
                                                      <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                                        ...and {route.stops.length - 20} more stops
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          ) : loadingRoutes[school.schoolId] ? (
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                              Loading route data...
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                              No route data available
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                                    No PDF files found for this school
                                  </div>
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

      {/* Schools List - Mobile */}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pdfStatus.schools.map((school: any) => {
            const isExpanded = expandedRows[school.schoolId];
            const fetchInfo = pdfFetchInfo[school.schoolId];
            const lastSyncCheck = fetchInfo?.lastChecked;
            const lastDriveCheck = fetchInfo?.driveLastChecked;
            
            // Determine the most recent check time
            let mostRecentCheck = null;
            if (lastSyncCheck && lastDriveCheck) {
              mostRecentCheck = new Date(lastSyncCheck).getTime() > new Date(lastDriveCheck).getTime() ? lastSyncCheck : lastDriveCheck;
            } else {
              mostRecentCheck = lastSyncCheck || lastDriveCheck;
            }
            
            return (
              <div
                key={school.schoolId}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color-primary)',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', cursor: 'pointer' }}
                  onClick={() => handleRowExpand(school.schoolId)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{school.schoolName}</div>
                  </div>
                  <ChevronIcon direction={isExpanded ? 'down' : 'right'} size={14} color="var(--text-primary)" style={{ marginLeft: '0.5rem' }} />
                </div>

                {/* Data Pairs */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}>
                  {/* PDFs */}
                  <div style={{ 
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color-primary)',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600' }}>PDFs</span>{' '}
                      {school.hasPdfs ? (
                        <span style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{school.pdfCount}</span>
                      ) : (
                        <span style={{ color: '#f44', fontWeight: 'bold' }}>0</span>
                      )}
                    </div>
                    {!school.hasPdfs && (
                      <div style={{ fontSize: '10px', color: '#f44', fontWeight: '600', marginTop: '0.25rem', lineHeight: '1.2' }}>
                        Route information not provided on the web by school district.
                      </div>
                    )}
                  </div>

                  {/* Last Checked */}
                  <div style={{ 
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color-primary)',
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600' }}>Last Checked</span>
                    </div>
                    {mostRecentCheck ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                        {new Date(mostRecentCheck).toLocaleString()}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        —
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
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
                          border: '1px solid var(--border-color)',
                        }}>
                          {school.pdfFiles.map((file: string, i: number) => {
                            const pdfUrl = `/api/pdfs/${school.schoolId}/${encodeURIComponent(file)}`;
                            
                            // Find route for this PDF by matching filename
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
                            
                            return (
                              <div
                                key={i}
                                style={{ 
                                  marginBottom: '1rem',
                                  padding: '0.75rem',
                                  backgroundColor: 'var(--bg-secondary)',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-color)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: route ? '0.75rem' : '0' }}>
                                  <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ 
                                      color: '#FFFFFF',
                                      fontSize: '12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      flex: 1,
                                      textDecoration: 'none',
                                      cursor: 'pointer',
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
                                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                          {route.stops.slice(0, 20).map((stop: any, stopIdx: number) => (
                                            <div 
                                              key={stop.id || stopIdx} 
                                              style={{ 
                                                marginBottom: '0.5rem', 
                                                padding: '0.5rem',
                                                backgroundColor: 'var(--bg-secondary)',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                              }}
                                            >
                                              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                                {stop.address}
                                              </div>
                                              {stop.coordinates && (
                                                <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '9px' }}>
                                                  {stop.coordinates[1].toFixed(6)}, {stop.coordinates[0].toFixed(6)}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                          {route.stops.length > 20 && (
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                              ...and {route.stops.length - 20} more stops
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : loadingRoutes[school.schoolId] ? (
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                    Loading route data...
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                    No route data available
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                          No PDF files found for this school
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Schools Without PDFs Section */}
      {pdfStatus.schools.some((s: any) => !s.hasPdfs) && (
        <div style={{ marginTop: '3rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: isMobile ? '1.25rem' : '1.5rem', color: 'var(--text-primary)' }}>Schools Without Route Data</h2>
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', boxShadow: 'var(--drop-shadow-floating-primary)', padding: isMobile ? '1rem' : '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: isMobile ? '12px' : '14px' }}>
              The following schools do not have publicly available route information at this time:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
              {pdfStatus.schools
                .filter((s: any) => !s.hasPdfs)
                .map((school: any) => (
                  <div
                    key={school.schoolId}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{school.schoolName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{school.schoolId}</div>
                    <div style={{ color: '#f44', fontSize: '11px', fontWeight: 'bold', lineHeight: '1.4' }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '0.25rem' }}></i>
                      Route information not provided on the web by school district.
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      </div>
      <Footer />
    </div>
  );
}

