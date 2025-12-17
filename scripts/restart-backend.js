#!/usr/bin/env node
/**
 * Restart Backend Script
 * Finds and restarts the backend server process
 * Works independently of PM2 API
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Check if PM2 is managing the process
async function checkPM2Process() {
  return new Promise((resolve) => {
    const pm2 = spawn('npx', ['pm2', 'list'], { 
      cwd: projectRoot,
      stdio: 'pipe',
      shell: true 
    });
    
    let output = '';
    pm2.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pm2.on('close', (code) => {
      if (code === 0 && output.includes('pps-backend')) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    pm2.on('error', () => {
      resolve(false);
    });
  });
}

// Restart via PM2 (if PM2 is managing it)
async function restartViaPM2() {
  return new Promise((resolve) => {
    console.log('[RestartBackend] Attempting restart via PM2...');
    const pm2 = spawn('npx', ['pm2', 'restart', 'pps-backend'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    pm2.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pm2.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pm2.on('close', (code) => {
      if (code === 0) {
        console.log('[RestartBackend] Successfully restarted via PM2');
        resolve({ success: true, method: 'pm2' });
      } else {
        const errorMsg = stderr || stdout || `PM2 exit code: ${code}`;
        console.log('[RestartBackend] PM2 restart failed, will try signal method');
        resolve({ success: false, method: 'pm2', error: errorMsg });
      }
    });
    
    pm2.on('error', (err) => {
      console.log('[RestartBackend] PM2 spawn error, will try signal method:', err.message);
      resolve({ success: false, method: 'pm2', error: err.message });
    });
  });
}

// Find process by port and kill it (PM2 will auto-restart)
async function restartByKillingProcess() {
  return new Promise((resolve) => {
    console.log('[RestartBackend] Finding process on port 3001...');
    
    // Use lsof to find process on port 3001
    const lsof = spawn('lsof', ['-ti', ':3001'], {
      stdio: 'pipe',
      shell: false
    });
    
    let pid = '';
    lsof.stdout.on('data', (data) => {
      pid += data.toString().trim();
    });
    
    lsof.on('close', (code) => {
      if (code === 0 && pid) {
        console.log(`[RestartBackend] Found process ${pid}, sending SIGTERM...`);
        const kill = spawn('kill', ['-TERM', pid], {
          stdio: 'inherit',
          shell: false
        });
        
        kill.on('close', (killCode) => {
          if (killCode === 0) {
            console.log('[RestartBackend] Sent SIGTERM, PM2 should auto-restart');
            resolve({ success: true, method: 'signal', pid });
          } else {
            resolve({ success: false, method: 'signal', error: `Kill exit code: ${killCode}` });
          }
        });
        
        kill.on('error', (err) => {
          resolve({ success: false, method: 'signal', error: err.message });
        });
      } else {
        resolve({ success: false, method: 'signal', error: 'No process found on port 3001' });
      }
    });
    
    lsof.on('error', (err) => {
      resolve({ success: false, method: 'signal', error: `lsof error: ${err.message}` });
    });
  });
}

// Main restart function
async function restartBackend() {
  try {
    // First check if PM2 is managing the process
    const isPM2Managed = await checkPM2Process();
    
    if (isPM2Managed) {
      // Try PM2 restart first
      const result = await restartViaPM2();
      if (result.success) {
        return result;
      }
      // If PM2 restart fails, fall back to signal method
      console.log('[RestartBackend] PM2 restart failed, trying signal method...');
    }
    
    // Fall back to killing the process (PM2 will auto-restart if it's managed)
    return await restartByKillingProcess();
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
      process.exit(0);
    } else {
      console.error('[RestartBackend] Restart failed:', result.error);
      process.exit(1);
    }
  });
}

export { restartBackend };

