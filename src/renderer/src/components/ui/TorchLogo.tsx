import logoSrc from '@resources/logo.png'

interface TorchLogoProps {
  className?: string
  style?: React.CSSProperties
  /** Height in px (used when width is not set) */
  size?: number
  /** Width in px for wordmark layout */
  width?: number
  /** Select the wordmark color for light or dark surfaces. */
  tone?: 'light' | 'dark'
  /** Apply a subtle working-state pulse to the wordmark. */
  animate?: boolean
}

export function TorchLogo({
  className,
  style,
  size = 32,
  width,
  tone = 'dark',
  animate = false
}: TorchLogoProps): JSX.Element {
  return (
    <img
      src={logoSrc}
      alt="TORCH"
      className={[
        'torch-logo-wordmark',
        tone === 'light' ? 'torch-logo-wordmark--light' : '',
        animate ? 'torch-logo-wordmark--animated' : '',
        className ?? ''
      ]
        .filter(Boolean)
        .join(' ')}
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
