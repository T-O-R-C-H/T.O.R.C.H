import { useEffect } from 'react'
import { useTorchStore, type Message } from '../store/torchStore'
import { speakWithNaturalVoice, stopSpeaking } from '../utils/voicePlayback'
import { formatAgentContent } from '../utils/plainLanguage'

/**
 * Reads the final recap aloud, when the user has asked for that.
 *
 * Driven from the store rather than from the WebSocket message handler. That
 * handler runs inside `ws.onmessage`, whose `catch` swallows everything, so a
 * side effect placed there fails silently and invisibly.
 *
 * Only messages the backend marked speakable are read. The flag is never
 * inferred from a message's shape: a plan message is a step list, and reading
 * step lists aloud is the one thing the voice ladder must not do.
 */

/*
 * Module scope, not per-effect. React mounts effects twice in development,
 * and a counter living inside the effect gave each subscription its own idea
 * of what had already been said — so the recap was spoken twice, over itself.
 */
let lastSpokenId: string | null = null

export function __resetSpokenRecapForTests(): void {
  lastSpokenId = null
}

/** The message to read, or null if there is nothing to say yet. */
export function recapToSpeak(
  messages: Message[],
  speakResponses: boolean,
  alreadySpokenId: string | null
): Message | null {
  if (!speakResponses) return null

  const latest = messages[messages.length - 1] as (Message & { speak?: boolean }) | undefined
  if (!latest || latest.role !== 'torch' || !latest.speak) return null
  if (latest.id === alreadySpokenId) return null

  /*
   * Messages arrive with empty content and stream in character by character,
   * so reading at arrival speaks nothing at all — which is exactly what
   * happened. Wait for the text to settle.
   */
  if (latest.isStreaming) return null
  if (!formatAgentContent(latest.content || '').trim()) return null

  return latest
}

export function useSpokenRecap(): void {
  useEffect(() => {
    const speakIfReady = (messages: Message[]): void => {
      const message = recapToSpeak(messages, useTorchStore.getState().speakResponses, lastSpokenId)
      if (!message) return
      lastSpokenId = message.id
      void speakWithNaturalVoice(formatAgentContent(message.content || ''))
    }

    speakIfReady(useTorchStore.getState().messages)
    const unsubscribe = useTorchStore.subscribe((state, previous) => {
      if (state.messages !== previous.messages) speakIfReady(state.messages)
      // A new task interrupts whatever was still being read out.
      if (state.agentStatus !== previous.agentStatus && state.agentStatus === 'processing') {
        stopSpeaking()
      }
    })

    return (): void => {
      unsubscribe()
      stopSpeaking()
    }
  }, [])
}
