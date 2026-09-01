import { useEffect, useState } from 'react'
import { useTorchStore } from '../store/torchStore'
import { useWebSocket } from '../hooks/useWebSocket'

/**
 * The "TORCH is driving" indicator.
 *
 * Three parts, all in one click-through full-screen window:
 *
 * A pulsing edge around the display, so the state is readable from anywhere.
 * This replaced a ring parked in the middle of the screen, which sat on top
 * of whatever the user was looking at and said nothing about where the
 * action was.
 *
 * A cursor that follows the pointer, so it is obvious which movements are
 * TORCH's rather than the user's.
 *
 * A panel naming what it is doing and why. Watching a cursor move on its own
 * with no explanation is the unsettling part, so the action and the model's
 * own reason for it are both shown.
 */
const ACCENT = '#5375db'
const ACCENT_RGB = '83, 117, 219'

export default function ControlBorder(): JSX.Element {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  // Its own socket, like every other TORCH window.
  useWebSocket()
  const messages = useTorchStore((s) => s.messages)
  const agentStatus = useTorchStore((s) => s.agentStatus)

  useEffect(() => {
    const onMove = (event: MouseEvent): void => {
      setPointer({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // The step being worked on right now carries the live action and reason.
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

    /* The edge. Inset shadows rather than a border, so the glow falls inward
       over the screen without shifting anything. */
    .control-indicator__edge {
      position: absolute;
      inset: 0;
      border: 3px solid ${ACCENT};
      animation: edgeBreathe 2s ease-in-out infinite;
    }

    /* Scaling very slightly as well as fading reads as a breath rather than
       a flicker. */
    @keyframes edgeBreathe {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
        box-shadow:
          inset 0 0 0 1px rgba(${ACCENT_RGB}, 0.65),
          inset 0 0 60px 14px rgba(${ACCENT_RGB}, 0.42),
          inset 0 0 120px 30px rgba(${ACCENT_RGB}, 0.18),
          0 0 40px 8px rgba(${ACCENT_RGB}, 0.55);
      }
      50% {
        opacity: 0.72;
        transform: scale(0.997);
        box-shadow:
          inset 0 0 0 1px rgba(${ACCENT_RGB}, 0.4),
          inset 0 0 34px 8px rgba(${ACCENT_RGB}, 0.22),
          inset 0 0 70px 16px rgba(${ACCENT_RGB}, 0.1),
          0 0 20px 4px rgba(${ACCENT_RGB}, 0.3);
      }
    }

    .control-indicator__cursor {
      position: absolute; left: 0; top: 0;
      width: 46px; height: 46px;
      margin-left: -23px; margin-top: -23px;
      will-change: transform;
    }

    .control-indicator__halo {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 2px solid ${ACCENT};
      box-shadow:
        0 0 16px 3px rgba(${ACCENT_RGB}, 0.6),
        inset 0 0 10px rgba(${ACCENT_RGB}, 0.4);
      animation: haloPulse 1.4s ease-in-out infinite;
    }

    @keyframes haloPulse {
      0%, 100% { transform: scale(1);    opacity: 0.95; }
      50%      { transform: scale(1.22); opacity: 0.45; }
    }

    .control-indicator__arrow {
      position: absolute; left: 50%; top: 50%;
      transform: translate(-6px, -5px);
    }

    /* Bottom right, where it overlaps least with what is being driven. */
    .control-indicator__panel {
      position: absolute;
      right: 26px; bottom: 26px;
      width: 340px;
      padding: 14px 16px;
      background: rgba(10, 12, 18, 0.92);
      backdrop-filter: blur(18px);
      border: 1px solid rgba(${ACCENT_RGB}, 0.55);
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.55),
        0 0 22px rgba(${ACCENT_RGB}, 0.28);
      color: #f4f4f5;
    }

    .control-indicator__brand {
      display: flex; align-items: center; gap: 8px;
      padding-bottom: 10px; margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 11px; font-weight: 600; letter-spacing: 0.14em;
    }

    .control-indicator__live {
      width: 7px; height: 7px; border-radius: 50%;
      background: ${ACCENT};
      box-shadow: 0 0 8px 2px rgba(${ACCENT_RGB}, 0.8);
      animation: haloPulse 1.4s ease-in-out infinite;
    }

    .control-indicator__key {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
      color: rgb(${ACCENT_RGB});
      margin-bottom: 3px;
    }

    .control-indicator__value {
      font-size: 12.5px; line-height: 1.45;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 11px;
      overflow-wrap: anywhere;
    }
    .control-indicator__value:last-child { margin-bottom: 0; }

    .control-indicator__value--mono {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11.5px;
      color: #ffffff;
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
            width="16"
            height="18"
            viewBox="0 0 16 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1 L1 14.5 L4.6 11.2 L7 17 L9.6 15.8 L7.2 10.2 L12 10 Z"
              fill={ACCENT}
              stroke="#ffffff"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      <div className="control-indicator__panel">
        <div className="control-indicator__brand">
          <span className="control-indicator__live" />
          TORCH
        </div>

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

        {/* The model's own reason for this step. Shown only when it gave one,
            rather than filled in with a guess. */}
        {activeStep?.label && (
          <>
            <div className="control-indicator__key">Thought</div>
            <div className="control-indicator__value">{activeStep.label}</div>
          </>
        )}
      </div>
    </div>
  )
}
