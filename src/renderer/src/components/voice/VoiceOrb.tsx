/**
 * The voice orb.
 *
 * Shown when TORCH is woken by the phrase, so there is something to look at
 * that is obviously not the chat window. It reacts to the real microphone
 * level while listening and pulses gently while thinking, so the state is
 * readable without reading any words.
 *
 * The depth is layered radial gradients rather than a 3D library: it has to
 * sit in a transparent always-on-top window over whatever the user is doing,
 * and a WebGL canvas there costs a great deal for a sphere.
 */
export type OrbState = 'listening' | 'thinking' | 'speaking'

const ACCENT = '#5375db'
const ACCENT_RGB = '83, 117, 219'

export function VoiceOrb({
  state,
  level = 0,
  size = 132
}: {
  state: OrbState
  /** 0..1 microphone level, used only while listening. */
  level?: number
  size?: number
}): JSX.Element {
  // The orb swells with the voice, but only a little: a wildly resizing ball
  // reads as a toy rather than an instrument.
  const swell = state === 'listening' ? 1 + Math.min(1, level) * 0.12 : 1

  return (
    <div
      className={`orb orb--${state}`}
      style={{ width: size, height: size, transform: `scale(${swell})` }}
      aria-hidden="true"
    >
      <div className="orb__glow" />
      <div className="orb__body">
        <div className="orb__sheen" />
        <div className="orb__core" />
      </div>
      <div className="orb__ring" />

      <style>{`
        .orb {
          position: relative;
          display: grid;
          place-items: center;
          transition: transform 120ms ease-out;
        }

        /* The light the orb casts on what is behind it. */
        .orb__glow {
          position: absolute; inset: -30%;
          border-radius: 50%;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(${ACCENT_RGB}, 0.34) 0%,
            rgba(${ACCENT_RGB}, 0.12) 45%,
            transparent 70%
          );
          filter: blur(10px);
          animation: orbGlow 3s ease-in-out infinite;
        }

        /* Depth comes from an off-centre highlight and a darker rim, which is
           what makes a flat circle read as a sphere. */
        .orb__body {
          position: relative;
          width: 100%; height: 100%;
          border-radius: 50%;
          background:
            radial-gradient(circle at 32% 28%, #a8bdf5 0%, ${ACCENT} 42%, #2f4699 78%, #1b2a63 100%);
          box-shadow:
            inset -8px -10px 26px rgba(9, 15, 40, 0.55),
            inset 6px 8px 22px rgba(255, 255, 255, 0.22),
            0 14px 40px -10px rgba(${ACCENT_RGB}, 0.6);
          overflow: hidden;
        }

        .orb__sheen {
          position: absolute;
          top: 8%; left: 16%;
          width: 46%; height: 34%;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at 40% 40%,
            rgba(255, 255, 255, 0.75) 0%,
            rgba(255, 255, 255, 0.16) 55%,
            transparent 72%
          );
          filter: blur(2px);
        }

        /* A slow drift inside the sphere so it never looks like a static
           image, even when the room is silent. */
        .orb__core {
          position: absolute; inset: 12%;
          border-radius: 50%;
          background: radial-gradient(
            circle at 60% 65%,
            rgba(168, 189, 245, 0.5) 0%,
            transparent 62%
          );
          animation: orbDrift 6s ease-in-out infinite;
        }

        .orb__ring {
          position: absolute; inset: -7%;
          border-radius: 50%;
          border: 1px solid rgba(${ACCENT_RGB}, 0.45);
          animation: orbRing 2.2s ease-out infinite;
        }

        @keyframes orbGlow {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.05); }
        }
        @keyframes orbDrift {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(-6%, -5%); }
        }
        @keyframes orbRing {
          0%   { transform: scale(0.94); opacity: 0.7; }
          100% { transform: scale(1.18); opacity: 0; }
        }

        /* Thinking has no voice to follow, so it breathes on its own. */
        .orb--thinking .orb__body { animation: orbThink 1.6s ease-in-out infinite; }
        @keyframes orbThink {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(0.955); }
        }

        /* Speaking gets a faster ring, so it is clear which way the
           conversation is flowing. */
        .orb--speaking .orb__ring { animation-duration: 1.1s; }
        .orb--listening .orb__ring { animation-duration: 2.2s; }

        @media (prefers-reduced-motion: reduce) {
          .orb__glow, .orb__core, .orb__ring, .orb--thinking .orb__body {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
