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
import { useUrlState } from '../hooks/useUrlState';
import { useLocation } from 'react-router-dom';

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
  
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '';
  const {
    schoolId: selectedSchoolId,
    directionFilter,
    selectStop,
    setDirectionFilter,
    setActiveTab,
  } = useUrlState({ basePath });

  const {
    lookupAddress,
    setLookupAddress,
    clearLookupAddress,
    routes,
    setMapIntent
  } = useStore();
  
  const { isDarkMode } = useDarkMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15)
  );

  const getDisplayAddress = (address: string): string => {
    if (!address) return address;
    const streetPart = address.split(',')[0].trim();
    return formatStreetName(streetPart);
  };

  const handleFindClosestStop = async () => {
    if (!lookupAddress || !routes || routes.length === 0) return;

    // Context-Aware Search: Pass the current filter to findClosestStop
    let result = await findClosestStop(lookupAddress, routes, directionFilter);

    // Fallback: If no stop in current direction, search everything
    if (!result && directionFilter !== 'Both') {
      result = await findClosestStop(lookupAddress, routes, 'Both');
    }

    if (result) {
      const { route, stop, distance } = result;

      // Elegant School-as-Closest-Stop handling
      if (stop.isSchoolStop) {
        alert(`The school is closer than any bus stop!`);
        return;
      }

      // Update direction, tab, and stop in ONE call to avoid URL race conditions
      selectStop(route.name, stop.id, { 
        doubleFit: true,
        direction: (route.direction as any) || directionFilter,
        show: 'routes',
        soleRoute: true
      });

      analyticsService.trackAction('find_my_stop_admin', {
        schoolId: selectedSchoolId,
        distance
      });
    }
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
        const result = await autocompleteAddress(
          query, 'Portland', 'OR', abortController.signal, sessionTokenRef.current
        );

        if (!abortController.signal.aborted) {
          setSuggestions(result.suggestions || []);
          setShowSuggestions(true);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('[AddressLookup] Autocomplete error:', error);
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
    analyticsService.trackAddressSearch('admin', suggestion.address);
    if (!suggestion.coordinates) {
      try {
        setIsLoading(true);
        const geocodeResult = await geocodeAddress(suggestion.address);
        if (geocodeResult.coordinates) {
          const addressData = { address: suggestion.address, coordinates: geocodeResult.coordinates };
          setLookupAddress(addressData);
          onAddressSelect(suggestion.address, geocodeResult.coordinates);
        } else {
          const addressData = { address: suggestion.address, coordinates: [0, 0] as [number, number] };
          setLookupAddress(addressData);
          onAddressSelect(suggestion.address, [0, 0]);
        }
      } catch (error) {
        console.error('[AddressLookup] Geocoding error:', error);
        const addressData = { address: suggestion.address, coordinates: [0, 0] as [number, number] };
        setLookupAddress(addressData);
        onAddressSelect(suggestion.address, [0, 0]);
      } finally {
        setIsLoading(false);
      }
    } else {
      const addressData = { address: suggestion.address, coordinates: suggestion.coordinates };
      setLookupAddress(addressData);
      onAddressSelect(suggestion.address, suggestion.coordinates);
    }

    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    sessionTokenRef.current = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15);
  };

  useEffect(() => {
    if (lookupAddress && onAddressSelect) {
      onAddressSelect(lookupAddress.address, lookupAddress.coordinates);
    }
  }, []);

  return (
    <div style={{ position: 'absolute', top: '1.2rem', left: '1.25rem', right: '1.25rem', zIndex: 1000, display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <div style={{ flex: 1, padding: '0 0.75rem 0 1.25rem', height: '40px', display: 'flex', alignItems: 'center', backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)', borderRadius: '9999px', boxShadow: '0 4px 12px var(--shadow-large)', transition: 'background-color 0.3s ease, box-shadow 0.3s ease' }}>
        {lookupAddress ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
            <i className="fas fa-map-marker-alt" style={{ color: 'var(--text-primary)', fontSize: '12px', flexShrink: 0 }}></i>
            <div style={{ fontSize: '14px', fontWeight: '500', flex: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getDisplayAddress(lookupAddress.address)}
            </div>
            <button
              onClick={clearLookupAddress}
              style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', color: 'var(--text-tertiary)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0, flexShrink: 0 }}
            >
              <XIcon />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', height: '100%' }}>
            <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Search for an address..."
                style={{ width: '100%', height: '100%', padding: '0 0.5rem', border: 'none', borderRadius: '9999px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: 'transparent', color: 'var(--text-primary)', outline: 'none' }}
              />
              {isLoading && <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-tertiary)' }}>Searching...</div>}
              {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: '0 2px 8px var(--shadow-hover)', maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                  {suggestions.map((suggestion, index) => (
                    <div key={index} onClick={() => handleSelectSuggestion(suggestion)} style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none', fontSize: '14px', color: 'var(--text-primary)' }}>
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
          style={{ padding: '0 1.25rem', height: '40px', backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)', color: 'var(--text-primary)', border: 'none', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px var(--shadow-large)' }}
        >
          <MapPinIcon style={{ marginRight: '0.5rem', flexShrink: 0 }} />
          <span>Find My Stop</span>
        </button>
      )}
    </div>
  );
}
