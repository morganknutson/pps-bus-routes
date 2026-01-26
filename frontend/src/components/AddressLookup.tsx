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
import { useIsMobile } from '../hooks/useMediaQuery';

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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

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
    setMapIntent,
    setIsFindMyStopVisible,
  } = useStore();

  const { isDarkMode } = useDarkMode();
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15)
  );

  const shouldShowButton = lookupAddress && selectedSchoolId && routes.length > 0;

  useEffect(() => {
    setIsFindMyStopVisible(!!shouldShowButton && isMobile);
    return () => setIsFindMyStopVisible(false);
  }, [shouldShowButton, isMobile, setIsFindMyStopVisible]);

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
      position: 'absolute',
      top: isMobile ? '1.375rem' : '1.2rem',
      left: isMobile ? '0.75rem' : '1.25rem',
      right: isMobile ? '0.75rem' : '1.25rem',
      zIndex: 1000,
      display: 'flex',
      gap: isMobile ? '0.5rem' : '0.75rem',
      alignItems: 'center'
    }}>
      <div style={{
        flex: 1,
        padding: isMobile ? '0 1.25rem' : '0 0.75rem 0 1.25rem',
        height: isMobile ? '56px' : '40px',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)',
        borderRadius: '9999px',
        boxShadow: 'var(--drop-shadow-floating-primary)',
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
      }}>
        {lookupAddress ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
            <i className="fas fa-map-marker-alt" style={{ color: 'var(--text-primary)', fontSize: isMobile ? '16px' : '12px', flexShrink: 0 }}></i>
            <div style={{ fontSize: isMobile ? '16px' : '14px', fontWeight: '500', flex: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', height: '100%' }}>
            <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-map-marker-alt" style={{ position: 'absolute', left: isMobile ? '0' : '4px', top: '50%', transform: 'translateY(-50%)', fontSize: isMobile ? '16px' : '12px', color: 'var(--text-tertiary)', pointerEvents: 'none', zIndex: 1 }}></i>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Search for an address..."
                style={{ width: '100%', height: '100%', padding: isMobile ? '0 0.5rem 0 1.8125rem' : '0 0.5rem 0 1.5rem', border: 'none', borderRadius: '9999px', fontSize: isMobile ? '16px' : '14px', boxSizing: 'border-box', backgroundColor: 'transparent', color: 'var(--text-primary)', outline: 'none' }}
              />
              {isLoading && <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-tertiary)' }}>Searching...</div>}
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
                        fontSize: isMobile ? '16px' : '14px',
                        color: highlightedIndex === index ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        backgroundColor: highlightedIndex === index ? (isDarkMode ? 'rgba(255,255,255, .1)' : '#f8f8f8ec') : 'var(--bg-primary)'
                      }}>
                      {suggestion.displayName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {shouldShowButton && (
        <button
          onClick={handleFindClosestStop}
          title="Find My Stop"
          style={isMobile ? {
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60px',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: 'none',
            borderTop: '1px solid var(--border-color-primary)',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            boxShadow: 'var(--drop-shadow-primary)',
            zIndex: 800,
            transition: 'all 0.2s ease',
          } : {
            padding: '0 1.5rem',
            height: '40px',
            fontWeight: '600',
            backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'var(--drop-shadow-floating-primary)',
            transition: 'all 0.2s ease',
            gap: '0.75rem',
          }}
        >
          <MapPinIcon filled style={{ width: isMobile ? 14 : 10, height: isMobile ? 18 : 13, flexShrink: 0 }} />
          <span>Find My Stop</span>
        </button>
      )}
    </div>
  );
}
