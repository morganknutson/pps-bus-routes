import { useDarkMode } from '../hooks/useDarkMode';

interface DirectionToggleProps {
    directionFilter: 'Morning' | 'Afternoon' | 'Both';
    onDirectionChange: (direction: 'Morning' | 'Afternoon' | 'Both') => void;
    showBothOption?: boolean;
}

/**
 * Reusable toggle component for switching between Morning and Afternoon (and optionally Both)
 */
export function DirectionToggle({
    directionFilter,
    onDirectionChange,
    showBothOption = false
}: DirectionToggleProps) {
    const { isDarkMode } = useDarkMode();

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '40px',
            backgroundColor: 'var(--bg-quaternary)',
            borderRadius: 'var(--radius-pill)',
            overflow: 'hidden',
            boxShadow: 'var(--edge-outer-tertiary), var(--inset-shadow-quaternary)',
        }}>
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                zIndex: 2
            }}>
                <div
                    onClick={() => onDirectionChange('Morning')}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: directionFilter === 'Morning' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                >
                    Morning
                </div>
                <div
                    onClick={() => onDirectionChange('Afternoon')}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: directionFilter === 'Afternoon' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                    }}
                >
                    Afternoon
                </div>
                {showBothOption && (
                    <div
                        onClick={() => onDirectionChange('Both')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: directionFilter === 'Both' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                        }}
                    >
                        Both
                    </div>
                )}
            </div>
            <div
                style={{
                    position: 'absolute',
                    top: '4px',
                    bottom: '4px',
                    left: showBothOption
                        ? directionFilter === 'Morning' ? '4px' : directionFilter === 'Afternoon' ? 'calc(33.333% + 4px)' : 'calc(66.666% + 4px)'
                        : directionFilter === 'Morning' ? '4px' : 'calc(50% + 4px)',
                    width: showBothOption ? 'calc(33.333% - 8px)' : 'calc(50% - 8px)',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-pill)',
                    transition: 'left 0.3s ease',
                    zIndex: 1,
                    boxShadow: 'var(--drop-shadow-tertiary)',
                }}
            />
        </div >
    );
}
