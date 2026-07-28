export interface OverlaySuggestion {
  label: string
  command: string
}

export interface OverlayContext {
  appName: string
  windowTitle: string
  clipboardText?: string
  focusLabel?: string
}

export function getContextSuggestions(appName: string, clipboardKind?: string): OverlaySuggestion[] {
  const app = appName.toLowerCase()

  if (app.includes('vs code') || app.includes('code')) {
    return [
      { label: 'Explain this file', command: 'Explain the active file in my editor' },
      { label: 'Refactor selection', command: 'Refactor the selected code' },
      { label: 'Add comments', command: 'Add helpful comments to this code' }
    ]
  }

  if (app.includes('chrome') || app.includes('edge') || app.includes('firefox')) {
    return [
      { label: 'Summarize page', command: 'Summarize the current webpage' },
      { label: 'Translate page', command: 'Translate this page to French' },
      { label: 'Bookmark this', command: 'Bookmark the current page' }
    ]
  }

  if (app.includes('spotify')) {
    return [
      { label: 'Play lo-fi', command: 'Play lo-fi music on Spotify' },
      { label: 'Pause music', command: 'Pause Spotify playback' },
      { label: 'Next track', command: 'Skip to the next song' }
    ]
  }

  if (app.includes('file explorer') || app.includes('explorer')) {
    return [
      { label: 'Find invoice', command: 'Find my latest invoice' },
      { label: 'Open Downloads', command: 'Open my Downloads folder' },
      { label: 'Find large files', command: 'Find large video files on my PC' }
    ]
  }

  if (clipboardKind === 'code') {
    return [
      { label: 'Explain code', command: 'Explain this code' },
      { label: 'Optimize', command: 'Optimize this code' },
      { label: 'Add comments', command: 'Add comments to this code' }
    ]
  }

  if (clipboardKind === 'url') {
    return [
      { label: 'Summarize', command: 'Summarize this link' },
      { label: 'Open link', command: 'Open this URL in the browser' },
      { label: 'Bookmark', command: 'Save this link for later' }
    ]
  }

  if (clipboardKind === 'email') {
    return [
      { label: 'Draft reply', command: 'Draft a polite reply to this email' },
      { label: 'Summarize', command: 'Summarize this email' }
    ]
  }

  return [
    { label: 'Explain clipboard', command: 'Explain what I copied' },
    { label: 'Fix grammar', command: 'Fix grammar in my clipboard text' },
    { label: 'Find a file', command: 'Find my latest invoice' }
  ]
}

export function enrichOverlayCommand(command: string, context: OverlayContext): string {
  let enriched = command
  const parts: string[] = []

  if (context.appName && context.appName !== 'Desktop') {
    parts.push(`Active app: ${context.appName}`)
  }

  if (context.focusLabel) {
    parts.push(`Active context: ${context.focusLabel}`)
  } else if (context.windowTitle && context.windowTitle !== context.appName) {
    parts.push(`Window: ${context.windowTitle.slice(0, 120)}`)
  }

  if (parts.length > 0) {
    enriched = `[${parts.join(' · ')}] ${enriched}`
  }

  const wantsClipboard = /\b(this|selected|clipboard|copied|highlighted|page|file|post|article|code)\b/i.test(
    command
  )
  if (wantsClipboard && context.clipboardText) {
    enriched += `\n\nSelected/copied content:\n${context.clipboardText.slice(0, 2000)}`
  }

  return enriched
}

export function getClipboardActions(kind: string): OverlaySuggestion[] {
  switch (kind) {
    case 'code':
      return [
        { label: 'Explain', command: 'Explain this code' },
        { label: 'Optimize', command: 'Optimize this code' },
        { label: 'Add comments', command: 'Add comments to this code' }
      ]
    case 'url':
      return [
        { label: 'Summarize', command: 'Summarize this URL' },
        { label: 'Open', command: 'Open this URL' },
        { label: 'Bookmark', command: 'Bookmark this link' }
      ]
    case 'email':
      return [
        { label: 'Draft reply', command: 'Draft a reply to this email' },
        { label: 'Summarize', command: 'Summarize this email' }
      ]
    default:
      return [
        { label: 'Explain', command: 'Explain this text' },
        { label: 'Fix grammar', command: 'Fix grammar in this text' },
        { label: 'Translate', command: 'Translate this to French' }
      ]
  }
}

export function isDangerousAction(summary: string): boolean {
  const lower = summary.toLowerCase()
  return (
    lower.includes('delete') ||
    lower.includes('send email') ||
    lower.includes('send_email') ||
    lower.includes('move file') ||
    lower.includes('terminal') ||
    lower.includes('publish') ||
    lower.includes('shutdown') ||
    lower.includes('restart')
  )
}
