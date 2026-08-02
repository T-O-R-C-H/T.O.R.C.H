let activeUtterance: SpeechSynthesisUtterance | null = null

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
  window.speechSynthesis?.cancel()
  activeUtterance = null
}

export function speakWithNaturalVoice(text: string): void {
  if (!window.speechSynthesis || !text.trim()) return
  stopSpeaking()

  const speak = (): void => {
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
