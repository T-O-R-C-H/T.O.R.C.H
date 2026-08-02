import { useEffect, useRef, useState } from 'react'
import { TorchCatRive } from '../ui/TorchCatRive'

type Guidance = { type: 'point' | 'none'; x?: number; y?: number; label?: string }

export function GuidanceOverlay(): JSX.Element {
  const [guidance, setGuidance] = useState<Guidance | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleGuidance = (_event: unknown, next: Guidance): void => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setGuidance(next)
      hideTimer.current = setTimeout(() => {
        setGuidance(null)
        window.torchAPI?.hideGuidance()
      }, 9000)
    }
    window.torchAPI?.onGuidance(handleGuidance)
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      window.torchAPI?.removeGuidance()
    }
  }, [])

  if (!guidance || guidance.type !== 'point') return <div className="guidance-stage" />

  return (
    <div className="guidance-stage">
      <div
        className="guidance-target"
        style={{ transform: `translate3d(${guidance.x ?? 0}px, ${guidance.y ?? 0}px, 0)` }}
      >
        <span className="guidance-target__ring" />
        <span className="guidance-target__ring guidance-target__ring--delay" />
        <div className="guidance-companion">
          <TorchCatRive className="guidance-companion__cat" />
          <span className="guidance-companion__label">{guidance.label || 'Look here'}</span>
        </div>
      </div>
    </div>
  )
}
