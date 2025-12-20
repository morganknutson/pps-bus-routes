import { useState } from 'react';
import { School } from '../types';
import { SchoolTypeFilter, SchoolTypeFilters } from './SchoolTypeFilter';

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
        return '#4ECDC4'; // Default teal
    }
  }
  
  return '#4ECDC4'; // Default teal
}

interface SchoolListProps {
  schools: School[];
  selectedSchoolId: string | null;
  onSelectSchool: (schoolId: string | null) => void;
  enableEditing?: boolean;
  onUpdateSchool?: (schoolId: string, updates: { schoolPageLink?: string | null; driveLink?: string | null }) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  schoolTypeFilters?: SchoolTypeFilters;
  onFiltersChange?: (filters: SchoolTypeFilters) => void;
}

export function SchoolList({ 
  schools, 
  selectedSchoolId, 
  onSelectSchool, 
  enableEditing = false, 
  onUpdateSchool,
  searchTerm: externalSearchTerm,
  onSearchChange: externalOnSearchChange,
  schoolTypeFilters: externalFilters,
  onFiltersChange: externalOnFiltersChange,
}: SchoolListProps) {
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [internalFilters, setInternalFilters] = useState<SchoolTypeFilters>({
    elementary: true,
    middle: true,
    high: true,
    hybrid: true,
  });
  
  // Use external state if provided, otherwise use internal state
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = externalOnSearchChange || setInternalSearchTerm;
  const schoolTypeFilters = externalFilters !== undefined ? externalFilters : internalFilters;
  const setSchoolTypeFilters = externalOnFiltersChange || setInternalFilters;
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [editingPageLink, setEditingPageLink] = useState('');
  const [editingDriveLink, setEditingDriveLink] = useState('');

  const filteredSchools = schools.filter(school => {
    // Search filter
    const matchesSearch = 
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    // School type filter
    const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
    const isHybrid = schoolTypes.includes('Hybrid');
    
    // If it's a hybrid school, check hybrid filter
    if (isHybrid) {
      if (schoolTypeFilters.hybrid) {
        return true; // Show hybrid schools if hybrid filter is enabled
      }
      // If hybrid filter is disabled, don't show hybrid schools
      return false;
    }
    
    // For non-hybrid schools, check individual type filters
    const matchesFilter = 
      (schoolTypes.includes('Elementary School') && schoolTypeFilters.elementary) ||
      (schoolTypes.includes('Middle School') && schoolTypeFilters.middle) ||
      (schoolTypes.includes('High School') && schoolTypeFilters.high);
    
    return matchesFilter;
  });

  const schoolsWithCoords = filteredSchools.filter(s => s.coordinates && s.coordinates.length === 2);
  const schoolsWithoutCoords = filteredSchools.filter(s => !s.coordinates || s.coordinates.length !== 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .school-list-item:hover {
          background-color: var(--bg-secondary) !important;
        }
        .school-list-item.selected {
          background-color: var(--bg-tertiary) !important;
        }
        .school-list-item.selected:hover {
          background-color: var(--bg-tertiary) !important;
        }
      `}</style>
      {/* Search */}
      <div style={{ padding: '0.5rem 1rem 1rem 1rem', borderBottom: '1px solid var(--border-color)', flexShrink: 0, transition: 'border-color 0.3s ease' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search schools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              paddingRight: searchTerm ? '2.5rem' : '0.75rem',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              fontSize: '12px',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, padding-right 0.2s ease',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                lineHeight: '1',
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                transition: 'background-color 0.2s ease, color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* School list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filteredSchools.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            No schools found
          </div>
        ) : (
          <div>
            {schoolsWithCoords.map((school) => {
              const schoolTypes = school.schoolTypes || getSchoolTypes(school.name);
              const schoolColor = getSchoolColor(schoolTypes);
              const isSelected = school.id === selectedSchoolId;
              const isEditing = editingSchoolId === school.id;
              
              return (
                <div
                  key={school.id}
                  className={`school-list-item ${isSelected ? 'selected' : ''}`}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    borderLeft: `4px solid ${schoolColor}`,
                    transition: 'background-color 0.3s ease, border-color 0.3s ease',
                  }}
                >
                  <div
                    onClick={() => {
                      if (!isEditing) {
                        // Toggle selection: if already selected, deselect; otherwise select
                        if (isSelected) {
                          onSelectSchool(null); // Pass null to deselect
                        } else {
                          onSelectSchool(school.id);
                        }
                      }
                    }}
                    style={{
                      padding: '1rem 1rem 1rem 1.5rem',
                      cursor: isEditing ? 'default' : 'pointer',
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {school.name}
                        </div>
                        {enableEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchoolId(school.id);
                              setEditingPageLink(school.schoolPageLink || '');
                              setEditingDriveLink(school.driveLink || '');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--text-tertiary)',
                              transition: 'color 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#4ECDC4';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-tertiary)';
                            }}
                          >
                            <i className="fas fa-edit" style={{ fontSize: '14px' }}></i>
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: schoolColor, marginBottom: '0.25rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <i className="fas fa-graduation-cap" style={{ fontSize: '10px', width: '10px', flexShrink: 0 }}></i>
                        <span>{schoolTypes.join(' & ')}</span>
                      </div>
                      {school.address && (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <i className="fas fa-map-marker-alt" style={{ fontSize: '10px', width: '10px', flexShrink: 0, color: 'var(--text-tertiary)' }}></i>
                          <span>{school.address.split(',')[0]}</span>
                        </div>
                      )}
                      {school.routeCount !== undefined && (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <i className="fas fa-route" style={{ fontSize: '10px', width: '10px', flexShrink: 0 }}></i>
                          <span>{school.routeCount} {school.routeCount === 1 ? 'route' : 'routes'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isEditing && enableEditing && onUpdateSchool && (
                    <div style={{ padding: '0 1rem 1rem 1rem', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                            Page Link
                          </label>
                          <input
                            type="text"
                            value={editingPageLink}
                            onChange={(e) => setEditingPageLink(e.target.value)}
                            placeholder="School page URL..."
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              fontSize: '12px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              boxSizing: 'border-box',
                              backgroundColor: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                            Drive Link
                          </label>
                          <input
                            type="text"
                            value={editingDriveLink}
                            onChange={(e) => setEditingDriveLink(e.target.value)}
                            placeholder="Google Drive folder URL..."
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              fontSize: '12px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              boxSizing: 'border-box',
                              backgroundColor: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (onUpdateSchool) {
                                await onUpdateSchool(school.id, {
                                  schoolPageLink: editingPageLink || null,
                                  driveLink: editingDriveLink || null,
                                });
                                setEditingSchoolId(null);
                                setEditingPageLink('');
                                setEditingDriveLink('');
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              fontSize: '12px',
                              backgroundColor: '#4ECDC4',
                              color: 'white',
                              border: 'none',
                              borderRadius: '9999px',
                              cursor: 'pointer',
                              fontWeight: '500',
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchoolId(null);
                              setEditingPageLink('');
                              setEditingDriveLink('');
                            }}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              fontSize: '12px',
                              backgroundColor: '#ccc',
                              color: 'white',
                              border: 'none',
                              borderRadius: '9999px',
                              cursor: 'pointer',
                              fontWeight: '500',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {schoolsWithoutCoords.length > 0 && (
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderTop: '2px solid #ffd700', transition: 'background-color 0.3s ease' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Schools without coordinates ({schoolsWithoutCoords.length})
                </div>
                {schoolsWithoutCoords.map((school) => {
                  const isEditing = editingSchoolId === school.id;
                  return (
                    <div
                      key={school.id}
                      className={`school-list-item ${school.id === selectedSchoolId ? 'selected' : ''}`}
                      style={{
                        padding: '0.5rem',
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <div
                        onClick={() => {
                          if (!isEditing) {
                            // Toggle selection: if already selected, deselect; otherwise select
                            if (school.id === selectedSchoolId) {
                              onSelectSchool(null); // Pass null to deselect
                            } else {
                              onSelectSchool(school.id);
                            }
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: isEditing ? 'default' : 'pointer',
                        }}
                      >
                        <span>{school.name}</span>
                        {enableEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchoolId(school.id);
                              setEditingPageLink(school.schoolPageLink || '');
                              setEditingDriveLink(school.driveLink || '');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--text-tertiary)',
                              transition: 'color 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#4ECDC4';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-tertiary)';
                            }}
                          >
                            <i className="fas fa-edit" style={{ fontSize: '14px' }}></i>
                          </button>
                        )}
                      </div>
                      {school.address && (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <i className="fas fa-map-marker-alt" style={{ fontSize: '10px', width: '10px', flexShrink: 0 }}></i>
                          <span>{school.address}</span>
                        </div>
                      )}
                      {isEditing && enableEditing && onUpdateSchool && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', border: '1px solid var(--border-color)', transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                                Page Link
                              </label>
                              <input
                                type="text"
                                value={editingPageLink}
                                onChange={(e) => setEditingPageLink(e.target.value)}
                                placeholder="School page URL..."
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  fontSize: '12px',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box',
                                  backgroundColor: 'var(--bg-secondary)',
                                  color: 'var(--text-primary)',
                                  transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                                Drive Link
                              </label>
                              <input
                                type="text"
                                value={editingDriveLink}
                                onChange={(e) => setEditingDriveLink(e.target.value)}
                                placeholder="Google Drive folder URL..."
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  fontSize: '12px',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  boxSizing: 'border-box',
                                  backgroundColor: 'var(--bg-secondary)',
                                  color: 'var(--text-primary)',
                                  transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (onUpdateSchool) {
                                    await onUpdateSchool(school.id, {
                                      schoolPageLink: editingPageLink || null,
                                      driveLink: editingDriveLink || null,
                                    });
                                    setEditingSchoolId(null);
                                    setEditingPageLink('');
                                    setEditingDriveLink('');
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  fontSize: '12px',
                                  backgroundColor: '#4ECDC4',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '500',
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSchoolId(null);
                                  setEditingPageLink('');
                                  setEditingDriveLink('');
                                }}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  fontSize: '12px',
                                  backgroundColor: '#ccc',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: '500',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* School Type Filters */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)' }}>
        <SchoolTypeFilter 
          filters={schoolTypeFilters}
          onChange={setSchoolTypeFilters}
        />
      </div>
    </div>
  );
}

