import { useState, ReactNode } from 'react';

interface ExpandableExampleProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function ExpandableExample({ title, children, defaultExpanded = false }: ExpandableExampleProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div style={{
      marginTop: '15px',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      overflow: 'hidden',
      transition: 'border-color 0.3s ease',
    }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-secondary)',
          border: 'none',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          color: 'var(--text-primary)',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.2s ease, border-color 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        }}
      >
        <span>{title}</span>
        <i 
          className="fas fa-chevron-down"
          style={{
            fontSize: '12px',
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        />
      </button>
      {isExpanded && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--bg-primary)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}
