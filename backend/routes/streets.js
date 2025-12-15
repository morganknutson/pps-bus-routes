import express from 'express';
import { streetGeometryService } from '../services/streetGeometryService.js';

const router = express.Router();

/**
 * Get full street geometry by street name
 * POST /api/streets/geometry
 * Body: { streetName, city?, state? }
 */
router.post('/geometry', async (req, res) => {
  try {
    const { streetName, city = 'Portland', state = 'OR', stopCoordinates } = req.body;

    if (!streetName) {
      return res.status(400).json({ success: false, error: 'Street name is required' });
    }

    console.log(`[Streets] Requesting geometry for: ${streetName}, ${city}, ${state}${stopCoordinates ? ` near [${stopCoordinates[0]}, ${stopCoordinates[1]}]` : ''}`);

    const result = await streetGeometryService.getStreetGeometry(streetName, city, state, stopCoordinates);

    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get street geometry - no result returned',
      });
    }

    if (result.success) {
      return res.json({
        success: true,
        streetName,
        geometry: result.geometry || [], // [lat, lng][]
        bounds: result.bounds || null,
        isApproximate: result.isApproximate || false,
        responseTime: result.responseTime || 0,
      });
    } else {
      return res.status(404).json({
        success: false,
        error: result.error || 'Street not found',
      });
    }
  } catch (error) {
    console.error('[Streets] Error:', error);
    console.error('[Streets] Error stack:', error.stack);
    
    // Ensure we always return valid JSON
    try {
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    } catch (jsonError) {
      // If even JSON.stringify fails, send plain text
      console.error('[Streets] Failed to send JSON error response:', jsonError);
      return res.status(500).send(`Error: ${error.message || 'Internal server error'}`);
    }
  }
});

export { router as streetsRouter };

