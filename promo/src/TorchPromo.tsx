import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'
import type { ReactNode } from 'react'

const FONT = 'Inter, system-ui, -apple-system, sans-serif'
const C = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  muted: '#fafafa',
  border: '#e4e4e7',
  text: '#18181b',
  sub: '#71717a',
  ghost: '#a1a1aa',
  blue: '#60a5fa',
  blueDark: '#3b82f6',
  link: '#c15f3c'
}

function useSpringIn(delay = 0, config = { damping: 14, stiffness: 80 }): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config })
}

function useTyped(text: string, start: number, cps = 0.7): string {
  const frame = useCurrentFrame()
  const n = Math.floor(Math.max(0, frame - start) * cps)
  return text.slice(0, Math.min(text.length, n))
}

function ClickCursor({
  x,
  y,
  clicking,
  visible
}: {
  x: number
  y: number
  clicking: boolean
  visible: boolean
}): JSX.Element | null {
  if (!visible) return null
  const scale = clicking ? 0.82 : 1
  return (
    <>
      {clicking && (
        <div
          style={{
            position: 'absolute',
            left: x - 28,
            top: y - 28,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '2px solid rgba(96,165,250,0.5)',
            pointerEvents: 'none'
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: `scale(${scale})`,
          pointerEvents: 'none',
          zIndex: 100,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 3L19 12L11 13L9 21L5 3Z"
            fill="#fff"
            stroke="#18181b"
            strokeWidth="1.2"
          />
        </svg>
      </div>
    </>
  )
}

function AppSidebar({ active = 'chat' }: { active?: string }): JSX.Element {
  const items = [
    { id: 'chat', label: 'Chat' },
    { id: 'today', label: 'Today' },
    { id: 'history', label: 'History' },
    { id: 'skills', label: 'Skills' }
  ]
  return (
    <div
      style={{
        width: 200,
        height: '100%',
        background: C.muted,
        borderRight: `1px solid ${C.border}`,
        padding: '14px 0',
        flexShrink: 0
      }}
    >
      <div style={{ padding: '0 16px 16px' }}>
        <Img src={staticFile('logo.png')} style={{ width: 72, height: 'auto' }} />
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            margin: '2px 8px',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: item.id === active ? 500 : 400,
            color: item.id === active ? C.text : C.sub,
            background: item.id === active ? C.surface : 'transparent',
            border: item.id === active ? `1px solid ${C.border}` : '1px solid transparent'
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}

function AppShell({
  children,
  title = 'Command Center'
}: {
  children: ReactNode
  title?: string
}): JSX.Element {
  return (
    <div
      style={{
        width: 960,
        height: 580,
        background: C.bg,
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
        border: `1px solid ${C.border}`
      }}
    >
      <AppSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            height: 48,
            borderBottom: `1px solid ${C.border}`,
            background: C.surface,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{title}</div>
            <div style={{ fontSize: 11, color: C.ghost }}>Desktop agent</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ width: 12, height: 12, borderRadius: 3, background: C.border }}
              />
            ))}
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  )
}

function SceneIntro(): JSX.Element {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 70 } })
  const y = interpolate(s, [0, 1], [60, 0])

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 90% 70% at 50% 0%, #dbeafe 0%, ${C.bg} 60%)`,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${y}px)`, opacity: s }}>
        <Img src={staticFile('logo.png')} style={{ width: 280, marginBottom: 24 }} />
        <p style={{ fontSize: 36, fontWeight: 600, color: C.text, letterSpacing: '-0.03em' }}>
          Your desktop, finally understood.
        </p>
        <p style={{ fontSize: 17, color: C.sub, marginTop: 14 }}>TORCH · Local AI agent for Windows</p>
      </div>
    </AbsoluteFill>
  )
}

function SceneAppReveal(): JSX.Element {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const zoom = spring({ frame, fps, config: { damping: 16, stiffness: 55 } })
  const scale = interpolate(zoom, [0, 1], [1.35, 1])
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        background: '#e8e8ec',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT
      }}
    >
      <div style={{ transform: `scale(${scale})`, opacity }}>
        <AppShell>
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 40px 80px'
            }}
          >
            <Img src={staticFile('logo.png')} style={{ width: 150, marginBottom: 6 }} />
            <p style={{ fontSize: 12, color: C.sub, marginBottom: 28 }}>Command Center</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                width: '100%',
                maxWidth: 420
              }}
            >
              {['Find a file', 'Draft an email', 'Summarize doc', 'Open an app'].map((t, i) => (
                <div
                  key={t}
                  style={{
                    padding: '14px 16px',
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text,
                    opacity: interpolate(frame, [8 + i * 4, 18 + i * 4], [0, 1], {
                      extrapolateRight: 'clamp'
                    }),
                    transform: `translateY(${interpolate(frame, [8 + i * 4, 18 + i * 4], [16, 0], { extrapolateRight: 'clamp' })}px)`
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </AppShell>
      </div>
    </AbsoluteFill>
  )
}

function SceneClickSuggestion(): JSX.Element {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const zoomIn = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 60 } })
  const scale = interpolate(zoomIn, [0, 1], [1, 1.55])
  const focusX = interpolate(zoomIn, [0, 1], [0, -120])
  const focusY = interpolate(zoomIn, [0, 1], [0, -40])
  const clickAt = frame > 42 && frame < 52
  const cardGlow = clickAt ? '0 0 0 4px rgba(96,165,250,0.35)' : 'none'

  const cursorX = interpolate(frame, [20, 38], [680, 520], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic)
  })
  const cursorY = interpolate(frame, [20, 38], [420, 310], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic)
  })

  return (
    <AbsoluteFill
      style={{
        background: '#e8e8ec',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) translate(${focusX}px, ${focusY}px)`,
          transformOrigin: 'center center'
        }}
      >
        <AppShell>
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 40px 80px'
            }}
          >
            <Img src={staticFile('logo.png')} style={{ width: 150, marginBottom: 6, opacity: 0.4 }} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                width: '100%',
                maxWidth: 420
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  background: clickAt ? '#eff6ff' : C.surface,
                  border: `1px solid ${clickAt ? C.blue : C.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.text,
                  boxShadow: cardGlow,
                  transform: clickAt ? 'scale(0.97)' : 'scale(1)'
                }}
              >
                Find a file
                <div style={{ fontSize: 10, color: C.sub, marginTop: 4, fontWeight: 400 }}>
                  Search folders and open what you need
                </div>
              </div>
              {['Draft an email', 'Summarize doc', 'Open an app'].map((t) => (
                <div
                  key={t}
                  style={{
                    padding: '14px 16px',
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: C.sub,
                    opacity: 0.6
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </AppShell>
      </div>
      <ClickCursor x={cursorX} y={cursorY} clicking={clickAt} visible={frame > 15 && frame < 58} />
      {clickAt && (
        <AbsoluteFill
          style={{
            background: 'radial-gradient(circle at 52% 48%, rgba(96,165,250,0.12) 0%, transparent 50%)',
            pointerEvents: 'none'
          }}
        />
      )}
    </AbsoluteFill>
  )
}

const TYPE_CMD = 'Find my latest invoice in Downloads'

function SceneTypeSend(): JSX.Element {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const typed = useTyped(TYPE_CMD, 12, 0.85)
  const zoom = spring({ frame: frame - 5, fps, config: { damping: 17, stiffness: 58 } })
  const scale = interpolate(zoom, [0, 1], [1.2, 1.45])
  const ty = interpolate(zoom, [0, 1], [0, 80])
  const clickSend = frame > 58 && frame < 68
  const flash = interpolate(frame, [58, 62, 68], [0, 0.35, 0], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{ background: '#e8e8ec', justifyContent: 'center', alignItems: 'center', fontFamily: FONT }}
    >
      <div style={{ transform: `scale(${scale}) translateY(${ty}px)` }}>
        <AppShell>
          <div style={{ padding: '24px 32px 100px', height: '100%', position: 'relative' }}>
            {typed.length > 0 && (
              <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 20 }}>{typed}</p>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: 24,
                right: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: C.surface,
                border: `1px solid ${frame > 50 ? C.blue : C.border}`,
                borderRadius: 8,
                boxShadow: clickSend ? '0 0 0 4px rgba(96,165,250,0.25)' : '0 2px 8px rgba(0,0,0,0.04)'
              }}
            >
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>
                {typed}
                {typed.length < TYPE_CMD.length && Math.floor(frame / 12) % 2 === 0 ? '|' : ''}
              </span>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: C.blue,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  transform: clickSend ? 'scale(0.88)' : 'scale(1)',
                  boxShadow: clickSend ? '0 0 24px rgba(96,165,250,0.7)' : 'none'
                }}
              >
                ↑
              </div>
            </div>
          </div>
        </AppShell>
      </div>
      <AbsoluteFill style={{ background: `rgba(96,165,250,${flash})`, pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}

function SceneAgentReply(): JSX.Element {
  const frame = useCurrentFrame()
  const slide = useSpringIn(0, { damping: 16, stiffness: 72 })
  const step1 = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: 'clamp' })
  const step2 = interpolate(frame, [22, 38], [0, 1], { extrapolateRight: 'clamp' })
  const reply = interpolate(frame, [40, 58], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{ background: '#e8e8ec', justifyContent: 'center', alignItems: 'center', fontFamily: FONT }}
    >
      <div style={{ opacity: slide, transform: `translateY(${(1 - slide) * 20}px)` }}>
        <AppShell>
          <div style={{ padding: '28px 36px', maxWidth: 520 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 20 }}>{TYPE_CMD}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: C.sub,
                  opacity: step1
                }}
              >
                <span style={{ color: C.blue }}>●</span> Searching Downloads…
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: C.sub,
                  opacity: step2
                }}
              >
                <span style={{ color: '#16a34a' }}>✓</span> Found invoice_march.pdf
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: C.text,
                  opacity: reply,
                  transform: `translateY(${(1 - reply) * 12}px)`
                }}
              >
                Opened your latest invoice. Total due:{' '}
                <strong style={{ color: C.link }}>$1,240.00</strong> — want me to email a summary?
              </div>
            </div>
          </div>
        </AppShell>
      </div>
    </AbsoluteFill>
  )
}

function SceneOverlay(): JSX.Element {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const shrink = spring({ frame, fps, config: { damping: 18, stiffness: 50 } })
  const appScale = interpolate(shrink, [0, 1], [1, 0.75])
  const appOpacity = interpolate(shrink, [0, 1], [1, 0.15])
  const overlaySlide = spring({ frame: frame - 18, fps, config: { damping: 14, stiffness: 65 } })
  const ox = interpolate(overlaySlide, [0, 1], [120, 0])
  const oy = interpolate(overlaySlide, [0, 1], [80, 0])

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg, #18181b 0%, #3f3f46 100%)', fontFamily: FONT }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${appScale})`,
          opacity: appOpacity,
          filter: 'blur(2px)'
        }}
      >
        <AppShell>
          <div style={{ padding: 40, color: C.sub, fontSize: 13 }}>VS Code — index.tsx</div>
        </AppShell>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 48,
          right: 48,
          width: 300,
          padding: 18,
          background: C.surface,
          borderRadius: 14,
          boxShadow: '0 28px 90px rgba(0,0,0,0.5)',
          transform: `translate(${ox}px, ${oy}px) scale(${interpolate(overlaySlide, [0, 1], [0.88, 1])})`,
          opacity: overlaySlide
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <Img src={staticFile('logo.png')} style={{ height: 20 }} />
          <div>
            <div style={{ fontSize: 9, color: C.ghost, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Active
            </div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>VS Code · index.tsx</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>Explain this file</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Explain', 'Refactor', 'Comments'].map((l) => (
            <span
              key={l}
              style={{
                fontSize: 10,
                padding: '5px 10px',
                borderRadius: 999,
                border: `1px solid ${C.border}`,
                color: C.sub,
                background: C.muted
              }}
            >
              {l}
            </span>
          ))}
        </div>
      </div>

      <p
        style={{
          position: 'absolute',
          bottom: 52,
          left: 52,
          color: '#fafafa',
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          opacity: interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp' })
        }}
      >
        Minimize. Keep working. TORCH floats.
      </p>
    </AbsoluteFill>
  )
}

function SceneOutro(): JSX.Element {
  const s = useSpringIn(0, { damping: 12, stiffness: 75 })
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 40%, #eff6ff 0%, ${C.bg} 100%)`,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${s})`, opacity: s }}>
        <Img src={staticFile('logo.png')} style={{ width: 240, marginBottom: 22 }} />
        <p style={{ fontSize: 28, fontWeight: 600, color: C.text, letterSpacing: '-0.02em' }}>
          TORCH
        </p>
        <p style={{ fontSize: 15, color: C.sub, marginTop: 10 }}>Desktop AI that actually does things.</p>
        <div
          style={{
            marginTop: 28,
            display: 'inline-block',
            padding: '12px 28px',
            background: C.blue,
            color: '#fff',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600
          }}
        >
          Download for Windows
        </div>
      </div>
    </AbsoluteFill>
  )
}

export function TorchPromo(): JSX.Element {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={70}>
        <SceneIntro />
      </Sequence>
      <Sequence from={70} durationInFrames={65}>
        <SceneAppReveal />
      </Sequence>
      <Sequence from={135} durationInFrames={70}>
        <SceneClickSuggestion />
      </Sequence>
      <Sequence from={205} durationInFrames={75}>
        <SceneTypeSend />
      </Sequence>
      <Sequence from={280} durationInFrames={70}>
        <SceneAgentReply />
      </Sequence>
      <Sequence from={350} durationInFrames={85}>
        <SceneOverlay />
      </Sequence>
      <Sequence from={435} durationInFrames={75}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  )
}
