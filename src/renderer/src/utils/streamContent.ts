import { useTorchStore } from '../store/torchStore'

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Stream text into a message word-by-word for a live reply feel */
export async function streamMessageContent(
  messageId: string,
  fullText: string,
  wordDelayMs = 26
): Promise<void> {
  if (!fullText) {
    useTorchStore.getState().updateMessage(messageId, { isStreaming: false })
    return
  }

  const tokens = fullText.split(/(\s+)/)

  for (const token of tokens) {
    if (!token) continue
    useTorchStore.getState().appendMessageContent(messageId, token)
    await delay(wordDelayMs)
  }

  useTorchStore.getState().updateMessage(messageId, { isStreaming: false })
}
