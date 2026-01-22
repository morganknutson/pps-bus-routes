import React from 'react';

interface LogoSpinnerProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number;
    className?: string;
}

const LogoSpinner: React.FC<LogoSpinnerProps> = ({
    size = 106,
    color = 'currentColor',
    strokeWidth = 9.11382,
    className = '',
}) => {
    return (
        <div
            className={`logo-spinner-container ${className}`}
            style={{ width: size, height: size }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 113 106"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="logo-spinner-svg"
            >
                {/* Point A: The Top Capsule (Hollow/Outlined) */}
                <rect
                    x="7.5"
                    y="5"
                    width="50.283"
                    height="23.6322"
                    rx="11.8161"
                    stroke="white"
                    stroke-width="9.11382"
                />


                {/* Point B: The Bottom Circle (Hollow/Outlined) */}
                <circle
                    cx="91"
                    cy="91"
                    r="11"
                    stroke={color}
                    stroke-width="9.11382"
                    fill="none"
                />

                {/* The Route: Single stroke line that animates */}
                <path
                    d="
                        M 62.8575 
                                   16.30693 
                        L 82.0373 
                                   16.30693 
                        C 92.6867 
                                   16.30693 
                        101.3078 
                                   24.9627 
                        101.2649 
                                   35.6121 
                        C 101.2224 
                                   46.2011 
                        92.6263 
                                   54.7626 
                        82.0373 
                                   54.7626 
                        L 28.2742 
                                   54.7626 
                        C 18.1828 
                                   54.7626 
                        10.0142 
                                   62.966 
                        10.05704 
                                   73.0573 
                        C 10.09962 
                                   83.0881 
                        18.2432 
                                   91.1973 
                        28.2742 
                                   91.1973 
                        L 78.7649 
                                   91.1973
                      "
                    stroke={color}
                    stroke-width="9.11382"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    className="logo-route-line"
                />
            </svg>
        </div >
    );
};

export default LogoSpinner;


