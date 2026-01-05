/**
 * API Usage Tracking Service
 * Centralized service to track Google API usage across all services
 * Provides aggregated statistics and cost estimates
 */

import { directionsService } from './directionsService.js';
import { geocodingService } from './geocodingService.js';
import { placesService } from './placesService.js';
import { autocompleteService } from './autocompleteService.js';
import { neighborhoodService } from './neighborhoodService.js';
import { streetGeometryService } from './streetGeometryService.js';

// Google API Pricing (as of 2024)
// Source: https://developers.google.com/maps/billing-and-pricing/pricing
const API_PRICING = {
  geocoding: {
    per1000: 5.00, // $5.00 per 1,000 requests
    sku: 'Geocoding API',
  },
  reverseGeocoding: {
    per1000: 5.00, // $5.00 per 1,000 requests (same as geocoding)
    sku: 'Geocoding API',
  },
  directions: {
    per1000: 5.00, // $5.00 per 1,000 requests
    sku: 'Directions API',
  },
  places: {
    per1000: 17.00, // $17.00 per 1,000 requests (Places API - New)
    sku: 'Places API (New)',
  },
  autocomplete: {
    per1000: 2.83, // $2.83 per 1,000 requests (Places Autocomplete API)
    sku: 'Places Autocomplete API',
  },
  roads: {
    per1000: 10.00, // $10.00 per 1,000 requests (Roads API)
    sku: 'Roads API',
  },
  drive: {
    per1000: 0.0, // Free tier
    sku: 'Drive API',
  },
};

const FREE_TIER_CREDIT = 200.00; // $200/month credit for new accounts

/**
 * API Usage Service Class
 * Aggregates usage statistics from all Google API services
 */
class ApiUsageService {
  constructor() {
    // Track service instances
    this.services = {
      directions: directionsService,
      geocoding: geocodingService,
      places: placesService,
      autocomplete: autocompleteService,
      neighborhood: neighborhoodService,
      roads: streetGeometryService,
    };
  }

  /**
   * Get usage statistics from a service
   * Each service should implement getStats() method
   */
  getServiceStats(serviceName) {
    const service = this.services[serviceName];
    if (!service) {
      return null;
    }

    try {
      // Try to get stats if the service has a getStats method
      if (typeof service.getStats === 'function') {
        return service.getStats();
      }
      
      // Try to access stats directly if available
      if (service.stats) {
        return service.stats;
      }
      
      return null;
    } catch (error) {
      console.error(`[ApiUsageService] Error getting stats from ${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Calculate estimated cost for API calls
   */
  calculateCost(apiName, requestCount) {
    const pricing = API_PRICING[apiName];
    if (!pricing) {
      return 0;
    }

    if (requestCount === 0) {
      return 0;
    }

    const cost = (requestCount / 1000) * pricing.per1000;
    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get aggregated usage statistics from all services
   */
  getUsageStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      services: {},
      totals: {
        totalRequests: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        estimatedCost: 0,
        freeTierRemaining: FREE_TIER_CREDIT,
      },
      apis: {},
    };

    // Directions API stats
    const directionsStats = this.getServiceStats('directions');
    if (directionsStats) {
      const googleRequests = directionsStats.googleRequests || 0;
      const googleSuccesses = directionsStats.googleSuccesses || 0;
      const googleFailures = directionsStats.googleFailures || 0;
      const cost = this.calculateCost('directions', googleRequests);
      
      stats.services.directions = {
        ...directionsStats,
        estimatedCost: cost,
        pricing: API_PRICING.directions,
      };
      
      stats.totals.totalRequests += googleRequests;
      stats.totals.totalSuccesses += googleSuccesses;
      stats.totals.totalFailures += googleFailures;
      stats.totals.estimatedCost += cost;
      
      stats.apis.directions = {
        requests: googleRequests,
        successes: googleSuccesses,
        failures: googleFailures,
        cost,
        sku: API_PRICING.directions.sku,
      };
    }

    // Geocoding API stats (if service has stats)
    // Note: GeocodingService doesn't have stats yet, but we'll add it
    const geocodingStats = this.getServiceStats('geocoding');
    if (geocodingStats) {
      const requests = geocodingStats.googleRequests || 0;
      const successes = geocodingStats.googleSuccesses || 0;
      const failures = geocodingStats.googleFailures || 0;
      const cost = this.calculateCost('geocoding', requests);
      
      stats.services.geocoding = {
        ...geocodingStats,
        estimatedCost: cost,
        pricing: API_PRICING.geocoding,
      };
      
      stats.totals.totalRequests += requests;
      stats.totals.totalSuccesses += successes;
      stats.totals.totalFailures += failures;
      stats.totals.estimatedCost += cost;
      
      stats.apis.geocoding = {
        requests,
        successes,
        failures,
        cost,
        sku: API_PRICING.geocoding.sku,
      };
    }

    // Places API stats (if service has stats)
    const placesStats = this.getServiceStats('places');
    if (placesStats) {
      const requests = placesStats.requests || 0;
      const successes = placesStats.successes || 0;
      const failures = placesStats.failures || 0;
      const cost = this.calculateCost('places', requests);
      
      stats.services.places = {
        ...placesStats,
        estimatedCost: cost,
        pricing: API_PRICING.places,
      };
      
      stats.totals.totalRequests += requests;
      stats.totals.totalSuccesses += successes;
      stats.totals.totalFailures += failures;
      stats.totals.estimatedCost += cost;
      
      stats.apis.places = {
        requests,
        successes,
        failures,
        cost,
        sku: API_PRICING.places.sku,
      };
    }

    // Autocomplete API stats (if service has stats)
    const autocompleteStats = this.getServiceStats('autocomplete');
    if (autocompleteStats) {
      const requests = autocompleteStats.googleRequests || 0;
      const successes = autocompleteStats.googleSuccesses || 0;
      const failures = autocompleteStats.googleFailures || 0;
      const cost = this.calculateCost('autocomplete', requests);
      
      stats.services.autocomplete = {
        ...autocompleteStats,
        estimatedCost: cost,
        pricing: API_PRICING.autocomplete,
      };
      
      stats.totals.totalRequests += requests;
      stats.totals.totalSuccesses += successes;
      stats.totals.totalFailures += failures;
      stats.totals.estimatedCost += cost;
      
      stats.apis.autocomplete = {
        requests,
        successes,
        failures,
        cost,
        sku: API_PRICING.autocomplete.sku,
      };
    }

    // Reverse Geocoding (Neighborhood Service) stats
    const neighborhoodStats = this.getServiceStats('neighborhood');
    if (neighborhoodStats) {
      const requests = neighborhoodStats.googleRequests || 0;
      const successes = neighborhoodStats.googleSuccesses || 0;
      const failures = neighborhoodStats.googleFailures || 0;
      const cost = this.calculateCost('reverseGeocoding', requests);
      
      stats.services.neighborhood = {
        ...neighborhoodStats,
        estimatedCost: cost,
        pricing: API_PRICING.reverseGeocoding,
      };
      
      stats.totals.totalRequests += requests;
      stats.totals.totalSuccesses += successes;
      stats.totals.totalFailures += failures;
      stats.totals.estimatedCost += cost;
      
      stats.apis.reverseGeocoding = {
        requests,
        successes,
        failures,
        cost,
        sku: API_PRICING.reverseGeocoding.sku,
      };
    }

    // Roads API stats (if service has stats)
    const roadsStats = this.getServiceStats('roads');
    if (roadsStats) {
      const requests = roadsStats.googleRequests || 0;
      const successes = roadsStats.googleSuccesses || 0;
      const failures = roadsStats.googleFailures || 0;
      const cost = this.calculateCost('roads', requests);
      
      stats.services.roads = {
        ...roadsStats,
        estimatedCost: cost,
        pricing: API_PRICING.roads,
      };
      
      stats.totals.totalRequests += requests;
      stats.totals.totalSuccesses += successes;
      stats.totals.totalFailures += failures;
      stats.totals.estimatedCost += cost;
      
      stats.apis.roads = {
        requests,
        successes,
        failures,
        cost,
        sku: API_PRICING.roads.sku,
      };
    }

    // Calculate free tier remaining
    stats.totals.freeTierRemaining = Math.max(0, FREE_TIER_CREDIT - stats.totals.estimatedCost);
    stats.totals.freeTierUsed = FREE_TIER_CREDIT - stats.totals.freeTierRemaining;
    stats.totals.freeTierPercentage = Math.min(100, (stats.totals.estimatedCost / FREE_TIER_CREDIT) * 100);

    // Calculate success rate
    if (stats.totals.totalRequests > 0) {
      stats.totals.successRate = ((stats.totals.totalSuccesses / stats.totals.totalRequests) * 100).toFixed(2) + '%';
    } else {
      stats.totals.successRate = 'N/A';
    }

    return stats;
  }

  /**
   * Get pricing information for all APIs
   */
  getPricingInfo() {
    return API_PRICING;
  }

  /**
   * Reset all service statistics
   */
  resetStats() {
    Object.values(this.services).forEach(service => {
      if (typeof service.resetStats === 'function') {
        service.resetStats();
      } else if (service.stats) {
        // Reset stats object if service has one
        Object.keys(service.stats).forEach(key => {
          if (typeof service.stats[key] === 'number') {
            service.stats[key] = 0;
          } else if (typeof service.stats[key] === 'string') {
            service.stats[key] = 'N/A';
          } else {
            service.stats[key] = null;
          }
        });
      }
    });
  }
}

// Export singleton instance
export const apiUsageService = new ApiUsageService();
export { ApiUsageService };

