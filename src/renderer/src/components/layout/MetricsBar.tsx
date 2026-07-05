import { useEffect, useState, useRef } from 'react'
import { useTorchStore } from '../../store/torchStore'

interface MetricCardProps {
  label: string
  value: number
  suffix?: string
  decimals?: number
  delay?: number
  noBorder?: boolean
}

function MetricCard({
  label,
  value,
  suffix = '',
  decimals = 0,
  delay = 0,
  noBorder = false
}: MetricCardProps): JSX.Element {
  const [displayValue, setDisplayValue] = useState(0)
  const animationRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const startTime = performance.now()
      const duration = 600

      const animate = (currentTime: number): void => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplayValue(eased * value)
        if (progress < 1) animationRef.current = requestAnimationFrame(animate)
      }

      animationRef.current = requestAnimationFrame(animate)
    }, delay)

    return (): void => {
      clearTimeout(timeout)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [value, delay])

  return (
    <div className="cmd-metric" style={{ borderRight: noBorder ? 'none' : undefined }}>
      <div className="cmd-metric__label">{label}</div>
      <div className="cmd-metric__value">
        {decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}
        {suffix}
      </div>
    </div>
  )
}

export function MetricsBar(): JSX.Element {
  const metrics = useTorchStore((s) => s.metrics)

  return (
    <div className="cmd-metrics">
      <MetricCard label="Tasks" value={metrics.tasksCompleted} delay={0} />
      <MetricCard label="Time saved" value={metrics.timeSaved} suffix="h" decimals={1} delay={80} />
      <MetricCard label="Actions" value={metrics.actionsExecuted} delay={160} />
      <MetricCard label="Success" value={metrics.successRate} suffix="%" delay={240} noBorder />
    </div>
  )
}
