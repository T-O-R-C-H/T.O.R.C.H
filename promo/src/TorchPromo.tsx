import type {CSSProperties, ReactElement, ReactNode} from 'react'
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion'

const BG = '#f5f3ee'
const INK = '#181817'
const MUTED = '#77746e'
const BLUE = '#60a5fa'
const BLUE_DARK = '#3b82f6'
const FONT = 'Inter, Arial, Helvetica, sans-serif'
const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const APP_W = 1600
const APP_H = 900

const capture = (name: string): string => staticFile(`captures/${name}`)

const clamp = (value: number, input: [number, number], output: [number, number]): number =>
  interpolate(value, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE
  })

function Paper({children, style}: {children?: ReactNode; style?: CSSProperties}): ReactElement {
  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 78% 12%, rgba(255,255,255,.92), transparent 34%), linear-gradient(145deg, #f8f7f3 0%, #f2efe8 100%)',
        overflow: 'hidden',
        fontFamily: FONT,
        color: INK,
        ...style
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.14,
          backgroundImage:
            'radial-gradient(rgba(25,25,24,.22) .45px, transparent .45px)',
          backgroundSize: '5px 5px',
          pointerEvents: 'none'
        }}
      />
      {children}
    </AbsoluteFill>
  )
}

function Wordmark({width = 184, dark = true}: {width?: number; dark?: boolean}): ReactElement {
  return (
    <Img
      src={staticFile('logo.png')}
      style={{
        width,
        height: 'auto',
        filter: dark ? 'none' : 'invert(1)',
        objectFit: 'contain'
      }}
    />
  )
}

function AppWindow({
  shot,
  width = 1600,
  x = 0,
  y = 0,
  scale = 1,
  rotate = 0,
  opacity = 1,
  blur = 0,
  radius = 22,
  shadow = '0 44px 110px rgba(34,31,25,.16), 0 3px 14px rgba(34,31,25,.09)',
  style
}: {
  shot: string
  width?: number
  x?: number
  y?: number
  scale?: number
  rotate?: number
  opacity?: number
  blur?: number
  radius?: number
  shadow?: string
  style?: CSSProperties
}): ReactElement {
  const height = width * (APP_H / APP_W)
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        border: '1px solid rgba(34,31,25,.12)',
        boxShadow: shadow,
        opacity,
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
        filter: blur ? `blur(${blur}px)` : undefined,
        background: '#f4f4f5',
        ...style
      }}
    >
      <Img src={capture(shot)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.62)',
          borderRadius: radius,
          pointerEvents: 'none'
        }}
      />
    </div>
  )
}

function UiCrop({
  shot,
  cropX,
  cropY,
  scale,
  width,
  height,
  style,
  imageStyle
}: {
  shot: string
  cropX: number
  cropY: number
  scale: number
  width: number
  height: number
  style?: CSSProperties
  imageStyle?: CSSProperties
}): ReactElement {
  return (
    <div
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'absolute',
        background: '#fff',
        borderRadius: 26,
        boxShadow: '0 28px 80px rgba(35,31,24,.14), 0 2px 8px rgba(35,31,24,.08)',
        border: '1px solid rgba(35,31,24,.11)',
        ...style
      }}
    >
      <Img
        src={capture(shot)}
        style={{
          position: 'absolute',
          width: APP_W * scale,
          height: APP_H * scale,
          maxWidth: 'none',
          left: -cropX * scale,
          top: -cropY * scale,
          ...imageStyle
        }}
      />
    </div>
  )
}

function Pointer({
  x,
  y,
  down = false,
  opacity = 1,
  trail = false
}: {
  x: number
  y: number
  down?: boolean
  opacity?: number
  trail?: boolean
}): ReactElement {
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity, zIndex: 100}}>
      {trail && (
        <div
          style={{
            position: 'absolute',
            width: 96,
            height: 96,
            left: -42,
            top: -42,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(96,165,250,.28), transparent 68%)',
            transform: `scale(${down ? 1.25 : 0.72})`
          }}
        />
      )}
      {down && (
        <div
          style={{
            position: 'absolute',
            left: -35,
            top: -35,
            width: 70,
            height: 70,
            border: '3px solid rgba(96,165,250,.56)',
            borderRadius: 999,
            transform: 'scale(1.22)'
          }}
        />
      )}
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        style={{
          transform: `translate(-4px, -4px) scale(${down ? 0.82 : 1})`,
          filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.24))'
        }}
      >
        <path d="M4 2.8 19.2 12l-7.1 1.2-3 7.1L4 2.8Z" fill="white" stroke="#1d1d1c" strokeWidth="1.35" />
      </svg>
    </div>
  )
}

function Label({children, style}: {children: ReactNode; style?: CSSProperties}): ReactElement {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 16px',
        borderRadius: 999,
        border: '1px solid rgba(27,27,26,.1)',
        background: 'rgba(255,255,255,.78)',
        boxShadow: '0 8px 30px rgba(35,31,24,.07)',
        backdropFilter: 'blur(14px)',
        fontSize: 14,
        fontWeight: 650,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: MUTED,
        ...style
      }}
    >
      {children}
    </div>
  )
}

function IntroScene(): ReactElement {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const logo = spring({frame: frame - 5, fps, config: {damping: 18, stiffness: 78}})
  const line1 = spring({frame: frame - 28, fps, config: {damping: 20, stiffness: 72}})
  const line2 = spring({frame: frame - 47, fps, config: {damping: 20, stiffness: 72}})
  const line3 = spring({frame: frame - 66, fps, config: {damping: 20, stiffness: 72}})
  const composer = spring({frame: frame - 92, fps, config: {damping: 22, stiffness: 68}})
  const out = clamp(frame, [150, 178], [1, 0])

  const lineStyle = (s: number): CSSProperties => ({
    opacity: s,
    transform: `translateY(${(1 - s) * 56}px)`,
    lineHeight: 0.93
  })

  return (
    <Paper>
      <div style={{position: 'absolute', left: 82, top: 67, opacity: logo, transform: `translateY(${(1 - logo) * -18}px)`}}>
        <Wordmark width={170} />
      </div>
      <div style={{position: 'absolute', left: 80, top: 192, fontSize: 104, fontWeight: 560, letterSpacing: '-.068em', width: 1080, opacity: out}}>
        <div style={lineStyle(line1)}>Your desktop.</div>
        <div style={{...lineStyle(line2), color: MUTED}}>One command.</div>
        <div style={lineStyle(line3)}>Already moving.</div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 92,
          bottom: 94,
          width: 790,
          height: 205,
          opacity: composer * out,
          transform: `translateY(${(1 - composer) * 70}px) scale(${0.94 + composer * 0.06})`
        }}
      >
        <UiCrop shot="09-home-ready.png" cropX={510} cropY={742} scale={0.92} width={790} height={205} style={{inset: 0}} />
      </div>
      <div style={{position: 'absolute', right: 92, top: 82, opacity: clamp(frame, [86, 112], [0, 1]) * out}}>
        <Label><span style={{width: 7, height: 7, borderRadius: 99, background: '#16a34a'}} /> Desktop agent</Label>
      </div>
    </Paper>
  )
}

const COMMAND = 'Find my latest invoice and summarize what is due'

function ComposerScene(): ReactElement {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const enter = spring({frame, fps, config: {damping: 22, stiffness: 70}})
  const typedCount = Math.floor(clamp(frame, [48, 176], [0, COMMAND.length]))
  const typed = COMMAND.slice(0, typedCount)
  const cursorMove = clamp(frame, [182, 218], [0, 1])
  const cursorX = interpolate(cursorMove, [0, 1], [1400, 1519])
  const cursorY = interpolate(cursorMove, [0, 1], [620, 660])
  const down = frame >= 220 && frame <= 229
  const sendGlow = 0.3 + Math.sin(frame * 0.13) * 0.1
  const exit = clamp(frame, [224, 239], [1, 0])

  return (
    <Paper>
      <div style={{position: 'absolute', left: 86, top: 72, opacity: enter}}><Wordmark width={150} /></div>
      <div style={{position: 'absolute', left: 86, top: 176, fontSize: 25, color: MUTED, letterSpacing: '-.02em', opacity: enter}}>
        Ask naturally. TORCH handles the steps.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 80,
          right: 80,
          top: 345,
          height: 370,
          opacity: enter * exit,
          transform: `translateY(${(1 - enter) * 74}px) scale(${0.96 + enter * 0.04})`
        }}
      >
        <UiCrop shot="09-home-ready.png" cropX={455} cropY={702} scale={1.58} width={1760} height={370} style={{inset: 0, borderRadius: 46, boxShadow: '0 38px 110px rgba(35,31,24,.16), 0 3px 10px rgba(35,31,24,.08)'}} />
        <div style={{position: 'absolute', left: 104, top: 151, width: 1260, height: 70, background: '#fff'}} />
        <div style={{position: 'absolute', left: 106, top: 149, fontSize: 29, lineHeight: '46px', letterSpacing: '-.024em', color: '#2f2f31', whiteSpace: 'nowrap'}}>
          {typed}
          <span style={{display: 'inline-block', width: 2, height: 35, marginLeft: 3, background: INK, verticalAlign: -7, opacity: Math.floor(frame / 28) % 2 ? 0.15 : 1}} />
        </div>
        <div style={{position: 'absolute', right: 73, top: 87, width: 58, height: 58, borderRadius: 13, boxShadow: typedCount === COMMAND.length ? `0 0 0 12px rgba(96,165,250,${sendGlow})` : 'none'}} />
      </div>
      <Pointer x={cursorX} y={cursorY} down={down} opacity={clamp(frame, [170, 184], [0, 1]) * exit} trail />
      {down && <AbsoluteFill style={{background: 'radial-gradient(circle at 79% 62%, rgba(96,165,250,.18), transparent 26%)'}} />}
    </Paper>
  )
}

function FullAppScene(): ReactElement {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const enter = spring({frame, fps, config: {damping: 19, stiffness: 64, mass: 0.85}})
  const tilt = interpolate(enter, [0, 1], [-2.2, 0])
  const camera = clamp(frame, [48, 174], [0, 1])
  const shotMix = clamp(frame, [52, 70], [0, 1])
  const click = frame >= 52 && frame <= 62
  const pointerX = interpolate(clamp(frame, [15, 48], [0, 1]), [0, 1], [1200, 1531])
  const pointerY = interpolate(clamp(frame, [15, 48], [0, 1]), [0, 1], [710, 849])

  return (
    <Paper>
      <div style={{position: 'absolute', left: 86, top: 56, opacity: clamp(frame, [10, 32], [0, 1])}}>
        <Label><span style={{color: BLUE_DARK}}>01</span> Send the request</Label>
      </div>
      <AppWindow
        shot="02-typed.png"
        width={1600}
        scale={(0.84 + enter * 0.16) * (1 + camera * 0.015)}
        y={(1 - enter) * 175 + 20 - camera * 8}
        rotate={tilt}
        opacity={1 - shotMix}
      />
      <AppWindow
        shot="03-sending.png"
        width={1600}
        scale={(0.84 + enter * 0.16) * (1 + camera * 0.015)}
        y={(1 - enter) * 175 + 20 - camera * 8}
        rotate={tilt}
        opacity={shotMix}
      />
      <Pointer x={pointerX} y={pointerY} down={click} opacity={clamp(frame, [12, 24], [0, 1]) * clamp(frame, [76, 96], [1, 0])} trail />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 190,
          background: `linear-gradient(to top, rgba(245,243,238,${clamp(frame, [130, 174], [0, 0.82])}), transparent)`,
          pointerEvents: 'none'
        }}
      />
    </Paper>
  )
}

function ProcessingScene(): ReactElement {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const app = spring({frame, fps, config: {damping: 21, stiffness: 65}})
  const label1 = spring({frame: frame - 38, fps, config: {damping: 18, stiffness: 82}})
  const label2 = spring({frame: frame - 83, fps, config: {damping: 18, stiffness: 82}})
  const label3 = spring({frame: frame - 128, fps, config: {damping: 18, stiffness: 82}})
  const scan = interpolate(frame, [18, 250], [430, 1360], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
  const orbit = frame * 0.028

  return (
    <Paper>
      <div style={{position: 'absolute', left: 70, top: 70, width: 450}}>
        <div style={{fontSize: 19, color: BLUE_DARK, fontWeight: 700, letterSpacing: '.12em', marginBottom: 28}}>WORKING LIVE</div>
        {[
          ['Finds', 'the right file', label1],
          ['Reads', 'what matters', label2],
          ['Plans', 'the next move', label3]
        ].map(([word, rest, progress]) => (
          <div key={String(word)} style={{opacity: Number(progress), transform: `translateX(${(1 - Number(progress)) * -34}px)`, marginBottom: 15, fontSize: 55, letterSpacing: '-.055em', lineHeight: 1.04}}>
            <strong style={{fontWeight: 620}}>{String(word)}</strong>{' '}
            <span style={{color: '#aaa69f', fontWeight: 450}}>{String(rest)}</span>
          </div>
        ))}
      </div>
      <AppWindow shot="04-processing.png" width={1470} x={260} y={38} scale={0.9 + app * 0.1} rotate={0.45 - app * 0.45} opacity={app} />
      <div style={{position: 'absolute', left: 995, top: 291, width: 330, height: 42, background: '#f4f4f5', zIndex: 5}} />
      <div style={{position: 'absolute', left: 1002, top: 299, color: '#a1a1aa', fontSize: 14, zIndex: 6}}>Searching Downloads…</div>
      <div
        style={{
          position: 'absolute',
          left: scan,
          top: 232,
          width: 2,
          height: 580,
          background: 'linear-gradient(to bottom, transparent, rgba(96,165,250,.56), transparent)',
          boxShadow: '0 0 32px rgba(96,165,250,.5)',
          opacity: 0.75
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 974 + Math.cos(orbit) * 42,
          top: 284 + Math.sin(orbit) * 18,
          width: 10,
          height: 10,
          borderRadius: 99,
          background: BLUE,
          boxShadow: '0 0 24px rgba(96,165,250,.8)'
        }}
      />
      <div style={{position: 'absolute', right: 76, bottom: 55, opacity: clamp(frame, [150, 175], [0, 1])}}>
        <Label><span style={{width: 8, height: 8, background: BLUE, borderRadius: 99, boxShadow: '0 0 12px rgba(96,165,250,.8)'}} /> Every step stays visible</Label>
      </div>
    </Paper>
  )
}

function ResponseScene(): ReactElement {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const app = spring({frame, fps, config: {damping: 20, stiffness: 66}})
  const zoom = clamp(frame, [35, 210], [0, 1])
  const reveal = clamp(frame, [38, 150], [0, 1])
  const check = spring({frame: frame - 154, fps, config: {damping: 13, stiffness: 110}})

  return (
    <Paper>
      <div style={{position: 'absolute', left: 80, top: 66, zIndex: 20, opacity: clamp(frame, [4, 24], [0, 1])}}>
        <Label><span style={{color: BLUE_DARK}}>02</span> Get the answer</Label>
      </div>
      <AppWindow shot="07-response-success.png" width={1600} scale={(0.92 + app * 0.08) * (1 + zoom * 0.07)} x={-zoom * 55} y={22 + zoom * 18} opacity={app} />
      <div
        style={{
          position: 'absolute',
          left: 606,
          top: 200,
          width: 1038,
          height: 175 * (1 - reveal),
          background: '#f4f4f5',
          transformOrigin: 'top',
          zIndex: 6
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 601,
          top: 187,
          width: 1055,
          height: 190,
          borderRadius: 16,
          border: '2px solid rgba(96,165,250,.28)',
          boxShadow: '0 18px 58px rgba(96,165,250,.13)',
          opacity: interpolate(frame, [48, 72, 190, 225], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp'
          })
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 85,
          top: 64,
          width: 74,
          height: 74,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          background: '#181817',
          color: '#fff',
          fontSize: 36,
          fontWeight: 700,
          opacity: check,
          transform: `scale(${0.65 + check * 0.35})`,
          boxShadow: '0 18px 48px rgba(24,24,23,.2)'
        }}
      >
        ✓
      </div>
      <div style={{position: 'absolute', left: 80, bottom: 58, fontSize: 50, fontWeight: 560, letterSpacing: '-.05em', opacity: clamp(frame, [165, 195], [0, 1]), transform: `translateY(${clamp(frame, [165, 195], [24, 0])}px)`}}>
        Clear answer. <span style={{color: MUTED}}>Real action.</span>
      </div>
    </Paper>
  )
}

function MosaicScene(): ReactElement {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const p1 = spring({frame, fps, config: {damping: 20, stiffness: 72}})
  const p2 = spring({frame: frame - 18, fps, config: {damping: 20, stiffness: 72}})
  const p3 = spring({frame: frame - 36, fps, config: {damping: 20, stiffness: 72}})
  const title = spring({frame: frame - 62, fps, config: {damping: 20, stiffness: 70}})
  const drift = Math.sin(frame * 0.018)

  return (
    <Paper>
      <div style={{position: 'absolute', left: 80, top: 65}}><Wordmark width={150} /></div>
      <div style={{position: 'absolute', left: 80, top: 182, width: 610, opacity: title, transform: `translateY(${(1 - title) * 35}px)`}}>
        <div style={{fontSize: 76, lineHeight: .96, letterSpacing: '-.065em', fontWeight: 560}}>One flow.</div>
        <div style={{fontSize: 76, lineHeight: .96, letterSpacing: '-.065em', fontWeight: 500, color: '#aaa69f'}}>Nothing hidden.</div>
        <p style={{fontSize: 21, lineHeight: 1.5, color: MUTED, width: 470, marginTop: 34}}>Your request, TORCH’s live work, and the final result stay together in the exact app you started from.</p>
      </div>

      <UiCrop shot="07-response-success.png" cropX={299} cropY={55} scale={0.72} width={470} height={650} style={{right: 800, top: 145, opacity: p1, transform: `translateY(${(1 - p1) * 90 + drift * 6}px) rotate(-2.2deg)`, borderRadius: 30}} />
      <UiCrop shot="04-processing.png" cropX={505} cropY={105} scale={0.88} width={655} height={390} style={{right: 110, top: 100, opacity: p2, transform: `translateY(${(1 - p2) * 110 - drift * 7}px) rotate(2.5deg)`, borderRadius: 30}} />
      <UiCrop shot="02-typed.png" cropX={505} cropY={735} scale={0.86} width={755} height={235} style={{right: 80, bottom: 105, opacity: p3, transform: `translateY(${(1 - p3) * 95 + drift * 4}px) rotate(-1deg)`, borderRadius: 30}} />

      <div style={{position: 'absolute', right: 100, top: 72, opacity: clamp(frame, [110, 145], [0, 1])}}><Label>Live steps</Label></div>
      <div style={{position: 'absolute', right: 92, bottom: 76, opacity: clamp(frame, [138, 172], [0, 1])}}><Label>Natural input</Label></div>
    </Paper>
  )
}

function FinaleScene(): ReactElement {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const app = spring({frame, fps, config: {damping: 22, stiffness: 60}})
  const dim = clamp(frame, [105, 180], [0, 0.78])
  const mark = spring({frame: frame - 142, fps, config: {damping: 18, stiffness: 73}})
  const copy = spring({frame: frame - 164, fps, config: {damping: 20, stiffness: 70}})
  const camera = clamp(frame, [0, 295], [0, 1])

  return (
    <Paper style={{background: '#ebe9e3'}}>
      <AppWindow
        shot="07-response-success.png"
        width={1570}
        scale={(0.88 + app * 0.12) * (1 + camera * 0.055)}
        y={(1 - app) * 130 + 18}
        rotate={(1 - app) * -1.7}
        opacity={app}
        blur={dim * 2.2}
      />
      <AbsoluteFill style={{background: `rgba(245,243,238,${dim})`}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: mark,
          transform: `translateY(${(1 - mark) * 38}px) scale(${0.94 + mark * 0.06})`
        }}
      >
        <Wordmark width={310} />
        <div style={{marginTop: 42, fontSize: 68, lineHeight: 1, letterSpacing: '-.058em', fontWeight: 560, opacity: copy, transform: `translateY(${(1 - copy) * 24}px)`}}>
          Tell TORCH. <span style={{color: '#99968f'}}>Consider it done.</span>
        </div>
        <div style={{marginTop: 38, opacity: clamp(frame, [205, 232], [0, 1])}}>
          <Label style={{padding: '13px 20px', color: '#3f3f3d'}}><span style={{width: 8, height: 8, borderRadius: 99, background: '#16a34a'}} /> Desktop AI that acts</Label>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 30, textAlign: 'center', fontSize: 12, letterSpacing: '.16em', color: '#96938c', fontWeight: 650, opacity: clamp(frame, [225, 250], [0, 1])}}>TORCH FOR WINDOWS</div>
    </Paper>
  )
}

export function TorchPromo(): ReactElement {
  return (
    <AbsoluteFill style={{background: BG}}>
      <Audio src={staticFile('torch-score.wav')} volume={0.82} />
      <Sequence from={0} durationInFrames={180}><IntroScene /></Sequence>
      <Sequence from={180} durationInFrames={240}><ComposerScene /></Sequence>
      <Sequence from={420} durationInFrames={180}><FullAppScene /></Sequence>
      <Sequence from={600} durationInFrames={270}><ProcessingScene /></Sequence>
      <Sequence from={870} durationInFrames={270}><ResponseScene /></Sequence>
      <Sequence from={1140} durationInFrames={240}><MosaicScene /></Sequence>
      <Sequence from={1380} durationInFrames={300}><FinaleScene /></Sequence>
    </AbsoluteFill>
  )
}
