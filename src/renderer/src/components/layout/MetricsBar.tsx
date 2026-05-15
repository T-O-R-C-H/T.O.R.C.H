import { useEffect, useState, useRef } from 'react'
import { useTorchStore } from '../../store/torchStore'

/* ═══════════════════════════════════════════════════════════════
   TORCH METRICS ROW — System Telemetry
   76px · 4 columns · animated values · cinematic OS vibe
   ═══════════════════════════════════════════════════════════════ */

interface MetricCardProps {
  label: string
  value: number
  delta: number
  suffix?: string
  decimals?: number
  delay?: number
  noBorder?: boolean
}

function MetricCard({ label, value, delta, suffix = '', decimals = 0, delay = 0, noBorder = false }: MetricCardProps): JSX.Element {
  const [displayValue, setDisplayValue] = useState(0)
  const animationRef = useRef<number>()

  // 600ms smooth count-up animation
  useEffect(() => {
    const timeout = setTimeout(() => {
      const startTime = performance.now()
      const duration = 600

      const animate = (currentTime: number): void => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        // smooth ease-out
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
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      borderRight: noBorder ? 'none' : '1px solid #121212',
      padding: '16px 20px',
      minWidth: 0,
    }}>
      {/* Label */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '9px',
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.18em',
        color: '#555',
        lineHeight: 1,
      }}>
        {label}
      </div>

      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: '4px' }}>
        {/* Main Value */}
        <span style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '22px',
          fontWeight: 600,
          color: '#ffffff',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>
          {decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue)}
          {suffix && (
            <span style={{ fontSize: '15px', color: '#888', marginLeft: '2px' }}>{suffix}</span>
          )}
        </span>

        {/* Delta */}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          fontWeight: 500,
          color: '#666',
          marginLeft: '6px',
        }}>
          +{Math.abs(delta)}{suffix}
        </span>
      </div>
    </div>
  )
}

export function MetricsBar(): JSX.Element {
  const metrics = useTorchStore((s) => s.metrics)

  return (
    <div style={{
      display: 'flex',
      height: '64px',
      borderBottom: '1px solid #121212',
      background: '#000000',
      flexShrink: 0,
    }}>
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
        noBorder={true}
      />
    </div>
  )
}
