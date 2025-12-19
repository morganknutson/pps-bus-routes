import express from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { verificationService } from '../services/verificationService.js';
import { pdfFetchTrackingService } from '../services/pdfFetchTrackingService.js';
import { driveLinkVerificationService } from '../services/driveLinkVerificationService.js';
import { pdfMetadataService } from '../services/pdfMetadataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const REPORT_FILE = path.join(__dirname, '..', '..', 'data', 'verification-report.json');
const SCHOOLS_FILE = path.join(__dirname, '..', '..', 'data', 'schools.json');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DRIVE_VERIFICATION_CACHE_FILE = path.join(DATA_DIR, 'drive-link-verification-results.json');

/**
 * Get PDF count for a school
 */
function getLocalPdfCount(schoolId) {
  try {
    const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    if (fs.existsSync(pdfDir)) {
      const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
      return files.length;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Get list of PDF files for a school
 */
function getLocalPdfFiles(schoolId) {
  try {
    const pdfDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
    if (fs.existsSync(pdfDir)) {
      const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
      return files.sort();
    }
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Get latest verification report
 */
router.get('/report', (req, res) => {
  try {
    if (!fs.existsSync(REPORT_FILE)) {
      return res.status(404).json({ error: 'Verification report not found. Run verification first.' });
    }

    const content = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(content);
    res.json(report);
  } catch (error) {
    console.error('Error loading verification report:', error);
    // Return 404 instead of 500 so frontend knows it's just missing, not an error
    res.status(404).json({ error: 'Verification report not found. Run verification first.' });
  }
});

/**
 * Verify a specific school
 */
router.post('/verify/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;

    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      return res.status(404).json({ error: 'Schools file not found' });
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const school = schools.find(s => s.id === schoolId);

    if (!school) {
      return res.status(404).json({ error: `School not found: ${schoolId}` });
    }

    // Verify school links
    const result = await verificationService.verifySchoolLinks(school);
    // Add local PDF information
    result.localPdfCount = getLocalPdfCount(schoolId);
    result.localPdfFiles = getLocalPdfFiles(schoolId);
    res.json(result);
  } catch (error) {
    console.error('Error verifying school:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify all schools (triggers full verification)
 */
router.post('/verify-all', async (req, res) => {
  try {
    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      return res.status(404).json({ error: 'Schools file not found' });
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    const report = {
      timestamp: new Date().toISOString(),
      totalSchools: schools.length,
      summary: {
        validSitesLinks: 0,
        invalidSitesLinks: 0,
        missingSitesLinks: 0,
        validDriveLinks: 0,
        invalidDriveLinks: 0,
        missingDriveLinks: 0,
        fullyValid: 0,
        partiallyValid: 0,
        invalid: 0,
      },
      schools: [],
    };

    // Verify each school
    for (const school of schools) {
      try {
        const result = await verificationService.verifySchoolLinks(school);
        // Add local PDF information
        result.localPdfCount = getLocalPdfCount(school.id);
        result.localPdfFiles = getLocalPdfFiles(school.id);
        report.schools.push(result);

        // Update summary
        if (result.sitesLink.valid) {
          report.summary.validSitesLinks++;
        } else if (school.schoolPageLink) {
          report.summary.invalidSitesLinks++;
        } else {
          report.summary.missingSitesLinks++;
        }

        if (result.driveLinkResult.valid) {
          report.summary.validDriveLinks++;
        } else if (school.driveLink) {
          report.summary.invalidDriveLinks++;
        } else {
          report.summary.missingDriveLinks++;
        }

        if (result.overallValid) {
          report.summary.fullyValid++;
        } else if (result.sitesLink.valid || result.driveLinkResult.valid) {
          report.summary.partiallyValid++;
        } else {
          report.summary.invalid++;
        }

        // Add delay
        await verificationService.delay();
      } catch (error) {
        report.schools.push({
          schoolId: school.id,
          schoolName: school.name,
          error: error.message,
          overallValid: false,
        });
        report.summary.invalid++;
      }
    }

    // Save report
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

    res.json(report);
  } catch (error) {
    console.error('Error verifying all schools:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get PDF fetch info for a specific school
 */
router.get('/pdf-fetch-info/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;
    let fetchInfo = pdfFetchTrackingService.getFetchInfo(schoolId);
    
    // If no sync status entry, check metadata
    if (!fetchInfo) {
      const metadata = await pdfMetadataService.loadMetadata(schoolId);
      if (metadata.files && Object.keys(metadata.files).length > 0) {
        const localLastModified = await pdfMetadataService.getMostRecentModifiedTime(schoolId);
        fetchInfo = {
          lastFetch: null,
          lastModifiedPdf: localLastModified,
          lastChecked: metadata.lastSync || null,
        };
      } else {
        return res.status(404).json({ error: 'No fetch info found for this school' });
      }
    }
    
    // Also get last modified from local files (prefer metadata)
    const localLastModified = await pdfMetadataService.getMostRecentModifiedTime(schoolId) 
      || pdfFetchTrackingService.getLastModifiedPdfFromLocal(schoolId);
    
    res.json({
      ...fetchInfo,
      localLastModified,
    });
  } catch (error) {
    console.error('Error getting PDF fetch info:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get PDF fetch info for all schools
 * Includes both local and Drive last modified dates for comparison
 * 
 * IMPORTANT: This endpoint NEVER makes Drive API calls - it only returns cached data.
 * Drive data is populated from cache file created by the "Check Drive Links" operation.
 * This ensures no paid API calls happen on page load.
 * 
 * Cached Drive data is ALWAYS included if available (no query params needed).
 */
router.get('/pdf-fetch-info', async (req, res) => {
  try {
    const allFetchInfo = pdfFetchTrackingService.getAllFetchInfo();
    
    // Load schools to get Drive links and check metadata
    let schools = [];
    if (!fs.existsSync(SCHOOLS_FILE)) {
      return res.status(404).json({ error: 'Schools file not found' });
    }
    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    schools = JSON.parse(content);
    
    // Enhance with local and Drive last modified dates
    const enhanced = {};
    
    // First, add entries from sync status
    for (const [schoolId, fetchInfo] of Object.entries(allFetchInfo)) {
      const localLastModified = pdfFetchTrackingService.getLastModifiedPdfFromLocal(schoolId);
      
      enhanced[schoolId] = {
        ...fetchInfo,
        localLastModified,
        driveLastModified: null,
        driveAccessible: null,
        driveHasPdfs: null,
        drivePdfCount: null,
      };
    }
    
    // Also include schools that have metadata but no sync status entry yet
    for (const school of schools) {
      if (!enhanced[school.id]) {
        const metadata = await pdfMetadataService.loadMetadata(school.id);
        if (metadata.files && Object.keys(metadata.files).length > 0) {
          // School has metadata but no sync status - create entry from metadata
          const localLastModified = await pdfMetadataService.getMostRecentModifiedTime(school.id);
          enhanced[school.id] = {
            lastFetch: null,
            lastModifiedPdf: localLastModified,
            lastChecked: metadata.lastSync || null,
            localLastModified: localLastModified,
            driveLastModified: null,
            driveAccessible: null,
            driveHasPdfs: null,
            drivePdfCount: null,
          };
        }
      }
    }
    
    // ALWAYS include cached Drive data if available (no API calls, cache only)
    if (fs.existsSync(DRIVE_VERIFICATION_CACHE_FILE)) {
      try {
        const cacheContent = fs.readFileSync(DRIVE_VERIFICATION_CACHE_FILE, 'utf8');
        const cachedResults = JSON.parse(cacheContent);
        
        // Log cache age for debugging
        const cacheAge = cachedResults.timestamp 
          ? Date.now() - new Date(cachedResults.timestamp).getTime()
          : Infinity;
        const cacheAgeHours = Math.round(cacheAge / (60 * 60 * 1000) * 10) / 10;
        console.log(`[Verification] Using cached Drive data (${cacheAgeHours}h old, ${cachedResults.results?.length || 0} schools)`);
        
        // Create a map of cached results by schoolId for quick lookup
        const cachedResultsMap = {};
        if (cachedResults.results) {
          for (const result of cachedResults.results) {
            cachedResultsMap[result.schoolId] = result;
          }
        }
        
        // Get the global timestamp when Drive verification was run
        const driveVerificationTimestamp = cachedResults.timestamp || null;
        
        // Apply cached data to enhanced results
        for (const schoolId of Object.keys(enhanced)) {
          const cachedResult = cachedResultsMap[schoolId];
          
          if (cachedResult) {
            // Use cached Drive data (but NOT localLastModified - that should come from sync status/metadata)
            enhanced[schoolId].driveLastModified = cachedResult.driveLastModified;
            enhanced[schoolId].driveAccessible = cachedResult.accessible;
            enhanced[schoolId].driveHasPdfs = cachedResult.hasPdfs;
            enhanced[schoolId].drivePdfCount = cachedResult.pdfCount;
            enhanced[schoolId].driveLastChecked = driveVerificationTimestamp;
            
            // DO NOT overwrite localLastModified from cache - the sync status/metadata has the most
            // up-to-date local information. The cached result's localLastModified is from when the
            // Drive check was run, which may be stale after a PDF fetch.
          }
        }
      } catch (error) {
        console.warn('[Verification] Error loading cached Drive verification results:', error.message);
        // Continue without Drive data - not a fatal error
      }
    } else {
      console.log('[Verification] No Drive verification cache found. Run "Check Drive Links" to populate cache.');
    }
    
    res.json(enhanced);
  } catch (error) {
    console.error('Error getting PDF fetch info:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check Drive links for a specific school
 * Updates the cache with the result
 */
router.post('/check-drive-link/:schoolId', async (req, res) => {
  try {
    const { schoolId } = req.params;

    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      return res.status(404).json({ error: 'Schools file not found' });
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);
    const school = schools.find(s => s.id === schoolId);

    if (!school) {
      return res.status(404).json({ error: `School not found: ${schoolId}` });
    }

    const result = await driveLinkVerificationService.verifySchoolDriveLink(school);
    
    // Update cache with this result
    let cachedResults = {
      timestamp: new Date().toISOString(),
      totalSchools: schools.length,
      results: [],
    };
    
    if (fs.existsSync(DRIVE_VERIFICATION_CACHE_FILE)) {
      try {
        const cacheContent = fs.readFileSync(DRIVE_VERIFICATION_CACHE_FILE, 'utf8');
        cachedResults = JSON.parse(cacheContent);
      } catch (error) {
        console.warn('[Verification] Error loading cache for update:', error.message);
      }
    }
    
    // Update or add this school's result
    const existingIndex = cachedResults.results.findIndex(r => r.schoolId === schoolId);
    if (existingIndex >= 0) {
      cachedResults.results[existingIndex] = result;
    } else {
      cachedResults.results.push(result);
    }
    
    // Save updated cache
    try {
      fs.writeFileSync(DRIVE_VERIFICATION_CACHE_FILE, JSON.stringify(cachedResults, null, 2), 'utf8');
    } catch (error) {
      console.warn('[Verification] Error saving cache:', error.message);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error checking Drive link:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check all Drive links
 * Supports both synchronous (wait=true) and asynchronous (wait=false or omitted) modes
 */
router.post('/check-drive-links', async (req, res) => {
  try {
    const { wait = false } = req.body; // Option to wait for results

    // Load schools
    if (!fs.existsSync(SCHOOLS_FILE)) {
      return res.status(404).json({ error: 'Schools file not found' });
    }

    const content = fs.readFileSync(SCHOOLS_FILE, 'utf8');
    const schools = JSON.parse(content);

    if (wait) {
      // Synchronous mode: wait for results
      const results = await driveLinkVerificationService.verifyAllDriveLinks(schools);
      
      // Save results to file
      const resultsFile = path.join(DATA_DIR, 'drive-link-verification-results.json');
      fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), 'utf8');
      
      res.json(results);
    } else {
      // Asynchronous mode: return immediately and run in background
      res.json({
        message: 'Drive link verification started',
        totalSchools: schools.length,
        note: 'This operation may take several minutes. Check the results endpoint for progress.',
      });

      // Run verification in background (don't await)
      driveLinkVerificationService.verifyAllDriveLinks(schools)
        .then(results => {
          // Save results to file for later retrieval
          const resultsFile = path.join(DATA_DIR, 'drive-link-verification-results.json');
          fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2), 'utf8');
          console.log('[Verification] Drive link verification completed');
        })
        .catch(error => {
          console.error('[Verification] Error in background Drive link verification:', error);
        });
    }
  } catch (error) {
    console.error('Error starting Drive link verification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Drive link verification results
 * Merges the latest localLastModified from sync status to ensure accurate comparison
 */
router.get('/drive-link-results', async (req, res) => {
  try {
    const resultsFile = path.join(DATA_DIR, 'drive-link-verification-results.json');
    
    if (!fs.existsSync(resultsFile)) {
      return res.status(404).json({ error: 'Drive link verification results not found. Run verification first.' });
    }

    const content = fs.readFileSync(resultsFile, 'utf8');
    const results = JSON.parse(content);
    
    // Merge the current localLastModified from sync status/metadata
    // This ensures we show accurate comparison even if PDFs were fetched after the last Drive check
    if (results.results && Array.isArray(results.results)) {
      const allFetchInfo = pdfFetchTrackingService.getAllFetchInfo();
      
      // Load PDF status to get current local PDF counts
      let pdfStatusData = null;
      const pdfStatusFile = path.join(DATA_DIR, 'pdf-status.json');
      if (fs.existsSync(pdfStatusFile)) {
        try {
          pdfStatusData = JSON.parse(fs.readFileSync(pdfStatusFile, 'utf8'));
        } catch (e) {
          console.warn('[Verification] Error loading PDF status for count comparison:', e.message);
        }
      }
      
      let needsUpdateCount = 0;
      let matchingCount = 0;
      let errorsCount = 0;
      let countMismatchCount = 0;
      
      for (const result of results.results) {
        const schoolId = result.schoolId;
        
        // Get current localLastModified from sync status or metadata
        let currentLocalModified = null;
        const syncInfo = allFetchInfo[schoolId];
        if (syncInfo?.lastModifiedPdf) {
          currentLocalModified = syncInfo.lastModifiedPdf;
        } else {
          // Fall back to metadata
          currentLocalModified = await pdfMetadataService.getMostRecentModifiedTime(schoolId);
        }
        
        // Get current local PDF count from filesystem (more accurate than cached pdf-status.json)
        let localPdfCount = null;
        const schoolPdfsDir = path.join(DATA_DIR, 'schools', schoolId, 'pdfs');
        if (fs.existsSync(schoolPdfsDir)) {
          try {
            const files = fs.readdirSync(schoolPdfsDir);
            const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
            localPdfCount = pdfFiles.length;
          } catch (e) {
            console.warn(`[Verification] Error reading PDFs dir for ${schoolId}:`, e.message);
            // Fall back to cached status
            if (pdfStatusData?.schools) {
              const schoolStatus = pdfStatusData.schools.find(s => s.schoolId === schoolId);
              if (schoolStatus) {
                localPdfCount = schoolStatus.pdfCount || 0;
              }
            }
          }
        } else if (pdfStatusData?.schools) {
          // No PDFs directory, check cached status
          const schoolStatus = pdfStatusData.schools.find(s => s.schoolId === schoolId);
          if (schoolStatus) {
            localPdfCount = schoolStatus.pdfCount || 0;
          }
        }
        result.localPdfCount = localPdfCount;
        
        // Check for PDF count mismatch
        const hasCountMismatch = localPdfCount !== null && 
                                  result.pdfCount !== null && 
                                  localPdfCount !== result.pdfCount;
        result.countMismatch = hasCountMismatch;
        
        // Update the result with current local modified time
        if (currentLocalModified) {
          result.localLastModified = currentLocalModified;
          
          // Recalculate matches and needsUpdate if we have both timestamps
          if (result.driveLastModified) {
            const localTime = new Date(currentLocalModified).getTime();
            const driveTime = new Date(result.driveLastModified).getTime();
            
            // Consider them matching if within 1 second AND counts match
            const timestampMatch = Math.abs(localTime - driveTime) < 1000;
            result.matches = timestampMatch && !hasCountMismatch;
            result.needsUpdate = (driveTime > localTime && !timestampMatch) || hasCountMismatch;
          }
        } else if (hasCountMismatch) {
          // Even without timestamp comparison, count mismatch means needs update
          result.needsUpdate = true;
          result.matches = false;
        }
        
        // Count for summary
        if (result.error) {
          errorsCount++;
        } else if (hasCountMismatch) {
          countMismatchCount++;
          needsUpdateCount++;
        } else if (result.needsUpdate) {
          needsUpdateCount++;
        } else if (result.matches) {
          matchingCount++;
        }
      }
      
      // Update summary counts
      if (results.summary) {
        results.summary.needsUpdate = needsUpdateCount;
        results.summary.matching = matchingCount;
        results.summary.errors = errorsCount;
        results.summary.countMismatch = countMismatchCount;
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error loading Drive link verification results:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as verificationRouter };







