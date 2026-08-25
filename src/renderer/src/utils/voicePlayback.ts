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

export function stopSpeaking(): void {
  playbackGeneration += 1
  window.speechSynthesis?.cancel()
  activeAudio?.pause()
  if (activeAudio?.src.startsWith('blob:')) URL.revokeObjectURL(activeAudio.src)
  activeAudio = null
  activeUtterance = null
}

function speakLocally(text: string, generation: number): void {
  if (!window.speechSynthesis || !text.trim()) return

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

export async function speakWithNaturalVoice(text: string): Promise<void> {
  if (!text.trim()) return
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
    if (!response.ok) throw new Error('Neural voice unavailable')
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
