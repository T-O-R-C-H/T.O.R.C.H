import { ElectronAPI } from '@electron-toolkit/preload'

interface BackendHealth {
  status: 'starting' | 'running' | 'stopped' | 'unhealthy' | 'restarting'
  pid: number | null
  lastCheckedAt: number | null
  failureCount: number
  error?: string
}

type TaskCommand =
  | { type: 'stop_task' }
  | { type: 'clarification_response'; taskId: string; response: string }

interface TorchAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  openMainWindow: () => void
  captureScreens: () => Promise<
    Array<{
      displayId: string
      width: number
      height: number
      bounds: { x: number; y: number; width: number; height: number }
      dataUrl: string
    }>
  >
  showGuidance: (guidance: VisualGuidance) => void
  hideGuidance: () => void
  showControlBorder: () => void
  hideControlBorder: () => void
  completeVisionControl: () => void
  publishTaskEvent: (event: Record<string, unknown>) => void
  onTaskEvent: (callback: (_e: unknown, event: Record<string, unknown>) => void) => void
  removeTaskEvent: () => void
  publishTaskCommand: (command: TaskCommand) => void
  onTaskCommand: (callback: (_e: unknown, command: TaskCommand) => void) => void
  removeTaskCommand: () => void
  onGuidance: (callback: (_e: unknown, guidance: VisualGuidance) => void) => void
  removeGuidance: () => void
  openExternal: (url: string) => void
  getReportInfo: () => Promise<{ appVersion: string; electron: string; os: string }>
  getDesktopContext: () => Promise<{
    windowTitle: string
    appName: string
    clipboardText: string
    focusLabel?: string
  }>
  getAuthToken: () => Promise<string>
  setPillFocused: (focused: boolean) => void
  hidePill: () => void
  showTaskPanel: () => void
  hideTaskPanel: () => void
  getVoiceShortcut: () => Promise<string>
  showCompanion: () => void
  hideCompanion: () => void
  toggleCompanion: () => void
  onCompanionAnimateIn: (callback: () => void) => void
  onCompanionAnimateOut: (callback: () => void) => void
  onPillActivate: (callback: (payload: { voice: boolean }) => void) => void
  getPreferences: () => Promise<{ launchOnLogin: boolean; minimizeToTray: boolean }>
  setPreferences: (
    prefs: Partial<{ launchOnLogin: boolean; minimizeToTray: boolean }>
  ) => Promise<{ launchOnLogin: boolean; minimizeToTray: boolean }>
  onUpdateReady: (callback: (info: { version: string }) => void) => void
  installUpdate: () => void
  getCredentialStatus: () => Promise<{
    encryptionAvailable: boolean
    stored: Record<string, boolean>
  }>
  setCredentials: (updates: Record<string, string>) => Promise<{ ok: boolean; reason?: string }>
  getBackendPhase: () => Promise<'starting' | 'ready' | 'failed'>
  onBackendPhase: (callback: (phase: 'starting' | 'ready' | 'failed') => void) => void
  getBackendHealth: () => Promise<BackendHealth>
  onBackendHealth: (callback: (_e: unknown, health: BackendHealth) => void) => void
  onBackendStatus: (callback: (status: 'online' | 'offline') => void) => void
  onClipboardChanged: (
    callback: (
      _e: unknown,
      change: {
        id: string
        text: string
        timestamp: number
        kind: 'code' | 'url' | 'email' | 'text'
      }
    ) => void
  ) => void
  onScreenWatchToggle: (callback: (_e: unknown, enabled: boolean) => void) => void
  removeClipboardChanged: () => void
  removeScreenWatchToggle: () => void
  removeBackendHealth: () => void
  removeBackendStatus: () => void
  getClipboardEntries: () => Promise<
    Array<{ id: string; text: string; timestamp: number; dateKey: string }>
  >
  copyToClipboard: (text: string) => void
}

interface VisualGuidance {
  type: 'point' | 'none'
  x?: number
  y?: number
  homeX?: number
  homeY?: number
  label?: string
  transcript?: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    torchAPI: TorchAPI
  }
}
