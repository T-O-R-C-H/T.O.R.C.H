import { API_BASE, torchFetch } from '../config/api'

let activeUtterance: SpeechSynthesisUtterance | null = null
let activeAudio: HTMLAudioElement | null = null
let playbackGeneration = 0

const preferredVoicePatterns = [
  /microsoft.*natural/i,
  /aria.*natural/i,
  /jenny.*natural/i,
  /sonia.*natural/i,
  /google.*english/i,
  /microsoft.*aria/i,
  /microsoft.*zira/i
]

export function selectPreferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  for (const pattern of preferredVoicePatterns) {
    const voice = englishVoices.find((candidate) => pattern.test(candidate.name))
    if (voice) return voice
  }
  return englishVoices.find((voice) => voice.localService) ?? englishVoices[0] ?? voices[0] ?? null
}

/** Longest utterance worth speaking. Beyond this it stops being a recap. */
export const MAX_SPOKEN_CHARS = 240

/**
 * Reduce a recap to the part worth hearing.
 *
 * Some recaps carry a tool's raw result — a moved file's full path, a
 * command's output, a directory listing. Reading those aloud is the same
 * mistake as reading a step list: the screen is the right place for detail,
 * and the voice is for the outcome.
 */
export function spokenForm(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  if (flat.length <= MAX_SPOKEN_CHARS) return flat

  // Prefer a clean sentence boundary before falling back to a hard cut.
  const firstSentence = flat.match(/^.*?[.!?](\s|$)/)
  if (firstSentence && firstSentence[0].trim().length <= MAX_SPOKEN_CHARS) {
    return firstSentence[0].trim()
  }
  return `${flat.slice(0, MAX_SPOKEN_CHARS).trimEnd()}…`
}

export function stopSpeaking(): void {
  playbackGeneration += 1
  window.speechSynthesis?.cancel()
  activeAudio?.pause()
  if (activeAudio?.src.startsWith('blob:')) URL.revokeObjectURL(activeAudio.src)
  activeAudio = null
  activeUtterance = null
}

/** Rung two: the renderer's own speech synthesis. Always local, no setup. */
function speakLocally(text: string, generation: number): void {
  if (!text.trim()) return
  if (!window.speechSynthesis) {
    void speakViaSystemVoice(text)
    return
  }

  const speak = (): void => {
    if (generation !== playbackGeneration) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = selectPreferredVoice(window.speechSynthesis.getVoices())
    utterance.lang = utterance.voice?.lang || 'en-US'
    utterance.rate = 0.96
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onend = (): void => {
      if (activeUtterance === utterance) activeUtterance = null
    }
    utterance.onerror = utterance.onend
    activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    speak()
    return
  }

  const handleVoicesChanged = (): void => {
    window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
    speak()
  }
  window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged, { once: true })
  window.setTimeout(() => {
    window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
    if (!activeUtterance) speak()
  }, 500)
}

/**
 * The last rung: the operating system's own voice, spoken by the backend.
 *
 * Only reached when Piper has no voice downloaded and this renderer has no
 * speechSynthesis either — an unusual combination, but silently saying
 * nothing would leave the user wondering whether the toggle works.
 */
async function speakViaSystemVoice(text: string): Promise<void> {
  try {
    await torchFetch(`${API_BASE}/api/voice/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
  } catch {
    // Nothing further to fall back to.
  }
}

/**
 * Speak one sentence, using the best voice available on this machine.
 *
 * The ladder is Piper, then the renderer's speechSynthesis, then the system
 * voice. Every rung is local: this used to POST the text to Google's Gemini
 * TTS endpoint, so a summary of what TORCH had just done on the user's
 * computer left the machine before it was spoken.
 *
 * A 503 from the first rung is normal — it means no Piper voice has been
 * downloaded — so falling through is the expected path, not an error.
 */
export async function speakWithNaturalVoice(raw: string): Promise<void> {
  const text = spokenForm(raw)
  if (!text) return
  stopSpeaking()
  const generation = playbackGeneration
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 7000)

  try {
    const response = await torchFetch(`${API_BASE}/api/voice/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal
    })
    if (!response.ok) throw new Error('natural-voice-unavailable')
    const audioUrl = URL.createObjectURL(await response.blob())
    if (generation !== playbackGeneration) {
      URL.revokeObjectURL(audioUrl)
      return
    }
    const audio = new Audio(audioUrl)
    activeAudio = audio
    audio.onended = (): void => {
      URL.revokeObjectURL(audioUrl)
      if (activeAudio === audio) activeAudio = null
    }
    audio.onerror = (): void => {
      URL.revokeObjectURL(audioUrl)
      if (generation === playbackGeneration) speakLocally(text, generation)
    }
    await audio.play()
  } catch {
    if (generation === playbackGeneration) speakLocally(text, generation)
  } finally {
    window.clearTimeout(timeout)
  }
}
