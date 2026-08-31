import { LEVEL_HISTORY } from '../../hooks/useAudioCapture'

/**
 * The live microphone level.
 *
 * Every bar is one measured frame of real audio. There is deliberately no
 * idle animation and no synthetic motion: if the room is silent, or the
 * microphone is muted at the OS level, this sits flat — which is the useful
 * signal, because it tells the user TORCH is not hearing them.
 */
export function Waveform({ levels }: { levels: number[] }): JSX.Element {
  // Pad on the left so bars fill in from the right as audio arrives, rather
  // than the whole row rescaling on every frame.
  const padded = [...new Array(Math.max(0, LEVEL_HISTORY - levels.length)).fill(0), ...levels]

  return (
    <div className="waveform" role="img" aria-label="Microphone level">
      {padded.map((value, i) => (
        <span
          key={i}
          className="waveform__bar"
          // Never fully zero: a flat line of visible bars reads as "listening
          // and hearing nothing", where zero-height reads as broken.
          style={{ transform: `scaleY(${0.06 + value * 0.94})` }}
        />
      ))}
    </div>
  )
}
