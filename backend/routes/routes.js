/**
 * Routes API endpoints for route calculation
 */
import express from 'express';
import { directionsService } from '../services/directionsService.js';
import { routesService } from '../services/routesService.js';
import { posthog, getDistinctId } from '../services/posthog.js';

const router = express.Router();

/**
 * Get routing service diagnostics and statistics
 * GET /api/routes/diagnostics
 */
router.get('/diagnostics', (req, res) => {
  try {
    const stats = directionsService.getStats();
    const hasApiKey = !!directionsService.apiKey;
    const maskedKey = hasApiKey 
      ? directionsService.apiKey.substring(0, 10) + '...' 
      : 'Not configured';

    res.json({
      status: 'ok',
      service: 'DirectionsService',
      configuration: {
        hasApiKey,
        usingGoogle: directionsService.useGoogle,
        apiKeyPreview: maskedKey,
        provider: directionsService.useGoogle ? 'Google Directions API' : 'Not configured (street-following routing disabled)',
      },
      statistics: stats,
      recommendations: generateRecommendations(stats, hasApiKey),
    });
  } catch (error) {
    console.error('[Routes] Error getting diagnostics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate recommendations based on statistics
 */
function generateRecommendations(stats, hasApiKey) {
  const recommendations = [];

  if (!hasApiKey) {
    recommendations.push({
      type: 'configuration',
      priority: 'high',
      message: 'Google Maps API key not configured. Add GOOGLE_MAPS_API_KEY to backend/.env for better routing accuracy.',
      action: 'Set GOOGLE_MAPS_API_KEY in backend/.env',
    });
  }

  if (stats.googleFailures > 0 && stats.googleRequests > 0) {
    const failureRate = (stats.googleFailures / stats.googleRequests) * 100;
    if (failureRate > 10) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `Google API failure rate is ${failureRate.toFixed(1)}%. Check API key validity and quota.`,
        action: 'Verify API key and check Google Cloud Console for quota/errors',
      });
    }
  }

  if (stats.straightLineFallbacks > 0) {
    recommendations.push({
      type: 'accuracy',
      priority: 'medium',
      message: `${stats.straightLineFallbacks} route segments fell back to straight lines. Routes may not follow streets accurately.`,
      action: 'Check network connectivity and API service availability',
    });
  }

  return recommendations;
}

/**
 * Reset routing statistics
 * POST /api/routes/reset-stats
 */
router.post('/reset-stats', (req, res) => {
  try {
    directionsService.resetStats();
    res.json({ 
      status: 'ok', 
      message: 'Statistics reset successfully',
      stats: directionsService.getStats(),
    });
  } catch (error) {
    console.error('[Routes] Error resetting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Calculate route through waypoints
 * POST /api/routes/calculate
 * Body: { waypoints: [[lat, lng], [lat, lng], ...] }
 */
router.post('/calculate', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { waypoints } = req.body;

    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({ 
        error: 'At least 2 waypoints are required',
        received: waypoints?.length || 0,
      });
    }

    // Validate waypoint format
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (!Array.isArray(wp) || wp.length !== 2) {
        return res.status(400).json({ 
          error: `Waypoint ${i} must be an array of [lat, lng]`,
          waypoint: wp,
        });
      }
      
      if (typeof wp[0] !== 'number' || typeof wp[1] !== 'number') {
        return res.status(400).json({ 
          error: `Waypoint ${i} coordinates must be numbers`,
          waypoint: wp,
        });
      }
    }

    console.log(`[Routes] 📍 Calculating route with ${waypoints.length} waypoints`);
    const result = await directionsService.getRoute(waypoints);
    const responseTime = Date.now() - startTime;

    if (result.success) {
      console.log(`[Routes] ✅ Route calculated successfully (${responseTime}ms)`);
      posthog.capture({
        distinctId: getDistinctId(req),
        event: 'route_calculated',
        properties: {
          waypoint_count: waypoints.length,
          coordinate_count: result.coordinates?.length || 0,
          provider: result.provider || 'unknown',
          response_time_ms: responseTime,
          batched: result.batched || false,
          failed_segments: result.failedSegments || 0,
        },
      });
      res.json({
        coordinates: result.coordinates, // [lat, lng][] format for Leaflet
        distance: result.distance,
        duration: result.duration,
        provider: result.provider || 'unknown',
        responseTime,
        metadata: {
          waypointCount: waypoints.length,
          coordinateCount: result.coordinates?.length || 0,
          batched: result.batched || false,
          successfulSegments: result.successfulSegments,
          failedSegments: result.failedSegments,
        },
      });
    } else {
      console.error(`[Routes] ❌ Route calculation failed: ${result.error}`);
      res.status(500).json({
        error: result.error || 'Failed to calculate route',
        status: result.status,
        responseTime,
      });
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[Routes] ❌ Error calculating route (${responseTime}ms):`, error);
    res.status(500).json({ 
      error: error.message,
      responseTime,
    });
  }
});

/**
 * Calculate walking distances for multiple candidate stops
 * POST /api/routes/calculate-walking
 * Body: { home: [lat, lng], stops: [[lat, lng], ...] }
 */
router.post('/calculate-walking', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { home, stops } = req.body;

    if (!Array.isArray(home) || home.length !== 2 || !Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: 'Valid home [lat, lng] and stops array are required' });
    }

    console.log(`[Routes] 🚶 Calculating walking distances for ${stops.length} candidates using Routes Matrix API`);
    
    // We use the modern Google Routes Matrix API (v2) for efficiency.
    // We still limit to top 5 candidates to keep costs predictable.
    const candidates = stops.slice(0, 5);
    const matrixResult = await routesService.getWalkingMatrix(home, candidates);
    
    if (matrixResult.success) {
      const responseTime = Date.now() - startTime;
      posthog.capture({
        distinctId: getDistinctId(req),
        event: 'walking_distance_calculated',
        properties: {
          stop_count: candidates.length,
          successful_count: matrixResult.results.filter(r => !!r).length,
          response_time_ms: responseTime,
        },
      });
      res.json({
        results: matrixResult.results.map((res, index) => ({
          index,
          distance: res?.distance || 0,
          duration: res?.duration || 0,
          success: !!res,
          error: res?.error || (res ? null : 'Failed to calculate matrix element')
        })),
        responseTime
      });
    } else {
      throw new Error(matrixResult.error || 'Matrix calculation failed');
    }
  } catch (error) {
    console.error('[Routes] Error in calculate-walking:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as routesRouter };

