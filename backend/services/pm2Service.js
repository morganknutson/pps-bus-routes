import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import pm2 from 'pm2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// PM2 is installed in the root node_modules
const projectRoot = resolve(__dirname, '../..');

// Connect to PM2 daemon
const connectPM2 = () => {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        console.error('[PM2Service] Error connecting to PM2:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * PM2 Service Class
 * Handles PM2 process management operations
 */
class PM2Service {
  /**
   * Check if a PM2 process exists
   * @param {string} processName - Name of the PM2 process
   * @returns {Promise<boolean>}
   */
  async processExists(processName) {
    try {
      await connectPM2();
      return new Promise((resolve, reject) => {
        pm2.list((err, processes) => {
          if (err) {
            console.error(`[PM2Service] Error checking if process exists:`, err);
            pm2.disconnect();
            reject(err);
            return;
          }
          const exists = processes.some(p => p.name === processName);
          console.log(`[PM2Service] Process ${processName} exists: ${exists}`);
          if (!exists && processes.length > 0) {
            const processNames = processes.map(p => p.name).join(', ');
            console.log(`[PM2Service] Available processes: ${processNames}`);
          }
          pm2.disconnect();
          resolve(exists);
        });
      });
    } catch (error) {
      console.error(`[PM2Service] Error checking if process exists:`, error);
      return false;
    }
  }

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

      await connectPM2();

      // Check if process exists first
      const exists = await new Promise((resolve, reject) => {
        pm2.list((err, processes) => {
          if (err) {
            reject(err);
            return;
          }
          const exists = processes.some(p => p.name === processName);
          resolve(exists);
        });
      });

      if (!exists) {
        console.log(`[PM2Service] Process ${processName} not found, attempting to start it...`);
        pm2.disconnect();
        
        // Try to start the process using the ecosystem config
        return new Promise((resolve) => {
          pm2.connect((connectErr) => {
            if (connectErr) {
              pm2.disconnect();
              resolve({
                success: false,
                message: `Process ${processName} not found and could not connect to PM2 to start it.`,
              });
              return;
            }

            pm2.start(
              {
                script: processName === 'pps-backend' ? 'server.js' : 'npm',
                args: processName === 'pps-frontend' ? ['run', 'dev'] : undefined,
                cwd: processName === 'pps-backend' ? resolve(projectRoot, 'backend') : resolve(projectRoot, 'frontend'),
                name: processName,
                instances: 1,
                exec_mode: 'fork',
              },
              (startErr) => {
                pm2.disconnect();
                if (startErr) {
                  resolve({
                    success: false,
                    message: `Process ${processName} not found and could not be started: ${startErr.message || startErr}`,
                  });
                } else {
                  resolve({
                    success: true,
                    message: `Process ${processName} was not running, so it has been started`,
                  });
                }
              }
            );
          });
        });
      }

      // Process exists, restart it using PM2 API
      // Get the process details first to use ID as fallback
      return new Promise((resolve) => {
        pm2.list((listErr, processes) => {
          if (listErr) {
            console.error(`[PM2Service] Error listing processes:`, listErr);
            pm2.disconnect();
            resolve({
              success: false,
              message: `Failed to list processes: ${listErr.message || listErr}`,
            });
            return;
          }
          
          const targetProcess = processes.find(p => p.name === processName);
          if (!targetProcess) {
            console.error(`[PM2Service] Process ${processName} disappeared from list`);
            pm2.disconnect();
            resolve({
              success: false,
              message: `Process ${processName} not found`,
            });
            return;
          }
          
          console.log(`[PM2Service] Restarting ${processName} (ID: ${targetProcess.pm_id}, PID: ${targetProcess.pid})`);
          
          // Use reload for zero-downtime restart, or restart for full restart
          // For backend, we'll use restart to ensure clean state
          const restartMethod = processName === 'pps-backend' ? pm2.restart : pm2.reload;
          const methodName = processName === 'pps-backend' ? 'restart' : 'reload';
          
          console.log(`[PM2Service] Using ${methodName} method for ${processName}`);
          
          // Try restarting by name first
          restartMethod(processName, (err) => {
            if (err) {
              console.error(`[PM2Service] Error restarting by name:`, err);
              console.error(`[PM2Service] Error type:`, typeof err);
              console.error(`[PM2Service] Error string:`, String(err));
              
              // Try by process ID as fallback
              console.log(`[PM2Service] Trying ${methodName} by process ID ${targetProcess.pm_id}...`);
              restartMethod(targetProcess.pm_id, (err2) => {
                pm2.disconnect();
                if (err2) {
                  console.error(`[PM2Service] Error restarting by ID:`, err2);
                  const errorMsg = typeof err2 === 'string' ? err2 : (err2?.message || String(err2));
                  resolve({
                    success: false,
                    message: `Failed to restart ${processName}: ${errorMsg}`,
                  });
                } else {
                  console.log(`[PM2Service] Successfully restarted ${processName} by ID`);
                  resolve({
                    success: true,
                    message: `Successfully restarted ${processName}`,
                  });
                }
              });
            } else {
              console.log(`[PM2Service] Successfully restarted ${processName} by name`);
              pm2.disconnect();
              resolve({
                success: true,
                message: `Successfully restarted ${processName}`,
              });
            }
          });
        });
      });
    } catch (error) {
      console.error(`[PM2Service] Error restarting ${processName}:`, error);
      try {
        pm2.disconnect();
      } catch (disconnectErr) {
        // Ignore disconnect errors
      }
      
      return {
        success: false,
        message: `Error restarting ${processName}: ${error.message || error}`,
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
      await connectPM2();
      return new Promise((resolve) => {
        pm2.list((err, processes) => {
          pm2.disconnect();
          if (err) {
            console.error(`[PM2Service] Error getting status for ${processName}:`, err);
            resolve({
              success: false,
              message: `Error getting status: ${err.message || err}`,
            });
            return;
          }

          const process = processes.find(p => p.name === processName);
          
          if (!process) {
            resolve({
              success: false,
              message: `Process ${processName} not found`,
            });
            return;
          }

          resolve({
            success: true,
            status: {
              name: process.name,
              status: process.pm2_env?.status || 'unknown',
              uptime: process.pm2_env?.pm_uptime || 0,
              memory: process.monit?.memory || 0,
              cpu: process.monit?.cpu || 0,
            },
          });
        });
      });
    } catch (error) {
      console.error(`[PM2Service] Error getting status for ${processName}:`, error);
      try {
        pm2.disconnect();
      } catch (disconnectErr) {
        // Ignore disconnect errors
      }
      return {
        success: false,
        message: `Error getting status: ${error.message || error}`,
      };
    }
  }
}

export const pm2Service = new PM2Service();

