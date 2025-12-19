import React from 'react';

interface SchoolBusFrontProps {
  width?: number;
  height?: number;
  className?: string;
}

export const SchoolBusFront: React.FC<SchoolBusFrontProps> = ({ 
  width = 400, 
  height = 300,
  className 
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 300"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main bus body */}
      <rect
        x="50"
        y="80"
        width="300"
        height="180"
        fill="#FFD700"
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Windshield */}
      <polygon
        points="80,80 320,80 310,140 90,140"
        fill="#87CEEB"
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Windshield divider */}
      <line
        x1="200"
        y1="80"
        x2="200"
        y2="140"
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Grille */}
      <rect
        x="100"
        y="150"
        width="200"
        height="60"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Grille horizontal bars */}
      <line
        x1="100"
        y1="170"
        x2="300"
        y2="170"
        stroke="#333"
        strokeWidth="2"
      />
      <line
        x1="100"
        y1="190"
        x2="300"
        y2="190"
        stroke="#333"
        strokeWidth="2"
      />
      
      {/* Grille vertical bars */}
      <line
        x1="150"
        y1="150"
        x2="150"
        y2="210"
        stroke="#333"
        strokeWidth="2"
      />
      <line
        x1="200"
        y1="150"
        x2="200"
        y2="210"
        stroke="#333"
        strokeWidth="2"
      />
      <line
        x1="250"
        y1="150"
        x2="250"
        y2="210"
        stroke="#333"
        strokeWidth="2"
      />
      
      {/* Headlights */}
      <circle
        cx="120"
        cy="180"
        r="15"
        fill="#FFD700"
        stroke="#000"
        strokeWidth="2"
      />
      <circle
        cx="280"
        cy="180"
        r="15"
        fill="#FFD700"
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Headlight bulbs */}
      <circle
        cx="120"
        cy="180"
        r="8"
        fill="#FFF"
      />
      <circle
        cx="280"
        cy="180"
        r="8"
        fill="#FFF"
      />
      
      {/* Bumper */}
      <rect
        x="90"
        y="220"
        width="220"
        height="20"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Side door (front view shows edge) */}
      <rect
        x="50"
        y="140"
        width="30"
        height="100"
        fill="#FFA500"
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Door handle */}
      <rect
        x="65"
        y="180"
        width="10"
        height="3"
        fill="#1a1a1a"
      />
      
      {/* Stop sign arm (folded position) */}
      <rect
        x="30"
        y="160"
        width="20"
        height="8"
        fill="#FF0000"
        stroke="#000"
        strokeWidth="1"
        rx="2"
      />
      
      {/* Stop sign text */}
      <text
        x="40"
        y="166"
        fontSize="6"
        fill="#FFF"
        textAnchor="middle"
        fontWeight="bold"
      >
        STOP
      </text>
      
      {/* School bus text */}
      <text
        x="200"
        y="245"
        fontSize="24"
        fill="#000"
        textAnchor="middle"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        SCHOOL BUS
      </text>
      
      {/* Side mirrors */}
      <ellipse
        cx="40"
        cy="150"
        rx="8"
        ry="12"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="1"
      />
      <ellipse
        cx="360"
        cy="150"
        rx="8"
        ry="12"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="1"
      />
      
      {/* Roof edge detail */}
      <line
        x1="50"
        y1="80"
        x2="350"
        y2="80"
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Wheel wells */}
      <ellipse
        cx="120"
        cy="240"
        rx="25"
        ry="15"
        fill="#1a1a1a"
      />
      <ellipse
        cx="280"
        cy="240"
        rx="25"
        ry="15"
        fill="#1a1a1a"
      />
      
      {/* Wheels */}
      <circle
        cx="120"
        cy="240"
        r="20"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="2"
      />
      <circle
        cx="280"
        cy="240"
        r="20"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Wheel rims */}
      <circle
        cx="120"
        cy="240"
        r="12"
        fill="#333"
      />
      <circle
        cx="280"
        cy="240"
        r="12"
        fill="#333"
      />
      
      {/* Wheel hub */}
      <circle
        cx="120"
        cy="240"
        r="6"
        fill="#666"
      />
      <circle
        cx="280"
        cy="240"
        r="6"
        fill="#666"
      />
    </svg>
  );
};

