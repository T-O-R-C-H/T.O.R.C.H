import type { CSSProperties } from 'react'
import styles from './Orb.module.css'

/** The stage the geometry is tuned on; --orb-k scales it to `size`. */
const STAGE = 28

/** Default rendered size — 20×20 indicator box. */
const SIZE = 20

export type LatticeVariant = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'
export type RingVariant = 'C1' | 'C2' | 'C3' | 'C4' | 'C5'
export type OrbVariant = LatticeVariant | RingVariant

const LATTICE_VARIANTS: LatticeVariant[] = ['S1', 'S2', 'S3', 'S4', 'S5']

const ORB_TASKS: Record<OrbVariant, string> = {
  S1: 'Thinking',
  S2: 'Processing',
  S3: 'Working',
  S4: 'Searching',
  S5: 'Finalizing',
  C1: 'Loading',
  C2: 'Listening',
  C3: 'Streaming',
  C4: 'Analyzing',
  C5: 'Compiling'
}

function isLattice(v: OrbVariant): v is LatticeVariant {
  return (LATTICE_VARIANTS as OrbVariant[]).includes(v)
}

const N = 3
const PITCH = 6
const MID = (N - 1) / 2

const RING: [number, number][] = (() => {
  const ring: [number, number][] = []
  for (let x = 0; x < N; x++) ring.push([x, 0])
  for (let y = 1; y < N; y++) ring.push([N - 1, y])
  for (let x = N - 2; x >= 0; x--) ring.push([x, N - 1])
  for (let y = N - 2; y >= 1; y--) ring.push([0, y])
  return ring
})()

const RING_INDEX = new Map(RING.map(([x, y], i) => [x + ',' + y, i]))

function cellDelay(v: LatticeVariant, x: number, y: number): number {
  const dx = x - MID
  const dy = y - MID
  switch (v) {
    case 'S1':
      return Math.hypot(dx, dy) * 700 - (dx === 0 && dy === 0 ? 180 : 0)
    case 'S2':
      return ((x + y) / (2 * (N - 1))) * 1500
    case 'S3': {
      const i = RING_INDEX.get(x + ',' + y)
      if (i === undefined) return 0
      return -(((RING.length - i) % RING.length) / RING.length) * 1700
    }
    case 'S4':
      return (x / (N - 1)) * 1100
    case 'S5': {
      const i = RING_INDEX.get(x + ',' + y)
      if (i === undefined) return 0
      const scrambled = (i * 3) % RING.length
      return -(scrambled / RING.length) * 1700
    }
  }
}

const SWIRL = 1.05
const SPREAD = 1.6

function swirl(x: number, y: number, angle: number): [number, number] {
  const dx = x - MID
  const dy = y - MID
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    ((dx * cos - dy * sin) * SPREAD - dx) * PITCH,
    ((dx * sin + dy * cos) * SPREAD - dy) * PITCH
  ]
}

interface Cell {
  key: string
  left: number
  top: number
  delay: number
  ax: number
  ay: number
  bx: number
  by: number
  still: boolean
  mid: boolean
}

function latticeCells(v: LatticeVariant): Cell[] {
  const cells: Cell[] = []
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const [ax, ay] = swirl(x, y, -SWIRL)
      const [bx, by] = swirl(x, y, SWIRL)
      cells.push({
        key: x + ',' + y,
        left: x * PITCH,
        top: y * PITCH,
        delay: cellDelay(v, x, y),
        ax,
        ay,
        bx,
        by,
        still: (v === 'S3' || v === 'S5') && !RING_INDEX.has(x + ',' + y),
        mid: x === MID && y === MID
      })
    }
  }
  return cells
}

const RING_N = 8
const RING_R = 8

interface RingDot {
  key: number
  rx: number
  ry: number
  delay: number
}

function ringDuration(v: RingVariant): number {
  switch (v) {
    case 'C1':
      return 1600
    case 'C2':
      return 2000
    case 'C3':
      return 1800
    case 'C4':
      return 1600
    case 'C5':
      return 1800
  }
}

function ringDots(v: RingVariant): RingDot[] {
  const dots: RingDot[] = []
  for (let i = 0; i < RING_N; i++) {
    const a = (i / RING_N) * Math.PI * 2 - Math.PI / 2
    dots.push({
      key: i,
      rx: Math.cos(a) * RING_R,
      ry: Math.sin(a) * RING_R,
      delay: v === 'C1' ? -(i / RING_N) * ringDuration(v) : 0
    })
  }
  return dots
}

export interface OrbProps {
  variant?: OrbVariant
  size?: number
  label?: string
  pill?: boolean
  className?: string
  style?: CSSProperties
}

export function Orb({
  variant = 'S1',
  size = SIZE,
  label,
  pill,
  className,
  style
}: OrbProps): JSX.Element {
  const text = label ?? ORB_TASKS[variant] + '\u2026'
  return (
    <span className={styles.root + (className ? ' ' + className : '')} data-pill={pill ? '' : undefined} style={style}>
      <span
        className={styles.glyph}
        role={pill ? undefined : 'img'}
        aria-label={pill ? undefined : text}
        aria-hidden={pill ? true : undefined}
        style={{ width: size, height: size, '--orb-k': size / STAGE } as CSSProperties}
      >
        {isLattice(variant) ? (
          <span className={styles.lattice} data-variant={variant}>
            {latticeCells(variant).map((c) => (
              <span
                key={c.key}
                className={styles.cell}
                data-still={c.still ? '' : undefined}
                data-mid={c.mid ? '' : undefined}
                style={
                  {
                    left: c.left,
                    top: c.top,
                    animationDelay: c.delay + 'ms',
                    '--orb-ax': c.ax + 'px',
                    '--orb-ay': c.ay + 'px',
                    '--orb-bx': c.bx + 'px',
                    '--orb-by': c.by + 'px'
                  } as CSSProperties
                }
              />
            ))}
          </span>
        ) : (
          <span className={styles.ring} data-variant={variant}>
            {ringDots(variant).map((d) => (
              <span
                key={d.key}
                className={styles.ringDot}
                style={
                  {
                    '--orb-rx': d.rx + 'px',
                    '--orb-ry': d.ry + 'px',
                    animationDelay: d.delay + 'ms'
                  } as CSSProperties
                }
              />
            ))}
          </span>
        )}
      </span>
      {pill && <span className={styles.pillLabel}>{text}</span>}
    </span>
  )
}