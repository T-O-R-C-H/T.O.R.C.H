import { app, clipboard } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
  dateKey: string
}

const MAX_ENTRIES = 200
const POLL_MS = 800

let entries: ClipboardEntry[] = []
let lastText = ''
let pollTimer: NodeJS.Timeout | null = null
let storePath = ''

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadStore(): void {
  if (!storePath || !existsSync(storePath)) {
    entries = []
    return
  }
  try {
    entries = JSON.parse(readFileSync(storePath, 'utf-8')) as ClipboardEntry[]
  } catch {
    entries = []
  }
}

function saveStore(): void {
  if (!storePath) return
  writeFileSync(storePath, JSON.stringify(entries.slice(0, MAX_ENTRIES)), 'utf-8')
}

function pruneOldDays(): void {
  const cutoff = todayKey()
  entries = entries.filter((e) => e.dateKey === cutoff)
}

function addEntry(text: string): ClipboardEntry | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed === lastText) return null

  lastText = trimmed
  const entry: ClipboardEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: trimmed,
    timestamp: Date.now(),
    dateKey: todayKey()
  }

  entries.unshift(entry)
  entries = entries.slice(0, MAX_ENTRIES)
  saveStore()
  return entry
}

function pollClipboard(): void {
  pruneOldDays()
  const text = clipboard.readText()
  if (text?.trim()) {
    addEntry(text)
  }
}

export function startClipboardMonitor(): void {
  storePath = join(app.getPath('userData'), 'clipboard-history.json')
  loadStore()
  pruneOldDays()
  lastText = clipboard.readText()?.trim() || ''

  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(pollClipboard, POLL_MS)
}

export function stopClipboardMonitor(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function getClipboardEntries(): ClipboardEntry[] {
  pruneOldDays()
  return [...entries]
}

export function copyToClipboard(text: string): void {
  clipboard.writeText(text)
  lastText = text.trim()
}
