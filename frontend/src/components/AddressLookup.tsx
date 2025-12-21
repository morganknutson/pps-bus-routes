import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { autocompleteAddress, geocodeAddress } from '../services/api';
import { analyticsService } from '../services/analytics';
import { calculateDistance } from '../utils/coordinates';
import { formatStreetName } from '../utils/formatAddress';
import { Route, Stop } from '../types';

interface AutocompleteSuggestion {
  displayName: string;
  address: string;
  coordinates: [number, number] | null;
}

interface AddressLookupProps {
  onAddressSelect: (address: string, coordinates: [number, number]) => void;
}

export function AddressLookup({ onAddressSelect }: AddressLookupProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { 
    lookupAddress, 
    setLookupAddress, 
    clearLookupAddress,
    selectedSchoolId,
    routes,
    selectStop,
    setDirectionFilter
  } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Extract street name from full address (e.g., "123 Main St" from "123 Main St, Portland, OR")
  const getDisplayAddress = (address: string): string => {
    if (!address) return address;
    
    // Extract street part (everything before the first comma)
    const streetPart = address.split(',')[0].trim();
    return formatStreetName(streetPart);
  };

  const handleFindClosestStop = () => {
    if (!lookupAddress || !routes || routes.length === 0) return;

    let closestStop: Stop | null = null;
    let closestRoute: Route | null = null;
    let minDistance = Infinity;
    let closestStopNumber = -1;

    routes.forEach(route => {
      route.stops.forEach((stop, index) => {
        if (stop.coordinates) {
          const distance = calculateDistance(lookupAddress.coordinates, stop.coordinates);
          if (distance < minDistance) {
            minDistance = distance;
            closestStop = stop;
            closestRoute = route;
            closestStopNumber = index + 1;
          }
        }
      });
    });

    if (closestStop && closestRoute) {
      const route = closestRoute as Route;
      
      // Update direction filter if the route has a specific direction
      if (route.direction) {
        setDirectionFilter(route.direction);
      }
      
      selectStop(route, closestStop, closestStopNumber);
      
      // Automatically switch to routes tab to show the found stop
      window.dispatchEvent(new CustomEvent('change-tab', { detail: 'routes' }));
      
      analyticsService.trackAction('find_my_stop_admin', {
        schoolId: selectedSchoolId,
        distance: minDistance
      });
    }
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
        console.error('[AddressLookup] Autocomplete error:', error);
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
    analyticsService.trackAddressSearch('admin', suggestion.address);
    // If coordinates are missing, geocode the address
    if (!suggestion.coordinates) {
      try {
        setIsLoading(true);
        const geocodeResult = await geocodeAddress(suggestion.address);
        if (geocodeResult.coordinates) {
          const addressData = {
            address: suggestion.address,
            coordinates: geocodeResult.coordinates,
          };
          setLookupAddress(addressData);
          onAddressSelect(suggestion.address, geocodeResult.coordinates);
        } else {
          console.error('[AddressLookup] Failed to geocode selected address');
          const addressData = {
            address: suggestion.address,
            coordinates: [0, 0] as [number, number], // Fallback
          };
          setLookupAddress(addressData);
          onAddressSelect(suggestion.address, [0, 0]); // Fallback
        }
      } catch (error) {
        console.error('[AddressLookup] Geocoding error:', error);
        const addressData = {
          address: suggestion.address,
          coordinates: [0, 0] as [number, number], // Fallback
        };
        setLookupAddress(addressData);
        onAddressSelect(suggestion.address, [0, 0]); // Fallback
      } finally {
        setIsLoading(false);
      }
    } else {
      const addressData = {
        address: suggestion.address,
        coordinates: suggestion.coordinates,
      };
      setLookupAddress(addressData);
      onAddressSelect(suggestion.address, suggestion.coordinates);
    }
    
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Call onAddressSelect when lookupAddress is loaded from store (e.g., from localStorage)
  // Note: This is now optional since MapView reads directly from store
  useEffect(() => {
    if (lookupAddress && onAddressSelect) {
      onAddressSelect(lookupAddress.address, lookupAddress.coordinates);
    }
  }, []); // Only on mount - when component first loads with saved address

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
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '9999px',
        boxShadow: '0 4px 12px var(--shadow-large)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
      }}>
        {lookupAddress ? (
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
          }}>
            <i className="fas fa-map-marker-alt" style={{ color: 'var(--text-primary)', fontSize: '12px', flexShrink: 0 }}></i>
            <div style={{ fontSize: '14px', fontWeight: '500', flex: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getDisplayAddress(lookupAddress.address)}
            </div>
            <button
              onClick={() => {
                clearLookupAddress();
              }}
              style={{
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                lineHeight: '1',
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                transition: 'background-color 0.2s ease, color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ff6b6b';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            aria-label="Clear address"
          >
            <i className="fas fa-times" style={{ fontSize: '14px' }}></i>
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
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="Search for an address..."
              style={{
                width: '100%',
                height: '100%',
              padding: '0 0.5rem',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '14px',
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
                    style={{
                      padding: '0.75rem',
                      cursor: 'pointer',
                      borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
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

      {lookupAddress && selectedSchoolId && routes.length > 0 && (
        <button
          onClick={handleFindClosestStop}
          style={{
            padding: '0 1.25rem',
            height: '40px',
            backgroundColor: 'var(--bg-primary)',
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
          e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-large)';
        }}
      >
        <svg 
          width="9" 
          height="12" 
          viewBox="0 0 9 12" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ marginRight: '0.5rem', flexShrink: 0 }}
        >
          <path d="M4.5 0C6.98528 3.22128e-08 9 2.01472 9 4.5C9 6.98526 7.0714 10.2856 4.5 11.5713C1.9286 10.2856 3.08342e-08 6.98526 0 4.5C0 2.01472 2.01472 0 4.5 0ZM4.5 2.57129C3.43488 2.57129 2.57129 3.43488 2.57129 4.5C2.57129 5.56512 3.43488 6.42871 4.5 6.42871C5.56512 6.42871 6.42871 5.56512 6.42871 4.5C6.42871 3.43488 5.56512 2.57129 4.5 2.57129Z" fill="currentColor"/>
        </svg>
        <span>Find My Stop</span>
      </button>
    )}
    </div>
  );
}