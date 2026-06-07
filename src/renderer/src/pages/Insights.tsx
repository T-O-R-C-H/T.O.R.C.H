import { IconChart as BarChart3, IconTrendingUp as TrendingUp, IconTarget as Target, IconClock as Clock } from '../components/icons'
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
      className="h-full bg-white transition-all duration-700 ease-out"
      style={{ width: `${width}%`, opacity: 0.3 + (value / maxValue) * 0.7 }}
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
        <circle cx="50" cy="50" r="40" fill="none" stroke="#0d0d0d" strokeWidth="3" />
        <circle
          cx="50" cy="50" r="40"
          fill="none" stroke="#ffffff" strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="butt"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <text x="50" y="47" textAnchor="middle" fill="#ffffff" fontSize="18" fontWeight="600" fontFamily="Inter">{value}</text>
        <text x="50" y="62" textAnchor="middle" fill="#444" fontSize="8" fontFamily="JetBrains Mono">%</text>
      </svg>
      <span className="mono-xs text-[#444]">{label}</span>
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
    { label: 'Email', count: 34, color: '#ffffff' },
    { label: 'Files', count: 28, color: '#aaaaaa' },
    { label: 'Web', count: 22, color: '#666666' },
    { label: 'Social', count: 15, color: '#444444' },
    { label: 'System', count: 11, color: '#2a2a2a' }
  ]
  const totalCategory = categoryBreakdown.reduce((s, c) => s + c.count, 0)

  return (
    <div className="flex-1 flex flex-col h-full page-enter overflow-y-auto">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <BarChart3 size={14} className="text-[#666]" />
        <span className="label">ANALYTICS & INSIGHTS</span>
      </div>

      <div className="p-6 space-y-6">
        {/* Top row — gauges */}
        <div className="grid grid-cols-4 gap-px bg-[#0d0d0d]">
          <div className="bg-[#000] p-6 flex justify-center">
            <GaugeRing value={metrics.successRate || 94} label="SUCCESS RATE" />
          </div>
          <div className="bg-[#000] p-6 flex justify-center">
            <GaugeRing value={87} label="ACCURACY" />
          </div>
          <div className="bg-[#000] p-6 flex justify-center">
            <GaugeRing value={72} label="AUTOMATION" />
          </div>
          <div className="bg-[#000] p-6 flex justify-center">
            <GaugeRing value={91} label="HITL APPROVE" />
          </div>
        </div>

        {/* Tasks over time */}
        <div className="border border-[#1c1c1c] bg-[#060606]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1c1c1c]">
            <TrendingUp size={12} className="text-[#444]" />
            <span className="label">TASKS THIS WEEK</span>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-2 h-[120px]">
              {weeklyTasks.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full bg-[#0d0d0d] h-full relative">
                      <AnimatedBar value={count} maxValue={maxTasks} delay={i * 100} />
                    </div>
                  </div>
                  <span className="mono-xs text-[#333]">{weekLabels[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category breakdown + Time saved */}
        <div className="grid grid-cols-2 gap-px bg-[#0d0d0d]">
          <div className="bg-[#000] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target size={12} className="text-[#444]" />
              <span className="label">CATEGORY BREAKDOWN</span>
            </div>
            <div className="space-y-3">
              {categoryBreakdown.map((cat) => (
                <div key={cat.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-[#aaa]">{cat.label}</span>
                    <span className="mono-xs text-[#333]">{Math.round((cat.count / totalCategory) * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#0d0d0d]">
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

          <div className="bg-[#000] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={12} className="text-[#444]" />
              <span className="label">TIME SAVED THIS WEEK</span>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-[36px] font-semibold tracking-[-1px]">4.2</span>
              <span className="text-[14px] text-[#444]">hours</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#666]">Email automation</span>
                <span className="text-[#444] font-mono">1.8h</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#666]">File management</span>
                <span className="text-[#444] font-mono">1.2h</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#666]">Web research</span>
                <span className="text-[#444] font-mono">0.8h</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#666]">Other tasks</span>
                <span className="text-[#444] font-mono">0.4h</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
