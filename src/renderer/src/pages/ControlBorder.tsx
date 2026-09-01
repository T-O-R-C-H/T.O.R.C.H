import { useEffect, useState } from 'react'
import { useTorchStore } from '../store/torchStore'
import { useWebSocket } from '../hooks/useWebSocket'

/**
 * The "TORCH is driving" indicator.
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
 * A panel naming the action and the model's reason for it. Watching a cursor
 * move on its own with no explanation is the unsettling part. The panel is
 * deliberately roomy - an earlier version packed the same words into half
 * the space with tiny labels, and it read as a debug readout rather than
 * something a person is meant to follow while it works.
 */
const ACCENT = '#5375db'
const ACCENT_RGB = '83, 117, 219'

export default function ControlBorder(): JSX.Element {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  // Its own socket, like every other TORCH window, so steps arrive live.
  useWebSocket()
  const messages = useTorchStore((s) => s.messages)
  const agentStatus = useTorchStore((s) => s.agentStatus)

  useEffect(() => {
    window.torchAPI?.onControlBorderCursor?.((point) => setPointer(point))
  }, [])

  const activeStep = [...messages]
    .reverse()
    .flatMap((message) => message.steps ?? [])
    .find((step) => step.status === 'active')

  const action = activeStep?.action || (agentStatus === 'executing' ? 'working' : 'thinking')
  const thought = activeStep?.label

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

    /* Glow only. A drawn rule reads as a window frame. */
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

    /* ── The panel ── */
    .ci__panel {
      position: absolute;
      right: 32px; bottom: 32px;
      width: 400px;
      background: #ffffff;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 14px;
      box-shadow:
        0 24px 60px -12px rgba(15, 23, 42, 0.28),
        0 8px 20px -8px rgba(15, 23, 42, 0.16),
        0 0 0 1px rgba(${ACCENT_RGB}, 0.1);
      overflow: hidden;
    }

    .ci__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px 0;
    }

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

    /* Says which surface TORCH is acting on, like the reference's chip. */
    .ci__scope {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: #94a3b8;
    }

    .ci__section { padding: 16px 20px 0; }
    .ci__section:last-child { padding-bottom: 20px; }

    .ci__label {
      font-size: 13px; font-weight: 600; color: #0f172a;
      margin-bottom: 7px;
    }

    /* The action is code-shaped, so it is set as code. */
    .ci__action {
      display: flex; align-items: flex-start; gap: 8px;
      font-family: 'JetBrains Mono', ui-monospace, 'Courier New', monospace;
      font-size: 12px; line-height: 1.5;
      color: #334155;
      overflow-wrap: anywhere;
    }

    .ci__glyph { flex: none; margin-top: 1px; color: ${ACCENT}; }

    .ci__thought {
      font-size: 13px; line-height: 1.6;
      color: #475569;
      overflow-wrap: anywhere;
    }

    .ci__task {
      margin-top: 14px; padding-top: 14px;
      border-top: 1px solid rgba(15, 23, 42, 0.07);
      font-size: 12px; line-height: 1.5;
      color: #94a3b8;
      overflow-wrap: anywhere;
    }

    @media (prefers-reduced-motion: reduce) {
      .ci__edge, .ci__halo, .ci__live { animation: none; }
    }
  `

  const command = [...messages].reverse().find((m) => m.role === 'user')?.content

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

      <div className="ci__panel">
        <div className="ci__head">
          <div className="ci__brand">
            <span className="ci__live" />
            TORCH
          </div>
          <div className="ci__scope">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" stroke="currentColor" />
              <path d="M5.5 14h5" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Computer
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
            <span>{action}</span>
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
      </div>
    </div>
  )
}
