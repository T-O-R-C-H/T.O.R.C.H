import React from 'react'

interface TorchMarkProps {
  size?: number
  activeNode?: number
  animate?: boolean
  color?: string
}

export function TorchMark({
  size = 64,
  activeNode = 0,
  animate = false,
  color = '#ffffff'
}: TorchMarkProps): JSX.Element {
  const [active, setActive] = React.useState(activeNode)
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const dotR = size * 0.072

  React.useEffect(() => {
    if (!animate) {
      setActive(activeNode)
      return
    }
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % 5)
    }, 400)
    return () => clearInterval(interval)
  }, [animate, activeNode])

  const nodes = Array.from({ length: 5 }, (_, i) => {
    const angle = -Math.PI / 2 + i * (2 * Math.PI / 5)
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      filled: i === active
    }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.018} opacity={0.25} />
      {nodes.map((node, i) =>
        node.filled ? (
          <circle key={i} cx={node.x} cy={node.y} r={dotR} fill={color} />
        ) : (
          <circle key={i} cx={node.x} cy={node.y} r={dotR} fill="none" stroke={color} strokeWidth={size * 0.03} />
        )
      )}
    </svg>
  )
}