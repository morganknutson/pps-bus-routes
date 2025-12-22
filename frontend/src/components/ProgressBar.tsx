interface ProgressBarProps {
  /**
   * Progress percentage (0-100). If undefined, shows indeterminate/animated progress.
   */
  progress?: number;
  /**
   * Label text to display above or next to the progress bar
   */
  label?: string;
  /**
   * Height of the progress bar in pixels
   */
  height?: number;
  /**
   * Color of the progress bar fill
   */
  color?: string;
  /**
   * Show percentage text
   */
  showPercentage?: boolean;
  /**
   * Additional styles for the container
   */
  containerStyle?: React.CSSProperties;
  /**
   * Additional styles for the label
   */
  labelStyle?: React.CSSProperties;
}

/**
 * Reusable progress bar component that supports both determinate and indeterminate progress.
 * 
 * - Determinate: Shows actual progress percentage (0-100)
 * - Indeterminate: Shows animated progress when progress is undefined
 */
export function ProgressBar({
  progress,
  label,
  height = 8,
  color = '#FFFFFF',
  showPercentage = false,
  containerStyle,
  labelStyle,
}: ProgressBarProps) {
  const isIndeterminate = progress === undefined;

  return (
    <div
      style={{
        width: '100%',
        ...containerStyle,
      }}
    >
      {(label || (showPercentage && !isIndeterminate)) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            ...labelStyle,
          }}
        >
          {label && <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{label}</span>}
          {showPercentage && !isIndeterminate && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: `${height / 2}px`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {isIndeterminate ? (
          // Indeterminate progress - animated
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '40%',
              backgroundColor: color,
              borderRadius: `${height / 2}px`,
              animation: 'progress-indeterminate 1.5s ease-in-out infinite',
            }}
          />
        ) : (
          // Determinate progress - filled percentage
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              backgroundColor: color,
              borderRadius: `${height / 2}px`,
              transition: 'width 0.3s ease',
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes progress-indeterminate {
          0% {
            left: -40%;
          }
          50% {
            left: 100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
  );
}












