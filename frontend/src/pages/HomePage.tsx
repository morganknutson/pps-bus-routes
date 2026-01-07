import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { analyticsService } from '../services/analytics';
import { autocompleteAddress, geocodeAddress, calculateWalkingDistances } from '../services/api';
import { loadLocalRoutes } from '../services/localRoutes';
import { findClosestStop, findClosestStops, ClosestStopResult } from '../utils/findClosestStop';
import { formatDistance, calculateDistance } from '../utils/distance';
import { buildUrlPath, UrlState } from '../services/urlState';
import { School, HomeAddress } from '../types';
import { ProgressBar } from '../components/ProgressBar';
import { SEO } from '../components/SEO';
import { useDarkMode } from '../hooks/useDarkMode';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { MapPinIcon } from '../components/MapPinIcon';
import { Footer } from '../components/Footer';
import { WhoSection } from '../components/WhoSection';
import { getSchoolDisplayName, getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { XIcon } from '../components/XIcon';

interface AutocompleteSuggestion {
  displayName: string;
  address: string;
  coordinates: [number, number];
}

export function HomePage() {
  const navigate = useNavigate();
  const { isDarkMode } = useDarkMode();
  
  // Use selectors to prevent unnecessary re-renders when other parts of the store change
  const setHomeAddress = useStore(state => state.setHomeAddress);
  const setSelectedSchool = useStore(state => state.setSelectedSchool);
  const setRoutes = useStore(state => state.setRoutes);
  const setLoading = useStore(state => state.setLoading);
  const schools = useStore(state => state.schools);
  const setSchools = useStore(state => state.setSchools);
  const selectStop = useStore(state => state.selectStop);
  const setDirectionFilter = useStore(state => state.setDirectionFilter);
  const assignedSchools = useStore(state => state.assignedSchools);
  const homeAddress = useStore(state => state.homeAddress);
  const selectedSchoolId = useStore(state => state.selectedSchoolId);
  const clearHomeAddress = useStore(state => state.clearHomeAddress);

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
    
    // Background colors are now managed by CSS variables in index.css (html/body use --bg-header)
    
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
  }, [isDarkMode]);

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

  // Sync local state with global store on mount/update
  useEffect(() => {
    if (homeAddress) {
      setSelectedAddress(homeAddress);
    }
  }, [homeAddress]);

  useEffect(() => {
    if (selectedSchoolId && schools.length > 0) {
      const school = schools.find(s => s.id === selectedSchoolId);
      if (school) {
        setSelectedSchoolLocal(school);
      }
    } else if (schools.length > 0) {
      // Fallback to localStorage if store is empty (e.g. initial load or after unmount)
      const savedId = localStorage.getItem('selectedSchoolId');
      if (savedId) {
        const school = schools.find(s => s.id === savedId);
        if (school) {
          setSelectedSchoolLocal(school);
        }
      }
    }
  }, [selectedSchoolId, schools]);

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
          
          if (!result.suggestions || result.suggestions.length === 0) {
            analyticsService.trackAction('search_empty_results', { query: addressQuery, type: 'address' });
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }
        console.error('[HomePage] Address autocomplete error:', error);
        analyticsService.trackError(`Address autocomplete failed: ${error.message}`);
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

  // Fetch assigned schools when address is selected
  // (This is now handled by setHomeAddress in useStore)

  // School autocomplete - filter and sort schools based on query and address
  useEffect(() => {
    // Get assigned school names for prioritization
    const assignedNames = new Set<string>();
    if (assignedSchools) {
      Object.values(assignedSchools).forEach(school => {
        if (school && school.name) {
          assignedNames.add(school.name.toLowerCase());
        }
      });
    }

    // Helper to calculate score for sorting
    const getScore = (school: School) => {
      let score = 0;
      // Priority 1: Assigned (large negative score to put at top)
      if (assignedNames.has(school.name.toLowerCase())) {
        score -= 1000000;
      }
      
      // Priority 2: Distance (if address selected)
      if (selectedAddress && selectedAddress.coordinates && school.coordinates) {
        score += calculateDistance(selectedAddress.coordinates, school.coordinates);
      }
      
      return score;
    };

    // If there's a query, filter by name
    if (schoolQuery.trim()) {
      const query = schoolQuery.toLowerCase();
      const filtered = schools.filter(school =>
        school.name.toLowerCase().includes(query)
      );
      
      // Sort filtered results
      const sorted = filtered
        .map(school => ({
          school,
          score: getScore(school)
        }))
        .sort((a, b) => a.score - b.score)
        .map(item => item.school);
      
      setSchoolSuggestions(sorted.slice(0, 10));
      setShowSchoolSuggestions(true);
      return;
    }

    // If no query but field is focused, show suggestions
    if (!schoolQuery.trim() && isSchoolFocused) {
      // Sort all schools
      const sorted = schools
        .filter(school => school.coordinates) // Only show schools with coordinates
        .map(school => ({
          school,
          score: getScore(school)
        }))
        .sort((a, b) => a.score - b.score)
        .map(item => item.school);
      
      setSchoolSuggestions(sorted.slice(0, 10)); // Show top 10
      setShowSchoolSuggestions(true);
      return;
    }

    // If no query and not focused, clear suggestions
    if (!schoolQuery.trim() && !isSchoolFocused) {
      setSchoolSuggestions([]);
      setShowSchoolSuggestions(false);
    }
  }, [schoolQuery, schools, selectedAddress, isSchoolFocused, assignedSchools]);

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
    
    // Always perform a fresh geocode on selection to get high-quality snapped coordinates
    // and ensure the best results for finding the closest stop.
    try {
      setAddressLoading(true);
      const geocodeResult = await geocodeAddress(suggestion.address);
      
      if (geocodeResult.coordinates) {
        const address: HomeAddress = {
          address: suggestion.displayName || suggestion.address,
          coordinates: geocodeResult.coordinates,
        };
        setSelectedAddress(address);
        // Call setHomeAddress immediately to trigger assigned schools lookup
        setHomeAddress(address);
      } else if (suggestion.coordinates) {
        // Fallback to suggestion coordinates if geocode fails
        const address: HomeAddress = {
          address: suggestion.address,
          coordinates: suggestion.coordinates,
        };
        setSelectedAddress(address);
        setHomeAddress(address);
      } else {
        setError('Failed to geocode selected address');
      }
    } catch (error) {
      console.error('[HomePage] Geocoding error:', error);
      if (suggestion.coordinates) {
        const address: HomeAddress = {
          address: suggestion.address,
          coordinates: suggestion.coordinates,
        };
        setSelectedAddress(address);
        setHomeAddress(address);
      } else {
        setError('Failed to geocode address');
      }
    } finally {
      setAddressLoading(false);
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
    // Calculate distance if address is selected
    const distance = selectedAddress && selectedAddress.coordinates && school.coordinates
      ? calculateDistance(selectedAddress.coordinates, school.coordinates)
      : null;

    analyticsService.trackSchoolSelect(school.name, 'homepage');
    if (distance !== null) {
      analyticsService.trackAction('school_select_distance', { 
        schoolName: school.name, 
        distance_meters: Math.round(distance),
        distance_miles: (distance / 1609.34).toFixed(2)
      });
    }

    setSelectedSchoolLocal(school);
    // Don't set store immediately to avoid clearing routes which causes a race condition
    // with the "Find My Stop" navigation. Persistence is handled via localStorage.
    localStorage.setItem('selectedSchoolId', school.id);
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
        analyticsService.trackAction('find_stop_no_routes', { schoolName: selectedSchoolLocal.name });
        setIsFinding(false);
        return;
      }

      // Find closest stop using refined walking distance logic
      const closestStop = await findClosestStop(selectedAddress, routes);

      if (!closestStop) {
        setError('No stops with coordinates found for this school');
        analyticsService.trackAction('find_stop_no_coordinates', { schoolName: selectedSchoolLocal.name });
        setIsFinding(false);
        return;
      }

      console.log('[HomePage] Found closest stop:', {
        route: closestStop.route.name,
        stop: closestStop.stop.address,
        distance: formatDistance(closestStop.distance, true),
        walkingDistance: closestStop.walkingDistance ? `${closestStop.walkingDistance}m` : 'N/A'
      });

      analyticsService.trackAction('find_stop_success', {
        schoolName: selectedSchoolLocal.name,
        routeName: closestStop.route.name,
        distance_meters: Math.round(closestStop.distance),
        walking_distance_meters: closestStop.walkingDistance || null
      });

      // Update store
      // We set the home address and map intent, but let the URL transition
      // handle route loading and selection to avoid race conditions.
      setHomeAddress(selectedAddress);
      
      // Build the URL state for navigation
      const stopId = closestStop.stop.id;
      const stopMatch = stopId.match(/stop-(\d+)/);
      const stopNumberStr = stopMatch ? stopMatch[1] : stopId;
      const routeName = closestStop.route.name;
      
      const urlState: UrlState = {
        show: 'routes',
        schoolId: selectedSchoolLocal.id,
        direction: closestStop.route.direction?.toLowerCase() as 'morning' | 'afternoon' | 'both' || 'both',
        routeNames: [routeName],
        stopId: routeName.endsWith('-upcoming') 
          ? `${routeName.replace('-upcoming', '')}-${stopNumberStr}-upcoming`
          : `${routeName}-${stopNumberStr}`,
        focus: 'my-stop'
      };

      const explorerPath = buildUrlPath('', urlState);
      console.log('[HomePage] Navigating to:', explorerPath);

      // Navigate to explorer page with full state in URL
      navigate(explorerPath, { replace: false });
    } catch (error: any) {
      console.error('[HomePage] Error finding stop:', error);
      setError(error.message || 'Failed to find closest stop');
    } finally {
      setIsFinding(false);
      setLoading(false);
    }
  };

  // Match header background colors
  const headerBgColor = isDarkMode ? '#3A3A3A' : '#ffffff';
  // Text colors that work with the new backgrounds
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const textColorMuted = isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';
  const textColorSecondary = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  const textColorTertiary = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const sectionBgColor = isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
  
  return (
    <div style={{
      backgroundColor: headerBgColor,
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: '1rem',
        right: '12px',
        zIndex: 100,
      }}>
        <DarkModeToggle />
      </div>

      <SEO 
        title="" 
        description="Interactive bus route maps for Portland Public Schools. Find your school, view routes, and locate bus stops."
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
          maxWidth: '380px',
        }}>
          <div style={{
            margin: '0 0 2rem 0',
            width: '100%',
          }}>
            <svg width="100%" height="auto" viewBox="0 0 96 46" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxHeight: '60px', display: 'block' }}>
              <path d="M35.3486 5C35.1934 5.32667 35.05 5.66 34.9199 6H6C3.32472 6 1.14053 8.10111 1.00684 10.7432L1 11V40C1 42.7614 3.23858 45 6 45H90C92.7614 45 95 42.7614 95 40V11C95 8.23858 92.7614 6 90 6H61.0801C60.95 5.66 60.8066 5.32667 60.6514 5H90C93.3137 5 96 7.68629 96 11V40C96 43.3137 93.3137 46 90 46H6C2.68629 46 0 43.3137 0 40V11C0 7.68629 2.68629 5 6 5H35.3486Z" fill={isDarkMode ? "white" : "black"}/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M28.7373 25.6855C33.177 25.6855 35.5789 28.0555 35.5791 31.7998C35.5791 35.1495 33.2562 37.7412 28.7373 37.7412C24.2502 37.7411 21.8965 35.1494 21.8965 31.7998C21.8967 28.0397 24.3136 25.6856 28.7373 25.6855ZM28.7217 27.6133C25.9252 27.6133 24.1398 29.0987 24.1396 31.6738C24.1398 34.328 25.8777 35.8134 28.7373 35.8135C31.5813 35.8135 33.3348 34.3913 33.335 31.6738C33.3348 29.1144 31.5814 27.6133 28.7217 27.6133Z" fill={isDarkMode ? "white" : "black"}/>
              <path d="M39.8027 32.3848C39.8028 34.8336 41.0829 35.8134 43.6582 35.8135C46.2968 35.8135 47.5137 34.7857 47.5137 32.4473V25.9697H49.7568V32.6055C49.7568 35.9077 47.7189 37.7412 43.6582 37.7412C39.5976 37.7412 37.5596 35.9235 37.5596 32.6055V25.9697H39.8027V32.3848Z" fill={isDarkMode ? "white" : "black"}/>
              <path d="M82.917 25.6855C86.2032 25.6855 88.3048 26.7128 88.9844 28.7666L86.8672 29.4619C86.3773 28.1034 85.0655 27.5498 82.8379 27.5498C81.0687 27.5498 79.7896 28.0397 79.7891 28.9873C79.7891 29.7615 80.8157 30.0619 81.7637 30.2041L85.082 30.6943C87.7359 31.0893 89.1735 32.1636 89.1738 34.0117C89.1738 36.4291 87.0726 37.7411 83.502 37.7412C79.9785 37.7412 77.7186 36.4135 77.1182 34.4385L79.2832 33.7588C79.931 35.1491 81.3526 35.8134 83.5645 35.8135C85.555 35.8135 86.9303 35.134 86.9307 34.2178C86.9303 33.4596 85.9662 32.9853 84.6709 32.8115L81.8105 32.416C78.9038 32.0209 77.545 30.8361 77.5449 29.1299C77.5452 26.8865 79.4886 25.6856 82.917 25.6855Z" fill={isDarkMode ? "white" : "black"}/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M15.6123 25.9697C18.867 25.9697 20.1786 27.0445 20.1787 29.3984C20.1786 31.3259 18.8834 32.6528 16.9717 32.7793L20.4951 37.4561H17.7295L14.3965 32.9375H10.8408V37.4561H8.59766V25.9697H15.6123ZM10.8408 31.0732H15.2812C17.335 31.0732 17.9355 30.6145 17.9355 29.4453C17.9352 28.2926 17.2871 27.834 15.2812 27.834H10.8408V31.0732Z" fill={isDarkMode ? "white" : "black"}/>
              <path d="M63.9512 27.8975H58.8164V37.4561H56.5723V27.8975H51.4375V25.9697H63.9512V27.8975Z" fill={isDarkMode ? "white" : "black"}/>
              <path d="M75.9287 27.8975H67.8701V30.5674H74.8066V32.4951H67.8701V35.5283H76.1182V37.4561H65.627V25.9697H75.9287V27.8975Z" fill={isDarkMode ? "white" : "black"}/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M44.2041 5.01074C45.0152 5.09297 45.6825 5.65971 45.9131 6.41699H50C51.4267 6.417 52.583 7.57327 52.583 9C52.583 10.4267 51.4267 11.583 50 11.583H46C45.2176 11.583 44.583 12.2176 44.583 13C44.583 13.7824 45.2176 14.417 46 14.417H50.0869C50.3365 13.5969 51.0983 13 52 13L52.2041 13.0107C53.2128 13.113 54 13.9643 54 15L53.9893 15.2041C53.887 16.2128 53.0356 17 52 17L51.7959 16.9893C50.9849 16.907 50.3184 16.3402 50.0879 15.583H46C44.5733 15.583 43.417 14.4267 43.417 13C43.417 11.5733 44.5733 10.417 46 10.417H50C50.7824 10.417 51.417 9.78239 51.417 9C51.417 8.2176 50.7824 7.58301 50 7.58301H45.9131C45.6636 8.40315 44.9017 9 44 9L43.7959 8.98926C42.8543 8.8938 42.1062 8.14565 42.0107 7.2041L42 7C42 5.89543 42.8954 5 44 5L44.2041 5.01074ZM52 14.167C51.5398 14.167 51.167 14.5398 51.167 15C51.167 15.4602 51.5398 15.833 52 15.833C52.4602 15.833 52.833 15.4602 52.833 15C52.833 14.5398 52.4602 14.167 52 14.167ZM44 6.16699C43.5398 6.16699 43.167 6.53976 43.167 7C43.167 7.46024 43.5398 7.83301 44 7.83301C44.4602 7.83301 44.833 7.46024 44.833 7C44.833 6.53976 44.4602 6.16699 44 6.16699Z" fill={isDarkMode ? "white" : "black"}/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M48 0C54.0751 0 59 4.92487 59 11C59 17.0751 54.0751 22 48 22C41.9249 22 37 17.0751 37 11C37 4.92487 41.9249 0 48 0ZM48 1C42.4772 1 38 5.47715 38 11C38 16.5228 42.4772 21 48 21C53.5228 21 58 16.5228 58 11C58 5.47715 53.5228 1 48 1Z" fill={isDarkMode ? "white" : "black"}/>
              <path d="M26.8379 13C28.7097 13 29.9069 13.585 30.2939 14.7549L29.0879 15.1514C28.8089 14.3774 28.0618 14.0625 26.793 14.0625C25.7851 14.0625 25.0559 14.341 25.0557 14.8809C25.0557 15.3218 25.6407 15.4932 26.1807 15.5742L28.0703 15.8535C29.5823 16.0785 30.4014 16.6902 30.4014 17.7432C30.4013 19.1201 29.2048 19.8671 27.1709 19.8672C25.1641 19.8672 23.8773 19.1111 23.5352 17.9863L24.7676 17.5986C25.1366 18.3906 25.947 18.7695 27.207 18.7695C28.3407 18.7695 29.1238 18.3822 29.124 17.8604C29.124 17.4284 28.5749 17.1576 27.8369 17.0586L26.208 16.834C24.552 16.609 23.7773 15.9339 23.7773 14.9619C23.7774 13.684 24.885 13 26.8379 13Z" fill={isDarkMode ? "white" : "black"}/>
              <path d="M75.2754 16.8164C75.2755 18.2112 76.0048 18.7695 77.4717 18.7695C78.9745 18.7695 79.6678 18.1842 79.668 16.8525V13.1621H80.9453V16.9424C80.9452 18.8232 79.7845 19.8672 77.4717 19.8672C75.1588 19.8672 73.9982 18.8322 73.998 16.9424V13.1621H75.2754V16.8164Z" fill={isDarkMode ? "white" : "black"}/>
              <path d="M85.3408 13C87.2127 13 88.4098 13.585 88.7969 14.7549L87.5908 15.1514C87.3118 14.3774 86.5648 14.0625 85.2959 14.0625C84.288 14.0625 83.5588 14.341 83.5586 14.8809C83.5586 15.3218 84.1436 15.4932 84.6836 15.5742L86.5732 15.8535C88.0852 16.0785 88.9043 16.6902 88.9043 17.7432C88.9042 19.1201 87.7077 19.8671 85.6738 19.8672C83.667 19.8672 82.3802 19.1111 82.0381 17.9863L83.2705 17.5986C83.6395 18.3906 84.45 18.7695 85.71 18.7695C86.8436 18.7695 87.6267 18.3822 87.627 17.8604C87.627 17.4284 87.0778 17.1576 86.3398 17.0586L84.7109 16.834C83.0549 16.609 82.2803 15.9339 82.2803 14.9619C82.2804 13.684 83.3879 13 85.3408 13Z" fill={isDarkMode ? "white" : "black"}/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12.8691 13.1621C14.6961 13.1621 15.5693 13.729 15.5693 15.1689C15.5693 16.5909 14.7144 17.167 12.8154 17.167H10.2773V19.7051H9V13.1621H12.8691ZM10.2773 16.0693H12.9951C14.0211 16.0693 14.292 15.7811 14.292 15.1602C14.292 14.5752 14.0485 14.2598 12.9775 14.2598H10.2773V16.0693Z" fill={isDarkMode ? "white" : "black"}/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M20.3662 13.1621C22.1932 13.1621 23.0664 13.729 23.0664 15.1689C23.0664 16.5909 22.2115 17.167 20.3125 17.167H17.7744V19.7051H16.4971V13.1621H20.3662ZM17.7744 16.0693H20.4922C21.5181 16.0693 21.789 15.7811 21.7891 15.1602C21.7891 14.5752 21.5456 14.2598 20.4746 14.2598H17.7744V16.0693Z" fill={isDarkMode ? "white" : "black"}/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M69.9775 13.1621C71.6515 13.1621 72.5068 13.711 72.5068 14.8359C72.5068 15.4569 72.2998 15.8623 71.751 16.1953C72.3446 16.4564 72.7586 17.095 72.7588 17.8057C72.7588 19.0387 71.7505 19.7051 70.2295 19.7051H66V13.1621H69.9775ZM67.2773 18.6436H70.1035C71.0395 18.6436 71.4805 18.373 71.4805 17.707C71.4804 17.0951 71.0305 16.8066 70.1035 16.8066H67.2773V18.6436ZM67.2773 15.7451H70.0498C70.8056 15.7451 71.2284 15.5561 71.2285 14.9893C71.2285 14.4223 70.8327 14.2237 70.0498 14.2236H67.2773V15.7451Z" fill={isDarkMode ? "white" : "black"}/>
            </svg>
          </div>

          {/* Address Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            {selectedAddress ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 0.75rem 0.75rem 1rem',
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
                    localStorage.removeItem('homeAddress');
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
                  <XIcon />
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
                    padding: '0.75rem 0.75rem 0.75rem 1rem',
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
                padding: '0.75rem 0.75rem 0.75rem 1rem',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                height: '46px',
                boxSizing: 'border-box',
              }}>
                <i className="fas fa-graduation-cap" style={{ color: 'var(--text-primary)', fontSize: '14px' }}></i>
                <div style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getSchoolDisplayName(selectedSchoolLocal.name)}
                </div>
                <button
                  onClick={() => {
                    setSelectedSchoolLocal(null);
                    setSchoolQuery('');
                    localStorage.removeItem('selectedSchoolId');
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
                  <XIcon />
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
                    padding: '0.75rem 0.75rem 0.75rem 1rem',
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
                      
                      const isAssigned = assignedSchools && Object.values(assignedSchools).some(
                        s => s && s.name && s.name.toLowerCase() === school.name.toLowerCase()
                      );

                      const schoolTypes = getSchoolTypes(school.name);
                      const schoolColor = getSchoolColor(schoolTypes);

                      return (
                        <div
                          key={school.id}
                          onClick={() => handleSelectSchool(school)}
                          onMouseEnter={() => setHighlightedSchoolIndex(index)}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            borderBottom: index < schoolSuggestions.length - 1 
                              ? `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}` 
                              : 'none',
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            backgroundColor: highlightedSchoolIndex === index 
                              ? (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)') 
                              : 'var(--bg-primary)',
                            transition: 'background-color 0.2s ease',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isAssigned && (
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: schoolColor,
                                border: '1.5px solid white',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <i className="fas fa-graduation-cap" style={{ color: 'white', fontSize: '10px' }}></i>
                              </div>
                            )}
                            {getSchoolDisplayName(school.name)}
                          </span>
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
              maxWidth: '250px',
              margin: '0 auto',
              padding: '0.875rem',
              fontSize: '16px',
              fontWeight: '600',
              color: (!selectedAddress || !selectedSchoolLocal || isFinding) 
                ? textColorSecondary 
                : (isDarkMode ? '#3A3A3A' : 'white'),
              backgroundColor: (!selectedAddress || !selectedSchoolLocal || isFinding) 
                ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)') 
                : (isDarkMode ? 'white' : '#333333'),
              border: (!selectedAddress || !selectedSchoolLocal || isFinding)
                ? `1px solid ${borderColor}`
                : `1px solid ${isDarkMode ? 'white' : '#333333'}`,
              borderRadius: '9999px',
              cursor: (!selectedAddress || !selectedSchoolLocal || isFinding) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              if (!(!selectedAddress || !selectedSchoolLocal || isFinding)) {
                e.currentTarget.style.backgroundColor = isDarkMode ? '#f0f0f0' : '#1a1a1a';
                e.currentTarget.style.borderColor = isDarkMode ? '#f0f0f0' : '#1a1a1a';
              }
            }}
            onMouseLeave={(e) => {
              if (!(!selectedAddress || !selectedSchoolLocal || isFinding)) {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'white' : '#333333';
                e.currentTarget.style.borderColor = isDarkMode ? 'white' : '#333333';
              }
            }}
          >
            {isFinding ? (
              <>
                <div style={{ width: '60px', height: '4px', marginRight: '0.5rem' }}>
                  <ProgressBar height={4} color={isDarkMode ? '#3A3A3A' : 'white'} containerStyle={{ margin: 0 }} />
                </div>
                Finding...
              </>
            ) : (
              <>
                <MapPinIcon width={12} height={15} style={{ flexShrink: 0 }} />
                Find My Stop
              </>
            )}
          </button>
          
          <div style={{
            marginTop: '1.5rem',
            textAlign: 'center',
          }}>
            <Link
              to={selectedSchoolLocal ? `/${selectedSchoolLocal.id}/school-info` : "/schools"}
              onClick={() => {
                if (!selectedSchoolLocal) {
                  setSelectedSchool(null);
                }
                setRoutes([]);
              }}
              style={{
                color: textColorMuted,
                fontSize: '14px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = textColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = textColorMuted;
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
        backgroundColor: sectionBgColor,
        boxSizing: 'border-box',
        borderTop: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
      }}>
        <div style={{
          maxWidth: '1000px',
          margin: '0 auto',
        }}>
          <h2 style={{
            color: textColor,
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
                  color: textColor,
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '1rem',
                  lineHeight: '1.4'
                }}>
                  {item.question}
                </h3>
                <p style={{
                  color: textColorSecondary,
                  fontSize: '15px',
                  lineHeight: '1.7',
                  margin: 0
                }}>
                  {item.answer}
                </p>
              </div>
            ))}
          </div>

          <WhoSection style={{ marginTop: '6rem' }} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
