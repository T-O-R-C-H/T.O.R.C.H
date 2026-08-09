import logoSrc from '@resources/logo.png'
import markWhiteSrc from '../../assets/TorchLogoWhite.png'
import markBlackSrc from '../../assets/TorchLogoBlack.png'

interface TorchLogoProps {
  className?: string
  style?: React.CSSProperties
  /** Height in px (used when width is not set) */
  size?: number
  /** Width in px for wordmark layout */
  width?: number
  /** Use the TORCH flame emblem or the horizontal wordmark. */
  variant?: 'wordmark' | 'mark'
  /** Select the mark color for light or dark surfaces. */
  tone?: 'light' | 'dark'
  /** Apply a subtle working-state pulse to the mark. */
  animate?: boolean
}

export function TorchLogo({
  className,
  style,
  size = 32,
  width,
  variant = 'wordmark',
  tone = 'light',
  animate = false
}: TorchLogoProps): JSX.Element {
  if (variant === 'mark') {
    return (
      <span
        className={[
          'torch-logo-mark',
          animate ? 'torch-logo-mark--animated' : '',
          className ?? ''
        ]
          .filter(Boolean)
          .join(' ')}
        role="img"
        aria-label="TORCH"
        style={{ width: size, height: size, ...style }}
      >
        <img
          src={tone === 'light' ? markWhiteSrc : markBlackSrc}
          alt=""
          aria-hidden="true"
        />
      </span>
    )
  }

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
