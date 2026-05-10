import { useEffect, useState, useRef } from 'react'
import { useTorchStore } from '../../store/torchStore'

interface MetricCardProps {
  label: string
  value: number
  delta: number
  suffix?: string
  decimals?: number
  delay?: number
}

function MetricCard({ label, value, delta, suffix = '', decimals = 0, delay = 0 }: MetricCardProps): JSX.Element {
  const [displayValue, setDisplayValue] = useState(0)
  const animationRef = useRef<number>()

  useEffect(() => {
    const timeout = setTimeout(() => {
      const startTime = performance.now()
      const duration = 800

      const animate = (currentTime: number): void => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplayValue(eased * value)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }, delay)

    return (): void => {
      clearTimeout(timeout)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [value, delay])

  return (
    <div className="flex-1 px-4 py-[14px] border-r border-[#1c1c1c] last:border-r-0">
      <div className="label mb-2">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold tracking-[-0.8px] metric-value">
          {decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}
          {suffix}
        </span>
        <span className="flex items-center gap-0.5 mono-xs text-[#444]">
          +{Math.abs(delta)}{suffix}
        </span>
      </div>
    </div>
  )
}

export function MetricsBar(): JSX.Element {
  const metrics = useTorchStore((s) => s.metrics)

  return (
    <div className="flex border-b border-[#1c1c1c] bg-[#000] flex-shrink-0">
      <MetricCard
        label="TASKS COMPLETED"
        value={metrics.tasksCompleted}
        delta={metrics.tasksDelta}
        delay={0}
      />
      <MetricCard
        label="TIME SAVED"
        value={metrics.timeSaved}
        delta={metrics.timeDelta}
        suffix="h"
        decimals={1}
        delay={100}
      />
      <MetricCard
        label="ACTIONS EXECUTED"
        value={metrics.actionsExecuted}
        delta={metrics.actionsDelta}
        delay={200}
      />
      <MetricCard
        label="SUCCESS RATE"
        value={metrics.successRate}
        delta={metrics.successDelta}
        suffix="%"
        delay={300}
      />
    </div>
  )
}
