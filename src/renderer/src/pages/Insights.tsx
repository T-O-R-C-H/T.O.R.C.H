import { IconTrendingUp as TrendingUp, IconTarget as Target, IconClock as Clock } from '../components/icons'
import { useTorchStore } from '../store/torchStore'
import { useEffect, useState } from 'react'

function AnimatedBar({ value, maxValue, delay }: { value: number; maxValue: number; delay: number }): JSX.Element {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setWidth((value / maxValue) * 100), delay)
    return (): void => clearTimeout(timer)
  }, [value, maxValue, delay])

  return (
    <div
      className="h-full transition-all duration-700 ease-out"
      style={{ width: `${width}%`, background: 'var(--color-torch-text)', opacity: 0.25 + (value / maxValue) * 0.55 }}
    />
  )
}

function GaugeRing({ value, label }: { value: number; label: string }): JSX.Element {
  const circumference = 2 * Math.PI * 40
  const [offset, setOffset] = useState(circumference)

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (value / 100) * circumference)
    }, 200)
    return (): void => clearTimeout(timer)
  }, [value])

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-torch-border)" strokeWidth="3" />
        <circle
          cx="50" cy="50" r="40"
          fill="none" stroke="var(--color-torch-text)" strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <text x="50" y="47" textAnchor="middle" fill="var(--color-torch-text)" fontSize="18" fontWeight="500" fontFamily="Inter">{value}</text>
        <text x="50" y="62" textAnchor="middle" fill="var(--color-torch-text-tertiary)" fontSize="8" fontFamily="JetBrains Mono">%</text>
      </svg>
      <span className="t-mono-xs">{label}</span>
    </div>
  )
}

export function Insights(): JSX.Element {
  const metrics = useTorchStore((s) => s.metrics)

  // Demo weekly data
  const weeklyTasks = [12, 8, 15, 22, 18, 25, 14]
  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const maxTasks = Math.max(...weeklyTasks)

  const categoryBreakdown = [
    { label: 'Email', count: 34, color: '#262626' },
    { label: 'Files', count: 28, color: '#52525b' },
    { label: 'Web', count: 22, color: '#71717a' },
    { label: 'Social', count: 15, color: '#a1a1aa' },
    { label: 'System', count: 11, color: '#d4d4d8' }
  ]
  const totalCategory = categoryBreakdown.reduce((s, c) => s + c.count, 0)

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body space-y-6">
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-cell flex justify-center">
            <GaugeRing value={metrics.successRate || 94} label="Success rate" />
          </div>
          <div className="stat-cell flex justify-center">
            <GaugeRing value={87} label="Accuracy" />
          </div>
          <div className="stat-cell flex justify-center">
            <GaugeRing value={72} label="Automation" />
          </div>
          <div className="stat-cell flex justify-center">
            <GaugeRing value={91} label="HITL approve" />
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-torch-border-subtle)]">
            <TrendingUp size={12} className="text-[var(--color-torch-text-tertiary)]" />
            <span className="t-label">Tasks this week</span>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-2 h-[120px]">
              {weeklyTasks.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full progress-bar h-full relative" style={{ height: '100%' }}>
                      <AnimatedBar value={count} maxValue={maxTasks} delay={i * 100} />
                    </div>
                  </div>
                  <span className="t-mono-xs">{weekLabels[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-cell">
            <div className="flex items-center gap-2 mb-4">
              <Target size={12} className="text-[var(--color-torch-text-tertiary)]" />
              <span className="t-label">Category breakdown</span>
            </div>
            <div className="space-y-3">
              {categoryBreakdown.map((cat) => (
                <div key={cat.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-[var(--color-torch-text)]">{cat.label}</span>
                    <span className="t-mono-xs">{Math.round((cat.count / totalCategory) * 100)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="h-full transition-all duration-700 ease-out"
                      style={{
                        width: `${(cat.count / totalCategory) * 100}%`,
                        backgroundColor: cat.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-cell">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={12} className="text-[var(--color-torch-text-tertiary)]" />
              <span className="t-label">Time saved this week</span>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-[32px] font-medium tracking-[-1px] text-[var(--color-torch-text)]">4.2</span>
              <span className="text-[14px] text-[var(--color-torch-text-tertiary)]">hours</span>
            </div>
            <div className="space-y-2">
              {[
                ['Email automation', '1.8h'],
                ['File management', '1.2h'],
                ['Web research', '0.8h'],
                ['Other tasks', '0.4h']
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-torch-text-secondary)]">{label}</span>
                  <span className="t-mono-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
