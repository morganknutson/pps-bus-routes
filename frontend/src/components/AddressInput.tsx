import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { autocompleteAddress } from '../services/api';

interface AutocompleteSuggestion {
  displayName: string;
  address: string;
  coordinates: [number, number];
}

export function AddressInput() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setHomeAddress, homeAddress, clearHomeAddress } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete search
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await autocompleteAddress(query);
        setSuggestions(result.suggestions || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: AutocompleteSuggestion) => {
    setHomeAddress({
      address: suggestion.address,
      coordinates: suggestion.coordinates,
    });
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div style={{ 
      position: 'absolute',
      top: '1rem',
      left: '1rem',
      right: '1rem',
      zIndex: 1000,
      padding: '0.5rem 0.75rem',
      backgroundColor: 'var(--bg-primary)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px var(--shadow-large)',
      transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
    }}>
      {homeAddress ? (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <i className="fas fa-house" style={{ color: 'var(--text-primary)', fontSize: '12px', flexShrink: 0 }}></i>
          <div style={{ fontSize: '14px', fontWeight: '500', flex: 1, color: 'var(--text-primary)' }}>{homeAddress.address}</div>
          <button
            onClick={clearHomeAddress}
            style={{
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
              e.currentTarget.style.backgroundColor = '#ff6b6b';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            aria-label="Clear address"
          >
            ×
          </button>
        </div>
      ) : (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', flexShrink: 0, color: 'var(--text-primary)' }}>My Address</h3>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="Enter your address..."
              style={{
                width: '100%',
                padding: '0.375rem 0.5rem',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease',
              }}
            />
          {isLoading && (
            <div
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                color: 'var(--text-tertiary)',
              }}
            >
              Searching...
            </div>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                boxShadow: '0 2px 8px var(--shadow-hover)',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
                transition: 'background-color 0.3s ease, border-color 0.3s ease',
              }}
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  style={{
                    padding: '0.75rem',
                    cursor: 'pointer',
                    borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                  }}
                >
                  {suggestion.displayName}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

