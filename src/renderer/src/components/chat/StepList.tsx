import type { Step } from '../../store/torchStore'

interface StepListProps {
  steps: Step[]
}

/**
 * Parses raw tool / terminal results to extract a clean single-line preview.
 * Skips lines composed entirely of symbols/dashes, clamps to 120 chars, and prefixes a block symbol.
 */
function formatStepResult(result: string | undefined): { text: string; hasOverflow: boolean } {
  if (!result) return { text: '', hasOverflow: false };

  const lines = result.split(/\r?\n/);
  let targetLine = '';

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines or cosmetic divider artifacts (dashes, equals signs, whitespace)
    if (!trimmed || /^[-=\s]+$/.test(trimmed)) {
      continue;
    }
    
    targetLine = trimmed;
    break;
  }

  if (!targetLine) return { text: '', hasOverflow: false };

  const hasOverflow = targetLine.length > 120;
  const truncated = hasOverflow ? `${targetLine.substring(0, 120)}...` : targetLine;
  
  return { 
    text: `■ ${truncated}`, 
    hasOverflow 
  };
}

export function StepList({ steps }: StepListProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
      {steps.map((step) => {
        const isDone = step.status === 'done'
        const isActive = step.status === 'active'
        const isFailed = step.status === 'failed' || step.status === 'hitl_required'

        // Clean preview processing for standard successful terminal operations
        const { text: previewText, hasOverflow } = formatStepResult(step.result);

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

            {/* Clean One-Line Terminal Preview (Only shown when not failed) */}
            {step.result && !isFailed && previewText && (
              <div style={{ paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  color: '#2a2a2a',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {previewText}
                </div>
                
                {/* Secondary overflow direction anchor */}
                {hasOverflow && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '8px',
                    color: '#2a2a2a',
                    opacity: 0.6,
                    lineHeight: '1.2'
                  }}>
                    see full output in Terminal
                  </div>
                )}
              </div>
            )}

            {/* Error or Active stub (Errors bypass all truncation filters and show in full) */}
            {(step.error || isFailed || (isActive && !step.result)) && (
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
                
                {/* Fallback inline error message node */}
                {step.error && (
                  <div style={{ marginTop: '2px', borderLeft: '1px solid #333', paddingLeft: '8px' }}>
                    [{new Date().toLocaleTimeString('en-US', { hour12: false })}] ERROR: {step.error}
                  </div>
                )}

                {/* Full unchecked fallback stream rendering for failed actions lacking step.error maps */}
                {!step.error && isFailed && step.result && (
                  <div style={{ marginTop: '2px', borderLeft: '1px solid #888', paddingLeft: '8px', color: '#888' }}>
                    {step.result}
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