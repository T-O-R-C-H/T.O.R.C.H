import type { Step } from '../../store/torchStore'
import { ResultRenderer } from './ResultRenderer'

interface StepListProps {
  steps: Step[]
}

export function StepList({ steps }: StepListProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
      {steps.map((step) => {
        const isDone = step.status === 'done'
        const isActive = step.status === 'active'
        const isFailed = step.status === 'failed' || step.status === 'hitl_required'

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              opacity: isDone ? 0.6 : isFailed ? 0.8 : 1,
              transition: 'opacity 300ms ease',
            }}
          >
            {/* Step Row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: isActive ? '#ffffff' : isDone ? '#666666' : isFailed ? '#888' : '#333333',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: '1.4'
              }}>
                <span style={{ width: '18px', display: 'inline-block' }}>
                  {isActive ? '[•••]' : isDone ? '[✓]' : isFailed ? '[!]' : '[ ]'}
                </span>
                <span>{step.label}</span>
                {isActive && (
                  <div style={{
                    width: '5px', height: '5px',
                    background: '#ffffff',
                    animation: 'pulse-dot 1s infinite'
                  }} />
                )}
              </div>
            </div>

            {/* Smart Result Display */}
            {step.result && !isFailed && (
              <ResultRenderer result={step.result} />
            )}

            {/* Error or Active stub */}
            {(step.error || (isActive && !step.result)) && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                lineHeight: 1.7,
                color: isFailed ? '#888' : '#4f4f4f',
                paddingLeft: '28px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {isActive && !step.result && !step.error && `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] executing operation...`}
                {step.error && (
                  <div style={{ marginTop: '2px', borderLeft: '1px solid #333', paddingLeft: '8px' }}>
                    [{new Date().toLocaleTimeString('en-US', { hour12: false })}] ERROR: {step.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
