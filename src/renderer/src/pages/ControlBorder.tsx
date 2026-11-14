/**
 * Shown over the whole desktop while TORCH is driving the screen.
 *
 * A soft glow that breathes around the edges of the screen, so it is
 * obvious that TORCH has control without anything sitting over the app it is
 * working in. It used to be a pulsing ring in the middle of the screen, on
 * top of exactly the thing the user was trying to watch.
 *
 * The window is click-through and hidden from TORCH's own screenshots.
 * Blue is reserved for this signal and used nowhere else.
 */
export default function ControlBorder(): JSX.Element {
  return (
    <div className="control-glow">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; background: transparent !important; overflow: hidden; }
        .control-glow {
          position: fixed;
          inset: 0;
          pointer-events: none;
          border-radius: 10px;
          border: 2px solid rgba(59, 130, 246, 0.9);
          box-shadow:
            inset 0 0 18px 4px rgba(59, 130, 246, 0.55),
            inset 0 0 60px 10px rgba(59, 130, 246, 0.22);
          animation: control-breathe 2.6s ease-in-out infinite, control-in 420ms ease-out;
        }
        @keyframes control-breathe {
          0%, 100% {
            border-color: rgba(59, 130, 246, 0.95);
            box-shadow:
              inset 0 0 18px 4px rgba(59, 130, 246, 0.55),
              inset 0 0 60px 10px rgba(59, 130, 246, 0.22);
          }
          50% {
            border-color: rgba(96, 165, 250, 0.55);
            box-shadow:
              inset 0 0 10px 2px rgba(59, 130, 246, 0.3),
              inset 0 0 34px 6px rgba(59, 130, 246, 0.1);
          }
        }
        @keyframes control-in {
          from { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .control-glow { animation: none; }
        }
      `}</style>
    </div>
  )
}
