import logoSrc from '@resources/logo.png'

interface TorchLogoProps {
  className?: string
  style?: React.CSSProperties
  size?: number
}

export function TorchLogo({ className, style, size = 32 }: TorchLogoProps): JSX.Element {
  return (
    <img
      src={logoSrc}
      alt="TORCH"
      className={className}
      style={{
        height: `${size}px`,
        width: 'auto',
        objectFit: 'contain',
        ...style
      }}
    />
  )
}
