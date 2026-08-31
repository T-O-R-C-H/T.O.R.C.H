import type {ReactElement} from 'react'
import {AbsoluteFill, Img, staticFile} from 'remotion'

const INK = '#181817'
const MUTED = '#77746e'
const FONT = 'Inter, Arial, Helvetica, sans-serif'

function Paper({children}: {children: ReactElement | ReactElement[]}): ReactElement {
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        color: INK,
        fontFamily: FONT,
        background:
          'radial-gradient(circle at 78% 10%, rgba(255,255,255,.96), transparent 35%), linear-gradient(145deg, #f8f7f3 0%, #f2efe8 100%)'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.14,
          backgroundImage: 'radial-gradient(rgba(25,25,24,.22) .45px, transparent .45px)',
          backgroundSize: '5px 5px'
        }}
      />
      {children}
    </AbsoluteFill>
  )
}

function Wordmark(): ReactElement {
  return (
    <Img
      src={staticFile('resource-logo.png')}
      style={{
        position: 'absolute',
        left: 62,
        top: -15,
        width: 190,
        height: 190,
        objectFit: 'contain'
      }}
    />
  )
}

export function TorchXHeader(): ReactElement {
  return (
    <Paper>
      <Wordmark />
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 142,
          width: 640,
          fontSize: 72,
          lineHeight: 0.92,
          fontWeight: 560,
          letterSpacing: '-.068em'
        }}
      >
        <div>Your desktop.</div>
        <div style={{color: MUTED}}>One command.</div>
        <div>Already moving.</div>
      </div>
    </Paper>
  )
}

export function TorchXAvatar(): ReactElement {
  return (
    <Paper>
      <Img
        src={staticFile('resource-logo.png')}
        style={{
          position: 'absolute',
          left: -17,
          top: -11,
          width: 440,
          height: 440,
          objectFit: 'contain'
        }}
      />
    </Paper>
  )
}

export function TorchXHeaderCentered(): ReactElement {
  return (
    <Paper>
      <Img
        src={staticFile('resource-logo.png')}
        style={{
          position: 'absolute',
          left: 425,
          top: -176,
          width: 650,
          height: 650,
          objectFit: 'contain'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 258,
          textAlign: 'center',
          fontSize: 42,
          lineHeight: 1,
          fontWeight: 520,
          letterSpacing: '-.045em'
        }}
      >
        <span>Your desktop.</span>{' '}
        <span style={{color: MUTED}}>One command.</span>{' '}
        <span>Already moving.</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 438,
          right: 438,
          top: 341,
          height: 1,
          background: 'rgba(24,24,23,.14)'
        }}
      />
    </Paper>
  )
}

export function TorchXHeaderFlow(): ReactElement {
  const stations = [
    {left: 330, number: '01', label: 'Ask'},
    {left: 850, number: '02', label: 'Act'},
    {left: 1360, number: '03', label: 'Done'}
  ]

  return (
    <Paper>
      <Wordmark />
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 144,
          fontSize: 66,
          lineHeight: 0.96,
          fontWeight: 560,
          letterSpacing: '-.062em'
        }}
      >
        <div>One command.</div>
        <div style={{color: MUTED}}>Every step visible.</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 330,
          right: 70,
          top: 361,
          height: 1,
          background: 'rgba(24,24,23,.16)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 360,
          width: 520,
          height: 2,
          background: INK
        }}
      />
      {stations.map((station) => (
        <div key={station.number} style={{position: 'absolute', left: station.left, top: 350}}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              border: `2px solid ${INK}`,
              background: '#f6f4ef',
              boxSizing: 'border-box'
            }}
          />
          <div
            style={{
              marginTop: 17,
              fontSize: 12,
              fontWeight: 650,
              letterSpacing: '.14em',
              color: '#aaa69f',
              textTransform: 'uppercase'
            }}
          >
            {station.number}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 15,
              fontWeight: 650,
              letterSpacing: '.10em',
              textTransform: 'uppercase'
            }}
          >
            {station.label}
          </div>
        </div>
      ))}
    </Paper>
  )
}

export function TorchXHeaderDark(): ReactElement {
  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        color: '#f7f5ef',
        fontFamily: FONT,
        background:
          'radial-gradient(circle at 83% 18%, rgba(255,255,255,.08), transparent 30%), linear-gradient(145deg, #242320 0%, #171716 100%)'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.08,
          backgroundImage: 'radial-gradient(rgba(255,255,255,.38) .45px, transparent .45px)',
          backgroundSize: '5px 5px'
        }}
      />
      <Img
        src={staticFile('resource-logo.png')}
        style={{
          position: 'absolute',
          left: 62,
          top: -15,
          width: 190,
          height: 190,
          objectFit: 'contain',
          filter: 'invert(1)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 158,
          fontSize: 78,
          lineHeight: 0.96,
          fontWeight: 550,
          letterSpacing: '-.064em'
        }}
      >
        <div>Tell TORCH.</div>
        <div style={{color: '#98958e'}}>Consider it done.</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 411,
          height: 1,
          background: 'rgba(255,255,255,.16)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 410,
          width: 180,
          height: 2,
          background: '#60a5fa'
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 70,
          top: 383,
          fontSize: 11,
          fontWeight: 650,
          letterSpacing: '.16em',
          color: '#98958e',
          textTransform: 'uppercase'
        }}
      >
        One command. Every step visible.
      </div>
    </AbsoluteFill>
  )
}
