import express from 'express';
import { getStatus, toggleScheduler, runCheck } from '../services/schedulerService.js';
import { getSyncState } from '../services/weeklySyncService.js';
import { testEmailConfig } from '../services/emailService.js';

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

// Get weekly sync state (last run results, etc.)
router.get('/sync-state', async (req, res) => {
  try {
    const state = await getSyncState();
    res.json(state);
  } catch (error) {
    console.error('Error getting sync state:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle scheduler on/off (pause/resume)
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

// Manually trigger the weekly sync
router.post('/run-now', (req, res) => {
  try {
    const result = runCheck();
    res.status(202).json(result);
  } catch (error) {
    console.error('Error running scheduler check:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test email configuration
router.get('/test-email', async (req, res) => {
  try {
    const result = await testEmailConfig();
    res.json(result);
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as schedulerRouter };










