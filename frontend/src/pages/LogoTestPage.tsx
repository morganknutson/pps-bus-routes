import React, { useState } from 'react';
import LogoSpinner from '../components/LogoSpinner';
import { Header } from '../components/Header';

const LogoTestPage: React.FC = () => {
    const [size, setSize] = useState(150);
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [isDarkMode, setIsDarkMode] = useState(false);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
            color: isDarkMode ? '#ffffff' : '#000000',
            transition: 'all 0.3s ease'
        }}>
            <Header />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3rem',
                padding: '2rem'
            }}>
                <div style={{
                    padding: '4rem',
                    borderRadius: '32px',
                    backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <LogoSpinner
                        size={size}
                        strokeWidth={strokeWidth}
                        color={isDarkMode ? '#ffffff' : '#133A60'}
                    />
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    padding: '2rem',
                    backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                    borderRadius: '20px',
                    width: '100%',
                    maxWidth: '400px',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.05)'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', textAlign: 'center' }}>Test Controls</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label>Size: {size}px</label>
                        <input
                            type="range"
                            min="40"
                            max="400"
                            value={size}
                            onChange={(e) => setSize(Number(e.target.value))}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label>Stroke Width: {strokeWidth}</label>
                        <input
                            type="range"
                            min="0.5"
                            max="10"
                            step="0.5"
                            value={strokeWidth}
                            onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        />
                    </div>

                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        style={{
                            padding: '0.75rem',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: isDarkMode ? '#ffffff' : '#000000',
                            color: isDarkMode ? '#000000' : '#ffffff',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Toggle {isDarkMode ? 'Light' : 'Dark'} Mode
                    </button>

                    <a
                        href="/"
                        style={{
                            textAlign: 'center',
                            color: isDarkMode ? '#aaa' : '#666',
                            textDecoration: 'none',
                            fontSize: '0.9rem'
                        }}
                    >
                        ← Back to Home
                    </a>
                </div>
            </main>
        </div>
    );
};

export default LogoTestPage;
