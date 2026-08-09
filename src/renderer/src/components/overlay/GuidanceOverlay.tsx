import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { TorchLogo } from '../ui/TorchLogo'

type Guidance = {
  type: 'point' | 'none'
  x?: number
  y?: number
  homeX?: number
  homeY?: number
  label?: string
  transcript?: string
}

type MotionPhase = 'travelling' | 'pointing' | 'returning'

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export function GuidanceOverlay(): JSX.Element {
  const [guidance, setGuidance] = useState<Guidance | null>(null)
  const [phase, setPhase] = useState<MotionPhase>('travelling')
  const [spokenWords, setSpokenWords] = useState(0)
  const companionControls = useAnimation()
  const sequenceId = useRef(0)

  useEffect(() => {
    const handleGuidance = async (_event: unknown, next: Guidance): Promise<void> => {
      const currentSequence = ++sequenceId.current
      if (next.type !== 'point') {
        setGuidance(null)
        return
      }

      const homeX = next.homeX ?? 72
      const homeY = next.homeY ?? window.innerHeight - 72
      const targetX = next.x ?? homeX
      const targetY = next.y ?? homeY
      setGuidance(next)
      setSpokenWords(0)
      setPhase('travelling')
      companionControls.set({ x: homeX, y: homeY, opacity: 0, scale: 0.72, rotate: -10 })
      await companionControls.start({
        x: targetX,
        y: targetY,
        opacity: 1,
        scale: 1,
        rotate: 0,
        transition: { type: 'spring', stiffness: 115, damping: 17, mass: 0.82 }
      })
      if (sequenceId.current !== currentSequence) return

      setPhase('pointing')
      await wait(4200)
      if (sequenceId.current !== currentSequence) return

      setPhase('returning')
      await companionControls.start({
        x: homeX,
        y: homeY,
        scale: 0.78,
        opacity: 0.2,
        rotate: 8,
        transition: { type: 'spring', stiffness: 105, damping: 18, mass: 0.9 }
      })
      if (sequenceId.current !== currentSequence) return
      setGuidance(null)
      window.torchAPI?.hideGuidance()
    }

    window.torchAPI?.onGuidance(handleGuidance)
    return () => {
      sequenceId.current += 1
      window.torchAPI?.removeGuidance()
    }
  }, [companionControls])

  useEffect(() => {
    const words = guidance?.transcript?.split(/\s+/).filter(Boolean) ?? []
    if (words.length === 0) return
    const interval = window.setInterval(() => {
      setSpokenWords((count) => {
        if (count >= words.length) {
          window.clearInterval(interval)
          return count
        }
        return count + 1
      })
    }, Math.max(90, Math.min(190, 5200 / words.length)))
    return () => window.clearInterval(interval)
  }, [guidance?.transcript])

  const transcriptWords = guidance?.transcript?.split(/\s+/).filter(Boolean) ?? []
  const pointerAngle = guidance
    ? Math.atan2((guidance.y ?? 0) - (guidance.homeY ?? 0), (guidance.x ?? 0) - (guidance.homeX ?? 0)) * 180 / Math.PI
    : 0

  return (
    <div className="guidance-stage">
      <AnimatePresence>
        {guidance?.type === 'point' && phase === 'pointing' && (
          <motion.div
            className="guidance-marker"
            style={{ left: guidance.x, top: guidance.y }}
            initial={{ opacity: 0, scale: 0.45 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.3 }}
          >
            <span className="guidance-target__ring" />
            <span className="guidance-target__ring guidance-target__ring--delay" />
            <span className="guidance-marker__dot" />
            <motion.svg
              className="guidance-cursor"
              viewBox="0 0 34 42"
              style={{ rotate: pointerAngle + 35 }}
              initial={{ opacity: 0, scale: 0.5, x: -18, y: -18 }}
              animate={{ opacity: 1, scale: 1, x: -10, y: -10 }}
            >
              <path d="M3 2.5 29 22l-12 2.2 6.8 12.1-6.2 3.2-6.5-12.3L3 36Z" />
            </motion.svg>
          </motion.div>
        )}
      </AnimatePresence>

      {guidance?.type === 'point' && (
        <motion.div className="guidance-companion" animate={companionControls}>
          <TorchLogo variant="mark" tone="light" size={64} animate />
          <AnimatePresence>
            {transcriptWords.length > 0 && phase !== 'returning' && (
              <motion.span
                className="guidance-companion__speech"
                initial={{ opacity: 0, x: -8, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -5, scale: 0.95 }}
              >
                {transcriptWords.slice(0, spokenWords).join(' ')}
                <i className="guidance-companion__caret" />
              </motion.span>
            )}
          </AnimatePresence>
          {phase === 'pointing' && <span className="guidance-companion__target">{guidance.label || 'Look here'}</span>}
        </motion.div>
      )}
    </div>
  )
}
