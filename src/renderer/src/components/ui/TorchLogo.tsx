import { useState, useEffect } from 'react'

interface TorchLogoProps {
  className?: string
  style?: React.CSSProperties
  size?: number
}

export function TorchLogo({ className, style, size = 32 }: TorchLogoProps): JSX.Element {
  // Simple theme detection for now.
  // In a real app this would hook into a ThemeProvider context.
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    // Check if body has light theme class or if system is light
    const isLight = document.documentElement.classList.contains('light') || 
                    document.body.classList.contains('light')
    setIsDark(!isLight)
  }, [])

  const src = isDark 
    ? new URL('../../assets/TorchLogoWhite.png', import.meta.url).href
    : new URL('../../assets/TorchLogoBlack.png', import.meta.url).href

  return (
    <img 
      src={src} 
      alt="TORCH Logo" 
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
