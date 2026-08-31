import { describe, it, expect } from 'vitest'
import {
  rmsFromTimeDomain,
  levelToDisplay,
  encodeWav,
  shouldStopForSilence,
  SILENCE_HOLD_MS,
  SILENCE_LEVEL,
  SPEECH_LEVEL
} from './useAudioCapture'

/**
 * The level meter must be measuring, not animating.
 *
 * Capture previously lived in Python, so the UI had no access to the signal
 * and any waveform could only have been decorative. These pin the property
 * that makes it real: what is drawn is a function of the samples, so silence
 * draws silence.
 */

/** A byte time-domain frame at constant amplitude around the 128 centre. */
function frameAt(amplitude: number, length = 1024): Uint8Array {
  const frame = new Uint8Array(length)
  for (let i = 0; i < length; i += 1) {
    frame[i] = 128 + (i % 2 === 0 ? amplitude : -amplitude)
  }
  return frame
}

describe('rmsFromTimeDomain', () => {
  it('reports zero for true silence', () => {
    // A muted or absent microphone delivers a flat line at the centre value.
    expect(rmsFromTimeDomain(frameAt(0))).toBe(0)
  })

  it('reports zero for an empty frame rather than dividing by zero', () => {
    expect(rmsFromTimeDomain(new Uint8Array(0))).toBe(0)
  })

  it('grows with amplitude', () => {
    const quiet = rmsFromTimeDomain(frameAt(5))
    const talking = rmsFromTimeDomain(frameAt(30))
    const shouting = rmsFromTimeDomain(frameAt(100))

    expect(quiet).toBeLessThan(talking)
    expect(talking).toBeLessThan(shouting)
  })

  it('is normalised so a full-scale signal approaches 1', () => {
    expect(rmsFromTimeDomain(frameAt(127))).toBeGreaterThan(0.95)
    expect(rmsFromTimeDomain(frameAt(127))).toBeLessThanOrEqual(1)
  })

  it('ignores the sign of the excursion', () => {
    // Loudness is how far from centre, not which side of it.
    const positive = new Uint8Array([228, 228, 228, 228])
    const negative = new Uint8Array([28, 28, 28, 28])
    expect(rmsFromTimeDomain(positive)).toBeCloseTo(rmsFromTimeDomain(negative), 5)
  })
})

describe('levelToDisplay', () => {
  it('keeps silence at the floor', () => {
    expect(levelToDisplay(0)).toBe(0)
  })

  it('never exceeds the top of the bar', () => {
    expect(levelToDisplay(1)).toBeLessThanOrEqual(1)
    expect(levelToDisplay(50)).toBeLessThanOrEqual(1)
  })

  it('is monotonic, so a louder frame is never drawn shorter', () => {
    let previous = -1
    for (let rms = 0; rms <= 1; rms += 0.05) {
      const value = levelToDisplay(rms)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('lifts speech-level audio into a visible range', () => {
    // Conversational speech sits low in a linear scale; a linear bar would
    // barely leave the floor for a normal speaking voice.
    expect(levelToDisplay(0.05)).toBeGreaterThan(0.2)
  })

  it('still separates a normal voice from a raised one', () => {
    // The meter's job is to show how loud you are, so the useful range must
    // not all saturate at the top. An earlier gain drew speech and shouting
    // at identical height.
    const speech = levelToDisplay(0.07)
    const raised = levelToDisplay(0.28)

    expect(raised - speech).toBeGreaterThan(0.25)
    expect(speech).toBeLessThan(0.95)
  })
})

describe('encodeWav', () => {
  const read = async (blob: Blob): Promise<DataView> => new DataView(await blob.arrayBuffer())

  it('writes a RIFF/WAVE header the speech stack can read', async () => {
    const view = await read(encodeWav(new Float32Array(16000), 16000))
    const text = (offset: number, length: number): string =>
      String.fromCharCode(...new Uint8Array(view.buffer.slice(offset, offset + length)))

    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(text(12, 4)).toBe('fmt ')
    expect(text(36, 4)).toBe('data')
  })

  it('declares 16-bit mono PCM at the sample rate it was given', async () => {
    const view = await read(encodeWav(new Float32Array(100), 16000))

    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
  })

  it('sizes the file from the sample count', async () => {
    const blob = encodeWav(new Float32Array(1000), 16000)
    expect(blob.size).toBe(44 + 1000 * 2)

    const view = await read(blob)
    expect(view.getUint32(40, true)).toBe(2000)
  })

  it('clamps samples outside the valid range instead of wrapping', async () => {
    // A wrapped sample flips a loud peak to full-negative, which is audible
    // as a click and can derail transcription.
    const view = await read(encodeWav(new Float32Array([2, -2]), 16000))

    expect(view.getInt16(44, true)).toBe(32767)
    expect(view.getInt16(46, true)).toBe(-32768)
  })

  it('round-trips a recognisable signal', async () => {
    const view = await read(encodeWav(new Float32Array([0, 0.5, -0.5]), 16000))

    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBeCloseTo(0.5 * 0x7fff, -2)
    expect(view.getInt16(48, true)).toBeCloseTo(-0.5 * 0x8000, -2)
  })
})

describe('shouldStopForSilence', () => {
  it('does not end a recording before anything has been said', () => {
    // Someone presses the shortcut and draws breath. Closing the recording
    // underneath them is the worst possible moment to do it.
    expect(shouldStopForSilence(false, 5000)).toBe(false)
  })

  it('ends the recording once speech is followed by a long enough pause', () => {
    expect(shouldStopForSilence(true, SILENCE_HOLD_MS)).toBe(true)
    expect(shouldStopForSilence(true, SILENCE_HOLD_MS + 400)).toBe(true)
  })

  it('holds through a pause shorter than the threshold', () => {
    // Mid-sentence breaths must not cut the user off.
    expect(shouldStopForSilence(true, SILENCE_HOLD_MS - 1)).toBe(false)
    expect(shouldStopForSilence(true, 200)).toBe(false)
  })

  it('waits about eight hundred milliseconds', () => {
    expect(SILENCE_HOLD_MS).toBeGreaterThanOrEqual(600)
    expect(SILENCE_HOLD_MS).toBeLessThanOrEqual(1000)
  })

  it('accepts a caller-supplied hold time', () => {
    expect(shouldStopForSilence(true, 300, 250)).toBe(true)
    expect(shouldStopForSilence(true, 200, 250)).toBe(false)
  })
})

describe('silence thresholds', () => {
  it('treats quiet as above absolute zero', () => {
    // A real room has a noise floor; a threshold of zero never triggers.
    expect(SILENCE_LEVEL).toBeGreaterThan(0)
  })

  it('needs more level to count as speech than to count as quiet', () => {
    // The gap between them stops the detector flapping on borderline frames.
    expect(SPEECH_LEVEL).toBeGreaterThan(SILENCE_LEVEL)
  })

  it('puts conversational speech above the speech threshold', () => {
    expect(levelToDisplay(0.07)).toBeGreaterThan(SPEECH_LEVEL)
  })

  it('puts a silent room below the quiet threshold', () => {
    expect(levelToDisplay(0)).toBeLessThan(SILENCE_LEVEL)
  })
})
