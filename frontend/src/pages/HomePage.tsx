import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { analyticsService } from '../services/analytics';
import { autocompleteAddress, geocodeAddress } from '../services/api';
import { loadLocalRoutes } from '../services/localRoutes';
import { findClosestStop } from '../utils/findClosestStop';
import { formatDistance, calculateDistance } from '../utils/distance';
import { School, HomeAddress } from '../types';
import { ProgressBar } from '../components/ProgressBar';
import { SEO } from '../components/SEO';

interface AutocompleteSuggestion {
  displayName: string;
  address: string;
  coordinates: [number, number];
}

export function HomePage() {
  const navigate = useNavigate();
  
  // Use selectors to prevent unnecessary re-renders when other parts of the store change
  const setHomeAddress = useStore(state => state.setHomeAddress);
  const setSelectedSchool = useStore(state => state.setSelectedSchool);
  const setRoutes = useStore(state => state.setRoutes);
  const setLoading = useStore(state => state.setLoading);
  const schools = useStore(state => state.schools);
  const setSchools = useStore(state => state.setSchools);
  const selectStop = useStore(state => state.selectStop);

  // Address state
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<HomeAddress | null>(null);
  const [highlightedAddressIndex, setHighlightedAddressIndex] = useState(-1);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const addressSuggestionsRef = useRef<HTMLDivElement>(null);
  const addressAbortControllerRef = useRef<AbortController | null>(null);

  // School state
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

  // Set body background to match home page on mount and cleanup on unmount
  // Also prevent scrolling on the home page
  useEffect(() => {
    const originalBackground = document.body.style.backgroundColor;
    const originalOverflow = document.body.style.overflow;
    const originalHtmlBackground = document.documentElement.style.backgroundColor;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    const rootElement = document.getElementById('root');
    const originalRootOverflow = rootElement?.style.overflow;
    const originalRootHeight = rootElement?.style.height;
    
    // Set background colors
    document.body.style.backgroundColor = 'var(--brand-primary)';
    document.documentElement.style.backgroundColor = 'var(--brand-primary)';
    
    // On mobile/all devices, we want the body to scroll normally if content exceeds viewport
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    if (rootElement) {
      rootElement.style.overflow = 'visible';
      rootElement.style.height = 'auto';
      rootElement.style.minHeight = '100vh';
    }
    
    return () => {
      document.body.style.backgroundColor = originalBackground;
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.backgroundColor = originalHtmlBackground;
      document.documentElement.style.overflow = originalHtmlOverflow;
      
      if (rootElement) {
        rootElement.style.overflow = originalRootOverflow || '';
        rootElement.style.height = originalRootHeight || '';
        rootElement.style.minHeight = '';
      }
    };
  }, []);

  // Load schools on mount
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          setSchools(data.schools || []);
        }
      } catch (error) {
        console.error('[HomePage] Error loading schools:', error);
      }
    };
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Address autocomplete
  useEffect(() => {
    if (addressQuery.trim().length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setAddressLoading(false);
      return;
    }

    if (addressAbortControllerRef.current) {
      addressAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    addressAbortControllerRef.current = abortController;

    const debounceDelay = addressQuery.length > 5 ? 150 : 200;

    const timeoutId = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const result = await autocompleteAddress(addressQuery, 'Portland', 'OR', abortController.signal);
        
        if (!abortController.signal.aborted) {
          setAddressSuggestions(result.suggestions || []);
          setShowAddressSuggestions(true);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }
        console.error('[HomePage] Address autocomplete error:', error);
        if (!abortController.signal.aborted) {
          setAddressSuggestions([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setAddressLoading(false);
        }
      }
    }, debounceDelay);

    return () => {
      clearTimeout(timeoutId);
      if (addressAbortControllerRef.current) {
        addressAbortControllerRef.current.abort();
        addressAbortControllerRef.current = null;
      }
    };
  }, [addressQuery]);

  // School autocomplete - filter and sort schools based on query and address
  useEffect(() => {
    // If there's a query, filter by name
    if (schoolQuery.trim()) {
      const query = schoolQuery.toLowerCase();
      const filtered = schools.filter(school =>
        school.name.toLowerCase().includes(query)
      );
      
      // If we have an address, sort filtered results by distance
      if (selectedAddress && selectedAddress.coordinates) {
        const sorted = filtered
          .map(school => ({
            school,
            distance: school.coordinates 
              ? calculateDistance(selectedAddress.coordinates, school.coordinates)
              : Infinity
          }))
          .sort((a, b) => a.distance - b.distance)
          .map(item => item.school);
        
        setSchoolSuggestions(sorted.slice(0, 10));
      } else {
        setSchoolSuggestions(filtered.slice(0, 10));
      }
      
      setShowSchoolSuggestions(true);
      return;
    }

    // If no query but field is focused and we have an address, show all schools sorted by distance
    if (!schoolQuery.trim() && isSchoolFocused && selectedAddress && selectedAddress.coordinates) {
      const sorted = schools
        .filter(school => school.coordinates) // Only show schools with coordinates
        .map(school => ({
          school,
          distance: calculateDistance(selectedAddress.coordinates, school.coordinates!)
        }))
        .sort((a, b) => a.distance - b.distance)
        .map(item => item.school);
      
      setSchoolSuggestions(sorted);
      setShowSchoolSuggestions(true);
      return;
    }

    // If no query and not focused, clear suggestions
    if (!schoolQuery.trim() && !isSchoolFocused) {
      setSchoolSuggestions([]);
      setShowSchoolSuggestions(false);
    }
  }, [schoolQuery, schools, selectedAddress, isSchoolFocused]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedAddressIndex(-1);
  }, [addressSuggestions]);

  // Reset highlighted school index when suggestions change
  useEffect(() => {
    setHighlightedSchoolIndex(-1);
  }, [schoolSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addressSuggestionsRef.current &&
        !addressSuggestionsRef.current.contains(event.target as Node) &&
        addressInputRef.current &&
        !addressInputRef.current.contains(event.target as Node)
      ) {
        setShowAddressSuggestions(false);
      }
      if (
        schoolSuggestionsRef.current &&
        !schoolSuggestionsRef.current.contains(event.target as Node) &&
        schoolInputRef.current &&
        !schoolInputRef.current.contains(event.target as Node)
      ) {
        setShowSchoolSuggestions(false);
        setIsSchoolFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAddress = async (suggestion: AutocompleteSuggestion) => {
    analyticsService.trackAddressSearch('homepage', suggestion.address);
    if (!suggestion.coordinates) {
      try {
        setAddressLoading(true);
        const geocodeResult = await geocodeAddress(suggestion.address);
        if (geocodeResult.coordinates) {
          const address: HomeAddress = {
            address: suggestion.address,
            coordinates: geocodeResult.coordinates,
          };
          setSelectedAddress(address);
        } else {
          setError('Failed to geocode selected address');
        }
      } catch (error) {
        console.error('[HomePage] Geocoding error:', error);
        setError('Failed to geocode address');
      } finally {
        setAddressLoading(false);
      }
    } else {
      const address: HomeAddress = {
        address: suggestion.address,
        coordinates: suggestion.coordinates,
      };
      setSelectedAddress(address);
    }
    
    setAddressQuery('');
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setHighlightedAddressIndex(-1);
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAddressSuggestions || addressSuggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedAddressIndex(prev => 
        prev < addressSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedAddressIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedAddressIndex >= 0 && highlightedAddressIndex < addressSuggestions.length) {
        handleSelectAddress(addressSuggestions[highlightedAddressIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowAddressSuggestions(false);
      setHighlightedAddressIndex(-1);
    }
  };

  const handleSelectSchool = (school: School) => {
    analyticsService.trackSchoolSelect(school.name, 'homepage');
    setSelectedSchoolLocal(school);
    setSchoolQuery('');
    setSchoolSuggestions([]);
    setShowSchoolSuggestions(false);
    setHighlightedSchoolIndex(-1);
  };

  const handleSchoolKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSchoolSuggestions || schoolSuggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSchoolIndex(prev => 
        prev < schoolSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSchoolIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedSchoolIndex >= 0 && highlightedSchoolIndex < schoolSuggestions.length) {
        handleSelectSchool(schoolSuggestions[highlightedSchoolIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSchoolSuggestions(false);
      setHighlightedSchoolIndex(-1);
    }
  };

  const faqItems = [
    {
      question: "How do I find my Portland Public Schools bus stop?",
      answer: "Enter your home address and your school name in the search boxes above. Our system will automatically find the closest active bus stop and show you the route on an interactive map."
    },
    {
      question: "Are bus routes the same for morning and afternoon?",
      answer: "Often yes, but some schools have different morning and afternoon stop locations or times. You can toggle between Morning and Afternoon views in the Route Explorer to see specific details for each."
    },
    {
      question: "How accurate are these bus maps?",
      answer: "Our maps are generated directly from official Portland Public Schools (PPS) transportation documents. We update the data regularly to reflect changes in stops or schedules."
    },
    {
      question: "What should I do if my address doesn't show a stop?",
      answer: "If you live within the 'walk zone' (usually 1 mile for elementary, 1.5 miles for middle/high school), a bus stop might not be assigned. Check your school's specific transportation policy for more details."
    }
  ];

  const handleFindStop = async () => {
    if (!selectedAddress) {
      setError('Please select an address');
      return;
    }

    if (!selectedSchoolLocal) {
      setError('Please select a school');
      return;
    }

    analyticsService.trackEvent('Search', 'find_stop', `${selectedSchoolLocal.name}`);
    setIsFinding(true);
    setError(null);

    try {
      console.log('[HomePage] Finding closest stop for:', selectedAddress.address, 'at school:', selectedSchoolLocal.name);
      
      // Load routes for the selected school
      setLoading(true);
      const routes = await loadLocalRoutes(selectedSchoolLocal.id);
      console.log('[HomePage] Loaded', routes.length, 'routes');

      if (routes.length === 0) {
        setError('No routes found for this school');
        setIsFinding(false);
        setLoading(false);
        return;
      }

      // Find the closest stop
      const closestStop = findClosestStop(selectedAddress, routes);

      if (!closestStop) {
        setError('No stops with coordinates found for this school');
        setIsFinding(false);
        setLoading(false);
        return;
      }

      console.log('[HomePage] Found closest stop:', {
        route: closestStop.route.name,
        stop: closestStop.stop.address,
        distance: formatDistance(closestStop.distance, true),
      });

      // Set all routes, but only select the one with the closest stop
      const routesWithSelection = routes.map(route => ({
        ...route,
        isSelected: route.id === closestStop.route.id,
      }));

      // Update store
      setRoutes(routesWithSelection);
      setSelectedSchool(selectedSchoolLocal.id);
      setHomeAddress(selectedAddress);
      
      // Select the closest stop so it's highlighted on the map
      selectStop(closestStop.route, closestStop.stop, closestStop.stopNumber);
      
      // Set loading to false before navigation to ensure ExplorerApp doesn't show loading
      setLoading(false);

      // Navigate to explorer page
      navigate('/bus-route-explorer');
    } catch (error: any) {
      console.error('[HomePage] Error finding stop:', error);
      setError(error.message || 'Failed to find closest stop');
    } finally {
      setIsFinding(false);
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--brand-primary)',
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <SEO 
        title="Find Your Stop" 
        description="Find your closest Portland Public Schools bus stop. Enter your address and school to see your bus route and stop location."
        faqItems={faqItems}
      />

      {/* Hero Section - Search */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        padding: '2rem',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
        }}>
          <h1 style={{
            margin: '0 0 2rem 0',
            fontSize: '32px',
            fontWeight: '600',
            color: 'white',
            textAlign: 'center',
          }}>
            PPS Bus Routes
          </h1>

          {/* Address Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            {selectedAddress ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                height: '46px',
                boxSizing: 'border-box',
              }}>
                <i className="fas fa-house" style={{ color: 'var(--text-primary)', fontSize: '14px' }}></i>
                <div style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedAddress.address}
                </div>
                <button
                  onClick={() => {
                    setSelectedAddress(null);
                    setAddressQuery('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '0 4px',
                    lineHeight: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Clear address"
                >
                  ×
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  ref={addressInputRef}
                  type="text"
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  onKeyDown={handleAddressKeyDown}
                  onFocus={() => {
                    setIsAddressFocused(true);
                    if (addressSuggestions.length > 0) {
                      setShowAddressSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Small delay to allow clicks on suggestions
                    setTimeout(() => setIsAddressFocused(false), 200);
                  }}
                  placeholder="Enter your address..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    height: '46px',
                    outline: 'none',
                    transition: 'background-color 0.2s ease',
                  }}
                />
                {addressLoading && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                  }}>
                    Searching...
                  </div>
                )}
                {showAddressSuggestions && addressSuggestions.length > 0 && (
                  <div
                    ref={addressSuggestionsRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px var(--shadow-hover)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                    }}
                  >
                    {addressSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => handleSelectAddress(suggestion)}
                        onMouseEnter={() => setHighlightedAddressIndex(index)}
                        style={{
                          padding: '0.75rem',
                          cursor: 'pointer',
                          borderBottom: index < addressSuggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                          fontSize: '14px',
                          color: 'var(--text-primary)',
                          backgroundColor: highlightedAddressIndex === index ? 'rgba(78, 205, 196, 0.2)' : 'var(--bg-primary)',
                          transition: 'background-color 0.2s ease',
                        }}
                      >
                        {suggestion.displayName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* School Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            {selectedSchoolLocal ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                height: '46px',
                boxSizing: 'border-box',
              }}>
                <i className="fas fa-graduation-cap" style={{ color: 'var(--text-primary)', fontSize: '14px' }}></i>
                <div style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedSchoolLocal.name}
                </div>
                <button
                  onClick={() => {
                    setSelectedSchoolLocal(null);
                    setSchoolQuery('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '0 4px',
                    lineHeight: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Clear school"
                >
                  ×
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  ref={schoolInputRef}
                  type="text"
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                  onKeyDown={handleSchoolKeyDown}
                  onFocus={() => {
                    setIsSchoolFocused(true);
                    // If address is selected, immediately show all schools sorted by distance
                    if (selectedAddress && selectedAddress.coordinates) {
                      const sorted = schools
                        .filter(school => school.coordinates) // Only show schools with coordinates
                        .map(school => ({
                          school,
                          distance: calculateDistance(selectedAddress.coordinates, school.coordinates!)
                        }))
                        .sort((a, b) => a.distance - b.distance)
                        .map(item => item.school);
                      
                      setSchoolSuggestions(sorted);
                      setShowSchoolSuggestions(true);
                    } else if (schoolSuggestions.length > 0) {
                      // If no address but we have suggestions from typing, show them
                      setShowSchoolSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click events on suggestions to fire first
                    setTimeout(() => {
                      setIsSchoolFocused(false);
                    }, 200);
                  }}
                  placeholder="Enter your school..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    height: '46px',
                    outline: 'none',
                    transition: 'background-color 0.2s ease',
                  }}
                />
                {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                  <div
                    ref={schoolSuggestionsRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px var(--shadow-hover)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                    }}
                  >
                    {schoolSuggestions.map((school, index) => {
                      // Calculate distance for display if address is selected
                      const distance = selectedAddress && selectedAddress.coordinates && school.coordinates
                        ? calculateDistance(selectedAddress.coordinates, school.coordinates)
                        : null;
                      
                      return (
                        <div
                          key={school.id}
                          onClick={() => handleSelectSchool(school)}
                          onMouseEnter={() => setHighlightedSchoolIndex(index)}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            borderBottom: index < schoolSuggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            backgroundColor: highlightedSchoolIndex === index ? 'rgba(78, 205, 196, 0.2)' : 'var(--bg-primary)',
                            transition: 'background-color 0.2s ease',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span>{school.name}</span>
                          {distance !== null && (
                            <span style={{
                              fontSize: '12px',
                              color: 'var(--text-tertiary)',
                              marginLeft: '0.5rem',
                            }}>
                              {formatDistance(distance, true)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              backgroundColor: '#fee',
              color: '#c33',
              borderRadius: '12px',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {/* Find Button */}
          <button
            onClick={handleFindStop}
            disabled={!selectedAddress || !selectedSchoolLocal || isFinding}
            style={{
              width: '100%',
              padding: '0.875rem',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: (!selectedAddress || !selectedSchoolLocal || isFinding) ? '#999' : '#4ECDC4',
              border: 'none',
              borderRadius: '9999px',
              cursor: (!selectedAddress || !selectedSchoolLocal || isFinding) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              if (!(!selectedAddress || !selectedSchoolLocal || isFinding)) {
                e.currentTarget.style.backgroundColor = '#3db8a8';
              }
            }}
            onMouseLeave={(e) => {
              if (!(!selectedAddress || !selectedSchoolLocal || isFinding)) {
                e.currentTarget.style.backgroundColor = '#4ECDC4';
              }
            }}
          >
            {isFinding ? (
              <>
                <div style={{ width: '60px', height: '4px', marginRight: '0.5rem' }}>
                  <ProgressBar height={4} color="white" containerStyle={{ margin: 0 }} />
                </div>
                Finding...
              </>
            ) : (
              <>
                <i className="fas fa-search" style={{ fontSize: '14px' }}></i>
                Find My Stop
              </>
            )}
          </button>
          
          <div style={{
            marginTop: '1.5rem',
            textAlign: 'center',
          }}>
            <Link
              to="/bus-route-explorer"
              style={{
                color: 'white',
                fontSize: '14px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'white';
              }}
            >
              <i className="fas fa-map" style={{ fontSize: '12px' }}></i>
              Explore Map
            </Link>
          </div>
        </div>
      </div>

      {/* FAQ Section - Full Width */}
      <div style={{
        width: '100%',
        padding: '6rem 2rem',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        boxSizing: 'border-box',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
        }}>
          <h2 style={{
            color: 'white',
            fontSize: '32px',
            fontWeight: '600',
            marginBottom: '4rem',
            textAlign: 'center'
          }}>
            Common Questions
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth > 768 ? '1fr 1fr' : '1fr',
            gap: '4rem 3rem'
          }}>
            {faqItems.map((item, index) => (
              <div key={index}>
                <h3 style={{
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '1rem',
                  lineHeight: '1.4'
                }}>
                  {item.question}
                </h3>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '15px',
                  lineHeight: '1.7',
                  margin: 0
                }}>
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <footer style={{
        width: '100%',
        padding: '4rem 2rem',
        backgroundColor: '#0d2843',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '2rem 3rem',
          maxWidth: '1000px',
          width: '100%',
        }}>
          <Link
            to="/schools"
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
          >
            <i className="fas fa-graduation-cap" style={{ width: '16px' }}></i>
            School Directory
          </Link>
          <Link
            to="/neighborhood-directory"
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
          >
            <i className="fas fa-city" style={{ width: '16px' }}></i>
            Browse by Neighborhood
          </Link>
          <Link
            to="/about"
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
          >
            <i className="fas fa-info-circle" style={{ width: '16px' }}></i>
            About
          </Link>
          <Link
            to="/contact"
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '14px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
          >
            <i className="fas fa-envelope" style={{ width: '16px' }}></i>
            Contact
          </Link>
        </div>
        <div style={{
          marginTop: '3rem',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '12px',
        }}>
          &copy; {new Date().getFullYear()} Portland Public Schools Bus Routes. Not an official PPS website.
        </div>
      </footer>
    </div>
  );
}
