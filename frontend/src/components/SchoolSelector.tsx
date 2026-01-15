import { useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useUrlState } from '../hooks/useUrlState';
import { loadLocalRoutes } from '../services/localRoutes';
import { getSchoolDisplayName } from '../utils/schoolUtils';
import { calculateDistance, validateLngLat } from '../utils/coordinates';

export function SchoolSelector() {
  const {
    schools,
    setSchools,
    setRoutes,
    setLoading,
    setLoadingProgress,
    assignedSchools,
    homeAddress
  } = useStore();

  const {
    schoolId: selectedSchoolId,
    setSelectedSchool
  } = useUrlState();

  // Load schools on mount
  useEffect(() => {
    const loadSchools = async () => {
      try {
        console.log('[SchoolSelector] Loading schools...');
        const response = await fetch('/api/schools');
        if (response.ok) {
          const data = await response.json();
          console.log('[SchoolSelector] Loaded schools:', data.schools);
          setSchools(data.schools || []);

          // If no school is selected but schools exist, select the first one
          if (!selectedSchoolId && data.schools && data.schools.length > 0) {
            console.log('[SchoolSelector] Auto-selecting first school:', data.schools[0].id);
            setSelectedSchool(data.schools[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading schools:', error);
      }
    };

    loadSchools();
    // Only run on mount - remove selectedSchoolId from dependencies to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load routes when school changes
  useEffect(() => {
    if (!selectedSchoolId) {
      console.log('[SchoolSelector] No school selected, clearing routes');
      setRoutes([]); // Clear routes when no school is selected
      setLoading(false);
      setLoadingProgress(null);
      return;
    }

    console.log('[SchoolSelector] Loading routes for school:', selectedSchoolId);
    const loadRoutes = async () => {
      setLoading(true);
      setLoadingProgress(0);
      try {
        const routes = await loadLocalRoutes(selectedSchoolId);
        console.log('[SchoolSelector] Loaded', routes.length, 'routes');
        setRoutes(routes);
        setLoadingProgress(100);
      } catch (error) {
        console.error('[SchoolSelector] Failed to load routes:', error);
        setRoutes([]); // Set empty array on error
      } finally {
        setLoading(false);
        setLoadingProgress(null);
      }
    };

    loadRoutes();
  }, [selectedSchoolId, setRoutes, setLoading, setLoadingProgress]);

  // Sort schools: Assigned -> Distance -> Alphabetical
  const sortedSchools = useMemo(() => {
    if (!schools) return [];

    // Get assigned school names for quick lookup
    const assignedNames = new Set<string>();
    if (assignedSchools) {
      Object.values(assignedSchools).forEach(school => {
        if (school && school.name) {
          assignedNames.add(school.name.toLowerCase());
        }
      });
    }

    return [...schools].sort((a, b) => {
      // 1. Assigned Schools First
      const isAssignedA = assignedNames.has(a.name.toLowerCase());
      const isAssignedB = assignedNames.has(b.name.toLowerCase());

      if (isAssignedA && !isAssignedB) return -1;
      if (!isAssignedA && isAssignedB) return 1;

      // 2. Distance (if home address available)
      if (homeAddress && validateLngLat(homeAddress.coordinates)) {
        const coordsA = a.coordinates && validateLngLat(a.coordinates) ? a.coordinates : null;
        const coordsB = b.coordinates && validateLngLat(b.coordinates) ? b.coordinates : null;

        if (coordsA && coordsB) {
          const distA = calculateDistance(homeAddress.coordinates, coordsA);
          const distB = calculateDistance(homeAddress.coordinates, coordsB);
          // Sort by distance ascending
          if (Math.abs(distA - distB) > 100) { // Only differentiate if > 100m difference
            return distA - distB;
          }
        } else if (coordsA) {
          return -1; // A has coords, B doesn't -> A comes first
        } else if (coordsB) {
          return 1; // B has coords, A doesn't -> B comes first
        }
      }

      // 3. Alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [schools, assignedSchools, homeAddress]);

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: '500',
        color: '#666',
        marginBottom: '0.5rem'
      }}>
        School
      </label>
      <select
        value={selectedSchoolId || ''}
        onChange={(e) => setSelectedSchool(e.target.value || null)}
        style={{
          width: '100%',
          padding: '0.5rem',
          fontSize: '14px',
          border: '1px solid #ddd',
          borderRadius: '12px',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        <option value="">Select a school...</option>
        {sortedSchools.map((school) => {
          // Check if assigned to add visual indicator
          let isAssigned = false;
          if (assignedSchools) {
            isAssigned = Object.values(assignedSchools).some(s =>
              s && s.name && s.name.toLowerCase() === school.name.toLowerCase()
            );
          }

          return (
            <option key={school.id} value={school.id}>
              {isAssigned ? '★ ' : ''}{getSchoolDisplayName(school.name)}
            </option>
          );
        })}
      </select>
    </div>
  );
}

