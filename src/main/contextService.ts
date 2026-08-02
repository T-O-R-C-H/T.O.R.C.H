import { execFileSync } from 'child_process'

export interface DesktopContext {
  windowTitle: string
  appName: string
  clipboardText: string
  focusLabel?: string
}

let lastExternalContext: DesktopContext | null = null

function getActiveWindowTitle(): string {
  try {
    const script = `
$ProgressPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class TorchWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr handle, StringBuilder text, int count);
}
"@
$handle = [TorchWin32]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 256
[void][TorchWin32]::GetWindowText($handle, $title, 256)
$title.ToString()
`
    const encodedScript = Buffer.from(script, 'utf16le').toString('base64')
    return execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', encodedScript], {
      encoding: 'utf-8',
      timeout: 3000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
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
  return parts.length >= 2 ? parts[parts.length - 1].trim() : windowTitle.slice(0, 48)
}

export function extractFocusLabel(windowTitle: string, appName: string): string | undefined {
  if (!windowTitle) return undefined
  const app = appName.toLowerCase()
  if (app === 'vs code' || app === 'chrome' || app === 'edge' || app === 'firefox') {
    const label = windowTitle.split(' - ')[0]?.trim()
    return label && label !== windowTitle ? label.slice(0, 80) : undefined
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
    return { ...lastExternalContext, clipboardText: clipboardText.trim() }
  }
  const appName = parseAppName(windowTitle)
  const context: DesktopContext = {
    windowTitle,
    appName,
    clipboardText: clipboardText.trim(),
    focusLabel: extractFocusLabel(windowTitle, appName)
  }
  if (windowTitle && !isTorchWindow(windowTitle)) lastExternalContext = context
  return context
}

export type ClipboardKind = 'code' | 'url' | 'email' | 'text'

export function classifyClipboard(text: string): ClipboardKind {
  const trimmed = text.trim()
  if (!trimmed) return 'text'
  if (/^https?:\/\//i.test(trimmed)) return 'url'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.includes('@')) return 'email'
  if (/(\bfunction\b|\bclass\b|\bimport\b|\bconst\b|\bdef\b|=>|\{[\s\S]*\}|;\s*$)/m.test(trimmed) && trimmed.length > 20) {
    return 'code'
  }
  return 'text'
}
