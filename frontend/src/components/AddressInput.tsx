import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { autocompleteAddress, geocodeAddress } from '../services/api';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDarkMode } from '../hooks/useDarkMode';
import { analyticsService } from '../services/analytics';
import { formatStreetName } from '../utils/formatAddress';
import { findClosestStop } from '../utils/findClosestStop';
import { formatDistance } from '../utils/distance';
import { Route, Stop } from '../types';
import { MapPinIcon } from './MapPinIcon';
import { XIcon } from './XIcon';
import { parseUrlPath, buildUrlPath } from '../services/urlState';

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
  const { 
    setHomeAddress, 
    homeAddress, 
    clearHomeAddress, 
    triggerZoomToHomeAddress,
    selectedSchoolId, 
    routes,
    selectStop,
    setDirectionFilter
  } = useStore();
  const isMobile = useIsMobile();
  const { isDarkMode } = useDarkMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFindClosestStop = async () => {
    if (!homeAddress || !routes || routes.length === 0) return;

    console.log(`[AddressInput] Finding closest stop for school ${selectedSchoolId} among ${routes.length} routes`);

    const result = await findClosestStop(homeAddress, routes);

    if (result) {
      const { route, stop, stopNumber, distance } = result;
      console.log(`[AddressInput] Found closest stop: ${stop.address} at ${formatDistance(distance, true)}`);
      
      const urlState = parseUrlPath(location.pathname, '');
      const stopMatch = stop.id.match(/stop-(\d+)/);
      const stopNumberStr = stopMatch ? stopMatch[1] : stop.id;
      
      let finalStopId = `${route.name}-${stopNumberStr}`;
      if (route.name.endsWith('-upcoming')) {
        const baseName = route.name.replace('-upcoming', '');
        finalStopId = `${baseName}-${stopNumberStr}-upcoming`;
      }

      // Update URL with stop and home focus
      const newState = {
        ...urlState,
        show: 'routes' as const,
        direction: (route.direction?.toLowerCase() || 'morning') as any,
        routeNames: [route.name],
        stopId: finalStopId,
        focus: 'my-stop'
      };

      navigate(buildUrlPath('', newState));
      
      analyticsService.trackAction('find_my_stop', {
        schoolId: selectedSchoolId,
        distance,
        stopAddress: stop.address
      });
    } else {
      console.warn('[AddressInput] No stops with coordinates found in current routes');
    }
  };

  // Extract street name from full address (e.g., "123 Main St" from "123 Main St, Portland, OR")
  const getDisplayAddress = (address: string): string => {
    if (!address) return address;
    
    // Extract street part (everything before the first comma)
    const streetPart = address.split(',')[0].trim();
    return formatStreetName(streetPart);
  };

  // Debounced autocomplete search with request cancellation
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Progressive debounce: shorter delay for longer queries
    const debounceDelay = query.length > 5 ? 150 : 200;

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await autocompleteAddress(query, 'Portland', 'OR', abortController.signal);
        
        // Only update if this request wasn't cancelled
        if (!abortController.signal.aborted) {
          setSuggestions(result.suggestions || []);
          setShowSuggestions(true);
        }
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
          return;
        }
        console.error('[AddressInput] Autocomplete error:', error);
        if (!abortController.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
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

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = async (suggestion: AutocompleteSuggestion) => {
    analyticsService.trackAddressSearch('explorer', suggestion.address);
    // If coordinates are missing, geocode the address
    if (!suggestion.coordinates) {
      try {
        setIsLoading(true);
        const geocodeResult = await geocodeAddress(suggestion.address);
        if (geocodeResult.coordinates) {
          setHomeAddress({
            address: suggestion.address,
            coordinates: geocodeResult.coordinates,
          });
        } else {
          console.error('[AddressInput] Failed to geocode selected address');
          setHomeAddress({
            address: suggestion.address,
            coordinates: [0, 0], // Fallback
          });
        }
      } catch (error) {
        console.error('[AddressInput] Geocoding error:', error);
        setHomeAddress({
          address: suggestion.address,
          coordinates: [0, 0], // Fallback
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      setHomeAddress({
        address: suggestion.address,
        coordinates: suggestion.coordinates,
      });
    }
    
    // Explicitly trigger zoom when an address is selected
    const urlState = parseUrlPath(location.pathname, '');
    const newState = {
      ...urlState,
      focus: 'home'
    };
    navigate(buildUrlPath('', newState));
    
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
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
      position: 'absolute',
      top: '1.2rem',
      left: '1.25rem',
      right: '1.25rem',
      zIndex: 1000,
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
    }}>
      <div style={{ 
        flex: 1,
        padding: '0 0.75rem 0 1.25rem',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)',
        borderRadius: '9999px',
        boxShadow: '0 4px 12px var(--shadow-large)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
      }}>
        {homeAddress ? (
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
          }}>
            <i className="fas fa-house" style={{ color: 'var(--text-primary)', fontSize: '12px', flexShrink: 0 }}></i>
            <div 
              onClick={() => {
                console.log('[AddressInput] Clicked address to zoom:', homeAddress.address);
                const urlState = parseUrlPath(location.pathname, '');
                const newState = {
                  ...urlState,
                  focus: 'home'
                };
                navigate(buildUrlPath('', newState));
              }}
              style={{ 
                fontSize: '12px', 
                fontWeight: '500', 
                flex: 1, 
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationColor: 'transparent',
                transition: 'text-decoration-color 0.2s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecorationColor = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecorationColor = 'transparent';
              }}
              title="Click to zoom to address on map"
            >
              {getDisplayAddress(homeAddress.address)}
            </div>
            
            <button
              onClick={clearHomeAddress}
              style={{
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                lineHeight: '1',
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                transition: 'background-color 0.2s ease, color 0.2s ease, borderRadius 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderRadius = '50%';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
                e.currentTarget.style.borderRadius = '4px';
              }}
            aria-label="Clear address"
          >
            <XIcon />
          </button>
        </div>
        ) : (
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            height: '100%',
          }}>
            <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
              <i 
                className="fas fa-house" 
                style={{ 
                  position: 'absolute',
                  left: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              ></i>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder="Enter your address..."
                style={{
                  width: '100%',
                  height: '100%',
                padding: '0 0.5rem 0 1.5rem',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '12px',
                  boxSizing: 'border-box',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease',
                }}
              />
            {isLoading && (
              <div
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                }}
              >
                Searching...
              </div>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px var(--shadow-hover)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  transition: 'background-color 0.3s ease, border-color 0.3s ease',
                }}
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      padding: '0.75rem',
                      cursor: 'pointer',
                      borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      backgroundColor: highlightedIndex === index ? 'rgba(78, 205, 196, 0.2)' : 'var(--bg-primary)',
                      transition: 'background-color 0.2s ease',
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

      {homeAddress && selectedSchoolId && routes.length > 0 && (
        <button
          onClick={handleFindClosestStop}
          className="find-my-stop-btn"
          style={{
            padding: '0 1.25rem',
            height: '40px',
            backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 'normal',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px var(--shadow-large)',
          transition: 'all 0.2s ease',
        }}
        title="Find the closest bus stop to your address"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 6px 16px var(--shadow-large)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isDarkMode ? '#3A3A3A' : 'var(--bg-primary)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-large)';
        }}
      >
        <MapPinIcon style={{ marginRight: '0.5rem', flexShrink: 0 }} />
        <span>Find My Stop</span>
      </button>
    )}
    </div>
  );
}

