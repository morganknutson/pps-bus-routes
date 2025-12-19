import express from 'express';
import { restartService } from '../services/restartService.js';

const router = express.Router();

/**
 * Restart a server process
 * POST /api/servers/restart
 * Body: { processName: 'pps-backend' | 'pps-frontend' }
 */
router.post('/restart', async (req, res) => {
  try {
    console.log('[ServersRoute] POST /api/servers/restart called');
    const { processName } = req.body;
    console.log('[ServersRoute] processName:', processName);

    if (!processName) {
      console.log('[ServersRoute] Missing processName, returning 400');
      return res.status(400).json({ 
        success: false,
        message: 'processName is required',
        error: 'processName is required' 
      });
    }

    // Validate process name
    const validProcesses = ['pps-backend', 'pps-frontend'];
    if (!validProcesses.includes(processName)) {
      console.log('[ServersRoute] Invalid processName, returning 400');
      return res.status(400).json({ 
        success: false,
        message: `Invalid processName. Must be one of: ${validProcesses.join(', ')}`,
        error: `Invalid processName: ${processName}` 
      });
    }

    // For backend restarts, send response immediately to avoid connection loss
    // The restart will happen asynchronously after response is sent
    if (processName === 'pps-backend') {
      console.log('[ServersRoute] Backend restart requested, initiating async restart...');
      
      // Send immediate response
      res.json({ 
        success: true, 
        message: 'Backend restart initiated',
        note: 'Connection may be lost during restart. Status will be available shortly.'
      });
      
      // Use setImmediate to defer restart slightly, ensuring response is fully sent
      setImmediate(() => {
        // Wrap in try-catch to catch any synchronous errors
        try {
          // Start the restart process (don't wait for it)
          restartService.restartProcess(processName)
            .then(result => {
              if (result.success) {
                console.log('[ServersRoute] Backend restart completed successfully:', result.message);
              } else {
                console.error('[ServersRoute] Backend restart failed:', result.message || result.error);
              }
            })
            .catch(error => {
              console.error('[ServersRoute] Backend restart error:', error);
              // Log error but don't throw - restart was already initiated
            });
        } catch (error) {
          // Catch any synchronous errors
          console.error('[ServersRoute] Synchronous error during backend restart:', error);
        }
      });
      
      return;
    }

    // For frontend, wait for the restart to complete
    console.log('[ServersRoute] Calling restartService.restartProcess for frontend...');
    try {
      const result = await restartService.restartProcess(processName);
      console.log('[ServersRoute] Restart result:', result.success ? 'success' : 'failed', result.message);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (restartError) {
      console.error('[ServersRoute] Error during frontend restart:', restartError);
      res.status(500).json({ 
        success: false,
        message: restartError.message || 'Failed to restart frontend',
        error: restartError.message || String(restartError)
      });
    }
  } catch (error) {
    console.error('[ServersRoute] Error in /api/servers/restart:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Unknown error occurred',
      error: error.message || String(error)
    });
  }
});

/**
 * Get status of a server process
 * GET /api/servers/status/:processName
 */
router.get('/status/:processName', async (req, res) => {
  try {
    const { processName } = req.params;
    const result = await restartService.getProcessStatus(processName);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error in /api/servers/status:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export { router as serversRouter };

