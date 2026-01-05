import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { autocompleteAddress, geocodeAddress } from '../services/api';
import { useDarkMode } from '../hooks/useDarkMode';
import { analyticsService } from '../services/analytics';
import { findClosestStop } from '../utils/findClosestStop';
import { formatStreetName } from '../utils/formatAddress';
import { Route, Stop } from '../types';
import { MapPinIcon } from './MapPinIcon';
import { XIcon } from './XIcon';

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
    setDirectionFilter,
    fetchAssignedSchools
  } = useStore();
  const { isDarkMode } = useDarkMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  // Extract street name from full address (e.g., "123 Main St" from "123 Main St, Portland, OR")
  const getDisplayAddress = (address: string): string => {
    if (!address) return address;

    // Extract street part (everything before the first comma)
    const streetPart = address.split(',')[0].trim();
    return formatStreetName(streetPart);
  };

  const handleFindClosestStop = async () => {
    if (!lookupAddress || !routes || routes.length === 0) return;

    const result = await findClosestStop(lookupAddress, routes);

    if (result) {
      const { route, stop, stopNumber, distance } = result;

      // Update direction filter if the route has a specific direction
      if (route.direction) {
        setDirectionFilter(route.direction);
      }

      selectStop(route, stop, stopNumber);

      // Explicitly set the Map Intent to DOUBLE_FIT
      useStore.getState().setMapIntent({ type: 'DOUBLE_FIT' });

      // signal to MapView to perform a "double-fit" (Home + Stop)
      // This is now redundant since we use setMapIntent, but kept for compatibility
      window.dispatchEvent(new CustomEvent('find-my-stop-executed'));

      // Automatically switch to routes tab to show the found stop
      window.dispatchEvent(new CustomEvent('change-tab', { detail: 'routes' }));

      analyticsService.trackAction('find_my_stop_admin', {
        schoolId: selectedSchoolId,
        distance
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
        const result = await autocompleteAddress(
          query,
          'Portland',
          'OR',
          abortController.signal,
          sessionTokenRef.current // Pass current session token
        );

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
          fetchAssignedSchools(geocodeResult.coordinates[1], geocodeResult.coordinates[0]);
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
      fetchAssignedSchools(suggestion.coordinates[1], suggestion.coordinates[0]);
    }

    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    // Reset session token for next search
    sessionTokenRef.current = crypto.randomUUID();
  };

  // Call onAddressSelect when lookupAddress is loaded from store (e.g., from localStorage)
  // Note: This is now optional since MapView reads directly from store
  useEffect(() => {
    if (lookupAddress && onAddressSelect) {
      onAddressSelect(lookupAddress.address, lookupAddress.coordinates);
      fetchAssignedSchools(lookupAddress.coordinates[1], lookupAddress.coordinates[0]);
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
        backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)',
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