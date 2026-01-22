import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { analyticsService } from '../services/analytics';
import { autocompleteAddress, geocodeAddress, reverseGeocode } from '../services/api';
import { loadLocalRoutes } from '../services/localRoutes';
import { findClosestStop } from '../utils/findClosestStop';
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
import { LocationArrowIcon } from '../components/LocationArrowIcon';
import { useIsMobile } from '../hooks/useMediaQuery';

interface AutocompleteSuggestion {
  displayName: string;
  address: string;
  coordinates: [number, number];
}

export function HomePage() {
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

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      console.warn('[HomePage] Geolocation not supported');
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
      console.log(`[HomePage] Got location: ${latitude}, ${longitude}`);

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
        analyticsService.trackAction('location_autofill', { page: 'homepage', success: true });
      } else {
        console.warn('[HomePage] No address found for location');
        analyticsService.trackAction('location_autofill', { page: 'homepage', success: false, reason: 'no_address' });
      }
    } catch (error: any) {
      console.error('[HomePage] Geolocation error:', error);
      analyticsService.trackAction('location_autofill', { page: 'homepage', success: false, reason: error.code || 'error' });
    } finally {
      setIsGeolocating(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.style.overflow = 'visible';
      rootElement.style.height = 'auto';
      rootElement.style.minHeight = '100vh';
    }
  }, [isDarkMode]);

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
        console.error('[HomePage] Address autocomplete error:', error);
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
    const assignedNames = new Set<string>();
    if (assignedSchools) {
      Object.values(assignedSchools).forEach(school => {
        if (school && school.name) assignedNames.add(school.name.toLowerCase());
      });
    }

    const getScore = (school: School) => {
      let score = 0;
      if (assignedNames.has(school.name.toLowerCase())) score -= 1000000;
      if (selectedAddress && selectedAddress.coordinates && school.coordinates) {
        score += calculateDistance(selectedAddress.coordinates, school.coordinates);
      }
      return score;
    };

    if (schoolQuery.trim()) {
      const query = schoolQuery.toLowerCase();
      const filtered = schools.filter(school => school.name.toLowerCase().includes(query));
      const sorted = filtered.map(school => ({ school, score: getScore(school) })).sort((a, b) => a.score - b.score).map(item => item.school);
      setSchoolSuggestions(sorted.slice(0, 10));
      setShowSchoolSuggestions(true);
    } else if (isSchoolFocused) {
      const sorted = schools.filter(school => school.coordinates).map(school => ({ school, score: getScore(school) })).sort((a, b) => a.score - b.score).map(item => item.school);
      setSchoolSuggestions(sorted.slice(0, 10));
      setShowSchoolSuggestions(true);
    } else {
      setSchoolSuggestions([]);
      setShowSchoolSuggestions(false);
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
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAddress = async (suggestion: AutocompleteSuggestion) => {
    analyticsService.trackAddressSearch('homepage', suggestion.address);
    try {
      setAddressLoading(true);
      const geocodeResult = await geocodeAddress(suggestion.address);
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
      console.error('[HomePage] Geocoding error:', error);
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
    analyticsService.trackSchoolSelect(school.name, 'homepage');
    setSelectedSchoolLocal(school);
    localStorage.setItem('selectedSchoolId', school.id);
    setSchoolQuery('');
    setSchoolSuggestions([]);
    setShowSchoolSuggestions(false);
    setHighlightedSchoolIndex(-1);
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
    }
  };

  const faqItems = [
    {
      question: "How do I find my child's bus stop?",
      answer: "Enter your home address and select your child's school above. We'll show you the closest stops and routes serving that school from your neighborhood."
    },
    {
      question: "Are these routes official?",
      answer: "These routes are parsed from official PPS transportation documents. However, routes can change. Always verify with the PPS Transportation department for the most current information."
    },
    {
      question: "What if I can't find my school?",
      answer: "We cover most Portland Public Schools. If your school isn't listed, it may be because they use a different transportation system or their routes haven't been published yet."
    },
    {
      question: "How often is this data updated?",
      answer: "We sync with PPS transportation updates weekly. Check the 'Effective Date' on individual route maps to see when that specific route was last updated."
    }
  ];

  const handleFindStop = async () => {
    if (!selectedAddress || !selectedSchoolLocal) {
      setError(!selectedAddress ? 'Please select an address' : 'Please select a school');
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
      console.error('[HomePage] Error finding stop:', error);
      setError(error.message || 'Failed to find closest stop');
    } finally {
      setIsFinding(false);
      setLoading(false);
    }
  };

  /* 
   * LANDING PAGE STYLE VARIABLES
   * These variables dynamically adjust based on the isDarkMode state.
   * They are shared across the header, inputs, and information sections.
   */
  const headerBgColor = isDarkMode ? '#3A3A3A' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const textColorMuted = isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)';
  const textColorSecondary = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const sectionBgColor = isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';

  return (
    <div style={{ backgroundColor: headerBgColor, minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '1rem', right: '24px', zIndex: 100 }}><DarkModeToggle /></div>
      <SEO title="Portland Public School Bus Maps" description="Interactive bus route maps for Portland Public Schools." />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        padding: '2rem',
        boxSizing: 'border-box',
        backgroundImage: isDarkMode ? 'url(/bg-dark.png)' : 'url(/bg-light.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ margin: '0 0 1rem 0', width: '100%' }}>
            <svg width="153" height="52" viewBox="0 0 153 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxHeight: '60px', display: 'block', width: '100%', height: 'auto' }}>
              <path d="M147 0C150.314 0 153 2.68629 153 6V46L152.992 46.3086C152.837 49.3767 150.377 51.8367 147.309 51.9922L147 52H6L5.69141 51.9922C2.62332 51.8367 0.163251 49.3767 0.0078125 46.3086L0 46V6C6.44277e-07 2.68629 2.68629 1.14758e-07 6 0H147ZM54.875 50.25H147C149.347 50.25 151.25 48.3472 151.25 46V6C151.25 3.65279 149.347 1.75 147 1.75H54.875V50.25ZM6 1.75C3.65279 1.75 1.75 3.65279 1.75 6V46C1.75 48.3472 3.65279 50.25 6 50.25H53.125V1.75H6ZM85.2285 29.0449C89.1443 29.0451 91.2635 31.1358 91.2637 34.4385C91.2637 37.393 89.2141 39.6785 85.2285 39.6787C81.2705 39.6787 79.1943 37.3931 79.1943 34.4385C79.1945 31.1218 81.3264 29.0449 85.2285 29.0449ZM94.9893 34.9541C94.9893 37.1143 96.118 37.9785 98.3896 37.9785C100.717 37.9784 101.79 37.0723 101.79 35.0098V29.2959H103.77V35.1494C103.77 38.0621 101.971 39.6786 98.3896 39.6787C94.8079 39.6787 93.0098 38.0761 93.0098 35.1494V29.2959H94.9893V34.9541ZM133.019 29.0449C135.917 29.045 137.771 29.9512 138.37 31.7627L136.503 32.376C136.071 31.1777 134.914 30.6896 132.949 30.6895C131.388 30.6895 130.259 31.1219 130.259 31.958C130.259 32.6408 131.165 32.9058 132.001 33.0312L134.928 33.4629C137.269 33.8113 138.537 34.7594 138.537 36.3896C138.537 38.5219 136.684 39.6786 133.534 39.6787C130.427 39.6787 128.433 38.5085 127.903 36.7666L129.813 36.167C130.385 37.3931 131.639 37.9785 133.59 37.9785C135.345 37.9784 136.558 37.3794 136.559 36.5713C136.558 35.9025 135.708 35.4844 134.565 35.3311L132.043 34.9824C129.479 34.634 128.28 33.5882 128.28 32.083C128.281 30.1043 129.995 29.0449 133.019 29.0449ZM73.6514 29.2959C76.5219 29.296 77.6796 30.244 77.6797 32.3203C77.6797 34.0203 76.5364 35.1909 74.8506 35.3027L77.958 39.4277H75.5195L72.5781 35.4424H69.4424V39.4277H67.4639V29.2959H73.6514ZM116.289 30.9961H111.76V39.4277H109.781V30.9961H105.251V29.2959H116.289V30.9961ZM126.854 30.9961H119.746V33.3516H125.864V35.0518H119.746V37.7275H127.021V39.4277H117.767V29.2959H126.854V30.9961ZM25.2881 13.584C27.006 13.584 28.4648 14.692 28.9893 16.2324H33.7031C36.8479 16.2326 39.3935 18.7888 39.3809 21.9336C39.3677 25.0601 36.8297 27.5887 33.7031 27.5889H20.8672C19.0609 27.5891 17.5988 29.0579 17.6064 30.8643C17.6148 32.6592 19.0721 34.1111 20.8672 34.1113H32.916C33.3796 32.6121 34.7772 31.5235 36.4287 31.5234C38.4588 31.5234 40.1045 33.1691 40.1045 35.1992C40.104 37.2289 38.4585 38.875 36.4287 38.875C34.7777 38.875 33.3811 37.7856 32.917 36.2871H20.8672C17.8739 36.2869 15.4439 33.8662 15.4307 30.873C15.4179 27.8615 17.8556 25.4133 20.8672 25.4131H33.7031C35.6315 25.4129 37.1967 23.8531 37.2051 21.9248C37.2129 19.985 35.6429 18.4084 33.7031 18.4082H29.0889C28.6763 20.1248 27.1312 21.4014 25.2881 21.4014H18.9258C16.7674 21.4012 15.018 19.6505 15.0176 17.4922C15.0178 15.3337 16.7673 13.5842 18.9258 13.584H25.2881ZM85.2148 30.7451C82.7481 30.7451 81.173 32.0556 81.1729 34.3271C81.1729 36.6685 82.706 37.9785 85.2285 37.9785C87.7369 37.9784 89.2842 36.7241 89.2842 34.3271C89.2841 32.0697 87.7369 30.7454 85.2148 30.7451ZM36.4287 33.6992C35.6003 33.6993 34.9287 34.3708 34.9287 35.1992C34.9292 36.0272 35.6006 36.6992 36.4287 36.6992C37.2568 36.6992 37.9282 36.0272 37.9287 35.1992C37.9287 34.3708 37.2571 33.6992 36.4287 33.6992ZM69.4424 33.7979H73.3594C75.1703 33.7977 75.7001 33.3933 75.7002 32.3623C75.7001 31.3452 75.1285 30.9406 73.3594 30.9404H69.4424V33.7979ZM93.1416 13.1172C95.8361 13.1173 97.5592 13.9594 98.1162 15.6436L96.3809 16.2129C95.9793 15.099 94.9033 14.6456 93.0771 14.6455C91.6264 14.6455 90.5765 15.0471 90.5762 15.8242C90.5763 16.4589 91.419 16.7057 92.1963 16.8223L94.916 17.2236C97.0922 17.5476 98.2714 18.4287 98.2715 19.9443C98.2714 21.9263 96.5486 23.0018 93.6211 23.002C90.7322 23.002 88.8792 21.9132 88.3867 20.2939L90.1621 19.7373C90.6934 20.877 91.8594 21.4209 93.6729 21.4209C95.3045 21.4208 96.432 20.8643 96.4326 20.1133C96.4326 19.4916 95.642 19.1026 94.5801 18.96L92.2344 18.6357C89.851 18.3118 88.7365 17.3403 88.7363 15.9414C88.7363 14.1017 90.3303 13.1172 93.1416 13.1172ZM118.661 18.5322C118.661 20.54 119.711 21.3428 121.822 21.3428C123.985 21.3425 124.983 20.5008 124.983 18.584V13.2715H126.823V18.7129C126.823 21.4203 125.151 22.9236 121.822 22.9238C118.493 22.9238 116.821 21.4335 116.821 18.7129V13.2715H118.661V18.5322ZM133.149 13.0391C135.844 13.0392 137.568 13.8814 138.125 15.5654L136.389 16.1348C135.987 15.021 134.911 14.5675 133.085 14.5674C131.634 14.5674 130.585 14.969 130.585 15.7461C130.585 16.3808 131.427 16.6275 132.204 16.7441L134.925 17.1455C137.101 17.4695 138.28 18.3507 138.28 19.8662C138.28 21.8481 136.556 22.9236 133.629 22.9238C130.74 22.9238 128.888 21.835 128.396 20.2158L130.17 19.6592C130.701 20.7988 131.867 21.3427 133.681 21.3428C135.312 21.3426 136.44 20.7861 136.44 20.0352C136.44 19.4135 135.65 19.1026 134.588 18.96L132.243 18.5576C129.86 18.2338 128.745 17.2623 128.745 15.8633C128.745 14.0237 130.338 13.0391 133.149 13.0391ZM73.0342 13.3496C75.6638 13.3497 76.9209 14.1665 76.9209 16.2393C76.9208 18.2858 75.6899 19.1151 72.957 19.1152H69.3037V22.7686H67.4639V13.3496H73.0342ZM83.8262 13.3496C86.4558 13.3497 87.7129 14.1665 87.7129 16.2393C87.7128 18.2858 86.482 19.1151 83.749 19.1152H80.0957V22.7686H78.2559V13.3496H83.8262ZM111.034 13.2715C113.443 13.2717 114.675 14.0624 114.675 15.6816C114.675 16.5752 114.377 17.1584 113.587 17.6377C114.442 18.0136 115.038 18.9339 115.038 19.957C115.038 21.7315 113.586 22.6901 111.397 22.6904H105.309V13.2715H111.034ZM107.147 21.1621H111.216C112.563 21.1619 113.198 20.7729 113.198 19.8145C113.198 18.9337 112.55 18.5187 111.216 18.5186H107.147V21.1621ZM18.749 15.7686C17.9334 15.8514 17.285 16.4998 17.2021 17.3154L17.1934 17.4922C17.1937 18.3892 17.8753 19.1281 18.749 19.2168L18.9258 19.2256H25.2881L25.4658 19.2168C26.3394 19.128 27.0211 18.3891 27.0215 17.4922C27.0213 16.5951 26.3395 15.8574 25.4658 15.7686L25.2881 15.7598H18.9258L18.749 15.7686ZM69.3037 17.5352H73.2158C74.692 17.5351 75.0809 17.12 75.0811 16.2266C75.0811 15.3845 74.7307 14.9308 73.1895 14.9307H69.3037V17.5352ZM80.0957 17.5352H84.0078C85.484 17.5351 85.8729 17.12 85.873 16.2266C85.873 15.3845 85.5227 14.9308 83.9814 14.9307H80.0957V17.5352ZM107.147 16.9902H111.139C112.226 16.99 112.835 16.7178 112.835 15.9023C112.835 15.0865 112.265 14.801 111.139 14.8008H107.147V16.9902Z" fill={isDarkMode ? '#ffffff' : '#000000'} />
            </svg>
          </div>

          {/* New Header Text Section */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>

            <h1 style={{
              fontSize: isMobile ? '14px' : '16px',
              color: textColorSecondary,
              maxWidth: '300px',
              margin: '0 auto 5rem',
              lineHeight: '1.3',
              fontWeight: 'normal'
            }}>
              Interactive bus route maps <br />for Portland Public Schools
            </h1>


          </div>

          {/* Address Input Section - Toggles between Selected Address and Search Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            {selectedAddress ? (
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
                height: isMobile ? '56px' : '46px',
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
                    height: isMobile ? '56px' : '46px',
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
                  /* CSS: Address Dropdown Container                                                                                                               Hover State                                                                                                               */
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
            )}
          </div>

          {/* School Input Section - Toggles between Selected School and Search Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            {selectedSchoolLocal ? (
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
                height: isMobile ? '56px' : '46px',
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
                  onFocus={() => { setIsSchoolFocused(true); if (selectedAddress && selectedAddress.coordinates) { const sorted = schools.filter(school => school.coordinates).map(school => ({ school, distance: calculateDistance(selectedAddress.coordinates, school.coordinates!) })).sort((a, b) => a.distance - b.distance).map(item => item.school); setSchoolSuggestions(sorted); setShowSchoolSuggestions(true); } else if (schoolSuggestions.length > 0) { setShowSchoolSuggestions(true); } }}
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
                    height: isMobile ? '56px' : '46px',
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
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}>
                    {schoolSuggestions.map((school, index) => {
                      const distance = selectedAddress && selectedAddress.coordinates && school.coordinates ? calculateDistance(selectedAddress.coordinates, school.coordinates) : null;
                      const isAssigned = assignedSchools && Object.values(assignedSchools).some(s => s && s.name && s.name.toLowerCase() === school.name.toLowerCase());
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
                          {distance !== null && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>{formatDistance(distance, true)}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message Display */}
          {error && <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#fee', color: '#c33', borderRadius: '12px', fontSize: '14px' }}>{error}</div>}

          {/* Main Action Button - Find My Stop */}
          <button onClick={handleFindStop} disabled={!selectedAddress || !selectedSchoolLocal || isFinding} style={{ width: '100%', maxWidth: '380px', margin: '0 auto', padding: '1rem 0', fontSize: '16px', fontWeight: '500', color: (!selectedAddress || !selectedSchoolLocal || isFinding) ? textColorSecondary : (isDarkMode ? '#3A3A3A' : 'white'), backgroundColor: (!selectedAddress || !selectedSchoolLocal || isFinding) ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)') : (isDarkMode ? 'white' : '#333333'), border: (!selectedAddress || !selectedSchoolLocal || isFinding) ? `1px solid ${borderColor}` : `1px solid ${isDarkMode ? 'white' : '#333333'}`, borderRadius: '9999px', cursor: (!selectedAddress || !selectedSchoolLocal || isFinding) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxSizing: 'border-box' }}>
            {isFinding ? <>{/* Progress Bar while finding */}<div style={{ width: '60px', height: '4px', marginRight: '0.5rem' }}><ProgressBar height={4} color={isDarkMode ? '#3A3A3A' : 'white'} containerStyle={{ margin: 0 }} /></div>Finding...</> : <><MapPinIcon filled width={12} height={15} style={{ flexShrink: 0 }} />Find My Stop</>}
          </button>

          <div style={{ marginTop: '4.5rem', textAlign: 'center' }}>
            <Link to={selectedSchoolLocal ? `/${selectedSchoolLocal.id}/school-info` : "/schools"} onClick={() => { setRoutes([]); }} style={{ color: textColorMuted, fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fas fa-map" style={{ fontSize: '12px' }}></i>
              Explore Map
            </Link>
          </div>
        </div>
      </div>

      {/* Common Questions & Information Section */}
      <div style={{ width: '100%', padding: '6rem 2rem', backgroundColor: sectionBgColor, boxSizing: 'border-box', borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ color: textColor, fontSize: isMobile ? '28px' : '32px', fontWeight: '600', marginBottom: '4rem', textAlign: 'center' }}>Common Questions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: !isMobile ? '1fr 1fr' : '1fr', gap: '4rem 3rem' }}>
            {faqItems.map((item, index) => (
              <div key={index}>
                <h3 style={{ color: textColor, fontSize: '18px', fontWeight: '600', marginBottom: '1rem', lineHeight: '1.4' }}>{item.question}</h3>
                {/* Line-height for the answers */}
                <p style={{ color: textColorSecondary, fontSize: '15px', lineHeight: '1.4', margin: 0 }}>{item.answer}</p>
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
