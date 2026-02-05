import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../services/analytics';

/**
 * Hook to automatically track page views on route changes.
 * Place this in the root App component or any component that has access to the Router context.
 * 
 * Also captures UTM parameters and referral sources from the URL.
 */
export function usePageTracking() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Skip tracking on first render since gtag.js in index.html already sent the initial pageview
    // This prevents duplicate pageview events
    if (isFirstRender.current) {
      isFirstRender.current = false;
      
      // But DO capture UTM/referral params on first load
      captureMarketingParams(location.search);
      return;
    }

    // Track page view for subsequent navigation
    analyticsService.trackPageView(currentPath);
  }, [location]);
}

/**
 * Capture and store marketing/referral parameters
 */
function captureMarketingParams(search: string) {
  const params = new URLSearchParams(search);
  
  // Standard UTM parameters
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const utmTerm = params.get('utm_term');
  const utmContent = params.get('utm_content');
  
  // Custom referral parameters
  const ref = params.get('ref') || params.get('source');
  
  // Set user properties for any present UTM params
  if (utmSource) {
    analyticsService.setUserProperty('utm_source', utmSource);
  }
  if (utmMedium) {
    analyticsService.setUserProperty('utm_medium', utmMedium);
  }
  if (utmCampaign) {
    analyticsService.setUserProperty('utm_campaign', utmCampaign);
  }
  if (utmTerm) {
    analyticsService.setUserProperty('utm_term', utmTerm);
  }
  if (utmContent) {
    analyticsService.setUserProperty('utm_content', utmContent);
  }
  if (ref) {
    analyticsService.setUserProperty('referral_source', ref);
  }
  
  // Track if user came from a marketing campaign
  if (utmSource || utmMedium || utmCampaign || ref) {
    analyticsService.trackAction('marketing_landing', {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: utmTerm,
      utm_content: utmContent,
      ref: ref,
      landing_page: window.location.pathname,
    });
  }
}
