import { useEffect, useState } from 'react'
import { useTorchStore } from '../store/torchStore'
import { useWebSocket } from '../hooks/useWebSocket'

/**
 * The "TORCH is driving" indicator.
 *
 * Three parts in one click-through full-screen window:
 *
 * A glow around the edges. There is no drawn border line - a hard rule read
 * as a window frame and boxed the screen in. The glow alone says the same
 * thing without pretending to be chrome.
 *
 * A cursor with the TORCH name on it. Its position comes from the main
 * process, which reads the real pointer from the OS: a click-through window
 * does not reliably receive mousemove, which is why an earlier version sat
 * still while the real cursor moved.
 *
 * A panel naming the task, the action, and the model's reason for it.
 * Watching a cursor move on its own with no explanation is the unsettling
 * part.
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

  const command = [...messages].reverse().find((m) => m.role === 'user')?.content

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root {
      width: 100%; height: 100%;
      background: transparent !important;
      overflow: hidden;
      cursor: none;
    }

    .control-indicator {
      position: fixed; inset: 0; pointer-events: none;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }

    /* Glow only. No border line: a drawn rule reads as a window frame. */
    .control-indicator__edge {
      position: absolute;
      inset: 0;
      animation: edgeBreathe 2s ease-in-out infinite;
    }

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

    .control-indicator__cursor {
      position: absolute; left: 0; top: 0;
      width: 40px; height: 40px;
      margin-left: -20px; margin-top: -20px;
      will-change: transform;
    }

    .control-indicator__halo {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 2px solid ${ACCENT};
      background: rgba(${ACCENT_RGB}, 0.14);
      box-shadow:
        0 0 16px 3px rgba(${ACCENT_RGB}, 0.6),
        inset 0 0 10px rgba(${ACCENT_RGB}, 0.4);
      animation: haloPulse 1.4s ease-in-out infinite;
    }

    @keyframes haloPulse {
      0%, 100% { transform: scale(1);    opacity: 0.95; }
      50%      { transform: scale(1.22); opacity: 0.5; }
    }

    .control-indicator__arrow {
      position: absolute; left: 50%; top: 50%;
      transform: translate(-5px, -4px);
    }

    /* The name rides with the cursor so there is no doubt whose it is. */
    .control-indicator__tag {
      position: absolute;
      left: 26px; top: 22px;
      padding: 2px 7px;
      background: ${ACCENT};
      color: #ffffff;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.14em;
      white-space: nowrap;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    }

    .control-indicator__panel {
      position: absolute;
      right: 26px; bottom: 26px;
      width: 350px;
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(${ACCENT_RGB}, 0.35);
      box-shadow:
        0 16px 44px rgba(15, 23, 42, 0.22),
        0 0 24px rgba(${ACCENT_RGB}, 0.18);
      color: #1c1c1f;
      overflow: hidden;
    }

    .control-indicator__brand {
      display: flex; align-items: center; gap: 8px;
      padding: 11px 16px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      font-size: 11px; font-weight: 600; letter-spacing: 0.14em;
      color: #1c1c1f;
    }

    .control-indicator__live {
      width: 7px; height: 7px; border-radius: 50%;
      background: ${ACCENT};
      box-shadow: 0 0 8px 2px rgba(${ACCENT_RGB}, 0.7);
      animation: haloPulse 1.4s ease-in-out infinite;
    }

    .control-indicator__body { padding: 13px 16px 15px; }

    .control-indicator__key {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
      color: rgb(${ACCENT_RGB});
      margin-bottom: 4px;
    }

    .control-indicator__value {
      font-size: 12.5px; line-height: 1.5;
      color: #3f3f46;
      margin-bottom: 12px;
      overflow-wrap: anywhere;
    }
    .control-indicator__value:last-child { margin-bottom: 0; }

    .control-indicator__value--mono {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11.5px;
      color: #1c1c1f;
    }

    @media (prefers-reduced-motion: reduce) {
      .control-indicator__edge,
      .control-indicator__halo,
      .control-indicator__live { animation: none; }
    }
  `

  return (
    <div className="control-indicator">
      <style>{css}</style>

      <div className="control-indicator__edge" />

      {pointer && (
        <div
          className="control-indicator__cursor"
          style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)` }}
        >
          <div className="control-indicator__halo" />
          <svg
            className="control-indicator__arrow"
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
          <span className="control-indicator__tag">TORCH</span>
        </div>
      )}

      <div className="control-indicator__panel">
        <div className="control-indicator__brand">
          <span className="control-indicator__live" />
          TORCH
        </div>

        <div className="control-indicator__body">
          {command && (
            <>
              <div className="control-indicator__key">Task</div>
              <div className="control-indicator__value">{command}</div>
            </>
          )}

          <div className="control-indicator__key">Action</div>
          <div className="control-indicator__value control-indicator__value--mono">
            {activeStep?.action || (agentStatus === 'executing' ? 'working' : 'thinking')}
          </div>

          {/* The model's own reason, shown only when it gave one rather than
              filled in with a guess. */}
          {activeStep?.label && (
            <>
              <div className="control-indicator__key">Thought</div>
              <div className="control-indicator__value">{activeStep.label}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
