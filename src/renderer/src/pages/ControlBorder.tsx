export default function ControlBorder(): JSX.Element {
  return (
    <div className="control-border">
      <div className="control-border__label">TORCH IN CONTROL</div>
      <style>{`
        @keyframes borderPulse {
          0%, 100% { opacity: 1; border-color: #3b82f6; box-shadow: 0 0 0 1px #1d4ed8, inset 0 0 0 1px #1d4ed8, 0 0 30px rgba(59,130,246,.4); }
          50% { opacity: .6; border-color: #60a5fa; box-shadow: 0 0 0 1px #2563eb, inset 0 0 0 1px #2563eb, 0 0 50px rgba(59,130,246,.6); }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; background: transparent !important; }
        .control-border { position: fixed; inset: 0; pointer-events: none; border: 3px solid #3b82f6; animation: borderPulse 1.5s ease-in-out infinite; }
        .control-border__label { position: absolute; top: 12px; left: 12px; background: #3b82f6; color: white; font: 11px monospace; padding: 3px 8px; letter-spacing: .05em; }
      `}</style>
    </div>
  )
}
