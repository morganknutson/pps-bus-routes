import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { School, AssignedSchools } from '../types';
import { analyticsService } from '../services/analytics';
import { RouteIcon } from './RouteIcon';
import { SchoolTypeFilter, SchoolTypeFilters } from './SchoolTypeFilter';
import { MapPinIcon } from './MapPinIcon';
import { getSchoolDisplayName, getSchoolTypes, getSchoolColor } from '../utils/schoolUtils';
import { XIcon } from './XIcon';
import { SearchIcon } from './SearchIcon';

interface SchoolListProps {
  schools: School[];
  selectedSchoolId: string | null;
  onSelectSchool: (schoolId: string | null) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  schoolTypeFilters?: SchoolTypeFilters;
  onFiltersChange?: (filters: SchoolTypeFilters) => void;
  onMobileClose?: () => void;
  assignedSchools?: AssignedSchools | null;
}

export function SchoolList({
  schools,
  selectedSchoolId, // STATE: Selected School ID - Currently selected school (null if none selected)
  onSelectSchool,
  searchTerm: externalSearchTerm,
  onSearchChange: externalOnSearchChange,
  schoolTypeFilters: externalFilters,
  onFiltersChange: externalOnFiltersChange,
  onMobileClose,
  assignedSchools: externalAssignedSchools,
}: SchoolListProps) {
  // STATE: Mobile Detection - Determines if component is rendered on mobile device
  const isMobile = useIsMobile();
  
  // STATE: Internal Search - Local search term state (used when no external state provided)
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  
  // STATE: Internal Filters - Local filter state (used when no external state provided)
  const [internalFilters, setInternalFilters] = useState<SchoolTypeFilters>({
    elementary: true,
    middle: true,
    high: true,
    hybrid: true,
    noRoutes: true,
  });

  // STATE: Resolved Search - Uses external search term if provided, otherwise internal state
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = externalOnSearchChange || setInternalSearchTerm;
  
  // STATE: Resolved Filters - Uses external filters if provided, otherwise internal state
  const schoolTypeFilters = externalFilters !== undefined ? externalFilters : internalFilters;
  const setSchoolTypeFilters = (filters: SchoolTypeFilters) => {
    if (externalOnFiltersChange) externalOnFiltersChange(filters);
    else setInternalFilters(filters);
  };

  // STATE: Filtered Schools - Schools filtered by search term and school type filters
  const filteredSchools = schools.filter(school => {
    // Search filter
    const matchesSearch =
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // School type filter
    const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
    const isHybrid = schoolTypes.includes('K-8');
    const hasNoRoutes = school.routeCount === 0;

    // 1. Check School Type Filter first (PRIORITY)
    let matchesType = false;
    if (isHybrid) {
      matchesType = schoolTypeFilters.hybrid;
    } else {
      matchesType =
        (schoolTypes.includes('Elementary School') && schoolTypeFilters.elementary) ||
        (schoolTypes.includes('Middle School') && schoolTypeFilters.middle) ||
        (schoolTypes.includes('High School') && schoolTypeFilters.high);
    }

    if (!matchesType) return false;

    // 2. Then check Route Status Filter
    if (hasNoRoutes && !schoolTypeFilters.noRoutes) {
      return false;
    }

    return true;
  });

  // STATE: Assigned Schools Data - Uses external assigned schools if provided, otherwise from Zustand store
  const storeAssignedSchools = useStore(state => state.assignedSchools);
  const assignedSchoolsData = externalAssignedSchools !== undefined ? externalAssignedSchools : storeAssignedSchools;

  // STATE: Assigned/Others Split - Separates filtered schools into assigned (user's home schools) and others
  const { assigned, others } = useMemo(() => {
    if (!assignedSchoolsData || searchTerm) {
      return { assigned: [], others: filteredSchools };
    }

    // Build list of assigned school names from arrays
    const assignedNames: string[] = [];
    const schoolArrays = [
      assignedSchoolsData.elementary,
      assignedSchoolsData.middle,
      assignedSchoolsData.high,
      assignedSchoolsData.k8
    ];
    
    schoolArrays.forEach(schoolArray => {
      if (Array.isArray(schoolArray)) {
        schoolArray.forEach(school => {
          if (school && school.name) {
            assignedNames.push(school.name.toLowerCase().trim());
          }
        });
      }
    });

    const assigned: School[] = [];
    const others: School[] = [];

    filteredSchools.forEach(school => {
      const schoolNameLower = school.name.toLowerCase().trim();

      const isAssigned = assignedNames.some(assignedName => {
        if (!assignedName) return false;

        // Exact or substring match
        if (schoolNameLower === assignedName ||
          schoolNameLower.includes(assignedName) ||
          assignedName.includes(schoolNameLower)) {
          return true;
        }

        // Handle specific PPS naming patterns (remove non-alphanumeric)
        const normalizedSchool = schoolNameLower.replace(/[^a-z0-9]/g, '');
        const normalizedAssigned = assignedName.replace(/[^a-z0-9]/g, '');
        return normalizedSchool.includes(normalizedAssigned) || normalizedAssigned.includes(normalizedSchool);
      });

      if (isAssigned) {
        assigned.push(school)
      } else {
        others.push(school);
      }
    });

    return { assigned, others };
  }, [filteredSchools, assignedSchoolsData, searchTerm]);

  /* 
   * STATE: Assigned Schools - Determined in the useMemo hook above. 
   * Styled with distinct bg-secondary background. Only shown when no search term is active.
   */

  // Helper to render a school item
  const renderSchoolItem = (school: School) => {
    const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
    const schoolColor = getSchoolColor(schoolTypes);
    
    // STATE: Individual School Selection - Whether this specific school is currently selected
    const isSelected = school.id === selectedSchoolId;

    return (
      <div
        key={school.id}
        data-testid="school-list-item"
        className={`school-list-item ${isSelected ? 'selected' : ''}`}
        style={{ '--school-color': schoolColor } as React.CSSProperties}
      >
        <div
          onClick={() => {
            if (isSelected) {
              onSelectSchool(null);
            } else {
              analyticsService.trackSchoolSelect(school.name, 'explorer_list');
              onSelectSchool(school.id);
            }
          }}
          className="school-list-item-content"
        >
          <div className="school-list-item-info">
            <div className="school-list-item-title-wrapper">
              <div className="school-list-item-title">
                {getSchoolDisplayName(school.name)}
              </div>
            </div>
            <div className="school-list-item-meta type">
              <div className="school-list-item-meta-icon">
                <i className="fas fa-graduation-cap"></i>
              </div>
              <span>{schoolTypes.join(' & ')}</span>
            </div>
            {school.address && (
              <div className="school-list-item-meta address">
                <div className="school-list-item-meta-icon address">
                  <MapPinIcon width={10} height={12} />
                </div>
                <span>{school.address.split(',')[0]}</span>
              </div>
            )}
            {school.routeCount !== undefined && (
              <div className={`school-list-item-meta routes ${school.routeCount === 0 ? 'no-routes' : ''}`}>
                {school.routeCount === 0 ? (
                  <>
                    <div className="school-list-item-meta-icon routes">
                      <i className="fas fa-exclamation-circle"></i>
                    </div>
                    <span>Routes not provided by district</span>
                  </>
                ) : (
                  <>
                    <div className="school-list-item-meta-icon">
                      <RouteIcon size={10} color="var(--text-tertiary)" />
                    </div>
                    <span>{school.routeCount} {school.routeCount === 1 ? 'route' : 'routes'}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>


      </div>
    );
  };

  // STATE: Schools with Coordinates - Other schools that have valid coordinate data (for map display)
  const schoolsWithCoords = others.filter(s => s.coordinates && s.coordinates.length === 2);
  
  // STATE: Schools without Coordinates - Other schools missing coordinate data (shown in separate section)
  const schoolsWithoutCoords = others.filter(s => !s.coordinates || s.coordinates.length !== 2);

  return (
    <div className="school-list-container">
      {/* Search */}
      <div className="school-search-section">
        <div className="school-search-container">
          <div className="school-search-input-wrapper">
            <div className="school-search-icon">
              <SearchIcon size={11} color="var(--text-primary)" />
            </div>
            <input
              type="text"
              className={`school-search-input ${searchTerm ? 'has-clear' : ''}`}
              placeholder="Search schools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="school-search-clear"
                aria-label="Clear search"
              >
                <XIcon />
              </button>
            )}
          </div>
        </div>
      </div>



      {/* Main School list */}
      <div className="school-list-scroll">
        {/* STATE: Empty Results - No schools match current search/filter criteria */}
        {filteredSchools.length === 0 ? (
          <div className="school-no-results">
            No schools found
          </div>
        ) : (
          <div>
            {/* STATE: Assigned Schools Section - User's home location schools (only shown when no search active) */}
            {assigned.length > 0 && (
              <div className="school-assigned-section">
                <div className="eyebrow school-section-header">
                  <i className="fas fa-home"></i>
                  Your Assigned Schools
                </div>
                {assigned.map(school => renderSchoolItem(school))}
              </div>
            )}

            {/* STATE: Other Schools Header - Separator between assigned and other schools */}
            {assigned.length > 0 && others.length > 0 && (
              <div className="eyebrow school-section-header">
                All other schools
              </div>
            )}

            {/* STATE: Schools with Coordinates - Rendered with full school item component */}
            {schoolsWithCoords.map((school) => renderSchoolItem(school))}
            
            {/* STATE: Schools without Coordinates Section - Special section for schools missing coordinate data */}
            {schoolsWithoutCoords.length > 0 && (
              <div className="school-no-coords-section">
                <div className="school-no-coords-header">
                  Schools without coordinates ({schoolsWithoutCoords.length})
                </div>
                {schoolsWithoutCoords.map((school) => (
                  <div
                    key={school.id}
                    className={`school-list-item ${school.id === selectedSchoolId ? 'selected' : ''} school-no-coords-item`}
                  >
                    <div
                      onClick={() => {
                        // Toggle selection: if already selected, deselect; otherwise select
                        if (school.id === selectedSchoolId) {
                          onSelectSchool(null); // Pass null to deselect
                        } else {
                          onSelectSchool(school.id);
                        }
                      }}
                      className="school-list-item-content"
                    >
                      <span className="school-no-coords-item-title">{getSchoolDisplayName(school.name)}</span>
                    </div>
                    {school.address && (
                      <div className="school-list-item-meta address">
                        <div className="school-list-item-meta-icon">
                          <i className="fas fa-map-marker-alt"></i>
                        </div>
                        <span>{school.address}</span>
                      </div>
                    )}
                    {school.routeCount !== undefined && (
                      <div className={`school-list-item-meta routes ${school.routeCount === 0 ? 'no-routes' : ''}`}>
                        {school.routeCount === 0 ? (
                          <>
                            <div className="school-list-item-meta-icon routes">
                              <i className="fas fa-exclamation-circle"></i>
                            </div>
                            <span>Routes not provided by district</span>
                          </>
                        ) : (
                          <>
                            <div className="school-list-item-meta-icon">
                              <RouteIcon size={10} color="var(--text-tertiary)" />
                            </div>
                            <span>{school.routeCount} {school.routeCount === 1 ? 'route' : 'routes'}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* School Type Filters */}
      <SchoolTypeFilter
        filters={schoolTypeFilters}
        onChange={setSchoolTypeFilters}
      />
    </div>
  );
}

