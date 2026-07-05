import { sanitizeDisplayText } from '../utils/plainLanguage'

/** Format clipboard text for display — clean markdown/dashes, preserve line breaks */
export function formatClipboardText(raw: string): string {
  return sanitizeDisplayText(raw)
}

/** One-line preview for list rows */
export function clipboardPreview(raw: string, maxLen = 80): string {
  const flat = raw.replace(/\s+/g, ' ').trim()
  if (flat.length <= maxLen) return flat
  return `${flat.slice(0, maxLen)}…`
}
