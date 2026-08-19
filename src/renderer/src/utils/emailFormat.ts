export function formatTime(raw: string): string {
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function formatFullDate(raw: string): string {
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export function initialsOf(name: string): string {
  const clean = name.replace(/<[^>]+>/g, '').trim()
  const parts = clean.split(/[\s.@]+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => p[0].toUpperCase())
  return letters.join('') || '?'
}

export function domainFromEmail(email?: string): string | null {
  const match = /@([^@\s]+)/.exec(email || '')
  return match ? match[1] : null
}

export function stripHtml(html: string): string {
  const doc = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  const text = doc
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(
      /<\s*(script|style|iframe|object|embed|meta|link|form|input|button|textarea|select)[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ' '
    )
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>/gi, ' ')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' ')
    .replace(/(\shref|\ssrc|\sbackground)\s*=\s*(["']?)\s*javascript:[^"'\s>]+/gi, ' ')
    .replace(/(\shref|\ssrc|\sbackground)\s*=\s*(["']?)\s*data:[^"'\s>]+/gi, ' ')
}
