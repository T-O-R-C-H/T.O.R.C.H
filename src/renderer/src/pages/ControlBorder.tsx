import { useEffect, useState } from 'react'

/**
 * The "TORCH is driving" indicator.
 *
 * Two parts, both in the TORCH accent rather than the old blue:
 *
 * A glowing edge around the whole screen, so the state is readable from
 * anywhere without hunting for a badge. This replaced a pulsing ring parked
 * in the middle of the display, which sat on top of whatever the user was
 * looking at and said nothing about where the action was.
 *
 * A ring that follows the pointer, so it is obvious which cursor movements
 * are TORCH's. The window is click-through with move events forwarded, so it
 * can see the pointer without ever swallowing a click.
 */
const ACCENT = '#d97757'

export default function ControlBorder(): JSX.Element {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onMove = (event: MouseEvent): void => {
      setPointer({ x: event.clientX, y: event.clientY })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="control-indicator">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root {
          width: 100%; height: 100%;
          background: transparent !important;
          overflow: hidden;
          cursor: none;
        }

        .control-indicator { position: fixed; inset: 0; pointer-events: none; }

        /* The edge. Inset shadows rather than a border so nothing shifts the
           layout, and the glow falls inward over the screen content. */
        .control-indicator__edge {
          position: absolute;
          inset: 0;
          border: 2px solid ${ACCENT};
          box-shadow:
            inset 0 0 0 1px rgba(217, 119, 87, 0.5),
            inset 0 0 28px 6px rgba(217, 119, 87, 0.28),
            0 0 18px 2px rgba(217, 119, 87, 0.35);
          animation: edgeBreathe 2.4s ease-in-out infinite;
        }

        @keyframes edgeBreathe {
          0%, 100% { opacity: 0.95; }
          50%      { opacity: 0.6; }
        }

        /* The cursor. An arrow so it reads as a pointer, with a ring behind
           it so it is visible over both light and dark windows. */
        .control-indicator__cursor {
          position: absolute;
          left: 0; top: 0;
          width: 46px; height: 46px;
          margin-left: -23px; margin-top: -23px;
          will-change: transform;
        }

        .control-indicator__halo {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 2px solid ${ACCENT};
          box-shadow:
            0 0 12px 2px rgba(217, 119, 87, 0.55),
            inset 0 0 8px rgba(217, 119, 87, 0.35);
          animation: haloPulse 1.4s ease-in-out infinite;
        }

        @keyframes haloPulse {
          0%, 100% { transform: scale(1);    opacity: 0.9; }
          50%      { transform: scale(1.18); opacity: 0.5; }
        }

        .control-indicator__arrow {
          position: absolute;
          left: 50%; top: 50%;
          transform: translate(-6px, -5px);
        }

        .control-indicator__label {
          position: absolute;
          left: 50%;
          bottom: -22px;
          transform: translateX(-50%);
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${ACCENT};
          white-space: nowrap;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
        }
      `}</style>

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
          <span className="control-indicator__label">TORCH</span>
        </div>
      )}
    </div>
  )
}
