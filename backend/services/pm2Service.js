import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// PM2 is installed in the root node_modules
const projectRoot = resolve(__dirname, '../..');

/**
 * PM2 Service Class
 * Handles PM2 process management operations
 */
class PM2Service {
  /**
   * Restart a PM2 process by name
   * @param {string} processName - Name of the PM2 process (e.g., 'pps-backend', 'pps-frontend')
   * @returns {Promise<{success: boolean, message: string, output?: string}>}
   */
  async restartProcess(processName) {
    try {
      console.log(`[PM2Service] Restarting process: ${processName}`);
      
      // Validate process name
      const validProcesses = ['pps-backend', 'pps-frontend'];
      if (!validProcesses.includes(processName)) {
        return {
          success: false,
          message: `Invalid process name. Must be one of: ${validProcesses.join(', ')}`,
        };
      }

      // Execute PM2 restart command from project root
      // Use npx to find PM2 in node_modules
      const { stdout, stderr } = await execAsync(`npx pm2 restart ${processName}`, {
        cwd: projectRoot,
      });
      
      if (stderr && !stderr.includes('Restarting')) {
        console.error(`[PM2Service] Error restarting ${processName}:`, stderr);
        return {
          success: false,
          message: `Failed to restart ${processName}: ${stderr}`,
        };
      }

      console.log(`[PM2Service] Successfully restarted ${processName}`);
      return {
        success: true,
        message: `Successfully restarted ${processName}`,
        output: stdout,
      };
    } catch (error) {
      console.error(`[PM2Service] Error restarting ${processName}:`, error);
      return {
        success: false,
        message: `Error restarting ${processName}: ${error.message}`,
      };
    }
  }

  /**
   * Get status of a PM2 process
   * @param {string} processName - Name of the PM2 process
   * @returns {Promise<{success: boolean, status?: object, message?: string}>}
   */
  async getProcessStatus(processName) {
    try {
      const { stdout } = await execAsync(`npx pm2 jlist`, {
        cwd: projectRoot,
      });
      const processes = JSON.parse(stdout);
      const process = processes.find(p => p.name === processName);
      
      if (!process) {
        return {
          success: false,
          message: `Process ${processName} not found`,
        };
      }

      return {
        success: true,
        status: {
          name: process.name,
          status: process.pm2_env?.status || 'unknown',
          uptime: process.pm2_env?.pm_uptime || 0,
          memory: process.monit?.memory || 0,
          cpu: process.monit?.cpu || 0,
        },
      };
    } catch (error) {
      console.error(`[PM2Service] Error getting status for ${processName}:`, error);
      return {
        success: false,
        message: `Error getting status: ${error.message}`,
      };
    }
  }
}

export const pm2Service = new PM2Service();

