import ReactGA from 'react-ga4';

/**
 * Analytics Service for Google Analytics 4
 * 
 * Handles initialization, page tracking, and custom event instrumentation.
 */
class AnalyticsService {
  private isInitialized = false;

  /**
   * Initialize GA4 with the provided tracking ID
   * @param measurementId GA4 Measurement ID (G-XXXXXXXXXX)
   */
  init(measurementId: string) {
    if (!measurementId) {
      console.warn('[AnalyticsService] No GA4 Measurement ID provided. Analytics disabled.');
      return;
    }

    if (this.isInitialized) return;

    try {
      ReactGA.initialize(measurementId);
      this.isInitialized = true;
      console.log('[AnalyticsService] GA4 Initialized successfully with ID:', measurementId);
    } catch (error) {
      console.error('[AnalyticsService] Failed to initialize GA4:', error);
    }
  }

  /**
   * Track a page view
   * @param path The URL path (including search/params)
   * @param title Optional page title
   */
  trackPageView(path: string, title?: string) {
    if (!this.isInitialized) return;

    ReactGA.send({
      hitType: 'pageview',
      page: path,
      title: title || document.title
    });
    console.log('[AnalyticsService] PageView tracked:', path);
  }

  /**
   * Track a custom event
   * @param category Event category (e.g., 'Search', 'Selection', 'Admin')
   * @param action Event action (e.g., 'address_search', 'school_select')
   * @param label Optional event label
   * @param value Optional numeric value
   * @param nonInteraction If true, this event doesn't impact bounce rate
   */
  trackEvent(category: string, action: string, label?: string, value?: number, nonInteraction = false) {
    if (!this.isInitialized) return;

    ReactGA.event({
      category,
      action,
      label,
      value,
      nonInteraction,
    });
    console.log(`[AnalyticsService] Event tracked: [${category}] ${action}${label ? ` (${label})` : ''}`);
  }

  // --- Convenience Methods for PPS Bus Maps ---

  /**
   * Track an address search
   * @param source Where the search happened ('homepage', 'explorer', 'admin')
   * @param address The address searched (anonymized or full depending on privacy)
   */
  trackAddressSearch(source: string, address?: string) {
    this.trackEvent('Search', 'address_search', source, undefined, false);
    if (address) {
      this.trackAction('address_search_detail', { source, address });
    }
  }

  /**
   * Track a school selection
   * @param schoolName Name of the school
   * @param source Where it was selected ('map', 'list')
   */
  trackSchoolSelect(schoolName: string, source: string) {
    this.trackEvent('Selection', 'school_select', `${schoolName} (${source})`);
  }

  /**
   * Track a bus route selection
   * @param routeName Name/Number of the route
   * @param schoolName Name of the school the route belongs to
   */
  trackRouteToggle(routeName: string, schoolName: string, isSelected: boolean) {
    this.trackEvent('Selection', isSelected ? 'route_select' : 'route_deselect', `${routeName} - ${schoolName}`);
  }

  /**
   * Track tab changes in Explorer/Admin
   * @param tabName Name of the tab ('schools', 'routes')
   */
  trackTabChange(tabName: string) {
    this.trackEvent('Navigation', 'tab_change', tabName);
  }

  /**
   * Track admin actions
   * @param action Action performed (e.g., 'pdf_sync', 'school_update')
   * @param label Optional label
   */
  trackAdminAction(action: string, label?: string) {
    this.trackEvent('Admin', action, label);
  }

  /**
   * Track map interactions
   * @param action Action (e.g., 'zoom_in', 'zoom_out', 'pan')
   */
  trackMapInteraction(action: string) {
    this.trackEvent('Map', action);
  }

  /**
   * Track a generic action with properties
   * @param action The action name
   * @param properties Optional properties
   */
  trackAction(action: string, properties?: any) {
    if (!this.isInitialized) return;
    
    // In GA4, we can send custom parameters with events
    ReactGA.event(action, properties);
    console.log(`[AnalyticsService] Action tracked: ${action}`, properties);
  }
}

export const analyticsService = new AnalyticsService();

