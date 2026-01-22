import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { School, AssignedSchools } from '../types';
import { analyticsService } from '../services/analytics';
import { RouteIcon } from './RouteIcon';
import { SchoolTypeFilter, SchoolTypeFilters } from './SchoolTypeFilter';
import { MapPinIcon } from './MapPinIcon';
import { getSchoolDisplayName } from '../utils/schoolUtils';
import { XIcon } from './XIcon';


// Infer school type(s) from name - returns array to support hybrid schools
function getSchoolTypes(schoolName: string): ('Elementary School' | 'Middle School' | 'High School' | 'Hybrid')[] {
  const name = schoolName.toLowerCase();

  // Hybrid schools - schools that serve multiple grade levels
  // Check these FIRST before other type checks
  const hybridSchools = ['access'];

  if (hybridSchools.some(key => name.includes(key))) {
    return ['Hybrid'];
  }

  // Check for explicit type in name
  const hasElementary = name.includes('elementary');
  const hasMiddle = name.includes('middle');
  const hasHigh = name.includes('high');

  // Known high schools in Portland
  const highSchools = [
    'lincoln', 'franklin', 'benson', 'grant', 'cleveland', 'jefferson',
    'roosevelt', 'wilson', 'madison', 'marshall', 'da vinci', 'davinci'
  ];
  const isHighSchool = highSchools.some(hs => name.includes(hs)) || hasHigh;

  // Known middle schools in Portland
  const middleSchools = [
    'beaumont', 'hosford', 'west sylvan', 'george', 'harrison park',
    'lane', 'gray', 'kelly', 'kellogg', 'mt tabor', 'mt. tabor', 'roseway heights'
  ];
  const isMiddleSchool = middleSchools.some(ms => name.includes(ms)) || hasMiddle;

  // Default to elementary if no match
  const isElementary = hasElementary || (!isMiddleSchool && !isHighSchool);

  const types: ('Elementary School' | 'Middle School' | 'High School' | 'Hybrid')[] = [];
  if (isElementary) types.push('Elementary School');
  if (isMiddleSchool) types.push('Middle School');
  if (isHighSchool) types.push('High School');

  return types.length > 0 ? types : ['Elementary School'];
}

// Get color for school type(s)
function getSchoolColor(schoolTypes: ('Elementary School' | 'Middle School' | 'High School' | 'Hybrid')[]): string {
  if (schoolTypes.includes('Hybrid')) {
    return '#9C27B0'; // Purple for hybrid schools
  }
  if (schoolTypes.length === 1) {
    switch (schoolTypes[0]) {
      case 'Elementary School':
        return '#2196F3'; // Blue
      case 'Middle School':
        return '#4CAF50'; // Green
      case 'High School':
        return '#FF9800'; // Orange
      default:
        return '#FFFFFF'; // Default teal
    }
  }

  return '#FFFFFF'; // Default teal
}

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
  selectedSchoolId,
  onSelectSchool,
  searchTerm: externalSearchTerm,
  onSearchChange: externalOnSearchChange,
  schoolTypeFilters: externalFilters,
  onFiltersChange: externalOnFiltersChange,
  onMobileClose,
  assignedSchools: externalAssignedSchools,
}: SchoolListProps) {
  const isMobile = useIsMobile();
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [internalFilters, setInternalFilters] = useState<SchoolTypeFilters>({
    elementary: true,
    middle: true,
    high: true,
    hybrid: true,
    noRoutes: true,
  });

  // Use external state if provided, otherwise use internal state
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = externalOnSearchChange || setInternalSearchTerm;
  const schoolTypeFilters = externalFilters !== undefined ? externalFilters : internalFilters;
  const setSchoolTypeFilters = (filters: SchoolTypeFilters) => {
    if (externalOnFiltersChange) externalOnFiltersChange(filters);
    else setInternalFilters(filters);
  };


  const filteredSchools = schools.filter(school => {
    // Search filter
    const matchesSearch =
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // School type filter
    const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
    const isHybrid = schoolTypes.includes('Hybrid');
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

  const storeAssignedSchools = useStore(state => state.assignedSchools);
  const assignedSchoolsData = externalAssignedSchools !== undefined ? externalAssignedSchools : storeAssignedSchools;

  // Split into assigned and other schools
  const { assigned, others } = useMemo(() => {
    if (!assignedSchoolsData || searchTerm) {
      return { assigned: [], others: filteredSchools };
    }

    const assignedNames = [
      assignedSchoolsData.elementary?.name,
      assignedSchoolsData.middle?.name,
      assignedSchoolsData.high?.name,
      assignedSchoolsData.k8?.name
    ].filter(Boolean).map(n => n!.toLowerCase().trim());

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
   * Assigned State: Determined in the useMemo hook above. Styled with distinct bg-secondary background.
   */

  // Helper to render a school item
  const renderSchoolItem = (school: School) => {
    const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
    const schoolColor = getSchoolColor(schoolTypes);
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

  const schoolsWithCoords = others.filter(s => s.coordinates && s.coordinates.length === 2);
  const schoolsWithoutCoords = others.filter(s => !s.coordinates || s.coordinates.length !== 2);

  return (
    <div className="school-list-container">
      {/* Search */}
      <div className="school-search-section">
        <div className="school-search-container">
          <div className="school-search-input-wrapper">
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



      {/* School list */}
      <div className="school-list-scroll">
        {filteredSchools.length === 0 ? (
          <div className="school-no-results">
            No schools found
          </div>
        ) : (
          <div>
            {/* STATE: Assigned Schools (Home Location) */}
            {assigned.length > 0 && (
              <div className="school-assigned-section">
                <div className="eyebrow school-section-header">
                  <i className="fas fa-home"></i>
                  Your Assigned Schools
                </div>
                {assigned.map(school => renderSchoolItem(school))}
              </div>
            )}

            {/* Other Schools Header */}
            {assigned.length > 0 && others.length > 0 && (
              <div className="eyebrow school-section-header">
                All other schools
              </div>
            )}

            {schoolsWithCoords.map((school) => renderSchoolItem(school))}
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

