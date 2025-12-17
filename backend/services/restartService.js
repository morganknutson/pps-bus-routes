import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

/**
 * Restart Service Class
 * Handles process restarts using script-based approach (not PM2 API)
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
      
      console.log(`[RestartService] Running script: ${scriptPath}`);
      
      // Run the restart script
      return new Promise((resolve) => {
        const child = spawn('node', [scriptPath], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          console.log(`[RestartService] ${data.toString().trim()}`);
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          console.error(`[RestartService] ${data.toString().trim()}`);
        });
        
        child.on('close', (code) => {
          if (code === 0) {
            console.log(`[RestartService] Successfully restarted ${processName}`);
            resolve({
              success: true,
              message: `Successfully restarted ${processName}`,
            });
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
          console.error(`[RestartService] Error spawning restart script:`, err);
          resolve({
            success: false,
            message: `Failed to execute restart script: ${err.message}`,
          });
        });
      });
    } catch (error) {
      console.error(`[RestartService] Error restarting ${processName}:`, error);
      return {
        success: false,
        message: `Error restarting ${processName}: ${error.message || error}`,
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

