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
  const [animatedNode, setAnimatedNode] = React.useState(activeNode)
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const dotR = size * 0.072

  React.useEffect(() => {
    if (!animate) return
    const interval = window.setInterval(
      () => setAnimatedNode((previous) => (previous + 1) % 5),
      400
    )
    return () => window.clearInterval(interval)
  }, [animate])

  const active = animate ? animatedNode : ((activeNode % 5) + 5) % 5

  const nodes = Array.from({ length: 5 }, (_, index) => {
    const angle = -Math.PI / 2 + index * ((2 * Math.PI) / 5)
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      filled: index === active
    }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="TORCH">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.018}
        opacity={0.25}
      />
      {nodes.map((node, index) =>
        node.filled ? (
          <circle key={index} cx={node.x} cy={node.y} r={dotR} fill={color} />
        ) : (
          <circle
            key={index}
            cx={node.x}
            cy={node.y}
            r={dotR}
            fill="none"
            stroke={color}
            strokeWidth={size * 0.03}
          />
        )
      )}
    </svg>
  )
}
