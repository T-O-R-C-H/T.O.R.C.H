import { useEffect, useRef, useState } from 'react'

/**
 * TORCH's own cursor, drawn on the real screen over other apps.
 *
 * One pointer does both jobs. When TORCH teaches, it glides to the thing
 * being explained and a bubble beside it holds what TORCH said. When TORCH
 * acts, it glides to wherever the next click lands and ripples as it clicks,
 * so the user watches TORCH work instead of watching their own mouse jump.
 *
 * The window is full-desktop, transparent and click-through. Coordinates
 * arrive already converted to this window's pixels by the main process.
 */

type Guidance = {
  type: 'point' | 'none'
  x?: number
  y?: number
  label?: string
  transcript?: string
}

/** What the backend says TORCH is about to do, and where. */
export type AgentCursorEvent = {
  action: 'click' | 'right_click' | 'double_click' | 'scroll' | 'type' | 'key' | 'look' | 'hide'
  x?: number
  y?: number
  note?: string
}

type Mode = 'hidden' | 'teaching' | 'working'

/** How long the real mouse takes to travel, so the two arrive together. */
const GLIDE_MS = 650
const POINTER_ACTIONS = new Set(['click', 'right_click', 'double_click'])

const ACTION_WORDS: Record<string, string> = {
  click: 'Clicking',
  right_click: 'Right-clicking',
  double_click: 'Double-clicking',
  scroll: 'Scrolling',
  type: 'Typing',
  key: 'Pressing a key',
  look: 'Looking'
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export function GuidanceOverlay(): JSX.Element {
  const [mode, setMode] = useState<Mode>('hidden')
  // The cursor keeps its last position between events so it always travels
  // from where it was, the way a hand does. It starts low and central.
  const [position, setPosition] = useState(() => ({
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight * 0.72)
  }))
  const [bubble, setBubble] = useState('')
  const [label, setLabel] = useState('')
  const [tag, setTag] = useState('')
  const [shownWords, setShownWords] = useState(0)
  const [ripple, setRipple] = useState(0)
  const sequence = useRef(0)

  useEffect(() => {
    const handleGuidance = async (_event: unknown, next: Guidance): Promise<void> => {
      const current = ++sequence.current
      if (next.type !== 'point' || next.x === undefined || next.y === undefined) {
        setMode('hidden')
        return
      }
      setMode('teaching')
      setTag('')
      setBubble(next.transcript ?? '')
      setLabel(next.label ?? '')
      setShownWords(0)
      setPosition({ x: next.x, y: next.y })

      // Long enough to read what TORCH said: about three words a second,
      // never shorter than a glance and never so long it gets in the way.
      const words = next.transcript?.split(/\s+/).filter(Boolean).length ?? 0
      await wait(Math.min(16000, Math.max(5000, words * 350 + 2000)))
      if (sequence.current !== current) return
      setMode('hidden')
      await wait(220)
      if (sequence.current !== current) return
      window.torchAPI?.hideGuidance()
    }

    const handleCursor = async (_event: unknown, next: AgentCursorEvent): Promise<void> => {
      const current = ++sequence.current
      if (next.action === 'hide') {
        setMode('hidden')
        await wait(220)
        if (sequence.current === current) window.torchAPI?.hideGuidance()
        return
      }
      setMode('working')
      setBubble('')
      setLabel('')
      setTag(ACTION_WORDS[next.action] ?? '')
      if (next.x !== undefined && next.y !== undefined) {
        setPosition({ x: next.x, y: next.y })
      }
      if (POINTER_ACTIONS.has(next.action)) {
        await wait(GLIDE_MS)
        if (sequence.current !== current) return
        setRipple((count) => count + 1)
      }
    }

    window.torchAPI?.onGuidance(handleGuidance)
    window.torchAPI?.onAgentCursor(handleCursor)
    return () => {
      sequence.current += 1
      window.torchAPI?.removeGuidance()
      window.torchAPI?.removeAgentCursor()
    }
  }, [])

  // Reveal the bubble's words a few at a time, like speech.
  useEffect(() => {
    const total = bubble.split(/\s+/).filter(Boolean).length
    if (total === 0) return
    const interval = window.setInterval(
      () => {
        setShownWords((count) => {
          if (count >= total) {
            window.clearInterval(interval)
            return count
          }
          return count + 1
        })
      },
      Math.max(70, Math.min(160, 4200 / total))
    )
    return () => window.clearInterval(interval)
  }, [bubble])

  const words = bubble.split(/\s+/).filter(Boolean)
  const flipX = position.x > window.innerWidth - 400
  const flipY = position.y > window.innerHeight - 220

  return (
    <div className="guidance-stage">
      <div
        className="torch-cursor"
        data-mode={mode}
        data-flip-x={flipX}
        data-flip-y={flipY}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        {ripple > 0 && mode === 'working' && <span key={ripple} className="torch-cursor__ripple" />}

        {/* The tip of the arrow sits exactly on the target. */}
        <svg className="torch-cursor__arrow" viewBox="0 0 28 32" aria-hidden="true">
          <path d="M2.5 2.2 L24.5 15.4 L14.2 17.4 L20.2 28.6 L15.4 31 L9.6 19.8 L2.5 26.6 Z" />
        </svg>

        <span className="torch-cursor__tag">{tag ? `TORCH · ${tag}` : 'TORCH'}</span>

        {mode === 'teaching' && words.length > 0 && (
          <span className="torch-cursor__bubble">
            {label && <strong className="torch-cursor__label">{label}</strong>}
            {words.slice(0, shownWords).join(' ')}
          </span>
        )}
      </div>
    </div>
  )
}
