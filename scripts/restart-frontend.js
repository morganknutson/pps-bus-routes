#!/usr/bin/env node
/**
 * Restart Frontend Script
 * Finds and restarts the frontend server process
 * Uses direct process management
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const frontendDir = resolve(projectRoot, 'frontend');
const PORT = 5173; // Vite default port

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

// Find the actual vite process from a list of PIDs
async function findViteProcess(pids) {
  if (pids.length === 0) return null;
  
  // Try to find the one that's actually running vite
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
      
      // Check if this process is running vite
      if (output.includes('vite') || output.includes('node_modules/.bin/vite')) {
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
    console.log(`[RestartFrontend] Killing process ${pid}...`);
    const kill = spawn('kill', ['-TERM', pid], {
      stdio: 'inherit',
      shell: false
    });
    
    kill.on('close', (code) => {
      if (code === 0) {
        console.log(`[RestartFrontend] Successfully sent TERM signal to process ${pid}`);
        resolve(true);
      } else {
        console.log(`[RestartFrontend] Failed to kill process ${pid}, exit code: ${code}`);
        resolve(false);
      }
    });
    
    kill.on('error', (err) => {
      console.error(`[RestartFrontend] Error killing process:`, err.message);
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

// Start frontend server
async function startFrontend() {
  return new Promise((resolve) => {
    console.log('[RestartFrontend] Starting frontend server...');
    
    // Start frontend using npm run dev (which runs vite)
    const frontend = spawn('npm', ['run', 'dev'], {
      cwd: frontendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: false, // Keep attached so we can monitor it
      env: {
        ...process.env, // Pass through all environment variables
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
        frontend.unref();
        waitForPortInUse(PORT, 5000).then(portInUse => {
          if (portInUse) {
            console.log('[RestartFrontend] Frontend server started (port in use)');
            resolve({ success: true, method: 'npm-start' });
          } else {
            const errorMsg = stderr || stdout || 'Frontend process started but port not in use';
            console.error('[RestartFrontend] Frontend failed to start:', errorMsg);
            resolve({ success: false, method: 'npm-start', error: errorMsg });
          }
        });
      }
    }, 3000);
    
    frontend.stdout.on('data', (data) => {
      stdout += data.toString();
      const output = data.toString();
      console.log(`[RestartFrontend] stdout: ${output.trim()}`);
      
      // Check for success indicators
      if (output.includes('Local:') || 
          output.includes('localhost') ||
          output.includes(`:${PORT}`) ||
          output.includes('VITE')) {
        startupDetected = true;
        clearTimeout(startupTimeout);
        // Detach after startup detected
        frontend.unref();
        console.log('[RestartFrontend] Frontend server started successfully');
        resolve({ success: true, method: 'npm-start' });
      }
    });
    
    frontend.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[RestartFrontend] stderr: ${data.toString().trim()}`);
    });
    
    frontend.on('close', (code) => {
      processExited = true;
      clearTimeout(startupTimeout);
      if (startupDetected) {
        // Already resolved
        return;
      }
      if (code === 0) {
        resolve({ success: true, method: 'npm-start' });
      } else {
        const errorMsg = stderr || stdout || `Process exited with code ${code}`;
        console.error('[RestartFrontend] Frontend process exited:', errorMsg);
        resolve({ success: false, method: 'npm-start', error: errorMsg });
      }
    });
    
    frontend.on('error', (err) => {
      clearTimeout(startupTimeout);
      console.error('[RestartFrontend] Error starting frontend:', err.message);
      resolve({ success: false, method: 'npm-start', error: err.message });
    });
  });
}

// Main restart function
async function restartFrontend() {
  try {
    console.log('[RestartFrontend] Checking for existing frontend process...');
    
    // Find existing processes on port 5173
    const existingPids = await findProcessesByPort(PORT);
    
    if (existingPids.length > 0) {
      console.log(`[RestartFrontend] Found ${existingPids.length} process(es) on port ${PORT}: ${existingPids.join(', ')}`);
      
      // Kill ALL processes on the port to ensure it's released
      console.log(`[RestartFrontend] Killing all processes on port ${PORT}...`);
      for (const pid of existingPids) {
        await killProcess(pid);
      }
      
      // Wait for the port to be released with longer timeout
      console.log('[RestartFrontend] Waiting for port to be released...');
      const portReleased = await waitForPortRelease(PORT, 8000);
      
      if (!portReleased) {
        // Try force kill with SIGKILL
        console.warn('[RestartFrontend] Port not released, trying force kill...');
        const remainingPids = await findProcessesByPort(PORT);
        for (const pid of remainingPids) {
          console.log(`[RestartFrontend] Force killing process ${pid}...`);
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
      console.log(`[RestartFrontend] No existing process found on port ${PORT}`);
    }
    
    // Start the frontend
    const startResult = await startFrontend();
    
    // Verify the server actually started by checking the port
    if (startResult.success) {
      const portInUse = await waitForPortInUse(PORT, 5000);
      if (!portInUse) {
        console.warn('[RestartFrontend] Port not in use after start, but process may still be starting...');
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
                     process.argv[1]?.endsWith('restart-frontend.js');

if (isMainModule) {
  restartFrontend().then((result) => {
    if (result.success) {
      console.log('[RestartFrontend] Frontend restart completed successfully');
      process.exit(0);
    } else {
      console.error('[RestartFrontend] Frontend restart failed:', result.error);
      process.exit(1);
    }
  });
}

export { restartFrontend };
