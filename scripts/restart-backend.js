#!/usr/bin/env node
/**
 * Restart Backend Script
 * Finds and restarts the backend server process
 * Uses direct process management
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const backendDir = resolve(projectRoot, 'backend');
const PORT = process.env.PORT || 3001;

// Find process by port - returns array of PIDs
async function findProcessesByPort(port) {
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-ti', `:${port}`], {
      stdio: 'pipe',
      shell: false
    });
    
    let output = '';
    lsof.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    lsof.on('close', (code) => {
      if (code === 0 && output.trim()) {
        // Split by newline and filter empty strings
        const pids = output.trim().split('\n').filter(pid => pid.trim());
        resolve(pids);
      } else {
        resolve([]);
      }
    });
    
    lsof.on('error', () => {
      resolve([]);
    });
  });
}

// Find the actual node server.js process from a list of PIDs
async function findNodeServerProcess(pids) {
  if (pids.length === 0) return null;
  
  // Try to find the one that's actually running server.js
  for (const pid of pids) {
    try {
      const ps = spawn('ps', ['-p', pid, '-o', 'command='], {
        stdio: 'pipe',
        shell: false
      });
      
      let output = '';
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        ps.on('close', () => resolve());
        ps.on('error', () => resolve());
      });
      
      // Check if this process is running server.js
      if (output.includes('server.js') || output.includes('node')) {
        return pid;
      }
    } catch (error) {
      // Continue to next PID
      continue;
    }
  }
  
  // If we can't find the specific one, return the first PID
  return pids[0];
}

// Kill process by PID
async function killProcess(pid) {
  return new Promise((resolve) => {
    console.log(`[RestartBackend] Killing process ${pid}...`);
    const kill = spawn('kill', ['-TERM', pid], {
      stdio: 'inherit',
      shell: false
    });
    
    kill.on('close', (code) => {
      if (code === 0) {
        console.log(`[RestartBackend] Successfully sent TERM signal to process ${pid}`);
        resolve(true);
      } else {
        console.log(`[RestartBackend] Failed to kill process ${pid}, exit code: ${code}`);
        resolve(false);
      }
    });
    
    kill.on('error', (err) => {
      console.error(`[RestartBackend] Error killing process:`, err.message);
      resolve(false);
    });
  });
}

// Wait for port to be released
async function waitForPortRelease(port, maxWait = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const pids = await findProcessesByPort(port);
    if (pids.length === 0) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
}

// Wait for port to be in use (server started)
async function waitForPortInUse(port, maxWait = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const pids = await findProcessesByPort(port);
    if (pids.length > 0) {
      // Give it a moment to fully start
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return false;
}

// Start backend server
async function startBackend() {
  return new Promise((resolve) => {
    console.log('[RestartBackend] Starting backend server...');
    
    // Start backend directly using node --watch
    // Use shell: true to ensure environment variables are available
    const backend = spawn('node', ['--watch', 'server.js'], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: false, // Keep attached so we can monitor it
      env: {
        ...process.env, // Pass through all environment variables
        PORT: PORT.toString(),
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    });
    
    let stdout = '';
    let stderr = '';
    let startupDetected = false;
    let processExited = false;
    
    // Set timeout for startup detection
    const startupTimeout = setTimeout(() => {
      if (!startupDetected && !processExited) {
        // Process is running but we haven't detected startup yet
        // Detach it and check if port is in use
        backend.unref();
        waitForPortInUse(PORT, 5000).then(portInUse => {
          if (portInUse) {
            console.log('[RestartBackend] Backend server started (port in use)');
            resolve({ success: true, method: 'node-start' });
          } else {
            const errorMsg = stderr || stdout || 'Backend process started but port not in use';
            console.error('[RestartBackend] Backend failed to start:', errorMsg);
            resolve({ success: false, method: 'node-start', error: errorMsg });
          }
        });
      }
    }, 3000);
    
    backend.stdout.on('data', (data) => {
      stdout += data.toString();
      const output = data.toString();
      console.log(`[RestartBackend] stdout: ${output.trim()}`);
      
      // Check for success indicators
      if (output.includes('Server running') || 
          output.includes('listening') ||
          output.includes(`localhost:${PORT}`) ||
          output.includes(`port ${PORT}`)) {
        startupDetected = true;
        clearTimeout(startupTimeout);
        // Detach after startup detected
        backend.unref();
        console.log('[RestartBackend] Backend server started successfully');
        resolve({ success: true, method: 'node-start' });
      }
    });
    
    backend.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[RestartBackend] stderr: ${data.toString().trim()}`);
    });
    
    backend.on('close', (code) => {
      processExited = true;
      clearTimeout(startupTimeout);
      if (startupDetected) {
        // Already resolved
        return;
      }
      if (code === 0) {
        resolve({ success: true, method: 'node-start' });
      } else {
        const errorMsg = stderr || stdout || `Process exited with code ${code}`;
        console.error('[RestartBackend] Backend process exited:', errorMsg);
        resolve({ success: false, method: 'node-start', error: errorMsg });
      }
    });
    
    backend.on('error', (err) => {
      clearTimeout(startupTimeout);
      console.error('[RestartBackend] Error starting backend:', err.message);
      resolve({ success: false, method: 'node-start', error: err.message });
    });
  });
}

// Main restart function
async function restartBackend() {
  try {
    console.log('[RestartBackend] Checking for existing backend process...');
    
    // Find existing processes on port 3001
    const existingPids = await findProcessesByPort(PORT);
    
    if (existingPids.length > 0) {
      console.log(`[RestartBackend] Found ${existingPids.length} process(es) on port ${PORT}: ${existingPids.join(', ')}`);
      
      // Kill ALL processes on the port to ensure it's released
      console.log(`[RestartBackend] Killing all processes on port ${PORT}...`);
      for (const pid of existingPids) {
        await killProcess(pid);
      }
      
      // Wait for the port to be released with longer timeout
      console.log('[RestartBackend] Waiting for port to be released...');
      const portReleased = await waitForPortRelease(PORT, 8000);
      
      if (!portReleased) {
        // Try force kill with SIGKILL
        console.warn('[RestartBackend] Port not released, trying force kill...');
        const remainingPids = await findProcessesByPort(PORT);
        for (const pid of remainingPids) {
          console.log(`[RestartBackend] Force killing process ${pid}...`);
          const kill9 = spawn('kill', ['-9', pid], {
            stdio: 'inherit',
            shell: false
          });
          await new Promise((resolve) => {
            kill9.on('close', () => resolve());
            kill9.on('error', () => resolve());
          });
        }
        
        // Wait again after force kill
        await new Promise(resolve => setTimeout(resolve, 1000));
        const stillBlocked = await findProcessesByPort(PORT);
        if (stillBlocked.length > 0) {
          return {
            success: false,
            method: 'kill',
            error: `Port ${PORT} is still in use after killing processes: ${stillBlocked.join(', ')}`
          };
        }
      }
      
      // Give it a moment to fully release
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(`[RestartBackend] No existing process found on port ${PORT}`);
    }
    
    // Start the backend
    const startResult = await startBackend();
    
    // Verify the server actually started by checking the port and health endpoint
    if (startResult.success) {
      console.log('[RestartBackend] Verifying server is responding...');
      const portInUse = await waitForPortInUse(PORT, 10000);
      if (portInUse) {
        // Try to verify the health endpoint responds
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const http = await import('http');
          const healthCheck = new Promise((resolve) => {
            const req = http.get(`http://localhost:${PORT}/api/health`, { timeout: 3000 }, (res) => {
              if (res.statusCode === 200) {
                console.log('[RestartBackend] Server health check passed');
                resolve(true);
              } else {
                resolve(false);
              }
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
              req.destroy();
              resolve(false);
            });
          });
          
          const healthOk = await healthCheck;
          if (!healthOk) {
            console.warn('[RestartBackend] Server started but health check failed - may still be initializing');
          }
        } catch (error) {
          console.warn('[RestartBackend] Could not perform health check:', error.message);
        }
      } else {
        console.error('[RestartBackend] Port not in use after start - server may have failed to start');
        return {
          success: false,
          method: 'verification',
          error: 'Server process started but port is not in use'
        };
      }
    }
    
    return startResult;
    
  } catch (error) {
    return {
      success: false,
      method: 'unknown',
      error: error.message || String(error)
    };
  }
}

// If run directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('restart-backend.js');

if (isMainModule) {
  restartBackend().then((result) => {
    if (result.success) {
      console.log('[RestartBackend] Backend restart completed successfully');
      process.exit(0);
    } else {
      console.error('[RestartBackend] Backend restart failed:', result.error);
      process.exit(1);
    }
  });
}

export { restartBackend };
