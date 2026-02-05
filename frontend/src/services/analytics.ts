import ReactGA from 'react-ga4';

/**
 * Analytics Service for Google Analytics 4
 * 
 * Handles initialization, page tracking, and custom event instrumentation.
 * 
 * IMPORTANT: gtag.js is loaded in index.html BEFORE React for proper referrer tracking.
 * This service works alongside the gtag.js script, not as a replacement.
 */

// Extend window to include our custom properties set in index.html
declare global {
  interface Window {
    __INITIAL_REFERRER__?: string;
    __INITIAL_URL__?: string;
    __LANDING_TIME__?: number;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

class AnalyticsService {
  private isInitialized = false;
  private isDebugMode = false;
  private sessionId: string | null = null;
  private isFirstVisit = false;

  /**
   * Initialize GA4 with the provided tracking ID
   * @param measurementId GA4 Measurement ID (G-XXXXXXXXXX)
   */
  init(measurementId: string) {
    if (!measurementId) {
      console.warn('[Analytics] No GA4 Measurement ID provided. Analytics disabled.');
      return;
    }

    if (this.isInitialized) return;

    // Check if we're in debug mode (localhost)
    this.isDebugMode = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';

    try {
      // Initialize react-ga4 (works alongside gtag.js loaded in index.html)
      ReactGA.initialize(measurementId, {
        gaOptions: {
          debug_mode: this.isDebugMode,
        },
        gtagOptions: {
          debug_mode: this.isDebugMode,
        }
      });
      
      this.isInitialized = true;
      
      // Generate or retrieve session ID
      this.initSession();
      
      // Track first visit
      this.trackFirstVisit();
      
      // Send initial referrer data captured in index.html
      this.sendInitialReferrerData();
      
      if (this.isDebugMode) {
        console.log('[Analytics] GA4 Initialized (DEBUG MODE)', {
          measurementId,
          sessionId: this.sessionId,
          isFirstVisit: this.isFirstVisit,
          initialReferrer: window.__INITIAL_REFERRER__,
        });
      }
    } catch (error) {
      console.error('[Analytics] Failed to initialize GA4:', error);
    }
  }

  /**
   * Initialize or retrieve session ID for better user tracking
   */
  private initSession() {
    // Check for existing session
    const existingSession = sessionStorage.getItem('ga_session_id');
    const sessionStart = sessionStorage.getItem('ga_session_start');
    
    // Session expires after 30 minutes of inactivity
    const SESSION_TIMEOUT = 30 * 60 * 1000;
    const now = Date.now();
    
    if (existingSession && sessionStart) {
      const elapsed = now - parseInt(sessionStart, 10);
      if (elapsed < SESSION_TIMEOUT) {
        this.sessionId = existingSession;
        // Update session activity time
        sessionStorage.setItem('ga_session_start', now.toString());
        return;
      }
    }
    
    // Create new session
    this.sessionId = `${now}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('ga_session_id', this.sessionId);
    sessionStorage.setItem('ga_session_start', now.toString());
    
    // Track new session event
    this.trackAction('session_start', {
      session_id: this.sessionId,
      referrer: window.__INITIAL_REFERRER__ || document.referrer || '(direct)',
    });
  }

  /**
   * Track if this is the user's first visit
   */
  private trackFirstVisit() {
    const hasVisited = localStorage.getItem('ga_has_visited');
    
    if (!hasVisited) {
      this.isFirstVisit = true;
      localStorage.setItem('ga_has_visited', 'true');
      localStorage.setItem('ga_first_visit', new Date().toISOString());
      
      this.trackAction('first_visit', {
        landing_page: window.location.pathname,
        referrer: window.__INITIAL_REFERRER__ || document.referrer || '(direct)',
        utm_source: new URLSearchParams(window.location.search).get('utm_source'),
        utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
        utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
      });
      
      this.setUserProperty('is_new_user', true);
    } else {
      this.setUserProperty('is_new_user', false);
    }
  }

  /**
   * Send the initial referrer data captured in index.html before React loaded
   */
  private sendInitialReferrerData() {
    const referrer = window.__INITIAL_REFERRER__;
    
    if (referrer && !referrer.includes('ppsbus.com')) {
      try {
        const referrerUrl = new URL(referrer);
        this.setUserProperty('initial_referrer_domain', referrerUrl.hostname);
        this.setUserProperty('has_referrer', true);
        
        if (this.isDebugMode) {
          console.log('[Analytics] Initial referrer captured:', {
            full: referrer,
            domain: referrerUrl.hostname,
          });
        }
      } catch {
        // Invalid URL, just store the raw value
        this.setUserProperty('initial_referrer_domain', referrer);
        this.setUserProperty('has_referrer', true);
      }
    } else {
      this.setUserProperty('has_referrer', false);
      this.setUserProperty('initial_referrer_domain', '(direct)');
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
    
    if (this.isDebugMode) {
      console.log('[Analytics] PageView:', path);
    }
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
    
    if (this.isDebugMode) {
      console.log(`[Analytics] Event: [${category}] ${action}${label ? ` (${label})` : ''}`);
    }
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
  trackAction(action: string, properties?: Record<string, any>) {
    if (!this.isInitialized) return;
    
    // Add session context to all actions
    const enrichedProperties = {
      ...properties,
      session_id: this.sessionId,
    };
    
    // In GA4, we can send custom parameters with events
    ReactGA.event(action, enrichedProperties);
    
    if (this.isDebugMode) {
      console.log(`[Analytics] Action: ${action}`, enrichedProperties);
    }
  }

  /**
   * Set a persistent user property
   * @param name Property name
   * @param value Property value
   */
  setUserProperty(name: string, value: any) {
    if (!this.isInitialized) return;
    ReactGA.set({ [name]: value });
    
    // Also send via gtag for better GA4 integration
    if (window.gtag) {
      window.gtag('set', 'user_properties', { [name]: value });
    }
    
    if (this.isDebugMode) {
      console.log(`[Analytics] User Property: ${name} = ${value}`);
    }
  }

  /**
   * Track outbound link clicks
   * @param url The destination URL
   * @param type The type of link
   */
  trackOutboundLink(url: string, type: 'website' | 'pdf' | 'maps' | 'external') {
    this.trackEvent('Navigation', 'outbound_click', `${type}: ${url}`);
  }

  /**
   * Track application errors
   * @param description Error description
   * @param fatal Whether the error was fatal
   */
  trackError(description: string, fatal = false) {
    if (!this.isInitialized) return;
    ReactGA.gtag('event', 'exception', {
      description,
      fatal,
    });
    
    if (this.isDebugMode || fatal) {
      console.error(`[Analytics] Error: ${description}${fatal ? ' (FATAL)' : ''}`);
    }
  }

  /**
   * Mark the current user as internal (developer/admin)
   * This helps filter your traffic from real users in GA4 reports
   */
  markAsInternalUser() {
    localStorage.setItem('is_internal_user', 'true');
    this.setUserProperty('traffic_type', 'internal');
    
    // Also set via gtag for GA4 internal traffic filtering
    if (window.gtag) {
      window.gtag('set', { 'traffic_type': 'internal' });
    }
    
    if (this.isDebugMode) {
      console.log('[Analytics] Marked as internal user');
    }
  }

  /**
   * Check if current user is marked as internal
   */
  isInternalUser(): boolean {
    return localStorage.getItem('is_internal_user') === 'true';
  }

  /**
   * Get debug info for troubleshooting
   */
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      isDebugMode: this.isDebugMode,
      sessionId: this.sessionId,
      isFirstVisit: this.isFirstVisit,
      isInternalUser: this.isInternalUser(),
      initialReferrer: window.__INITIAL_REFERRER__,
      initialUrl: window.__INITIAL_URL__,
      landingTime: window.__LANDING_TIME__,
      hasVisitedBefore: localStorage.getItem('ga_has_visited') === 'true',
      firstVisitDate: localStorage.getItem('ga_first_visit'),
    };
  }
}

export const analyticsService = new AnalyticsService();
