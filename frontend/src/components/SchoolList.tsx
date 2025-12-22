import { useState } from 'react';
import { School } from '../types';
import { analyticsService } from '../services/analytics';
import { RouteIcon } from './RouteIcon';
import { SchoolTypeFilter, SchoolTypeFilters } from './SchoolTypeFilter';
import { MapPinIcon } from './MapPinIcon';
import { getSchoolDisplayName } from '../utils/schoolUtils';

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
  onUpdateSchool?: (schoolId: string, updates: { name?: string; schoolPageLink?: string | null; driveLink?: string | null; address?: string | null; coordinates?: [number, number] | null }) => void;
  onAddSchool?: (school: { name: string; schoolPageLink: string | null; driveLink: string | null; address: string | null; coordinates: [number, number] | null }) => Promise<void>;
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
  onAddSchool,
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
  const [editingName, setEditingName] = useState('');
  const [editingPageLink, setEditingPageLink] = useState('');
  const [editingDriveLink, setEditingDriveLink] = useState('');
  const [editingAddress, setEditingAddress] = useState('');
  const [isAddingSchool, setIsAddingSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolPageLink, setNewSchoolPageLink] = useState('');
  const [newSchoolDriveLink, setNewSchoolDriveLink] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');

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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
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
          {enableEditing && (
            <button
              onClick={() => setIsAddingSchool(!isAddingSchool)}
              style={{
                backgroundColor: isAddingSchool ? 'var(--text-tertiary)' : '#4ECDC4',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                flexShrink: 0,
              }}
              title={isAddingSchool ? "Cancel adding school" : "Add new school"}
            >
              <i className={`fas ${isAddingSchool ? 'fa-times' : 'fa-plus'}`}></i>
            </button>
          )}
        </div>
      </div>

      {/* Add School Form */}
      {isAddingSchool && enableEditing && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: 'var(--bg-secondary)', 
          borderBottom: '1px solid var(--border-color)',
          transition: 'background-color 0.3s ease, border-color 0.3s ease'
        }}>
          <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Add New School
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                School Name *
              </label>
              <input
                type="text"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="e.g. Lincoln High School"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                Address
              </label>
              <input
                type="text"
                value={newSchoolAddress}
                onChange={(e) => setNewSchoolAddress(e.target.value)}
                placeholder="Full address..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                Page Link
              </label>
              <input
                type="text"
                value={newSchoolPageLink}
                onChange={(e) => setNewSchoolPageLink(e.target.value)}
                placeholder="PPS website URL..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                Drive Link
              </label>
              <input
                type="text"
                value={newSchoolDriveLink}
                onChange={(e) => setNewSchoolDriveLink(e.target.value)}
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
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                disabled={!newSchoolName}
                onClick={async () => {
                  if (onAddSchool && newSchoolName) {
                    await onAddSchool({
                      name: newSchoolName,
                      schoolPageLink: newSchoolPageLink || null,
                      driveLink: newSchoolDriveLink || null,
                      address: newSchoolAddress || null,
                      coordinates: null, // Backend doesn't support geocoding on create yet
                    });
                    setIsAddingSchool(false);
                    setNewSchoolName('');
                    setNewSchoolPageLink('');
                    setNewSchoolDriveLink('');
                    setNewSchoolAddress('');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  fontSize: '12px',
                  backgroundColor: newSchoolName ? '#4ECDC4' : 'var(--text-tertiary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  cursor: newSchoolName ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                }}
              >
                Create School
              </button>
            </div>
          </div>
        </div>
      )}

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
                  data-testid="school-list-item"
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
                          analyticsService.trackSchoolSelect(school.name, enableEditing ? 'admin_list' : 'explorer_list');
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
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-secondary)' }}>
                          {getSchoolDisplayName(school.name)}
                        </div>
                        {enableEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchoolId(school.id);
                              setEditingName(school.name);
                              setEditingPageLink(school.schoolPageLink || '');
                              setEditingDriveLink(school.driveLink || '');
                              setEditingAddress(school.address || '');
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
                        <div style={{ width: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fas fa-graduation-cap" style={{ fontSize: '11px' }}></i>
                        </div>
                        <span>{schoolTypes.join(' & ')}</span>
                      </div>
                      {school.address && (
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <div style={{ width: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MapPinIcon width={10} height={13} style={{ color: 'var(--text-tertiary)' }} />
                          </div>
                          <span>{school.address.split(',')[0]}</span>
                        </div>
                      )}
                      {school.routeCount !== undefined && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: school.routeCount === 0 ? '#f44' : 'var(--text-tertiary)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.375rem',
                          fontWeight: school.routeCount === 0 ? '600' : '400'
                        }}>
                          {school.routeCount === 0 ? (
                            <>
                              <div style={{ width: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="fas fa-exclamation-circle" style={{ fontSize: '12px' }}></i>
                              </div>
                              <span>Routes not provided by district</span>
                            </>
                          ) : (
                            <>
                              <div style={{ width: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <RouteIcon size={10} color="var(--text-tertiary)" />
                              </div>
                              <span>{school.routeCount} {school.routeCount === 1 ? 'route' : 'routes'}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isEditing && enableEditing && onUpdateSchool && (
                    <div style={{ padding: '0 1rem 1rem 1rem', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                            School Name
                          </label>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="School name..."
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
                            Address
                          </label>
                          <input
                            type="text"
                            value={editingAddress}
                            onChange={(e) => setEditingAddress(e.target.value)}
                            placeholder="School physical address..."
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
                                  name: editingName,
                                  schoolPageLink: editingPageLink || null,
                                  driveLink: editingDriveLink || null,
                                  address: editingAddress || null,
                                });
                                setEditingSchoolId(null);
                                setEditingName('');
                                setEditingPageLink('');
                                setEditingDriveLink('');
                                setEditingAddress('');
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
                        <span style={{ fontSize: '14px', fontWeight: '700' }}>{getSchoolDisplayName(school.name)}</span>
                        {enableEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchoolId(school.id);
                              setEditingName(school.name);
                              setEditingPageLink(school.schoolPageLink || '');
                              setEditingDriveLink(school.driveLink || '');
                              setEditingAddress(school.address || '');
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
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <div style={{ width: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fas fa-map-marker-alt" style={{ fontSize: '12px' }}></i>
                          </div>
                          <span>{school.address}</span>
                        </div>
                      )}
                      {school.routeCount !== undefined && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: school.routeCount === 0 ? '#f44' : 'var(--text-tertiary)', 
                          marginTop: '0.25rem',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.375rem',
                          fontWeight: school.routeCount === 0 ? '600' : '400'
                        }}>
                          {school.routeCount === 0 ? (
                            <>
                              <div style={{ width: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="fas fa-exclamation-circle" style={{ fontSize: '12px' }}></i>
                              </div>
                              <span>Routes not provided by district</span>
                            </>
                          ) : (
                            <>
                              <div style={{ width: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <RouteIcon size={10} color="var(--text-tertiary)" />
                              </div>
                              <span>{school.routeCount} {school.routeCount === 1 ? 'route' : 'routes'}</span>
                            </>
                          )}
                        </div>
                      )}
                      {isEditing && enableEditing && onUpdateSchool && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', border: '1px solid var(--border-color)', transition: 'background-color 0.3s ease, border-color 0.3s ease' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                                School Name
                              </label>
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                placeholder="School name..."
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
                                Address
                              </label>
                            <input
                              type="text"
                              value={editingAddress}
                              onChange={(e) => setEditingAddress(e.target.value)}
                              placeholder="School physical address..."
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

