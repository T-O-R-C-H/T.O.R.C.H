import { app, clipboard, safeStorage, BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { classifyClipboard } from './contextService'

import { join } from 'path'

export interface ClipboardChangeEvent {
  id: string
  text: string
  timestamp: number
  kind: 'code' | 'url' | 'email' | 'text'
}

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

/** Delete the pre-encryption history file if one is left over. */
function removeLegacyPlaintextStore(): void {
  try {
    const legacy = join(app.getPath('userData'), 'clipboard-history.json')
    if (existsSync(legacy)) rmSync(legacy, { force: true })
  } catch {
    // Nothing else to do; the file is simply never read again.
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/*
 * Clipboard history is encrypted at rest with the OS keystore, the same way
 * API keys are.
 *
 * Whatever the user copies passes through here — passwords pasted into a
 * form, a bank detail, a private message — so a readable JSON file in the
 * app-data directory is the wrong place for it. On a machine where the
 * keystore is unavailable, nothing is written at all rather than written in
 * the clear.
 */
function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function loadStore(): void {
  if (!storePath || !existsSync(storePath)) {
    entries = []
    return
  }
  try {
    const raw = readFileSync(storePath)
    if (!encryptionAvailable()) {
      entries = []
      return
    }
    entries = JSON.parse(safeStorage.decryptString(raw)) as ClipboardEntry[]
  } catch {
    // Includes a store written before encryption, or by another machine's
    // key. Unreadable history is dropped rather than guessed at.
    entries = []
  }
}

function saveStore(): void {
  if (!storePath) return
  if (!encryptionAvailable()) return
  const payload = JSON.stringify(entries.slice(0, MAX_ENTRIES))
  writeFileSync(storePath, safeStorage.encryptString(payload))
}

function pruneOldDays(): void {
  const cutoff = todayKey()
  entries = entries.filter((e) => e.dateKey === cutoff)
}

function emitClipboardChange(changeEvent: ClipboardChangeEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    const url = window.webContents.getURL()
    if (url.includes('/overlay') || url.includes('#/overlay')) {
      window.webContents.send('clipboard:changed', changeEvent)
    }
  }
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

  const changeEvent: ClipboardChangeEvent = {
    id: entry.id,
    text: trimmed,
    timestamp: entry.timestamp,
    kind: classifyClipboard(trimmed)
  }
  emitClipboardChange(changeEvent)

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
  // New name: the old plaintext file is neither read nor migrated, because
  // migrating it would mean reading secrets we promised not to keep in the
  // clear. It is removed instead.
  storePath = join(app.getPath('userData'), 'clipboard-history.enc')
  removeLegacyPlaintextStore()
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
