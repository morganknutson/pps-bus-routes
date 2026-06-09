import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { autocompleteAddress, geocodeAddress, reverseGeocode } from '../services/api';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDarkMode } from '../hooks/useDarkMode';
import { analyticsService } from '../services/analytics';
import { formatStreetName } from '../utils/formatAddress';
import { findClosestStop } from '../utils/findClosestStop';
import { formatDistance } from '../utils/distance';
import { Route, Stop } from '../types';
import { MapPinIcon } from './MapPinIcon';
import { XIcon } from './XIcon';
import { LocationArrowIcon } from './LocationArrowIcon';
import { ChevronIcon } from './ChevronIcon';
import { Button } from './Button';
import { useUrlState } from '../hooks/useUrlState';
import { useIsStandalone } from '../hooks/useIsStandalone';

interface AutocompleteSuggestion {
  displayName: string;
  address: string;
  coordinates: [number, number] | null;
}

export function AddressInput() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const navigate = useNavigate();
  const location = useLocation();

  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '';
  const {
    schoolId: selectedSchoolId,
    selectedStopId,
    directionFilter,
    selectStop,
    setDirectionFilter,
    setActiveTab,
    setFocus,
    focus,
  } = useUrlState({ basePath });

  const {
    setHomeAddress,
    homeAddress,
    clearHomeAddress,
    routes,
    schools,
    setShowSchoolClosestModal,
    setIsFindMyStopVisible,
  } = useStore();

  const isMobile = useIsMobile();
  const { isDarkMode } = useDarkMode();
  const isStandalone = useIsStandalone();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isGeolocating, setIsGeolocating] = useState(false);

  const handleGetLocation = async () => {
    console.log('[AddressInput] handleGetLocation called');
    if (!navigator.geolocation) {
      console.warn('[AddressInput] Geolocation not supported');
      return;
    }

    setIsGeolocating(true);
    console.log('[AddressInput] Starting geolocation...');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;
      console.log(`[AddressInput] Got location: ${latitude}, ${longitude}`);

      console.log('[AddressInput] Calling reverseGeocode...');
      let result;
      try {
        result = await reverseGeocode(latitude, longitude);
        console.log('[AddressInput] reverseGeocode result:', result);
      } catch (apiError: any) {
        console.error('[AddressInput] reverseGeocode API error:', apiError);
        console.error('[AddressInput] API error message:', apiError.message);
        throw new Error(`Reverse geocode failed: ${apiError.message}`);
      }

      if (result && result.fullAddress) {
        // Extract just the street address part (before the city)
        const addressParts = result.fullAddress.split(',');
        const streetAddress = addressParts.slice(0, 2).join(',').trim();
        console.log('[AddressInput] Setting home address:', streetAddress);

        setHomeAddress({
          address: streetAddress,
          coordinates: [longitude, latitude] // [lng, lat] format
        });
        setFocus('home');
        setQuery('');
        analyticsService.trackAction('location_autofill', { success: true });
        console.log('[AddressInput] Location autofill complete');
      } else {
        console.warn('[AddressInput] No fullAddress in result. Result object:', JSON.stringify(result, null, 2));
        analyticsService.trackAction('location_autofill', { success: false, reason: 'no_address' });
      }
    } catch (error: any) {
      console.error('[AddressInput] Geolocation error:', error);
      console.error('[AddressInput] Error message:', error.message);
      console.error('[AddressInput] Error code:', error.code);
      console.error('[AddressInput] Error stack:', error.stack);
      
      // Provide user feedback for common errors
      if (error.code === 1) {
        console.warn('[AddressInput] Location permission denied by user');
      } else if (error.code === 2) {
        console.warn('[AddressInput] Location position unavailable');
      } else if (error.code === 3) {
        console.warn('[AddressInput] Location request timed out');
      }
      
      analyticsService.trackAction('location_autofill', { success: false, reason: error.code || 'error' });
    } finally {
      setIsGeolocating(false);
      console.log('[AddressInput] Geolocation process finished');
    }
  };

  const shouldShowButton = homeAddress && selectedSchoolId && routes.length > 0;
  const isAnySheetOpen = focus === 'home' || focus === 'school-info' || !!selectedStopId;

  useEffect(() => {
    setIsFindMyStopVisible(!!shouldShowButton && isMobile);
    return () => setIsFindMyStopVisible(false);
  }, [shouldShowButton, isMobile, setIsFindMyStopVisible]);

  const handleFindClosestStop = async () => {
    if (!homeAddress || !routes || routes.length === 0) return;

    console.log(`[AddressInput] Finding closest stop for school ${selectedSchoolId} among ${routes.length} routes. Filter: ${directionFilter}`);

    // Context-Aware Search: Pass the current filter to findClosestStop
    let result = await findClosestStop(homeAddress, routes, directionFilter);

    // Fallback: If no stop in current direction, search everything
    if (!result && directionFilter !== 'Both') {
      console.log('[AddressInput] No stop found in current direction, searching all directions');
      result = await findClosestStop(homeAddress, routes, 'Both');
    }

    if (result) {
      const { route, stop, distance } = result;
      console.log(`[AddressInput] Found closest stop: ${stop.address} at ${formatDistance(distance, true)}`);

      // Elegant School-as-Closest-Stop handling
      if (stop.isSchoolStop) {
        setShowSchoolClosestModal(true, {
          schoolName: selectedSchoolId ? schools.find(s => s.id === selectedSchoolId)?.name || 'the school' : 'the school',
          schoolId: selectedSchoolId || ''
        });
        setFocus('home');
        return;
      }

      // Update direction, tab, and stop in ONE call to avoid URL race conditions
      selectStop(route.name, stop.id, {
        doubleFit: true,
        direction: (route.direction as any) || directionFilter,
        show: 'routes',
        soleRoute: true
      });

      analyticsService.trackAction('find_my_stop', {
        source: 'explorer',
        schoolId: selectedSchoolId,
        distance,
        route_name: route.name,
        route_direction: route.direction,
        stop_id: stop.id,
      });
    } else {
      console.warn('[AddressInput] No stops with coordinates found in current routes');
    }
  };

  const getDisplayAddress = (address: string): string => {
    if (!address) return address;
    const streetPart = address.split(',')[0].trim();
    return formatStreetName(streetPart);
  };

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const debounceDelay = query.length > 5 ? 150 : 200;

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await autocompleteAddress(query, 'Portland', 'OR', abortController.signal);
        if (!abortController.signal.aborted) {
          setSuggestions(result.suggestions || []);
          setShowSuggestions(true);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('[AddressInput] Autocomplete error:', error);
        if (!abortController.signal.aborted) setSuggestions([]);
      } finally {
        if (!abortController.signal.aborted) setIsLoading(false);
      }
    }, debounceDelay);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [query]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = async (suggestion: AutocompleteSuggestion) => {
    analyticsService.trackAddressSearch('explorer', suggestion.address);
    if (!suggestion.coordinates) {
      try {
        setIsLoading(true);
        const geocodeResult = await geocodeAddress(suggestion.address);
        if (geocodeResult.coordinates) {
          setHomeAddress({ address: suggestion.address, coordinates: geocodeResult.coordinates });
        } else {
          setHomeAddress({ address: suggestion.address, coordinates: [0, 0] });
        }
      } catch (error) {
        console.error('[AddressInput] Geocoding error:', error);
        setHomeAddress({ address: suggestion.address, coordinates: [0, 0] });
      } finally {
        setIsLoading(false);
      }
    } else {
      setHomeAddress({ address: suggestion.address, coordinates: suggestion.coordinates });
    }

    setFocus('home');
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div style={{
      /* Position container based on device type */
      position: 'absolute',
      top: isMobile ? '1.9rem' : '1.2rem',
      left: isMobile ? '1.9rem' : '1.25rem',
      right: isMobile ? '1.9rem' : '1.25rem',
      zIndex: 1000,
      display: 'flex',
      /* Adjust gap between input and button for mobile */
      gap: isMobile ? '0.5rem' : '0.75rem',
      alignItems: 'center'
    }}>
      {shouldShowButton && (
        <Button
          variant="primary"
          size={isMobile ? "large" : "medium"}
          align="left"
          onClick={handleFindClosestStop}
          title={focus === 'my-stop' ? "This is your stop" : "Find My Stop"}
          icon={<MapPinIcon filled style={{ width: isMobile ? 24 : 10, height: isMobile ? 19 : 13, flexShrink: 0 }} />}
          showChevron={isMobile}
          floating={isMobile ? !isAnySheetOpen : true}
          style={isMobile ? {
            position: 'fixed',
            bottom: isStandalone
              ? (isAnySheetOpen ? 'calc(env(safe-area-inset-bottom, 20px) + 10px)' : 'calc(env(safe-area-inset-bottom, 20px) + 30px)')
              : (isAnySheetOpen ? '16px' : '36px'),
            left: isAnySheetOpen ? '30px' : '30px',
            right: isAnySheetOpen ? '30px' : '30px',
            width: 'auto',
            height: '56px',
            backgroundColor: focus === 'my-stop' ? 'transparent' : 'var(--bg-primary)',
            color: focus === 'my-stop'
              ? (isDarkMode ? 'rgba(255,255,255, .4)' : 'rgba(0, 0, 0, .4)')
              : 'var(--text-primary)',
            border: focus === 'my-stop'
              ? (isDarkMode ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)')
              : 'none',
            ...(focus === 'my-stop' ? { boxShadow: 'none' } : {}),
            zIndex: 800,
            transition: 'all 0.5s ease',
          } : undefined}
        >
          {focus === 'my-stop' ? "This is your stop" : "Find My Stop"}
        </Button>
      )}

      <div style={{
        flex: 1,
        /* Dynamic padding and height for mobile/desktop inputs */
        padding: isMobile ? '0 1.25rem' : '0 0.75rem 0 1.25rem',
        height: isMobile ? '56px' : '40px',
        display: 'flex',
        alignItems: 'center',
        /* Theme-aware background color */
        backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)',
        borderRadius: '9999px',
        boxShadow: 'var(--drop-shadow-floating-primary), var(--edge-inner-primary)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
      }}>
        {/* Toggle view between selected address and empty input state */}
        {homeAddress ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            position: 'relative'
          }}>
            {/* Home icon style (Entered state) */}
            <i className="fas fa-house" style={{
              color: 'var(--text-primary)',
              fontSize: isMobile ? '16px' : '12px',
              flexShrink: 0,
              position: 'absolute',
              left: isMobile ? '6px' : '0px',
              top: '49%',
              transform: 'translateY(-50%)',
              zIndex: 1
            }}></i>
            <div
              onClick={() => setFocus('home')}
              style={{
                /* Standardized font size across both input states */
                fontSize: isMobile ? '16px' : '12px',
                fontWeight: '500',
                flex: 1,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationColor: 'transparent',
                transition: 'text-decoration-color 0.2s ease',
                /* Ensure long addresses don't break the layout */
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                /* Padding for the entered address text */
                padding: isMobile ? '0 0.5rem 0 2.5rem' : '0 0.5rem 0 1.5rem'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = 'transparent'; }}
              title="Click to zoom to address on map"
            >
              {getDisplayAddress(homeAddress.address)}
            </div>
            {/* Clear button to return to search state */}
            <button
              onClick={clearHomeAddress}
              style={{
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0
              }}
            >
              <XIcon />
            </button>
          </div>
        ) : (
          /* Empty input state for searching */
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', height: '100%' }}>
            <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
              {/* Home icon style (Not entered state) */}
              <i className="fas fa-house" style={{
                position: 'absolute',
                /* Adjust icon position for mobile/desktop padding */
                left: isMobile ? '6px' : '0px',
                top: '49%',
                transform: 'translateY(-50%)',
                fontSize: isMobile ? '14px' : '12px',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
                zIndex: 1
              }}></i>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Enter your address..."
                style={{
                  width: '100%',
                  height: '100%',
                  /* Custom padding to accommodate the absolute-positioned house icon and location button */
                  padding: isMobile ? '0 2.5rem 0 2.5rem' : '0 2rem 0 1.5rem',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: isMobile ? '16px' : '12px',
                  boxSizing: 'border-box',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              {/* Location icon no address is entered */}
              <div style={{ position: 'absolute', right: isMobile ? '8px' : '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isLoading && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Searching...</span>}
                <button
                  onClick={handleGetLocation}
                  disabled={isGeolocating}
                  title="Use my location"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: isMobile ? '4px 0px' : '4px 0px',
                    cursor: isGeolocating ? 'wait' : 'pointer',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => { if (!isGeolocating) e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                  {isGeolocating ? (
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: isMobile ? '18px' : '16px' }}></i>
                  ) : (
                    <LocationArrowIcon size={isMobile ? 14 : 12} />
                  )}
                </button>
              </div>

              {/* Autocomplete dropdown - visibility controlled by search results and focus */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: isDarkMode ? 'rgba(10,10,10, 1)' : 'rgba(150,150,150, 1)',
                    border: isDarkMode ? '1px solid rgba(10,10,10, 1)' : 'none',
                    borderRadius: '16px',
                    boxShadow: isDarkMode ? '0 10px 38px rgba(0,0,0, .8)' : '0 10px 38px rgba(0,0,0, .4)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000
                  }}>
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        borderBottom: index < suggestions.length - 1 ? (isDarkMode ? '1px solid rgba(10,10,10, .5)' : '1px solid rgba(236, 236, 236, 1)') : 'none',
                        fontSize: isMobile ? '16px' : '12px',
                        color: highlightedIndex === index ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        /* Highlight background color for keyboard navigation or hover */
                        backgroundColor: highlightedIndex === index ? (isDarkMode ? 'rgba(255,255,255, .1)' : '#f8f8f8ec') : 'var(--bg-primary)'
                      }}
                    >
                      {suggestion.displayName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
