import express from 'express';
import { pm2Service } from '../services/pm2Service.js';

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
        error: 'processName is required' 
      });
    }

    console.log('[ServersRoute] Calling pm2Service.restartProcess...');
    const result = await pm2Service.restartProcess(processName);
    console.log('[ServersRoute] PM2 restart result:', result.success ? 'success' : 'failed');
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in /api/servers/restart:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
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
    const result = await pm2Service.getProcessStatus(processName);
    
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

