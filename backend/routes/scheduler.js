import express from 'express';
import { getStatus, toggleScheduler, runCheck } from '../services/schedulerService.js';

const router = express.Router();

// Get scheduler status
router.get('/status', (req, res) => {
  try {
    const status = getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle scheduler on/off
router.post('/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    
    const status = toggleScheduler(enabled);
    res.json(status);
  } catch (error) {
    console.error('Error toggling scheduler:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger a check
router.post('/run-now', async (req, res) => {
  try {
    const result = await runCheck();
    res.json(result);
  } catch (error) {
    console.error('Error running scheduler check:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as schedulerRouter };















