import React from 'react';

interface TypingIndicatorProps {
  status: 'processing' | 'executing';
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = React.memo(({ status }) => {
  const caption = status === 'processing' ? 'planning with Gemini...' : 'running task...';
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      animation: 'fade-in 200ms ease-out',
    }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <span className="typing-square" />
        <span className="typing-square" />
        <span className="typing-square" />
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '9px',
        color: '#fff',
        textAlign: 'center',
      }}>{caption}</div>
    </div>
  );
});
