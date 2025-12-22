import React, { useState } from 'react';
import { ChevronIcon } from './ChevronIcon';

interface Contact {
  name: string;
  title: string;
  email: string;
  phone?: string;
  salary?: string;
  tenure?: string | number;
}

export function WhoSection({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const ContactCard = ({ contact }: { contact: Contact }) => (
    <div style={{ 
      flex: '1 1 300px', // Allow wrapping
      minWidth: '250px',
      padding: '1.5rem',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      backgroundColor: 'var(--bg-secondary)',
      marginBottom: '1rem'
    }}>
      <div style={{ 
        fontWeight: 'bold', 
        fontSize: '1.1rem', 
        color: 'var(--text-primary)', 
        marginBottom: '0.25rem',
        fontFamily: 'var(--font-family-heading)'
      }}>
        {contact.name}
      </div>
      <div style={{ 
        color: 'var(--text-secondary)', 
        fontSize: '0.9rem', 
        marginBottom: '1rem', 
        minHeight: '2.7em',
        fontFamily: 'var(--font-family-body)'
      }}>
        {contact.title}
      </div>
      <div style={{ fontFamily: 'var(--font-family-body)' }}>
        {/* Salary hidden as per request */}
        {/* {contact.salary && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
            {contact.salary}
          </div>
        )} */}
        {contact.tenure !== undefined && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
            {contact.tenure} Months in Role
          </div>
        )}
        {contact.phone && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
            {/\d/.test(contact.phone) ? (
              <a 
                href={`tel:${contact.phone.split(' x')[0].replace(/[^\d]/g, '')}`}
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                {contact.phone}
              </a>
            ) : (
              contact.phone
            )}
          </div>
        )}
        <a href={`mailto:${contact.email}`} style={{ color: 'var(--text-primary)', textDecoration: 'underline', fontSize: '0.9rem', display: 'block' }}>
          {contact.email}
        </a>
      </div>
    </div>
  );

  const operationsLeadership: Contact[] = [
    {
      name: "Dr. Jon Franco",
      title: "Senior Chief of Operations",
      email: "jfranco@pps.net",
      phone: "503-916-2430"
    },
    {
      name: "Tom Odgers",
      title: "Chief of Integrated Operations",
      email: "todgers@pps.net",
      phone: "503-916-3471"
    }
  ];

  const transportationLeadership: Contact[] = [
    {
      name: "Brandon Coonrod",
      title: "Senior Director of Transportation",
      email: "bcoonrod@pps.net",
      phone: "503-916-2000 x77295"
    }
  ];

  const otherDirectors: Contact[] = [
    { name: "Sarah Norman", title: "Senior Director, Office of School Modernization (interim)", email: "snorman@pps.net", phone: "No phone number provided" },
    { name: "Molly Romay", title: "Senior Director, Security & Emergency Management", email: "mromay@pps.net", phone: "503-916-3238" },
    { name: "Dana White", title: "Senior Director of Real Estate and Construction", email: "dwhite2@pps.net", phone: "503-916-6544" },
    { name: "Frank Leavitt", title: "Senior Director of Operations", email: "fleavitt@pps.net", phone: "503-916-3019" },
    { name: "Ben Dandeneau", title: "Director of Nutrition Services", email: "bdandene@pps.net", phone: "503-916-3276" },
    { name: "Marshall Haskins", title: "Senior Director of Athletics", email: "mhaskins@pps.net", phone: "503-916-3045" },
  ];

  const techLeadership: Contact[] = [
    {
      name: "Peter Jazowick",
      title: "Senior Director - Technology (OTIS)",
      email: "pjazowick@pps.net",
      phone: "No phone number provided"
    },
    {
      name: "Mark Lancaster",
      title: "Director of IT Infrastructure",
      email: "mlancaster@pps.net",
      phone: "503-916-3805",
      salary: "$163,092 in 2024"
    },
    {
      name: "Alicia Fecker",
      title: "Director of Enterprise Applications",
      email: "afecker@pps.net",
      phone: "503-916-3917",
      salary: "$167,892 in 2024"
    }
  ];

  return (
    <section className={className} style={{ marginBottom: '3rem', ...style }}>
      <h3 style={{ 
        fontSize: '18px', 
        marginBottom: '1rem', 
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family-heading)',
        fontWeight: '600',
        lineHeight: '1.4'
      }}>
        Who made this?
      </h3>
      <p style={{ 
        lineHeight: '1.7', 
        color: 'var(--text-secondary)', 
        marginBottom: '1.5rem',
        fontSize: '15px',
        fontFamily: 'var(--font-family-body)'
      }}>
        <strong>This platform was built by a father of two students</strong> in the Portland Public Schools District. He spent almost two weeks designing and building this system because the current method of delivering bus routes to parents and students is the opposite of user-friendly; in fact, it's practically hostile.
      </p>
      <p style={{ 
        lineHeight: '1.7', 
        color: 'var(--text-secondary)', 
        marginBottom: '1.5rem',
        fontSize: '15px',
        fontFamily: 'var(--font-family-body)'
      }}>
        Nobody should need to spend 30 minutes solving a puzzle of poorly displayed and poorly entered data just to find their closest bus stop. He also thinks it's a travesty that the technology in the PPS district is in such disrepair, and hopes for change.
      </p>
      <p style={{ 
        lineHeight: '1.7', 
        color: 'var(--text-secondary)', 
        marginBottom: '1.5rem',
        fontSize: '15px',
        fontFamily: 'var(--font-family-body)'
      }}>
        <strong>If you're also unhappy</strong> with the experience provided by the operations and technology teams at PPS, you're always welcome to send them a note.
      </p>
      
      {/* Accordion for Contact Info */}
      <div style={{
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        marginTop: '2rem',
        transition: 'all 0.3s ease',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'stretch',
            cursor: 'pointer',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
             e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
             e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
            {/* Main Clickable Area */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              height: '40px',
              flex: 1,
              minWidth: 0,
            }}>
                {/* Icon removed */}

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ 
                            color: 'var(--text-primary)', 
                            fontSize: '14px', 
                            fontWeight: '600',
                            marginTop: '1px',
                            fontFamily: 'var(--font-family-body)'
                        }}>
                            School Administrator Contact Info
                        </span>
                        <span style={{ 
                            fontSize: '13px', 
                            color: 'var(--text-tertiary)', 
                            opacity: 0.8,
                            fontFamily: 'var(--font-family-body)'
                        }}>
                            {operationsLeadership.length + transportationLeadership.length + otherDirectors.length + techLeadership.length} contacts
                        </span>
                    </div>
                </div>
            </div>

            {/* Chevron Button */}
            <div
              style={{
                background: 'none',
                border: 'none',
                borderLeft: '1px solid var(--border-color)',
                padding: '0.5rem 0.75rem',
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '40px',
              }}
            >
               <ChevronIcon direction={isExpanded ? 'up' : 'down'} size={10} />
            </div>
        </div>

        {isExpanded && (
          <div style={{
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '1.5rem'
          }}>
            <h3 style={{ 
              fontSize: 'var(--font-size-h3)', 
              marginTop: '0.5rem', 
              marginBottom: '1rem', 
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-family-heading)',
              fontWeight: '600'
            }}>
              Office of Operations Leadership
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              {operationsLeadership.map((contact, i) => <ContactCard key={i} contact={contact} />)}
            </div>

            <h3 style={{ 
              fontSize: 'var(--font-size-h3)', 
              marginTop: '2rem', 
              marginBottom: '1rem', 
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-family-heading)',
              fontWeight: '600'
            }}>
              Transportation Leadership
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              {transportationLeadership.map((contact, i) => <ContactCard key={i} contact={contact} />)}
            </div>

            <h3 style={{ 
              fontSize: 'var(--font-size-h3)', 
              marginTop: '2rem', 
              marginBottom: '1rem', 
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-family-heading)',
              fontWeight: '600'
            }}>
              Other Operations Directors
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              {otherDirectors.map((contact, i) => <ContactCard key={i} contact={contact} />)}
            </div>

            <h3 style={{ 
              fontSize: 'var(--font-size-h3)', 
              marginTop: '2rem', 
              marginBottom: '1rem', 
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-family-heading)',
              fontWeight: '600'
            }}>
              Technology Leadership (OTIS)
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              {techLeadership.map((contact, i) => <ContactCard key={i} contact={contact} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
