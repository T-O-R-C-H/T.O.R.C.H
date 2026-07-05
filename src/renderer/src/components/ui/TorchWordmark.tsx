interface TorchWordmarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showMeta?: boolean
}

export function TorchWordmark({
  size = 'md',
  className = '',
  showMeta = false
}: TorchWordmarkProps): JSX.Element {
  return (
    <div
      className={`torch-wordmark torch-wordmark--${size} ${className}`.trim()}
      aria-label="TORCH"
    >
      <div className="torch-wordmark__frame">
        <span className="torch-wordmark__corner torch-wordmark__corner--tl" aria-hidden="true" />
        <span className="torch-wordmark__corner torch-wordmark__corner--br" aria-hidden="true" />
        <span className="torch-wordmark__word">TORCH</span>
      </div>
      {showMeta && (
        <span className="torch-wordmark__meta">Desktop agent</span>
      )}
    </div>
  )
}
