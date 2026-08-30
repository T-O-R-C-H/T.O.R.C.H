import { useEffect, useState } from 'react'
import {
  IconTrendingUp as TrendingUp,
  IconTarget as Target,
  IconClock as Clock
} from '../components/icons'
import { API_BASE, torchFetch } from '../config/api'

/**
 * What TORCH has actually done, from the task history.
 *
 * This page used to show a hardcoded 87% "accuracy", a fabricated weekly
 * chart and "4.2 hours saved". None of it was measured. Everything here now
 * comes from rows in the database, and figures nothing measures - accuracy,
 * time saved - are absent rather than estimated: to the person reading it, a
 * plausible invented number is indistinguishable from a real one.
 */

interface DailyCount {
  date: string
  total: number
  completed: number
}

interface InsightsData {
  days: number
  daily: DailyCount[]
  total_tasks: number
  completed_tasks: number
  total_steps: number
  success_rate: number | null
  avg_duration_ms: number | null
  categories: { label: string; count: number }[]
}

function dayLabel(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString(undefined, { weekday: 'short' })
}

function durationLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}

function Bar({ day, maxValue, delay }: { day: DailyCount; maxValue: number; delay: number }) {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const timer = setTimeout(
      () => setHeight(maxValue > 0 ? (day.total / maxValue) * 100 : 0),
      delay
    )
    return (): void => clearTimeout(timer)
  }, [day.total, maxValue, delay])

  const failed = day.total - day.completed

  return (
    <div className="insight-bar">
      <div className="insight-bar__track" title={`${day.total} on ${day.date}`}>
        <div className="insight-bar__fill" style={{ height: `${height}%` }}>
          {/* Failures are shaded within the same column, so a tall bar is
              never mistaken for a good day. */}
          {failed > 0 && day.total > 0 && (
            <div
              className="insight-bar__failed"
              style={{ height: `${(failed / day.total) * 100}%` }}
            />
          )}
        </div>
      </div>
      <span className="t-mono-xs">{dayLabel(day.date)}</span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="stat-cell insight-stat">
      <span className="insight-stat__value">{value}</span>
      <span className="t-mono-xs">{label}</span>
    </div>
  )
}

export function Insights(): JSX.Element {
  const [data, setData] = useState<InsightsData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    torchFetch(`${API_BASE}/api/insights?days=7`)
      .then((r) => {
        if (!r.ok) throw new Error('unavailable')
        return r.json()
      })
      .then((result: InsightsData) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return (): void => {
      cancelled = true
    }
  }, [])

  if (failed) {
    return (
      <div className="page-shell page-enter">
        <div className="insight-empty">
          <p className="insight-empty__title">Can&rsquo;t load your activity right now</p>
          <p className="insight-empty__desc">
            TORCH couldn&rsquo;t reach its history. Try again in a moment.
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-shell page-enter">
        <div className="insight-empty">
          <p className="insight-empty__desc">Loading your activity&hellip;</p>
        </div>
      </div>
    )
  }

  // Nothing to summarise is its own state. Showing 0% success and an empty
  // chart would read as "TORCH fails everything" rather than "no history".
  if (data.total_tasks === 0) {
    return (
      <div className="page-shell page-enter">
        <div className="insight-empty">
          <p className="insight-empty__title">No tasks yet</p>
          <p className="insight-empty__desc">
            Run a few tasks and this page will show what you use TORCH for, how often it succeeds,
            and how long it takes.
          </p>
        </div>
      </div>
    )
  }

  const maxValue = Math.max(...data.daily.map((d) => d.total), 1)
  const categoryTotal = data.categories.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__body space-y-6">
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <Stat label="Tasks run" value={String(data.total_tasks)} />
          <Stat label="Finished" value={String(data.completed_tasks)} />
          <Stat
            label="Success rate"
            value={data.success_rate === null ? '—' : `${data.success_rate}%`}
          />
          <Stat
            label="Average time"
            value={data.avg_duration_ms === null ? '—' : durationLabel(data.avg_duration_ms)}
          />
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-torch-border-subtle)]">
            <TrendingUp size={12} className="text-[var(--color-torch-text-tertiary)]" />
            <span className="t-label">Tasks over the last {data.days} days</span>
          </div>
          <div className="p-4">
            <div className="insight-chart">
              {data.daily.map((day, i) => (
                <Bar key={day.date} day={day} maxValue={maxValue} delay={i * 60} />
              ))}
            </div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-cell">
            <div className="flex items-center gap-2 mb-4">
              <Target size={12} className="text-[var(--color-torch-text-tertiary)]" />
              <span className="t-label">What you use TORCH for</span>
            </div>
            {data.categories.length === 0 ? (
              <p className="insight-empty__desc">No steps recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {data.categories.map((cat) => (
                  <div key={cat.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-[var(--color-torch-text)]">
                        {cat.label}
                      </span>
                      <span className="t-mono-xs">
                        {Math.round((cat.count / categoryTotal) * 100)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="insight-category__fill"
                        style={{ width: `${(cat.count / categoryTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="stat-cell">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={12} className="text-[var(--color-torch-text-tertiary)]" />
              <span className="t-label">Steps carried out</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="insight-stat__value insight-stat__value--large">
                {data.total_steps}
              </span>
              <span className="text-[14px] text-[var(--color-torch-text-tertiary)]">
                {data.total_steps === 1 ? 'step' : 'steps'}
              </span>
            </div>
            <p className="insight-empty__desc mt-3">
              Individual actions TORCH took across those tasks — each file found, message sent, or
              app opened.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
