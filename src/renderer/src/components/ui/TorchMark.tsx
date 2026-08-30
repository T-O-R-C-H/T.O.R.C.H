/**
 * The five-node cycle mark.
 *
 * Distinct from `TorchLogo`, which is the raster wordmark used in the sidebar
 * and title bar. This is a symbol: five nodes on a ring, drawn as inline SVG
 * so each node can be animated on its own — an image could only ever pulse as
 * a single block.
 *
 * It reads as a status indicator, not decoration: the nodes light in sequence
 * while the agent is working and hold still when it is idle. That makes "is
 * TORCH doing something" answerable at a glance, without a spinner or a label.
 */

interface TorchMarkProps {
  /** Width and height in px. The mark is square. */
  size?: number
  /** Run the node cycle. Pass `agentStatus !== 'idle'`. */
  active?: boolean
  className?: string
}

const NODE_COUNT = 5
const RADIUS = 34
const CENTER = 50

/** Node positions, starting at 12 o'clock and going clockwise. */
const NODES = Array.from({ length: NODE_COUNT }, (_, i) => {
  const angle = (i / NODE_COUNT) * 2 * Math.PI - Math.PI / 2
  return {
    cx: CENTER + RADIUS * Math.cos(angle),
    cy: CENTER + RADIUS * Math.sin(angle)
  }
})

export function TorchMark({ size = 72, active = false, className }: TorchMarkProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label={active ? 'TORCH, working' : 'TORCH'}
      className={['torch-mark', active ? 'torch-mark--active' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {/* The ring the nodes sit on. Kept faint so the nodes carry the eye. */}
      <circle cx={CENTER} cy={CENTER} r={RADIUS} className="torch-mark__ring" strokeWidth={1} />

      {NODES.map((node, i) => (
        <circle
          key={i}
          cx={node.cx}
          cy={node.cy}
          r={6}
          className="torch-mark__node"
          /* Each node trails the one before it, so the highlight travels the
             ring instead of every node blinking together. */
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </svg>
  )
}
