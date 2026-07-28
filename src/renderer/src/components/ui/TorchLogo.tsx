import logoSrc from '@resources/logo.png'

interface TorchLogoProps {
  className?: string
  style?: React.CSSProperties
  /** Height in px (used when width is not set) */
  size?: number
  /** Width in px for wordmark layout */
  width?: number
}

export function TorchLogo({
  className,
  style,
  size = 32,
  width
}: TorchLogoProps): JSX.Element {
  return (
    <img
      src={logoSrc}
      alt="TORCH"
      className={className}
      style={{
        ...(width
          ? { width: `${width}px`, height: 'auto' }
          : { height: `${size}px`, width: 'auto' }),
        objectFit: 'contain',
        display: 'block',
        ...style
      }}
    />
  )
}
