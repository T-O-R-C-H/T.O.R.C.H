import { useEffect, useState, useRef } from 'react'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { useTorchStore } from '../../store/torchStore'

interface MetricCardProps {
  label: string
  value: number
  delta: number
  suffix?: string
  decimals?: number
}

function MetricCard({ label, value, delta, suffix = '', decimals = 0 }: MetricCardProps): JSX.Element {
  const [displayValue, setDisplayValue] = useState(0)
  const animationRef = useRef<number>()

  useEffect(() => {
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
    return (): void => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [value])

  const deltaIcon = delta > 0 ? <ArrowUp size={8} /> :
    delta < 0 ? <ArrowDown size={8} /> :
    <Minus size={8} />

  const deltaColor = delta > 0 ? 'text-[#22c55e]' :
    delta < 0 ? 'text-[#ef4444]' : 'text-[#444]'

  return (
    <div className="flex-1 px-5 py-4 border-r border-[#1c1c1c] last:border-r-0">
      <div className="label mb-2">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold tracking-[-0.5px] metric-value">
          {decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}
          {suffix}
        </span>
        <span className={`flex items-center gap-0.5 mono-xs ${deltaColor}`}>
          {deltaIcon}
          {Math.abs(delta)}{suffix}
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
      />
      <MetricCard
        label="TIME SAVED"
        value={metrics.timeSaved}
        delta={metrics.timeDelta}
        suffix="h"
        decimals={1}
      />
      <MetricCard
        label="ACTIONS EXECUTED"
        value={metrics.actionsExecuted}
        delta={metrics.actionsDelta}
      />
      <MetricCard
        label="SUCCESS RATE"
        value={metrics.successRate}
        delta={metrics.successDelta}
        suffix="%"
      />
    </div>
  )
}
