import { useCallback, useEffect, useRef, useState } from 'react'
import { useTorchStore } from '../store/torchStore'
import { useWebSocket } from '../hooks/useWebSocket'

/**
 * The "TORCH is driving" indicator.
 *
 * Shown only while TORCH actually holds the mouse: the window is raised on
 * vision_control_start and dropped on the matching end.
 *
 * Three parts in one click-through full-screen window:
 *
 * A glow around the edges. No drawn border line - a hard rule read as a
 * window frame and boxed the screen in.
 *
 * A cursor carrying the TORCH name. Its position comes from the main
 * process, which reads the real pointer from the OS: a click-through window
 * does not reliably receive mousemove, which is why an earlier version sat
 * still while the real cursor moved.
 *
 * A panel naming the action and the model's reason for it, with the controls
 * to hold or end the run. The window stays click-through everywhere except
 * over this panel, so the buttons work without the overlay ever swallowing a
 * click meant for the app underneath.
 */
const ACCENT = '#5375db'
const ACCENT_RGB = '83, 117, 219'

export default function ControlBorder(): JSX.Element {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [paused, setPaused] = useState(false)
  const [offset, setOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; dx: number; dy: number } | null>(null)

  // Its own socket, like every other TORCH window, so steps arrive live.
  const { sendStopCommand, sendPauseCommand } = useWebSocket()
  const messages = useTorchStore((s) => s.messages)
  const agentStatus = useTorchStore((s) => s.agentStatus)

  useEffect(() => {
    window.torchAPI?.onControlBorderCursor?.((point) => setPointer(point))
  }, [])

  /*
   * Main needs to know where the panel is to decide when to lift the
   * click-through. Reported after every move and on mount.
   */
  const reportRect = useCallback(() => {
    const box = panelRef.current?.getBoundingClientRect()
    if (!box) return
    window.torchAPI?.setControlPanelRect?.({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    })
  }, [])

  useEffect(() => {
    reportRect()
  }, [reportRect, offset])

  const onDragStart = (event: React.MouseEvent): void => {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      dx: offset.dx,
      dy: offset.dy
    }
    const onMove = (move: MouseEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      setOffset({
        dx: drag.dx + (move.clientX - drag.startX),
        dy: drag.dy + (move.clientY - drag.startY)
      })
    }
    const onUp = (): void => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      reportRect()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const activeStep = [...messages]
    .reverse()
    .flatMap((message) => message.steps ?? [])
    .find((step) => step.status === 'active')

  const action = activeStep?.action || (agentStatus === 'executing' ? 'working' : 'thinking')
  const thought = activeStep?.label
  const command = [...messages].reverse().find((m) => m.role === 'user')?.content

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root {
      width: 100%; height: 100%;
      background: transparent !important;
      overflow: hidden;
      cursor: none;
    }

    .ci {
      position: fixed; inset: 0; pointer-events: none;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .ci__edge { position: absolute; inset: 0; animation: edgeBreathe 2s ease-in-out infinite; }

    @keyframes edgeBreathe {
      0%, 100% {
        box-shadow:
          inset 0 0 40px 6px rgba(${ACCENT_RGB}, 0.55),
          inset 0 0 110px 26px rgba(${ACCENT_RGB}, 0.3),
          inset 0 0 190px 60px rgba(${ACCENT_RGB}, 0.12);
      }
      50% {
        box-shadow:
          inset 0 0 22px 3px rgba(${ACCENT_RGB}, 0.3),
          inset 0 0 64px 14px rgba(${ACCENT_RGB}, 0.16),
          inset 0 0 120px 34px rgba(${ACCENT_RGB}, 0.06);
      }
    }

    .ci__cursor {
      position: absolute; left: 0; top: 0;
      width: 40px; height: 40px;
      margin-left: -20px; margin-top: -20px;
      will-change: transform;
    }

    .ci__halo {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 2px solid ${ACCENT};
      background: rgba(${ACCENT_RGB}, 0.14);
      box-shadow: 0 0 16px 3px rgba(${ACCENT_RGB}, 0.6), inset 0 0 10px rgba(${ACCENT_RGB}, 0.4);
      animation: haloPulse 1.4s ease-in-out infinite;
    }

    @keyframes haloPulse {
      0%, 100% { transform: scale(1);    opacity: 0.95; }
      50%      { transform: scale(1.22); opacity: 0.5; }
    }

    .ci__arrow { position: absolute; left: 50%; top: 50%; transform: translate(-5px, -4px); }

    .ci__tag {
      position: absolute; left: 26px; top: 22px;
      padding: 2px 7px;
      background: ${ACCENT}; color: #fff;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 9px; font-weight: 500; letter-spacing: 0.14em;
      white-space: nowrap;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    }

    .ci__panel {
      position: absolute;
      right: 32px; bottom: 32px;
      width: 340px;
      background: #ffffff;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 14px;
      box-shadow:
        0 24px 60px -12px rgba(15, 23, 42, 0.28),
        0 8px 20px -8px rgba(15, 23, 42, 0.16),
        0 0 0 1px rgba(${ACCENT_RGB}, 0.1);
      overflow: hidden;
      pointer-events: auto;
    }

    /* The header doubles as the drag handle. */
    .ci__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px 0;
      cursor: grab;
      user-select: none;
    }
    .ci__head:active { cursor: grabbing; }

    .ci__brand {
      display: flex; align-items: center; gap: 9px;
      font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
      color: #0f172a;
    }

    .ci__live {
      width: 8px; height: 8px; border-radius: 50%;
      background: ${ACCENT};
      box-shadow: 0 0 0 3px rgba(${ACCENT_RGB}, 0.16);
      animation: haloPulse 1.4s ease-in-out infinite;
    }
    .ci__live--paused { background: #94a3b8; box-shadow: none; animation: none; }

    .ci__scope {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: #94a3b8;
    }

    .ci__section { padding: 14px 18px 0; }

    .ci__label { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 6px; }

    .ci__action {
      display: flex; align-items: flex-start; gap: 8px;
      font-family: 'JetBrains Mono', ui-monospace, 'Courier New', monospace;
      font-size: 12px; line-height: 1.5;
      color: #334155;
      overflow-wrap: anywhere;
    }

    .ci__glyph { flex: none; margin-top: 1px; color: ${ACCENT}; }

    .ci__thought {
      font-size: 13px; line-height: 1.6; color: #475569;
      overflow-wrap: anywhere;
    }

    .ci__task {
      font-size: 12px; line-height: 1.5; color: #94a3b8;
      overflow-wrap: anywhere;
    }

    /* Controls last, divided off, so they read as the way out. */
    .ci__controls {
      display: flex; gap: 8px;
      margin-top: 16px; padding: 12px 18px;
      border-top: 1px solid rgba(15, 23, 42, 0.07);
      background: #fafafa;
    }

    .ci__btn {
      flex: 1;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      height: 32px;
      font-family: inherit; font-size: 12px; font-weight: 500;
      border-radius: 8px; border: 1px solid rgba(15, 23, 42, 0.12);
      background: #ffffff; color: #0f172a;
      cursor: pointer;
    }
    .ci__btn:hover { background: #f1f5f9; }

    .ci__btn--end {
      border-color: rgba(220, 38, 38, 0.25);
      color: #dc2626;
    }
    .ci__btn--end:hover { background: #fef2f2; }

    .ci__hint {
      padding: 0 18px 14px;
      font-size: 11px; line-height: 1.45; color: #94a3b8;
    }

    @media (prefers-reduced-motion: reduce) {
      .ci__edge, .ci__halo, .ci__live { animation: none; }
    }
  `

  return (
    <div className="ci">
      <style>{css}</style>

      <div className="ci__edge" />

      {pointer && (
        <div
          className="ci__cursor"
          style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)` }}
        >
          <div className="ci__halo" />
          <svg
            className="ci__arrow"
            width="14"
            height="16"
            viewBox="0 0 16 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1 L1 14.5 L4.6 11.2 L7 17 L9.6 15.8 L7.2 10.2 L12 10 Z"
              fill={ACCENT}
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="ci__tag">TORCH</span>
        </div>
      )}

      <div
        ref={panelRef}
        className="ci__panel"
        style={{ transform: `translate(${offset.dx}px, ${offset.dy}px)` }}
      >
        <div className="ci__head" onMouseDown={onDragStart}>
          <div className="ci__brand">
            <span className={`ci__live ${paused ? 'ci__live--paused' : ''}`} />
            TORCH
          </div>
          <div className="ci__scope">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" />
              <path d="M5.5 14h5" stroke="currentColor" strokeLinecap="round" />
            </svg>
            {paused ? 'Paused' : 'Computer'}
          </div>
        </div>

        <div className="ci__section">
          <div className="ci__label">Action</div>
          <div className="ci__action">
            <svg
              className="ci__glyph"
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 2 L3 12.5 L5.8 9.9 L7.7 14.4 L9.7 13.5 L7.8 9.2 L11.5 9 Z"
                fill="currentColor"
              />
            </svg>
            <span>{paused ? 'held' : action}</span>
          </div>
        </div>

        {/* The model's own reason, shown only when it gave one. */}
        {thought && (
          <div className="ci__section">
            <div className="ci__label">Thought</div>
            <div className="ci__thought">{thought}</div>
          </div>
        )}

        {command && (
          <div className="ci__section">
            <div className="ci__task">{command}</div>
          </div>
        )}

        <div className="ci__controls">
          <button
            type="button"
            className="ci__btn"
            onClick={() => {
              const next = !paused
              setPaused(next)
              sendPauseCommand(next)
            }}
          >
            {paused ? (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 2.5 L13 8 L4 13.5 Z" fill="currentColor" />
                </svg>
                Resume
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="4" y="3" width="3" height="10" fill="currentColor" />
                  <rect x="9" y="3" width="3" height="10" fill="currentColor" />
                </svg>
                Pause
              </>
            )}
          </button>

          <button type="button" className="ci__btn ci__btn--end" onClick={() => sendStopCommand()}>
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
            </svg>
            End
          </button>
        </div>

        <div className="ci__hint">
          Pause holds TORCH before its next action. End stops the task.
        </div>
      </div>
    </div>
  )
}
