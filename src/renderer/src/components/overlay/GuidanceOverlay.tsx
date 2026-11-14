import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type Guidance = {
  type: 'point' | 'none'
  x?: number
  y?: number
  homeX?: number
  homeY?: number
  label?: string
  transcript?: string
}

type MotionPhase = 'pointing' | 'returning'

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export function GuidanceOverlay(): JSX.Element {
  const [guidance, setGuidance] = useState<Guidance | null>(null)
  const [phase, setPhase] = useState<MotionPhase>('pointing')
  const [spokenWords, setSpokenWords] = useState(0)
  const sequenceId = useRef(0)

  useEffect(() => {
    const handleGuidance = async (_event: unknown, next: Guidance): Promise<void> => {
      const currentSequence = ++sequenceId.current
      if (next.type !== 'point') {
        setGuidance(null)
        return
      }

      setGuidance(next)
      setSpokenWords(0)
      setPhase('pointing')
      // Long enough to read what TORCH said: about three words a second,
      // never shorter than a glance and never so long it gets in the way.
      const wordCount = next.transcript?.split(/\s+/).filter(Boolean).length ?? 0
      await wait(Math.min(14000, Math.max(4200, wordCount * 350 + 1500)))
      if (sequenceId.current !== currentSequence) return

      setPhase('returning')
      await wait(160)
      if (sequenceId.current !== currentSequence) return
      setGuidance(null)
      window.torchAPI?.hideGuidance()
    }

    window.torchAPI?.onGuidance(handleGuidance)
    return () => {
      sequenceId.current += 1
      window.torchAPI?.removeGuidance()
    }
  }, [])

  useEffect(() => {
    const words = guidance?.transcript?.split(/\s+/).filter(Boolean) ?? []
    if (words.length === 0) return
    const interval = window.setInterval(
      () => {
        setSpokenWords((count) => {
          if (count >= words.length) {
            window.clearInterval(interval)
            return count
          }
          return count + 1
        })
      },
      Math.max(90, Math.min(190, 5200 / words.length))
    )
    return () => window.clearInterval(interval)
  }, [guidance?.transcript])

  const transcriptWords = guidance?.transcript?.split(/\s+/).filter(Boolean) ?? []
  return (
    <div className="guidance-stage">
      <AnimatePresence>
        {guidance?.type === 'point' && phase !== 'returning' && (
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
        <div
          className="guidance-companion"
          data-leaving={phase === 'returning'}
          style={{ left: guidance.x, top: guidance.y }}
          data-flip-x={(guidance.x ?? 0) > window.innerWidth - 380}
          data-flip-y={(guidance.y ?? 0) > window.innerHeight - 200}
        >
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
          {phase !== 'returning' && (
            <span className="guidance-companion__target">{guidance.label || 'Look here'}</span>
          )}
        </div>
      )}
    </div>
  )
}
