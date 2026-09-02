/** Plain-language copy for users — no jargon, no double dashes */

export function toPlainLanguage(raw: string | undefined): string {
  if (!raw?.trim()) return 'Something went wrong. Please try again.'

  const lower = raw.toLowerCase()

  if (lower.includes('file not found') || lower.includes('no such file')) {
    return "I couldn't find that file. Check the name and try again."
  }
  if (lower.includes('permission') || lower.includes('access denied')) {
    return "I don't have permission to do that. Close the file if it's open elsewhere and try again."
  }
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('connection')) {
    return 'There was a connection problem. Check your internet and try again.'
  }
  if (lower.includes('backend offline') || lower.includes('not connected')) {
    return "TORCH isn't connected right now. Open the app again or wait a moment, then retry."
  }
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('quota')) {
    return 'Your AI connection needs to be set up in Settings before I can continue.'
  }
  if (lower.includes('cancelled by user')) {
    return 'You cancelled this action.'
  }
  // Backstop for tool-name jargon: the backend translates this before sending,
  // so reaching here means a path that skipped translation.
  if (lower.includes('unknown tool') || lower.includes('tool not registered')) {
    return "That isn't something I know how to do yet. Want me to try a different way?"
  }
  if (
    lower.includes('pyautogui') ||
    lower.includes('screenshot failed') ||
    lower.includes('mss:')
  ) {
    return "I couldn't capture your screen. Restart TORCH after setup, or run: pip install pyautogui mss in the backend folder."
  }
  if (lower.includes('step ') && lower.includes('failed after')) {
    return 'This step did not finish. Check the details below and try again.'
  }
  /*
   * Replace text that looks like a machine wrote it for a machine.
   *
   * Length alone used to be enough, at 140 characters. That threw away
   * perfectly readable sentences: "I couldn't finish that. This AI model has
   * run out of allowance on your plan. Wait a minute and try again, or pick a
   * different model in Settings." is 144, so the user was shown "Something
   * went wrong on this step" instead of being told their quota had run out.
   *
   * Length now only counts alongside evidence that the text is actually raw.
   */
  const looksRaw =
    lower.includes('traceback') ||
    lower.includes('exception') ||
    lower.includes('line ') ||
    /[{}]|0x[0-9a-f]{4}|File "/.test(raw)

  if (looksRaw || raw.length > 400) {
    return 'Something went wrong on this step. Try rephrasing your request.'
  }

  return sanitizeDisplayText(raw)
}

export function sanitizeDisplayText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/(?<!\*)\*(?!\*)/g, '')
    .replace(/__/g, '')
    .replace(/\s--\s/g, ', ')
    .replace(/—/g, ', ')
    .replace(/-{2,}/g, ', ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatAgentContent(text: string): string {
  let out = text
    .replace(/(?<!\*)\*(?!\*)/g, '')
    .replace(/__/g, '')
    .replace(/-{2,}/g, ' — ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  out = out.replace(/^[-•]\s+/gm, '• ')
  return out
}

export function formatUserContent(text: string): string {
  return sanitizeDisplayText(text)
}

export function formatClipboardContent(text: string): string {
  const cleaned = sanitizeDisplayText(text)
  if (cleaned.length <= 280) return cleaned
  return cleaned
}

export function isLikelyErrorMessage(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('failed') ||
    lower.includes("couldn't") ||
    lower.includes('something went wrong') ||
    lower.includes("didn't go as planned") ||
    (lower.includes('step ') && lower.includes('attempts'))
  )
}
