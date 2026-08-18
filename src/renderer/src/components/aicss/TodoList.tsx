import styles from './TodoList.module.css'
import { useState } from 'react'

export interface TodoStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done' | 'failed'
}

const cls = (base: string, on?: boolean): string => base + (on ? ' ' + styles.on : '')

const CheckIcon = ({ on }: { on?: boolean }): JSX.Element => (
  <svg className={cls(styles.todoIcon, on)} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ArrowIcon = ({ on }: { on?: boolean }): JSX.Element => (
  <svg className={cls(styles.todoIcon + ' ' + styles.strong, on)} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const DashedIcon = ({ on }: { on?: boolean }): JSX.Element => (
  <svg className={cls(styles.todoIcon, on)} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="1.8 3.6" strokeLinecap="round" />
  </svg>
)

const XIcon = ({ on }: { on?: boolean }): JSX.Element => (
  <svg className={cls(styles.todoIcon, on)} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const FilledCheckIcon = (): JSX.Element => (
  <svg className={styles.todoHeadCheck} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
      fill="currentColor"
    />
  </svg>
)

export function TodoList({ steps, title = 'To-dos' }: { steps: TodoStep[]; title?: string }): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  const done = steps.filter((s) => s.status === 'done').length
  const allDone = steps.length > 0 && done === steps.length
  const running = steps.some((s) => s.status === 'active' || s.status === 'pending')
  const pct = steps.length === 0 ? 0 : Math.round((done / steps.length) * 100)

  return (
    <div className={styles.todo}>
      <button type="button" className={styles.todoHead} aria-expanded={!collapsed} aria-label="Toggle to-dos" onClick={() => setCollapsed((c) => !c)}>
        <span className={styles.todoHeadIcon}>
          {allDone ? (
            <FilledCheckIcon />
          ) : running ? (
            <span className={styles.todoHeadPie} style={{ ['--todo-pie' as string]: pct + '%' }} aria-hidden="true">
              <svg className={styles.todoHeadPieRing} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="2.2 4.4" strokeLinecap="round" />
              </svg>
            </span>
          ) : (
            <svg className={styles.todoListIcon} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 5h8" />
              <path d="M13 12h8" />
              <path d="M13 19h8" />
              <path d="m3 17 2 2 4-4" />
              <path d="m3 7 2 2 4-4" />
            </svg>
          )}
          <svg className={styles.todoChevron} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="m19.5 8.25-7.5 7.5-7.5-7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className={styles.todoTitle}>{title}</span>
        <span className={styles.todoCount}>{done}/{steps.length}</span>
      </button>

      <div className={styles.todoCollapsible + (collapsed ? ' ' + styles.isCollapsed : '')}>
        <div className={styles.todoInner}>
          {running && (
            <div className={styles.todoThinking}>
              <span className={styles.todoThinkingDot} aria-hidden="true" />
              <span>Thinking…</span>
            </div>
          )}
          <ul className={styles.todoList}>
            {steps.map((step, i) => {
              const isDone = step.status === 'done'
              const isActive = step.status === 'active'
              const isFailed = step.status === 'failed'
              return (
                <li key={step.id} className={styles.todoItem + (isDone ? ' ' + styles.done : isActive ? ' ' + styles.active : isFailed ? ' ' + styles.failed : '')} style={{ ['--i' as string]: i }}>
                  <span className={styles.todoIconWrap}>
                    {isFailed ? (
                      <XIcon on />
                    ) : (
                      <>
                        <DashedIcon on={!isDone && !isActive} />
                        <ArrowIcon on={isActive} />
                        <CheckIcon on={isDone} />
                      </>
                    )}
                  </span>
                  <span className={styles.todoLabel} data-label={step.label}>
                    {step.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}