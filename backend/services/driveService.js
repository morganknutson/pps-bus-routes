/**
 * @fileoverview Google Drive Service for PPS Bus Maps
 * 
 * This module provides functionality to access public Google Drive folders,
 * list PDF files, and download them for processing. It works with or without
 * a Google API key - public folders can be accessed by parsing the HTML page.
 * 
 * @module services/driveService
 * @requires fetch (global)
 * 
 * @example
 * // List PDFs from a public folder (no API key needed)
 * import { listFolderFiles } from './driveService.js';
 * const files = await listFolderFiles('1BC03MH02DFuUL6teeq4jkcT2THRGgzxj');
 * // Returns: [{ id: 'abc123', name: 'route.pdf', modifiedTime: '2024-01-01T00:00:00Z' }]
 * 
 * @example
 * // Download a PDF file
 * import { downloadFile } from './driveService.js';
 * const { buffer, name } = await downloadFile('abc123');
 * // buffer is a Node.js Buffer containing the PDF data
 * // name is the original filename
 * 
 * @see {@link https://developers.google.com/drive/api/v3/reference|Google Drive API Reference}
 */

/**
 * Base URL for Google Drive API v3
 * @constant {string}
 */
const API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * Retrieves file metadata from Google Drive API.
 * 
 * This function is used internally to get the modifiedTime of files
 * when we have an API key available. Returns null if API key is not
 * provided or if the request fails.
 * 
 * @private
 * @async
 * @param {string} fileId - The Google Drive file ID
 * @param {string|null} apiKey - Google API key (optional)
 * @returns {Promise<Object|null>} File metadata object or null
 * 
 * @example
 * // Returns object like:
 * {
 *   id: '1abc123xyz',
 *   name: '100SYL-A_effective_082625.pdf',
 *   modifiedTime: '2024-08-26T15:30:00.000Z'
 * }
 */
async function getFileMetadataFromAPI(fileId, apiKey) {
  if (!apiKey) {
    return null;
  }

  try {
    const url = `${API_BASE}/files/${fileId}?fields=id,name,modifiedTime&key=${apiKey}`;
    const response = await fetch(url);
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // Silently fail - we'll use fallback
  }
  
  return null;
}

/**
 * Extracts file information from a public Google Drive folder by parsing the HTML page.
 * 
 * This is the primary method used when no API key is available. It works by:
 * 1. Fetching the public folder URL
 * 2. Parsing the HTML for file IDs and names using regex patterns
 * 3. Optionally fetching modifiedTime from API if apiKey is provided
 * 
 * If the primary regex pattern fails (looking for PDF MIME type), it falls back
 * to extracting all 33-character IDs and testing them for PDF magic bytes.
 * 
 * @async
 * @param {string} folderId - The Google Drive folder ID (33 characters)
 * @param {string|null} [apiKey=null] - Optional Google API key for fetching modifiedTime
 * @returns {Promise<Array<Object>>} Array of file objects
 * @throws {Error} If folder cannot be accessed (not public or doesn't exist)
 * 
 * @example
 * // List files from a public folder
 * const files = await listFolderFilesFromPage('1BC03MH02DFuUL6teeq4jkcT2THRGgzxj');
 * // Returns:
 * [
 *   { id: 'abc123', name: '100SYL-A_effective_082625.pdf', modifiedTime: '2024-01-01T00:00:00Z' },
 *   { id: 'def456', name: '101SYL-P_effective_082625.pdf', modifiedTime: '2024-01-01T00:00:00Z' }
 * ]
 * 
 * @example
 * // With API key for accurate modifiedTime
 * const files = await listFolderFilesFromPage('1BC03MH02DFuUL6teeq4jkcT2THRGgzxj', 'your-api-key');
 */
export async function listFolderFilesFromPage(folderId, apiKey = null) {
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  
  const response = await fetch(folderUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to access folder (${response.status}). Make sure it is publicly shared.`);
  }

  const html = await response.text();
  
  // Google Drive stores file data in various places in the HTML
  // Look for patterns like: ["fileId","fileName","application/pdf"
  const pdfPattern = /\["([a-zA-Z0-9_-]{25,44})","([^"]+\.pdf)","application\/pdf"/g;
  const matches = [...html.matchAll(pdfPattern)];
  
  if (matches.length === 0) {
    // Try alternative pattern - extract all 33-char IDs (Google Drive file ID format)
    const fileIdPattern = /"([a-zA-Z0-9_-]{33})"/g;
    const allMatches = [...html.matchAll(fileIdPattern)];
    const uniqueIds = [...new Set(allMatches.map(m => m[1]).filter(id => id !== folderId))];
    
    console.log(`Found ${uniqueIds.length} potential file IDs, testing for PDFs...`);
    
    // Try to find PDFs by downloading first few bytes to check PDF magic bytes
    const files = [];
    for (const fileId of uniqueIds.slice(0, 100)) {
      try {
        const testUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        
        // Download first 1024 bytes to check if it's a PDF
        const testResponse = await fetch(testUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Range': 'bytes=0-1023', // Just get first KB
          },
        });
        
        if (testResponse.ok) {
          const buffer = await testResponse.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          
          // Check PDF magic bytes: %PDF
          const isPDF = bytes.length >= 4 && 
                       bytes[0] === 0x25 && // %
                       bytes[1] === 0x50 && // P
                       bytes[2] === 0x44 && // D
                       bytes[3] === 0x46;   // F
          
          if (isPDF) {
            // Get full file to extract name from headers
            const fullResponse = await fetch(testUrl, {
              method: 'HEAD',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              },
            });
            
            const contentDisposition = fullResponse.headers.get('content-disposition');
            let name = `route_${fileId.substring(0, 8)}.pdf`;
            if (contentDisposition) {
              const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
              if (filenameMatch) {
                name = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
              }
            }
            
            // Try to get modifiedTime from API if available
            let modifiedTime = null;
            if (apiKey) {
              const metadata = await getFileMetadataFromAPI(fileId, apiKey);
              if (metadata && metadata.modifiedTime) {
                modifiedTime = metadata.modifiedTime;
              }
            }
            
            files.push({
              id: fileId,
              name: name,
              modifiedTime,
            });
          }
        }
      } catch (e) {
        // Skip this ID
      }
    }
    
    return files;
  }
  
  // Extract files from matches
  const files = await Promise.all(matches.map(async (match) => {
    const fileId = match[1];
    const name = match[2];
    
    // Try to get modifiedTime from API if available
    let modifiedTime = null;
    if (apiKey) {
      const metadata = await getFileMetadataFromAPI(fileId, apiKey);
      if (metadata && metadata.modifiedTime) {
        modifiedTime = metadata.modifiedTime;
      }
    }
    
    return {
      id: fileId,
      name: name,
      modifiedTime,
    };
  }));
  
  return files;
}

/**
 * Lists PDF files in a Google Drive folder.
 * 
 * This is the main entry point for listing files. It automatically chooses
 * the best method based on whether an API key is available:
 * - With API key: Uses official Drive API (faster, more reliable)
 * - Without API key: Parses public folder page (works for public folders)
 * 
 * Files are returned sorted by modifiedTime in descending order (most recent first).
 * 
 * @async
 * @param {string} folderId - The Google Drive folder ID
 * @param {string|null} [apiKey=null] - Optional Google API key
 * @returns {Promise<Array<Object>>} Array of file objects sorted by modifiedTime (descending)
 * @throws {Error} If folder cannot be accessed
 * 
 * @example
 * // Without API key (public folder)
 * const files = await listFolderFiles('1BC03MH02DFuUL6teeq4jkcT2THRGgzxj');
 * 
 * @example
 * // With API key (any accessible folder)
 * const files = await listFolderFiles('1BC03MH02DFuUL6teeq4jkcT2THRGgzxj', process.env.GOOGLE_API_KEY);
 * 
 * @example
 * // Returned file object structure
 * {
 *   id: '1abc123xyz',                        // Google Drive file ID
 *   name: '100SYL-A_effective_082625.pdf',   // Original filename
 *   modifiedTime: '2024-08-26T15:30:00.000Z' // ISO 8601 timestamp
 * }
 */
export async function listFolderFiles(folderId, apiKey = null) {
  if (!apiKey) {
    // Try without API key using page parsing
    console.log('No API key provided, using page parsing for public folder...');
    const files = await listFolderFilesFromPage(folderId, null);
    // Sort by modifiedTime descending (most recent first)
    return files.sort((a, b) => {
      const timeA = new Date(a.modifiedTime || 0).getTime();
      const timeB = new Date(b.modifiedTime || 0).getTime();
      return timeB - timeA; // Descending order
    });
  }

  // Sort by modifiedTime descending (most recent first)
  const url = `${API_BASE}/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'&fields=files(id,name,modifiedTime,webContentLink)&orderBy=modifiedTime+desc&key=${apiKey}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    // If API fails, try page parsing as fallback
    if (response.status === 403 || response.status === 401) {
      console.log('API key failed, trying page parsing...');
      const files = await listFolderFilesFromPage(folderId, apiKey); // Pass apiKey to try fetching metadata
      // Sort by modifiedTime descending (most recent first)
      return files.sort((a, b) => {
        const timeA = new Date(a.modifiedTime || 0).getTime();
        const timeB = new Date(b.modifiedTime || 0).getTime();
        return timeB - timeA; // Descending order
      });
    }
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to list folder files');
  }

  const data = await response.json();
  // API should return sorted, but ensure it's sorted by modifiedTime descending
  const files = data.files || [];
  return files.sort((a, b) => {
    const timeA = new Date(a.modifiedTime || 0).getTime();
    const timeB = new Date(b.modifiedTime || 0).getTime();
    return timeB - timeA; // Descending order (most recent first)
  });
}

/**
 * Downloads a file from Google Drive.
 * 
 * This function handles the complexity of Google Drive downloads:
 * - For small files: Direct download works
 * - For larger files: Google shows a confirmation page (handled automatically)
 * - Verifies the downloaded content is actually a PDF using magic bytes
 * 
 * The function tries multiple methods in order:
 * 1. API download with webContentLink (if API key provided)
 * 2. API download with alt=media (if API key provided)
 * 3. Direct download URL with confirmation bypass
 * 4. Parse confirmation page for actual download link
 * 
 * @async
 * @param {string} fileId - The Google Drive file ID
 * @param {string|null} [apiKey=null] - Optional Google API key
 * @returns {Promise<Object>} Download result object
 * @returns {Buffer} returns.buffer - The PDF file contents as a Node.js Buffer
 * @returns {string} returns.name - The original filename
 * @throws {Error} If file cannot be downloaded or is not publicly accessible
 * 
 * @example
 * // Download a PDF file
 * const { buffer, name } = await downloadFile('1abc123xyz');
 * console.log(`Downloaded ${name}, size: ${buffer.length} bytes`);
 * 
 * // Save to disk
 * import fs from 'fs';
 * fs.writeFileSync(`./downloads/${name}`, buffer);
 * 
 * @example
 * // With API key
 * const { buffer, name } = await downloadFile('1abc123xyz', process.env.GOOGLE_API_KEY);
 * 
 * @example
 * // Process the PDF
 * import pdfParse from 'pdf-parse';
 * const { buffer } = await downloadFile('1abc123xyz');
 * const pdfData = await pdfParse(buffer);
 * console.log(pdfData.text);
 */
export async function downloadFile(fileId, apiKey = null) {
  // For public files, we can use direct download URL
  // Google Drive requires confirmation for files, so we use confirm=t
  const downloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;

  if (apiKey) {
    // Try API first if we have a key
    try {
      const metadataUrl = `${API_BASE}/files/${fileId}?fields=id,name,webContentLink&key=${apiKey}`;
      const metadataResponse = await fetch(metadataUrl);
      
      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        if (metadata.webContentLink) {
          // Try webContentLink first (often works better than alt=media)
          try {
            const webContentResponse = await fetch(metadata.webContentLink, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              },
              redirect: 'follow',
            });
            
            if (webContentResponse.ok) {
              const contentType = webContentResponse.headers.get('content-type');
              if (contentType?.includes('pdf')) {
                const buffer = Buffer.from(await webContentResponse.arrayBuffer());
                // Verify PDF magic bytes
                if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
                  return {
                    buffer,
                    name: metadata.name || `file_${fileId.substring(0, 8)}.pdf`,
                  };
                }
              }
            }
          } catch (e) {
            // Fall through to API download
          }
          
          // Try API download URL as fallback
          const apiDownloadUrl = `${API_BASE}/files/${fileId}?alt=media&key=${apiKey}`;
          const fileResponse = await fetch(apiDownloadUrl);
          if (fileResponse.ok) {
            const buffer = Buffer.from(await fileResponse.arrayBuffer());
            // Verify PDF magic bytes
            if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
              return {
                buffer,
                name: metadata.name || `file_${fileId.substring(0, 8)}.pdf`,
              };
            }
          }
        }
      }
    } catch (e) {
      // Fall through to direct download
    }
  }

  // Try direct download with confirmation
  try {
    const fileResponse = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      redirect: 'follow',
    });

    if (fileResponse.ok) {
      const contentType = fileResponse.headers.get('content-type');
      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      
      // Check if it's a PDF by magic bytes (more reliable than content-type)
      // Google Drive often returns application/octet-stream instead of application/pdf
      if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        // It's a PDF! Get filename from Content-Disposition or use default
        const contentDisposition = fileResponse.headers.get('content-disposition');
        let name = `file_${fileId.substring(0, 8)}.pdf`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch) {
            name = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
          }
        }
        return { buffer, name };
      }
      
      // If content-type says PDF but magic bytes don't match, still check
      if (contentType?.includes('pdf')) {
        // Verify it's actually a PDF by checking magic bytes
        if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
          // Try to get filename from Content-Disposition
          const contentDisposition = fileResponse.headers.get('content-disposition');
          let name = `file_${fileId.substring(0, 8)}.pdf`;
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch) {
              name = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
            }
          }
          return { buffer, name };
        }
      }
      
      // If we got HTML, it's probably a confirmation page
      if (contentType?.includes('html')) {
        const html = await fileResponse.text();
        
        // Look for the actual download link in the confirmation page
        // Google Drive shows a warning page with a download link
        const downloadLinkPatterns = [
          /href="(\/uc\?export=download[^"]+)"/,
          /href="(\/uc\?id=[^"]+&export=download[^"]+)"/,
          /window\.location\.href\s*=\s*['"]([^'"]*uc[^"]*export=download[^"]*)['"]/,
        ];
        
        for (const pattern of downloadLinkPatterns) {
          const match = html.match(pattern);
          if (match) {
            let actualUrl = match[1].replace(/&amp;/g, '&');
            if (!actualUrl.startsWith('http')) {
              actualUrl = `https://drive.google.com${actualUrl}`;
            }
            
            const finalResponse = await fetch(actualUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              },
            });
            
            if (finalResponse.ok) {
              const buffer = Buffer.from(await finalResponse.arrayBuffer());
              // Verify PDF
              if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
                return {
                  buffer,
                  name: `file_${fileId.substring(0, 8)}.pdf`,
                };
              }
            }
          }
        }
      }
    }
  } catch (e) {
    // Error downloading
  }

  throw new Error('Failed to download file. File may not be publicly accessible.');
}
