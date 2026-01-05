/**
 * API Usage Statistics Route
 * Provides endpoint to get Google API usage statistics and cost estimates
 */

import express from 'express';
import { apiUsageService } from '../services/apiUsageService.js';

const router = express.Router();

/**
 * GET /api/usage
 * Get aggregated API usage statistics from all services
 */
router.get('/', async (req, res) => {
  try {
    const stats = apiUsageService.getUsageStats();
    res.json(stats);
  } catch (error) {
    console.error('[Usage Route] Error getting usage stats:', error);
    res.status(500).json({
      error: 'Failed to get usage statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/usage/pricing
 * Get pricing information for all APIs
 */
router.get('/pricing', (req, res) => {
  try {
    const pricing = apiUsageService.getPricingInfo();
    res.json(pricing);
  } catch (error) {
    console.error('[Usage Route] Error getting pricing info:', error);
    res.status(500).json({
      error: 'Failed to get pricing information',
      message: error.message,
    });
  }
});

/**
 * POST /api/usage/reset
 * Reset all service statistics
 * Note: This should probably be protected in production
 */
router.post('/reset', (req, res) => {
  try {
    apiUsageService.resetStats();
    res.json({
      success: true,
      message: 'All statistics have been reset',
    });
  } catch (error) {
    console.error('[Usage Route] Error resetting stats:', error);
    res.status(500).json({
      error: 'Failed to reset statistics',
      message: error.message,
    });
  }
});

export default router;

