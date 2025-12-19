import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

/**
 * Restart Service Class
 * Handles process restarts using script-based approach
 * Uses direct process management via ports
 */
class RestartService {
  /**
   * Restart a process by running the appropriate restart script
   * @param {string} processName - Name of the process ('pps-backend' or 'pps-frontend')
   * @returns {Promise<{success: boolean, message: string, method?: string}>}
   */
  async restartProcess(processName) {
    try {
      console.log(`[RestartService] Restarting ${processName}...`);
      
      // Validate process name
      const validProcesses = ['pps-backend', 'pps-frontend'];
      if (!validProcesses.includes(processName)) {
        return {
          success: false,
          message: `Invalid process name. Must be one of: ${validProcesses.join(', ')}`,
        };
      }

      // Determine which script to run
      const scriptName = processName === 'pps-backend' 
        ? 'restart-backend.js' 
        : 'restart-frontend.js';
      
      const scriptPath = resolve(projectRoot, 'scripts', scriptName);
      
      // Check if script file exists
      const fs = await import('fs/promises');
      try {
        await fs.access(scriptPath);
      } catch (accessError) {
        console.error(`[RestartService] Script file not found: ${scriptPath}`);
        return {
          success: false,
          message: `Restart script not found: ${scriptName}`,
        };
      }
      
      console.log(`[RestartService] Running script: ${scriptPath}`);
      
      // Run the restart script
      return new Promise((resolve) => {
        let child;
        try {
          child = spawn('node', [scriptPath], {
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
          });
        } catch (spawnError) {
          console.error(`[RestartService] Error spawning process:`, spawnError);
          resolve({
            success: false,
            message: `Failed to spawn restart script: ${spawnError.message || String(spawnError)}`,
          });
          return;
        }
        
        let stdout = '';
        let stderr = '';
        let hasError = false;
        let resolved = false;
        
        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.error(`[RestartService] Restart script timeout after 30 seconds`);
            if (child && !child.killed) {
              child.kill('SIGTERM');
            }
            resolve({
              success: false,
              message: `Restart script timed out after 30 seconds`,
            });
          }
        }, 30000);
        
        child.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          // Log all output for debugging
          console.log(`[RestartService] ${output.trim()}`);
        });
        
        child.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          // Check for actual errors vs warnings
          if (output.toLowerCase().includes('error') || 
              output.toLowerCase().includes('failed')) {
            hasError = true;
          }
          console.error(`[RestartService] ${output.trim()}`);
        });
        
        child.on('close', (code) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          
          if (code === 0 && !hasError) {
            // Check stdout for success messages
            const output = (stdout + stderr).toLowerCase();
            if (output.includes('completed successfully') || 
                output.includes('started successfully') ||
                output.includes('restart completed')) {
              console.log(`[RestartService] Successfully restarted ${processName}`);
              resolve({
                success: true,
                message: `Successfully restarted ${processName}`,
              });
            } else {
              // Exit code 0 but no clear success message - check for errors
              if (output.includes('error') || output.includes('failed')) {
                const errorMsg = stderr || stdout || `Script completed but with errors`;
                console.error(`[RestartService] Restart may have failed for ${processName}:`, errorMsg);
                resolve({
                  success: false,
                  message: `Restart may have failed: ${errorMsg}`,
                });
              } else {
                // Assume success if exit code is 0
                console.log(`[RestartService] Successfully restarted ${processName} (exit code 0)`);
                resolve({
                  success: true,
                  message: `Successfully restarted ${processName}`,
                });
              }
            }
          } else {
            const errorMsg = stderr || stdout || `Script exited with code ${code}`;
            console.error(`[RestartService] Failed to restart ${processName}:`, errorMsg);
            resolve({
              success: false,
              message: `Failed to restart ${processName}: ${errorMsg}`,
            });
          }
        });
        
        child.on('error', (err) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          console.error(`[RestartService] Error spawning restart script:`, err);
          resolve({
            success: false,
            message: `Failed to execute restart script: ${err.message || String(err)}`,
          });
        });
      });
    } catch (error) {
      console.error(`[RestartService] Error restarting ${processName}:`, error);
      return {
        success: false,
        message: `Error restarting ${processName}: ${error.message || String(error)}`,
      };
    }
  }

  /**
   * Get status of a process
   * @param {string} processName - Name of the process
   * @returns {Promise<{success: boolean, status?: object, message?: string}>}
   */
  async getProcessStatus(processName) {
    try {
      // Check if process is running by checking the port
      const port = processName === 'pps-backend' ? 3001 : 5173;
      
      return new Promise((resolve) => {
        const lsof = spawn('lsof', ['-ti', `:${port}`], {
          stdio: 'pipe',
          shell: false,
        });
        
        let pid = '';
        lsof.stdout.on('data', (data) => {
          pid += data.toString().trim();
        });
        
        lsof.on('close', (code) => {
          if (code === 0 && pid) {
            resolve({
              success: true,
              status: {
                name: processName,
                status: 'online',
                pid: pid,
              },
            });
          } else {
            resolve({
              success: false,
              message: `Process ${processName} not found (no process on port ${port})`,
            });
          }
        });
        
        lsof.on('error', (err) => {
          resolve({
            success: false,
            message: `Error checking status: ${err.message}`,
          });
        });
      });
    } catch (error) {
      console.error(`[RestartService] Error getting status for ${processName}:`, error);
      return {
        success: false,
        message: `Error getting status: ${error.message || error}`,
      };
    }
  }
}

export const restartService = new RestartService();


