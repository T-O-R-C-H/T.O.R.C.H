export default function ControlBorder(): JSX.Element {
  return (
    <div className="cursor-ring">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; background: transparent !important; overflow: hidden; }
        .cursor-ring { position: fixed; inset: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
        .cursor-ring__ring {
          width: 54px; height: 54px; border-radius: 50%;
          border: 3px solid #3b82f6;
          box-shadow:
            0 0 0 2px rgba(29, 78, 216, .55),
            0 0 22px 6px rgba(59, 130, 246, .6),
            inset 0 0 10px rgba(59, 130, 246, .4);
          animation: ringPulse 1.1s ease-in-out infinite;
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.14); opacity: .75; }
        }
      `}</style>
      <div className="cursor-ring__ring" />
    </div>
  )
}