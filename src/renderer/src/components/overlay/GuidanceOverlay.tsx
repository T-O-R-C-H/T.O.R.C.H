import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { TorchCatRive } from '../ui/TorchCatRive'

type Guidance = {
  type: 'point' | 'none'
  x?: number
  y?: number
  homeX?: number
  homeY?: number
  label?: string
}

type MotionPhase = 'travelling' | 'pointing' | 'returning'

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export function GuidanceOverlay(): JSX.Element {
  const [guidance, setGuidance] = useState<Guidance | null>(null)
  const [phase, setPhase] = useState<MotionPhase>('travelling')
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
          </motion.div>
        )}
      </AnimatePresence>

      {guidance?.type === 'point' && (
        <motion.div className="guidance-companion" animate={companionControls}>
          <TorchCatRive className="guidance-companion__cat" />
          <AnimatePresence>
            {phase === 'pointing' && (
              <motion.span
                className="guidance-companion__label"
                initial={{ opacity: 0, x: -8, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -5, scale: 0.95 }}
              >
                {guidance.label || 'Look here'}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
