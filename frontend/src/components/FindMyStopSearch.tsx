import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { analyticsService } from '../services/analytics';
import { autocompleteAddress, geocodeAddress, reverseGeocode } from '../services/api';
import { loadLocalRoutes } from '../services/localRoutes';
import { findClosestStop } from '../utils/findClosestStop';
import { formatDistance, calculateDistance } from '../utils/distance';
import { buildUrlPath, UrlState } from '../services/urlState';
import { School, HomeAddress } from '../types';
import { useDarkMode } from '../hooks/useDarkMode';
import { MapPinIcon } from './MapPinIcon';
import { getSchoolDisplayName, getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { XIcon } from './XIcon';
import { LocationArrowIcon } from './LocationArrowIcon';
import { useIsMobile } from '../hooks/useMediaQuery';
import LogoSpinner from './LogoSpinner';
import { Modal } from './Modal';
import { Button } from './Button';

interface AutocompleteSuggestion {
  displayName: string;
  address: string;
  coordinates: [number, number];
}

interface FindMyStopSearchProps {
  /** Analytics source/page identifier, e.g. 'homepage' or 'school_directory' */
  source: string;
  /** 'stacked' = vertical (homepage), 'inline' = fields and button in one row on desktop */
  layout?: 'stacked' | 'inline';
  /** Notifies the parent when the locally-selected school changes */
  onSchoolChange?: (school: School | null) => void;
}

export function FindMyStopSearch({ source, layout = 'stacked', onSchoolChange }: FindMyStopSearchProps) {
  const navigate = useNavigate();
  const { isDarkMode } = useDarkMode();
  const isMobile = useIsMobile();

  const setHomeAddress = useStore(state => state.setHomeAddress);
  const setRoutes = useStore(state => state.setRoutes);
  const setLoading = useStore(state => state.setLoading);
  const schools = useStore(state => state.schools);
  const setSchools = useStore(state => state.setSchools);
  const assignedSchools = useStore(state => state.assignedSchools);
  const homeAddress = useStore(state => state.homeAddress);
  const setShowSchoolClosestModal = useStore(state => state.setShowSchoolClosestModal);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<HomeAddress | null>(null);
  const [highlightedAddressIndex, setHighlightedAddressIndex] = useState(-1);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const addressSuggestionsRef = useRef<HTMLDivElement>(null);
  const addressAbortControllerRef = useRef<AbortController | null>(null);

  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolSuggestions, setSchoolSuggestions] = useState<School[]>([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [isSchoolFocused, setIsSchoolFocused] = useState(false);
  const [selectedSchoolLocal, setSelectedSchoolLocal] = useState<School | null>(null);
  const [highlightedSchoolIndex, setHighlightedSchoolIndex] = useState(-1);
  const schoolInputRef = useRef<HTMLInputElement>(null);
  const schoolSuggestionsRef = useRef<HTMLDivElement>(null);

  const [isFinding, setIsFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [showOutsidePortlandModal, setShowOutsidePortlandModal] = useState(false);
  const [noRoutesTooltipIndex, setNoRoutesTooltipIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);

  // Helper to check bounds (matches backend logic)
  const isWithinPortlandBounds = (coordinates: [number, number]) => {
    const [lng, lat] = coordinates;
    // Portland bounds with reasonable buffer
    const PORTLAND_LAT_MIN = 45.3;
    const PORTLAND_LAT_MAX = 45.8;
    const PORTLAND_LNG_MIN = -123.0;
    const PORTLAND_LNG_MAX = -122.3;

    return (
      lat >= PORTLAND_LAT_MIN &&
      lat <= PORTLAND_LAT_MAX &&
      lng >= PORTLAND_LNG_MIN &&
      lng <= PORTLAND_LNG_MAX
    );
  };

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      console.warn('[FindMyStopSearch] Geolocation not supported');
      return;
    }

    setIsGeolocating(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;
      console.log(`[FindMyStopSearch] Got location: ${latitude}, ${longitude}`);

      const result = await reverseGeocode(latitude, longitude);

      if (result.fullAddress) {
        // Extract just the street address part (before the city)
        const addressParts = result.fullAddress.split(',');
        const streetAddress = addressParts.slice(0, 2).join(',').trim();

        const address = {
          address: streetAddress,
          coordinates: [longitude, latitude] as [number, number]
        };
        setSelectedAddress(address);
        setHomeAddress(address);
        setAddressQuery('');
        analyticsService.trackAction('location_autofill', { page: source, success: true });
      } else {
        console.warn('[FindMyStopSearch] No address found for location');
        analyticsService.trackAction('location_autofill', { page: source, success: false, reason: 'no_address' });
      }
    } catch (error: any) {
      console.error('[FindMyStopSearch] Geolocation error:', error);
      analyticsService.trackAction('location_autofill', { page: source, success: false, reason: error.code || 'error' });
    } finally {
      setIsGeolocating(false);
    }
  };

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          setSchools(data.schools || []);
        }
      } catch (error) {
        console.error('[FindMyStopSearch] Error loading schools:', error);
      }
    };
    loadSchools();
  }, [setSchools]);

  useEffect(() => {
    if (homeAddress) setSelectedAddress(homeAddress);
  }, [homeAddress]);

  useEffect(() => {
    // Attempt to restore school selection from localStorage
    if (schools.length > 0) {
      const savedId = localStorage.getItem('selectedSchoolId');
      if (savedId) {
        const school = schools.find(s => s.id === savedId);
        if (school) setSelectedSchoolLocal(school);
      }
    }
  }, [schools]);

  useEffect(() => {
    onSchoolChange?.(selectedSchoolLocal);
  }, [selectedSchoolLocal, onSchoolChange]);

  useEffect(() => {
    if (addressQuery.trim().length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setAddressLoading(false);
      return;
    }

    if (addressAbortControllerRef.current) addressAbortControllerRef.current.abort();
    const abortController = new AbortController();
    addressAbortControllerRef.current = abortController;

    const timeoutId = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const result = await autocompleteAddress(addressQuery, 'Portland', 'OR', abortController.signal);
        if (!abortController.signal.aborted) {
          setAddressSuggestions(result.suggestions || []);
          setShowAddressSuggestions(true);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('[FindMyStopSearch] Address autocomplete error:', error);
        if (!abortController.signal.aborted) setAddressSuggestions([]);
      } finally {
        if (!abortController.signal.aborted) setAddressLoading(false);
      }
    }, addressQuery.length > 5 ? 150 : 200);

    return () => {
      clearTimeout(timeoutId);
      if (addressAbortControllerRef.current) addressAbortControllerRef.current.abort();
    };
  }, [addressQuery]);

  useEffect(() => {
    // Build list of assigned school names from arrays (for substring matching)
    const assignedNamesList: string[] = [];
    if (assignedSchools) {
      Object.values(assignedSchools).forEach(schoolArray => {
        if (Array.isArray(schoolArray)) {
          schoolArray.forEach(school => {
            if (school && school.name) assignedNamesList.push(school.name.toLowerCase());
          });
        }
      });
    }

    // Helper function for substring matching (handles "Tubman" vs "Harriet Tubman", etc.)
    const isSchoolAssigned = (schoolName: string): boolean => {
      const schoolNameLower = schoolName.toLowerCase();
      return assignedNamesList.some(assignedName =>
        schoolNameLower === assignedName ||
        schoolNameLower.includes(assignedName) ||
        assignedName.includes(schoolNameLower)
      );
    };

    const getScore = (school: School) => {
      let score = 0;
      if (selectedAddress && selectedAddress.coordinates && school.coordinates) {
        score += calculateDistance(selectedAddress.coordinates, school.coordinates);
      } else {
        score += 999999; // Schools without coordinates go to the end
      }
      return score;
    };

    // Always find assigned schools from the full list (don't filter by coordinates)
    const assignedSchoolsList = schools.filter(school => isSchoolAssigned(school.name));

    if (schoolQuery.trim()) {
      const query = schoolQuery.toLowerCase();
      const filtered = schools.filter(school => school.name.toLowerCase().includes(query));
      // When searching, put assigned schools first, then sort rest by distance
      const sorted = filtered
        .map(school => ({
          school,
          isAssigned: isSchoolAssigned(school.name),
          score: getScore(school)
        }))
        .sort((a, b) => {
          if (a.isAssigned && !b.isAssigned) return -1;
          if (!a.isAssigned && b.isAssigned) return 1;
          return a.score - b.score;
        })
        .map(item => item.school);
      // Show all matching schools (no limit) so users can always find their school
      setSchoolSuggestions(sorted);
      setShowSchoolSuggestions(true);
    } else if (isSchoolFocused) {
      // Get non-assigned schools with coordinates, sorted by distance
      const otherSchools = schools
        .filter(school => school.coordinates && !isSchoolAssigned(school.name))
        .map(school => ({ school, score: getScore(school) }))
        .sort((a, b) => a.score - b.score)
        .map(item => item.school);

      // Show ALL assigned schools first, then ALL other schools sorted by distance
      // No limit - let users scroll through all schools
      const combined = [...assignedSchoolsList, ...otherSchools];

      setSchoolSuggestions(combined);
      setShowSchoolSuggestions(true);
    } else {
      setSchoolSuggestions([]);
      setShowSchoolSuggestions(false);
      setNoRoutesTooltipIndex(null);
      setTooltipPosition(null);
    }
  }, [schoolQuery, schools, selectedAddress, isSchoolFocused, assignedSchools]);

  useEffect(() => { setHighlightedAddressIndex(-1); }, [addressSuggestions]);
  useEffect(() => { setHighlightedSchoolIndex(-1); }, [schoolSuggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressSuggestionsRef.current && !addressSuggestionsRef.current.contains(event.target as Node) &&
        addressInputRef.current && !addressInputRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false);
      }
      if (schoolSuggestionsRef.current && !schoolSuggestionsRef.current.contains(event.target as Node) &&
        schoolInputRef.current && !schoolInputRef.current.contains(event.target as Node)) {
        setShowSchoolSuggestions(false);
        setIsSchoolFocused(false);
        setNoRoutesTooltipIndex(null);
        setTooltipPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAddress = async (suggestion: AutocompleteSuggestion) => {
    analyticsService.trackAddressSearch(source, suggestion.address);
    try {
      setAddressLoading(true);

      // First try standard geocode (biased to Portland)
      let geocodeResult = await geocodeAddress(suggestion.address);

      // If that fails, and address looks complete (has commas), try without Portland bias
      // This handles addresses outside Portland (e.g. "San Francisco, CA")
      if (!geocodeResult.coordinates && suggestion.address.includes(',')) {
        console.log('[FindMyStopSearch] Standard geocode failed, trying without Portland bias...');
        // Pass empty strings to override defaults and avoid appending "Portland, OR"
        geocodeResult = await geocodeAddress(suggestion.address, '', '');
      }

      if (geocodeResult.coordinates) {
        const address = { address: suggestion.displayName || suggestion.address, coordinates: geocodeResult.coordinates };
        setSelectedAddress(address);
        setHomeAddress(address);
      } else {
        const address = { address: suggestion.address, coordinates: suggestion.coordinates };
        setSelectedAddress(address);
        setHomeAddress(address);
      }
    } catch (error) {
      console.error('[FindMyStopSearch] Geocoding error:', error);

      // Try one more time without bias if error occurred
      try {
         if (suggestion.address.includes(',')) {
            const retryResult = await geocodeAddress(suggestion.address, '', '');
            if (retryResult.coordinates) {
                const address = { address: suggestion.displayName || suggestion.address, coordinates: retryResult.coordinates };
                setSelectedAddress(address);
                setHomeAddress(address);
                return;
            }
         }
      } catch (e) { /* ignore retry error */ }

      const address = { address: suggestion.address, coordinates: suggestion.coordinates };
      setSelectedAddress(address);
      setHomeAddress(address);
    } finally {
      setAddressLoading(false);
    }
    setAddressQuery('');
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setHighlightedAddressIndex(-1);
  };

  const handleSelectSchool = (school: School) => {
    analyticsService.trackSchoolSelect(school.name, source);
    setSelectedSchoolLocal(school);
    localStorage.setItem('selectedSchoolId', school.id);
    setSchoolQuery('');
    setSchoolSuggestions([]);
    setShowSchoolSuggestions(false);
    setHighlightedSchoolIndex(-1);
    setNoRoutesTooltipIndex(null);
    setTooltipPosition(null);
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAddressSuggestions || addressSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedAddressIndex(prev => (prev + 1) % addressSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedAddressIndex(prev => (prev - 1 + addressSuggestions.length) % addressSuggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedAddressIndex >= 0) {
        handleSelectAddress(addressSuggestions[highlightedAddressIndex]);
      } else if (addressSuggestions.length > 0) {
        handleSelectAddress(addressSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowAddressSuggestions(false);
    }
  };

  const handleSchoolKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSchoolSuggestions || schoolSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSchoolIndex(prev => (prev + 1) % schoolSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSchoolIndex(prev => (prev - 1 + schoolSuggestions.length) % schoolSuggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedSchoolIndex >= 0) {
        handleSelectSchool(schoolSuggestions[highlightedSchoolIndex]);
      } else if (schoolSuggestions.length > 0) {
        handleSelectSchool(schoolSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSchoolSuggestions(false);
      setNoRoutesTooltipIndex(null);
      setTooltipPosition(null);
    }
  };

  const handleFindStop = async () => {
    if (!selectedAddress || !selectedSchoolLocal) {
      setError(!selectedAddress ? 'Please select an address' : 'Please select a school');
      return;
    }

    // Check if we have coordinates at all
    if (!selectedAddress.coordinates) {
      setError('Could not determine the location of this address. Please try a different address.');
      return;
    }

    // Check if address is within Portland bounds
    if (!isWithinPortlandBounds(selectedAddress.coordinates)) {
      setShowOutsidePortlandModal(true);
      return;
    }

    analyticsService.trackEvent('Search', 'find_stop', `${selectedSchoolLocal.name}`);
    setIsFinding(true);
    setError(null);

    try {
      setLoading(true);
      const routes = await loadLocalRoutes(selectedSchoolLocal.id);
      if (routes.length === 0) {
        setError('No routes found for this school');
        setIsFinding(false);
        return;
      }

      const closestStop = await findClosestStop(selectedAddress, routes);
      if (!closestStop) {
        setError('No stops with coordinates found for this school');
        setIsFinding(false);
        return;
      }

      // Elegant School-as-Closest-Stop handling
      if (closestStop.stop.isSchoolStop) {
        analyticsService.trackAction('school_closest_stop', {
          source,
          schoolId: selectedSchoolLocal.id,
          school_name: selectedSchoolLocal.name,
          distance: closestStop.distance,
        });
        setShowSchoolClosestModal(true, {
          schoolName: getSchoolDisplayName(selectedSchoolLocal.name),
          schoolId: selectedSchoolLocal.id
        });
        setIsFinding(false);
        return;
      }

      setHomeAddress(selectedAddress);

      const stopId = closestStop.stop.id;
      const stopMatch = stopId.match(/stop-(\d+)/);
      const stopNumberStr = stopMatch ? stopMatch[1] : stopId;
      const routeName = closestStop.route.name;

      analyticsService.trackAction('find_my_stop', {
        source,
        schoolId: selectedSchoolLocal.id,
        school_name: selectedSchoolLocal.name,
        distance: closestStop.distance,
        route_name: routeName,
        route_direction: closestStop.route.direction,
        stop_id: stopId,
      });

      const urlState: UrlState = {
        show: 'routes',
        schoolId: selectedSchoolLocal.id,
        direction: closestStop.route.direction?.toLowerCase() as any || 'both',
        routeNames: [routeName],
        stopId: routeName.endsWith('-upcoming') ? `${routeName.replace('-upcoming', '')}-${stopNumberStr}-upcoming` : `${routeName}-${stopNumberStr}`,
        focus: 'my-stop'
      };

      navigate(buildUrlPath('', urlState));
    } catch (error: any) {
      console.error('[FindMyStopSearch] Error finding stop:', error);
      setError(error.message || 'Failed to find closest stop');
    } finally {
      setIsFinding(false);
      setLoading(false);
    }
  };

  const textColorSecondary = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  // Inline layout puts both fields and the button on one row (desktop only)
  const isInline = layout === 'inline' && !isMobile;
  const fieldHeight = isMobile ? '56px' : '46px';

  const addressField = selectedAddress ? (
    /* Selected Address Display */
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '.8rem',
      /* CSS: Address Filled State - Field Container */
      padding: isMobile ? '0 1.5rem' : '0.75rem 1rem 0.75rem 1.25rem',
      backgroundColor: 'rgba(0,0,0, .01)',
      borderRadius: '9999px', // Pill shape for selected state
      border: `1px solid ${borderColor}`,
      height: fieldHeight,
      boxSizing: 'border-box'
    }}>
      <i className="fas fa-house" style={{ color: 'var(--text-primary)', fontSize: isMobile ? '14px' : '12px' }}></i>
      <div style={{
        flex: 1,
        /* CSS: Address Filled State - Text Style */
        fontSize: isMobile ? '16px' : '14px',
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {selectedAddress.address}
      </div>
      <button onClick={() => { setSelectedAddress(null); setAddressQuery(''); localStorage.removeItem('homeAddress'); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '18px', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Clear address"><XIcon /></button>
    </div>
  ) : (
    /* Address Search Input */
    <div style={{ position: 'relative' }}>
      <input
        ref={addressInputRef}
        type="text"
        value={addressQuery}
        onChange={(e) => setAddressQuery(e.target.value)}
        onKeyDown={handleAddressKeyDown}
        onFocus={() => { if (addressSuggestions.length > 0) setShowAddressSuggestions(true); }}
        placeholder="Enter your address..."
        className="home-input"
        style={{
          width: '100%',
          /* CSS: Address Empty State - Input Field */
          padding: isMobile ? '0 3rem 0 1.5rem' : '0.75rem 2.5rem 0.75rem 1.5rem',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.15)',
          borderRadius: '9999px',
          fontSize: isMobile ? '16px' : '14px',
          backgroundColor: 'rgba(0,0,0, .06)',
          color: isDarkMode ? '#ffffff' : '#000000',
          boxSizing: 'border-box',
          height: fieldHeight,
          outline: 'none'
        }}
      />
      {/* Location button and loading indicator container */}
      <div style={{ position: 'absolute', right: isMobile ? '14px' : '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {addressLoading && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Searching...</span>}
        <button
          onClick={handleGetLocation}
          disabled={isGeolocating}
          title="Use my location"
          style={{
            background: 'none',
            border: 'none',
            padding: isMobile ? '4px 14px' : '4px 10px',
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
      {/* Autocomplete Suggestions Dropdown */}
      {showAddressSuggestions && addressSuggestions.length > 0 && (
        /* CSS: Address Dropdown Container */
        <div
          ref={addressSuggestionsRef}
          style={{
            position: 'absolute',
            top: '100%', left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: isDarkMode ? 'rgba(10,10,10, 1)' : 'rgba(150,150,150, 1)',
            border: isDarkMode ? '1px solid rgba(10,10,10, 1)' : 'none !important',
            borderRadius: '16px',
            boxShadow: isDarkMode ? '0 10px 38px rgba(0,0,0, .8)' : '0 10px 38px rgba(0,0,0, .4)',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000
          }}>
          {addressSuggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSelectAddress(suggestion)}
              onMouseEnter={() => setHighlightedAddressIndex(index)}
              style={{
                padding: '0.75rem',
                cursor: 'pointer',
                borderBottom: index < addressSuggestions.length - 1 ? (isDarkMode ? '1px solid rgba(10,10,10, .5)' : '1px solid rgba(236, 236, 236, 1)') : 'none',
                fontSize: isMobile ? '16px' : '14px',
                color: highlightedAddressIndex === index ? 'var(--text-primary)' : 'var(--text-tertiary)',
                /* CSS: Address Dropdown Item & Hover State */
                backgroundColor: highlightedAddressIndex === index ? (isDarkMode ? 'rgba(255,255,255, .1)' : '#f8f8f8ec') : 'var(--bg-primary)'
              }}>
              {suggestion.displayName}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const schoolField = selectedSchoolLocal ? (
    /* Selected School Display */
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '.75rem',
      /* CSS: School Filled State - Field Container */
      padding: isMobile ? '0 1.5rem' : '0.75rem 1rem 0.75rem 1.3rem',
      backgroundColor: 'rgba(0,0,0, .01)',
      borderRadius: '9999px', // Pill shape for selected state
      border: `1px solid ${borderColor}`,
      height: fieldHeight,
      boxSizing: 'border-box'
    }}>
      <i className="fas fa-graduation-cap" style={{ color: 'var(--text-primary)', fontSize: isMobile ? '14px' : '12px' }}></i>
      <div style={{
        flex: 1,
        /* CSS: School Filled State - Text Style */
        fontSize: isMobile ? '16px' : '14px',
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {getSchoolDisplayName(selectedSchoolLocal.name)}
      </div>
      <button onClick={() => { setSelectedSchoolLocal(null); setSchoolQuery(''); localStorage.removeItem('selectedSchoolId'); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '18px', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Clear school"><XIcon /></button>
    </div>
  ) : (
    /* School Search Input */
    <div style={{ position: 'relative' }}>
      <input
        ref={schoolInputRef}
        type="text"
        value={schoolQuery}
        onChange={(e) => setSchoolQuery(e.target.value)}
        onKeyDown={handleSchoolKeyDown}
        onFocus={() => { setIsSchoolFocused(true); setShowSchoolSuggestions(true); }}
        onBlur={() => setTimeout(() => setIsSchoolFocused(false), 200)}
        placeholder="Enter your school..."
        className="home-input"
        style={{
          width: '100%',
          /* CSS: School Empty State - Input Field */
          padding: isMobile ? '0 0.5rem 0 1.5rem' : '0.75rem 0.75rem 0.75rem 1.5rem',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.15)',
          borderRadius: '9999px', // Unified pill shape
          fontSize: isMobile ? '16px' : '14px',
          backgroundColor: 'rgba(0,0,0, .06)',
          color: isDarkMode ? '#ffffff' : '#000000',
          boxSizing: 'border-box',
          height: fieldHeight,
          outline: 'none'
        }}
      />
      {showSchoolSuggestions && schoolSuggestions.length > 0 && (
        /* CSS: School Dropdown Container */
        <div
          ref={schoolSuggestionsRef}
          style={{
            position: 'absolute',
            top: '100%', left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: isDarkMode ? 'rgba(10,10,10, 1)' : 'rgba(150,150,150, 1)',
            border: isDarkMode ? '1px solid rgba(10,10,10, 1)' : 'none !important',
            borderRadius: '16px',
            boxShadow: isDarkMode ? '0 10px 38px rgba(0,0,0, .8)' : '0 10px 38px rgba(0,0,0, .4)',
            maxHeight: '350px',
            overflowY: 'auto',
            zIndex: 1000
          }}>
          {schoolSuggestions.map((school, index) => {
            const distance = selectedAddress && selectedAddress.coordinates && school.coordinates ? calculateDistance(selectedAddress.coordinates, school.coordinates) : null;
            // Check if assigned (handling arrays) - use substring matching for name variations
            const schoolNameLower = school.name.toLowerCase();
            const isAssigned = assignedSchools && Object.values(assignedSchools).some(schoolArray =>
              Array.isArray(schoolArray) && schoolArray.some(s => {
                if (!s || !s.name) return false;
                const assignedName = s.name.toLowerCase();
                // Exact or substring match (handles "Tubman" vs "Harriet Tubman", "Jefferson" vs "Jefferson High School")
                return schoolNameLower === assignedName ||
                  schoolNameLower.includes(assignedName) ||
                  assignedName.includes(schoolNameLower);
              })
            );
            const hasNoRoutes = school.routeCount === 0;
            const schoolTypes = getSchoolTypes(school.name);
            const schoolColor = getSchoolColor(schoolTypes);
            return (
              /* CSS: School Dropdown Item & Hover State */
              <div
                key={school.id}
                onClick={() => handleSelectSchool(school)}
                onMouseEnter={() => setHighlightedSchoolIndex(index)}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  borderBottom: index < schoolSuggestions.length - 1 ? (isDarkMode ? '1px solid rgba(10,10,10, .5)' : '1px solid rgba(236, 236, 236, 1)') : 'none',
                  fontSize: isMobile ? '16px' : '14px',
                  color: highlightedSchoolIndex === index ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  backgroundColor: highlightedSchoolIndex === index ? (isDarkMode ? 'rgba(255,255,255, .1)' : '#f8f8f8ec') : 'var(--bg-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isAssigned && <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: schoolColor, border: '1.5px solid white', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className="fas fa-graduation-cap" style={{ color: 'white', fontSize: '10px' }}></i></div>}
                  {getSchoolDisplayName(school.name)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {hasNoRoutes && (
                    <span
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPosition({ top: rect.top - 8, left: rect.left + rect.width / 2 });
                        setNoRoutesTooltipIndex(index);
                      }}
                      onMouseLeave={() => {
                        setNoRoutesTooltipIndex(null);
                        setTooltipPosition(null);
                      }}
                      style={{ position: 'relative', display: 'inline-flex', cursor: 'help' }}
                    >
                      <i className="fas fa-exclamation-circle" style={{ color: '#dc3545', fontSize: '14px' }}></i>
                    </span>
                  )}
                  {distance !== null && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{formatDistance(distance, true)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const buttonDisabled = !selectedAddress || !selectedSchoolLocal || isFinding;
  const buttonContent = isFinding
    ? <><LogoSpinner size={16} color={textColorSecondary} />Finding...</>
    : <><MapPinIcon filled width={12} height={15} style={{ flexShrink: 0 }} />Find My Stop</>;
  const buttonColors: React.CSSProperties = {
    color: buttonDisabled ? textColorSecondary : (isDarkMode ? '#3A3A3A' : 'white'),
    backgroundColor: buttonDisabled ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)') : (isDarkMode ? 'white' : '#333333'),
    border: buttonDisabled ? `1px solid ${borderColor}` : `1px solid ${isDarkMode ? 'white' : '#333333'}`,
    borderRadius: '9999px',
    cursor: buttonDisabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box'
  };

  const findButton = isInline ? (
    <button onClick={handleFindStop} disabled={buttonDisabled} style={{ ...buttonColors, height: fieldHeight, padding: '0 1.75rem', fontSize: '14px', fontWeight: '500', gap: '0.5rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
      {buttonContent}
    </button>
  ) : (
    /* Main Action Button - Find My Stop */
    <button onClick={handleFindStop} disabled={buttonDisabled} style={{ ...buttonColors, width: '100%', maxWidth: '380px', margin: '0 auto', padding: '1rem 0', fontSize: '16px', fontWeight: '500', gap: '0.75rem' }}>
      {buttonContent}
    </button>
  );

  return (
    <div>
      {/* Outside Portland Modal */}
      <Modal
        isOpen={showOutsidePortlandModal}
        onClose={() => setShowOutsidePortlandModal(false)}
        maxWidth="400px"
      >
        <Modal.Header icon={<i className="fas fa-exclamation-circle" style={{ fontSize: '25px', color: 'var(--text-primary)' }} />}>
          <Modal.Title>Address Outside Portland</Modal.Title>
        </Modal.Header>
        <Modal.Content>
          <Modal.Description>
            The address you selected appears to be outside of the Portland Public Schools service area.
            <br /><br />
            Please select an address within Portland to find your bus stop.
          </Modal.Description>
        </Modal.Content>
        <Modal.Footer twoButtons>
          <Button
            variant="secondary"
            onClick={() => setShowOutsidePortlandModal(false)}
          >
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowOutsidePortlandModal(false);
              setRoutes([]);
              navigate('/schools');
            }}
          >
            Explore
          </Button>
        </Modal.Footer>
      </Modal>

      {isInline ? (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>{addressField}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{schoolField}</div>
          {findButton}
        </div>
      ) : (
        <>
          {/* Address Input Section - Toggles between Selected Address and Search Input */}
          <div style={{ marginBottom: '1.5rem' }}>{addressField}</div>
          {/* School Input Section - Toggles between Selected School and Search Input */}
          <div style={{ marginBottom: '1.5rem' }}>{schoolField}</div>
        </>
      )}

      {/* Fixed-position No Routes Tooltip */}
      {noRoutesTooltipIndex !== null && tooltipPosition && (
        <div style={{
          position: 'fixed',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translate(-50%, -100%)',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          padding: '16px',
          width: '220px',
          zIndex: 9999,
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(220, 53, 69, 0.15)',
            color: '#dc3545',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '10px'
          }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '11px' }}></i>
            NO ROUTES
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: '1.4'
          }}>
            Route information not provided on the web by school district.
          </div>
        </div>
      )}

      {/* Error Message Display */}
      {error && <div style={{ padding: '0.75rem', margin: isInline ? '1rem 0 0' : '0 0 1rem', backgroundColor: '#fee', color: '#c33', borderRadius: '12px', fontSize: '14px' }}>{error}</div>}

      {!isInline && findButton}
    </div>
  );
}
