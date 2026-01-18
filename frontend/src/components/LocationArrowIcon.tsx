import React from 'react';

interface LocationArrowIconProps {
    size?: number | string;
    color?: string;
    style?: React.CSSProperties;
    className?: string;
}

/**
 * Custom location arrow icon component provided by the user.
 * Used for the location autofill button in address input fields.
 */
export const LocationArrowIcon: React.FC<LocationArrowIconProps> = ({
    size = 15,
    color = 'currentColor',
    style,
    className
}) => {
    const sizeValue = typeof size === 'number' ? `${size}px` : size;

    return (
        <svg
            width={sizeValue}
            height={sizeValue}
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={style}
            className={className}
            aria-hidden="true"
        >
            <path
                d="M0.323831 5.26368C-0.141961 5.4391 -0.0933201 6.11322 0.392831 6.21996L6.5773 7.57781C6.76221 7.6184 6.90832 7.75994 6.95479 7.94346L8.63988 14.5993C8.76002 15.0739 9.41996 15.111 9.5925 14.6529L14.856 0.677345C15.0076 0.27499 14.6143 -0.11833 14.2119 0.0332036L0.323831 5.26368Z"
                fill={color}
            />
        </svg>
    );
};

export default LocationArrowIcon;
