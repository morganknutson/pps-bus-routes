import React from 'react';

interface MapPinIconProps {
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    className?: string;
    filled?: boolean;
}

/**
 * Custom map pin icon component used throughout the app.
 * This is the same icon used on the "Find my stop" button on the map.
 */
export const MapPinIcon: React.FC<MapPinIconProps> = ({
    width = 10,
    height = 13,
    style,
    className,
    filled = false
}) => {
    const hollowPath = "M5 0C7.76142 0 10 2.23858 10 5C10 7.71572 7.92433 10.5969 5.22363 11.9473L5 12.0586L4.77637 11.9473C2.07567 10.5969 0 7.71572 0 5C0 2.23858 2.23858 0 5 0ZM5 1C2.79086 1 1 2.79086 1 5C1 7.18535 2.67361 9.67265 5 10.9355C7.32639 9.67265 9 7.18535 9 5C9 2.79086 7.20914 1 5 1ZM5 3.75C5.69036 3.75 6.25 4.30964 6.25 5C6.25 5.69036 5.69036 6.25 5 6.25C4.30964 6.25 3.75 5.69036 3.75 5C3.75 4.30964 4.30964 3.75 5 3.75Z";
    const filledPath = "M5 0C7.76142 0 10 2.23858 10 5C10 7.71572 7.92433 10.5969 5.22363 11.9473L5 12.0586L4.77637 11.9473C2.07567 10.5969 0 7.71572 0 5C0 2.23858 2.23858 0 5 0ZM5 3.5C4.17157 3.5 3.5 4.17157 3.5 5C3.5 5.82843 4.17157 6.5 5 6.5C5.82843 6.5 6.5 5.82843 6.5 5C6.5 4.17157 5.82843 3.5 5 3.5Z";

    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 10 13"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={style}
            className={className}
        >
            <path
                d={filled ? filledPath : hollowPath}
                fill="currentColor"
            />
        </svg>
    );
};
