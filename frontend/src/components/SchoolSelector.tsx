import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { loadLocalRoutes } from '../services/localRoutes';

export function SchoolSelector() {
  const { 
    schools, 
    selectedSchoolId, 
    setSelectedSchool, 
    setSchools, 
    setRoutes, 
    setLoading 
  } = useStore();

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
      console.log('[SchoolSelector] No school selected, skipping route load');
      return;
    }

    console.log('[SchoolSelector] Loading routes for school:', selectedSchoolId);
    const loadRoutes = async () => {
      setLoading(true);
      try {
        const routes = await loadLocalRoutes(selectedSchoolId);
        console.log('[SchoolSelector] Loaded', routes.length, 'routes');
        setRoutes(routes);
      } catch (error) {
        console.error('[SchoolSelector] Failed to load routes:', error);
        setRoutes([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [selectedSchoolId, setRoutes, setLoading]);

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
          borderRadius: '4px',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        <option value="">Select a school...</option>
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
    </div>
  );
}

