import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Microphone capture in the renderer.
 *
 * Capture used to live entirely in Python (`sr.Microphone()`), which meant the
 * UI had no access to the signal and could only ever have drawn an animation
 * pretending to be one. Reading the level here is the whole point: what the
 * waveform draws is the amplitude actually arriving from the device, so a
 * silent room looks silent and a dead microphone looks dead.
 *
 * Audio is encoded to 16-bit PCM WAV in the renderer rather than sent as
 * webm/opus, because decoding opus in Python needs ffmpeg on the user's
 * machine. A plain WAV is readable by the existing speech stack with no extra
 * dependency and nothing to install.
 */

/** Whisper wants 16 kHz mono; resampling here keeps the upload small. */
const TARGET_SAMPLE_RATE = 16000
const FFT_SIZE = 1024

/** Stop a runaway recording rather than filling memory forever. */
export const MAX_RECORDING_MS = 30000

/*
 * Ending on silence.
 *
 * Requiring a second press to stop is the wrong shape for voice: the user has
 * already said their piece and is waiting on a machine that is still
 * listening. These three numbers decide when a pause becomes an ending.
 */

/** Quiet for this long after speech ends the recording. */
export const SILENCE_HOLD_MS = 800

/**
 * Below this displayed level counts as quiet.
 *
 * Deliberately above zero: a real room has a noise floor, and a threshold of
 * zero would never trigger. Sits under the level a whisper produces so quiet
 * speech still holds the recording open.
 */
export const SILENCE_LEVEL = 0.12

/**
 * Silence before any speech never ends the recording.
 *
 * Someone who presses the shortcut and then draws breath must not have the
 * recording closed underneath them. The timer only arms once TORCH has
 * actually heard something.
 */
export const SPEECH_LEVEL = 0.2

export type CaptureState = 'idle' | 'requesting' | 'recording' | 'error'

export interface AudioCapture {
  state: CaptureState
  /** 0..1, root-mean-square amplitude of the most recent frame. */
  level: number
  /** Recent levels, oldest first, for drawing a waveform. */
  levels: number[]
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<Blob | null>
  cancel: () => void
}

/**
 * Root-mean-square of a byte time-domain frame, normalised to 0..1.
 *
 * Byte samples are centred on 128. RMS rather than peak because peak jumps on
 * a single click and makes the meter twitch; RMS tracks how loud the room
 * actually is.
 */
export function rmsFromTimeDomain(frame: Uint8Array): number {
  if (frame.length === 0) return 0
  let sumSquares = 0
  for (let i = 0; i < frame.length; i += 1) {
    const centred = (frame[i] - 128) / 128
    sumSquares += centred * centred
  }
  return Math.sqrt(sumSquares / frame.length)
}

/**
 * Decide whether a recording should end, from the levels seen so far.
 *
 * Pure so the rule can be tested without a microphone: given whether speech
 * has been heard and how long it has been quiet, should this stop?
 */
export function shouldStopForSilence(
  heardSpeech: boolean,
  quietForMs: number,
  holdMs: number = SILENCE_HOLD_MS
): boolean {
  if (!heardSpeech) return false
  return quietForMs >= holdMs
}

/**
 * Map RMS onto something a bar chart can show.
 *
 * Speech sits low in a linear 0..1 scale, so a linear bar barely moves for a
 * normal speaking voice. This is a gain plus a curve, clamped, so ordinary
 * speech uses most of the height while a shout still has somewhere to go.
 */
export function levelToDisplay(rms: number): number {
  // Gain 3 puts conversational speech (RMS around 0.07) near a third of the
  // height and a raised voice near the top, without pinning everything above
  // a moderate level to full — at gain 4 a normal voice and a shout drew the
  // same bar, which makes the meter useless exactly when it should be
  // informative.
  const scaled = Math.pow(Math.min(1, rms * 3), 0.6)
  return Math.max(0, Math.min(1, scaled))
}

/** Down-mix and resample to 16 kHz mono. */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const output = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < output.length; i += 1) {
    // Linear interpolation between neighbouring input samples.
    const position = i * ratio
    const lower = Math.floor(position)
    const upper = Math.min(lower + 1, input.length - 1)
    const weight = position - lower
    output[i] = input[lower] * (1 - weight) + input[upper] * weight
  }
  return output
}

/** Wrap Float32 samples as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeText = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }

  return new Blob([view], { type: 'audio/wav' })
}

/** How many level samples the waveform keeps. */
export const LEVEL_HISTORY = 48

/**
 * @param onSilence Called when the user stops speaking. Receives `stop`, so
 *   the caller never has to reference the hook's own return value to finish
 *   the recording.
 */
export function useAudioCapture(
  onSilence?: (stop: () => Promise<Blob | null>) => void | Promise<void>
): AudioCapture {
  const [state, setState] = useState<CaptureState>('idle')
  const [level, setLevel] = useState(0)
  const [levels, setLevels] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const frameRef = useRef<number | undefined>(undefined)
  const chunksRef = useRef<Float32Array[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const heardSpeechRef = useRef(false)
  const quietSinceRef = useRef<number | null>(null)
  const stopRef = useRef<() => Promise<Blob | null>>(async () => null)
  const onSilenceRef = useRef<((stop: () => Promise<Blob | null>) => void | Promise<void>) | null>(
    null
  )

  const teardown = useCallback((): void => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
    frameRef.current = undefined
    clearTimeout(timeoutRef.current)
    processorRef.current?.disconnect()
    analyserRef.current?.disconnect()
    processorRef.current = null
    analyserRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void contextRef.current?.close().catch(() => undefined)
    contextRef.current = null
    setLevel(0)
  }, [])

  /*
   * Held in a ref so the running capture loop always calls the latest
   * callback without start() having to be rebuilt - rebuilding it mid-record
   * would tear down the microphone.
   */
  useEffect(() => {
    onSilenceRef.current = onSilence ?? null
  }, [onSilence])

  // Releasing the microphone matters more than most cleanup: the OS shows a
  // recording indicator, and leaving it on after the component goes away
  // looks like the app is listening when it is not.
  useEffect(() => teardown, [teardown])

  const start = useCallback(async (): Promise<void> => {
    if (state === 'recording' || state === 'requesting') return
    setError(null)
    setState('requesting')
    chunksRef.current = []
    setLevels([])

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      streamRef.current = stream

      const context = new AudioContext()
      contextRef.current = context
      const source = context.createMediaStreamSource(stream)

      const analyser = context.createAnalyser()
      analyser.fftSize = FFT_SIZE
      // Some smoothing, or the bars flicker faster than the eye can read.
      analyser.smoothingTimeConstant = 0.6
      analyserRef.current = analyser
      source.connect(analyser)

      // Collect the raw samples alongside the meter so the recording and the
      // waveform are the same audio, not two separate captures.
      const processor = context.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      processor.onaudioprocess = (event): void => {
        chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)))
      }
      source.connect(processor)
      // ScriptProcessor only runs while connected to a destination. A zeroed
      // gain node keeps it running without playing the microphone back.
      const mute = context.createGain()
      mute.gain.value = 0
      processor.connect(mute)
      mute.connect(context.destination)

      setState('recording')

      const frame = new Uint8Array(analyser.frequencyBinCount)
      heardSpeechRef.current = false
      quietSinceRef.current = null

      const tick = (): void => {
        const node = analyserRef.current
        if (!node) return
        node.getByteTimeDomainData(frame)
        const display = levelToDisplay(rmsFromTimeDomain(frame))
        setLevel(display)
        setLevels((current) => {
          const next = current.length >= LEVEL_HISTORY ? current.slice(1) : current.slice()
          next.push(display)
          return next
        })

        // Track the run of quiet, and only once speech has been heard.
        const now = Date.now()
        if (display >= SPEECH_LEVEL) {
          heardSpeechRef.current = true
          quietSinceRef.current = null
        } else if (display < SILENCE_LEVEL) {
          if (quietSinceRef.current === null) quietSinceRef.current = now
        } else {
          // Between the two thresholds: neither clearly speech nor clearly
          // quiet, so hold the current state rather than flapping.
          quietSinceRef.current = quietSinceRef.current ?? null
        }

        const quietFor = quietSinceRef.current === null ? 0 : now - quietSinceRef.current
        if (shouldStopForSilence(heardSpeechRef.current, quietFor)) {
          // Hand back to the caller, which stops and transcribes. Doing the
          // stop here would leave the recording with nowhere to go.
          const notify = onSilenceRef.current
          quietSinceRef.current = null
          heardSpeechRef.current = false
          if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
          frameRef.current = undefined
          if (notify) {
            void notify(stopRef.current)
            return
          }
        }

        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)

      timeoutRef.current = setTimeout(() => {
        teardown()
        setState('idle')
      }, MAX_RECORDING_MS)
    } catch (err) {
      teardown()
      setState('error')
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'TORCH needs permission to use your microphone.'
          : "TORCH couldn't reach your microphone."
      )
    }
  }, [state, teardown])

  const stop = useCallback(async (): Promise<Blob | null> => {
    if (state !== 'recording') return null
    const context = contextRef.current
    const sampleRate = context?.sampleRate ?? TARGET_SAMPLE_RATE
    const chunks = chunksRef.current
    teardown()
    setState('idle')

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    if (total === 0) return null

    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    chunksRef.current = []

    return encodeWav(resample(merged, sampleRate, TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE)
  }, [state, teardown])

  // Kept current so the capture loop can hand `stop` to the silence callback.
  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  const cancel = useCallback((): void => {
    chunksRef.current = []
    teardown()
    setState('idle')
    setLevels([])
  }, [teardown])

  return { state, level, levels, error, start, stop, cancel }
}
