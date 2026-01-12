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
import { useUrlState } from '../hooks/useUrlState';

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
    directionFilter,
    selectStop,
    setDirectionFilter,
    setActiveTab,
    setFocus,
  } = useUrlState({ basePath });

  const {
    setHomeAddress,
    homeAddress,
    clearHomeAddress,
    routes,
    schools,
    setShowSchoolClosestModal,
  } = useStore();
  
  const isMobile = useIsMobile();
  const { isDarkMode } = useDarkMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
        schoolId: selectedSchoolId,
        distance,
        stopAddress: stop.address
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
    <div style={{ position: 'absolute', top: '1.2rem', left: '1.25rem', right: '1.25rem', zIndex: 1000, display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <div style={{ flex: 1, padding: '0 0.75rem 0 1.25rem', height: '40px', display: 'flex', alignItems: 'center', backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)', borderRadius: '9999px', boxShadow: '0 4px 12px var(--shadow-large)', transition: 'background-color 0.3s ease, box-shadow 0.3s ease' }}>
        {homeAddress ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
            <i className="fas fa-house" style={{ color: 'var(--text-primary)', fontSize: '12px', flexShrink: 0 }}></i>
            <div
              onClick={() => setFocus('home')}
              style={{ fontSize: '12px', fontWeight: '500', flex: 1, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.2s ease', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = 'transparent'; }}
              title="Click to zoom to address on map"
            >
              {getDisplayAddress(homeAddress.address)}
            </div>
            <button
              onClick={clearHomeAddress}
              style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', color: 'var(--text-tertiary)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0, flexShrink: 0 }}
            >
              <XIcon />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', height: '100%' }}>
            <div style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
              <i className="fas fa-house" style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-tertiary)', pointerEvents: 'none', zIndex: 1 }}></i>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Enter your address..."
                style={{ width: '100%', height: '100%', padding: '0 0.5rem 0 1.5rem', border: 'none', borderRadius: '9999px', fontSize: '12px', boxSizing: 'border-box', backgroundColor: 'transparent', color: 'var(--text-primary)', outline: 'none' }}
              />
              {isLoading && <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-tertiary)' }}>Searching...</div>}
              {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: '0 2px 8px var(--shadow-hover)', maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none', fontSize: '12px', color: 'var(--text-primary)', backgroundColor: highlightedIndex === index ? 'rgba(78, 205, 196, 0.2)' : 'var(--bg-primary)' }}
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
          style={{ padding: '0 1.25rem', height: '40px', backgroundColor: isDarkMode ? '#3A3A3A' : 'var(--bg-primary)', color: 'var(--text-primary)', border: 'none', borderRadius: '9999px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px var(--shadow-large)' }}
        >
          <MapPinIcon style={{ marginRight: '0.5rem', flexShrink: 0 }} />
          <span>Find My Stop</span>
        </button>
      )}
    </div>
  );
}
