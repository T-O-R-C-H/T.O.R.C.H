import { execSync } from 'child_process'

export interface DesktopContext {
  windowTitle: string
  appName: string
  clipboardText: string
  /** VS Code active file, browser page title, etc. */
  focusLabel?: string
}

let lastExternalContext: DesktopContext | null = null

function getActiveWindowTitle(): string {
  try {
    const script = [
      'Add-Type @"',
      'using System;',
      'using System.Runtime.InteropServices;',
      'using System.Text;',
      'public class TorchWin32 {',
      '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
      '  [DllImport("user32.dll", CharSet=CharSet.Unicode)]',
      '  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);',
      '}"@',
      '$hwnd = [TorchWin32]::GetForegroundWindow()',
      '$sb = New-Object System.Text.StringBuilder 256',
      '[void][TorchWin32]::GetWindowText($hwnd, $sb, 256)',
      '$sb.ToString()'
    ].join('; ')

    const result = execSync(`powershell -NoProfile -Command "${script}"`, {
      encoding: 'utf-8',
      timeout: 3000,
      windowsHide: true
    })
    return result.trim()
  } catch {
    return ''
  }
}

export function parseAppName(windowTitle: string): string {
  if (!windowTitle) return 'Desktop'

  const knownApps: Record<string, string> = {
    'visual studio code': 'VS Code',
    'code.exe': 'VS Code',
    chrome: 'Chrome',
    firefox: 'Firefox',
    edge: 'Edge',
    spotify: 'Spotify',
    discord: 'Discord',
    slack: 'Slack',
    outlook: 'Outlook',
    word: 'Word',
    excel: 'Excel',
    powerpoint: 'PowerPoint',
    'adobe acrobat': 'Acrobat',
    notepad: 'Notepad',
    explorer: 'File Explorer'
  }

  const lower = windowTitle.toLowerCase()
  for (const [key, name] of Object.entries(knownApps)) {
    if (lower.includes(key)) return name
  }

  const parts = windowTitle.split(' - ')
  if (parts.length >= 2) {
    return parts[parts.length - 1].trim()
  }

  return windowTitle.slice(0, 48)
}

export function extractFocusLabel(windowTitle: string, appName: string): string | undefined {
  if (!windowTitle) return undefined

  const app = appName.toLowerCase()

  if (app === 'vs code') {
    const filePart = windowTitle.split(' - ')[0]?.trim()
    return filePart && filePart !== windowTitle ? filePart : undefined
  }

  if (app === 'chrome' || app === 'edge' || app === 'firefox') {
    const pagePart = windowTitle.split(' - ')[0]?.trim()
    return pagePart && pagePart !== windowTitle ? pagePart.slice(0, 80) : undefined
  }

  if (app === 'word' || app === 'excel' || app === 'powerpoint') {
    return windowTitle.split(' - ')[0]?.trim()
  }

  return undefined
}

function isTorchWindow(title: string): boolean {
  return title.toLowerCase().includes('torch')
}

export function getDesktopContext(clipboardText = ''): DesktopContext {
  const windowTitle = getActiveWindowTitle()

  if (isTorchWindow(windowTitle) && lastExternalContext) {
    return {
      ...lastExternalContext,
      clipboardText: clipboardText.trim()
    }
  }

  const appName = parseAppName(windowTitle)
  const focusLabel = extractFocusLabel(windowTitle, appName)
  const ctx: DesktopContext = {
    windowTitle,
    appName,
    clipboardText: clipboardText.trim(),
    focusLabel
  }

  if (windowTitle && !isTorchWindow(windowTitle)) {
    lastExternalContext = ctx
  }

  return ctx
}

export type ClipboardKind = 'code' | 'url' | 'email' | 'text'

export function classifyClipboard(text: string): ClipboardKind {
  const trimmed = text.trim()
  if (!trimmed) return 'text'
  if (/^https?:\/\//i.test(trimmed)) return 'url'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.includes('@')) return 'email'
  if (
    /(\bfunction\b|\bclass\b|\bimport\b|\bconst\b|\bdef\b|=>|\{[\s\S]*\}|;\s*$)/m.test(trimmed) &&
    trimmed.length > 20
  ) {
    return 'code'
  }
  return 'text'
}
