import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type BackendHealth = {
  status: 'starting' | 'running' | 'stopped' | 'unhealthy' | 'restarting'
  pid: number | null
  lastCheckedAt: number | null
  failureCount: number
  error?: string
}

type DesktopContext = {
  windowTitle: string
  appName: string
  clipboardText: string
  focusLabel?: string
}

type ClipboardChangeEvent = {
  id: string
  text: string
  timestamp: number
  kind: 'code' | 'url' | 'email' | 'text'
}

type TaskCommand =
  | { type: 'stop_task' }
  | { type: 'clarification_response'; taskId: string; response: string }

export type ScreenCapture = {
  displayId: string
  width: number
  height: number
  bounds: { x: number; y: number; width: number; height: number }
  dataUrl: string
}

export type VisualGuidance = {
  type: 'point' | 'none'
  x?: number
  y?: number
  homeX?: number
  homeY?: number
  label?: string
  transcript?: string
}

// TORCH API exposed to renderer
const torchAPI = {
  // Window controls
  minimizeWindow: (): void => ipcRenderer.send('window:minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window:maximize'),
  closeWindow: (): void => ipcRenderer.send('window:close'),

  // Overlay controls
  showOverlay: (): void => ipcRenderer.send('overlay:show'),
  hideOverlay: (): void => ipcRenderer.send('overlay:hide'),
  openMainWindow: (): void => ipcRenderer.send('overlay:openMain'),
  setOverlaySize: (width: number, height: number): void =>
    ipcRenderer.send('overlay:setSize', { width, height }),
  captureScreens: (): Promise<ScreenCapture[]> => ipcRenderer.invoke('companion:captureScreens'),
  showGuidance: (guidance: VisualGuidance): void => ipcRenderer.send('guidance:show', guidance),
  hideGuidance: (): void => ipcRenderer.send('guidance:hide'),
  showControlBorder: (): void => ipcRenderer.send('control-border:show'),
  hideControlBorder: (): void => ipcRenderer.send('control-border:hide'),
  suspendOverlayForVisionCapture: (): void => ipcRenderer.send('vision-capture:start'),
  restoreOverlayAfterVisionCapture: (): void => ipcRenderer.send('vision-capture:end'),
  completeVisionControl: (): void => ipcRenderer.send('vision-control:complete'),
  publishTaskEvent: (event: Record<string, unknown>): void =>
    ipcRenderer.send('task-event:publish', event),
  onTaskEvent: (callback: (_e: unknown, event: Record<string, unknown>) => void): void => {
    ipcRenderer.on('task-event:update', callback)
  },
  removeTaskEvent: (): void => {
    ipcRenderer.removeAllListeners('task-event:update')
  },
  publishTaskCommand: (command: TaskCommand): void =>
    ipcRenderer.send('task-command:publish', command),
  onTaskCommand: (callback: (_e: unknown, command: TaskCommand) => void): void => {
    ipcRenderer.on('task-command:update', callback)
  },
  removeTaskCommand: (): void => {
    ipcRenderer.removeAllListeners('task-command:update')
  },
  onGuidance: (callback: (_e: unknown, guidance: VisualGuidance) => void): void => {
    ipcRenderer.on('guidance:update', callback)
  },
  removeGuidance: (): void => {
    ipcRenderer.removeAllListeners('guidance:update')
  },

  // External links
  openExternal: (url: string): void => ipcRenderer.send('shell:openExternal', url),

  // Desktop context
  getDesktopContext: (): Promise<DesktopContext> => ipcRenderer.invoke('context:getDesktop'),

  // Backend session token — required on every REST call and the WS handshake
  getAuthToken: (): Promise<string> => ipcRenderer.invoke('backend:getAuthToken'),

  // Command pill and task panel
  setPillFocused: (focused: boolean): void => ipcRenderer.send('pill:setFocused', focused),
  hidePill: (): void => ipcRenderer.send('pill:hide'),
  showTaskPanel: (): void => ipcRenderer.send('task-panel:show'),
  hideTaskPanel: (): void => ipcRenderer.send('task-panel:hide'),
  onPillActivate: (callback: () => void): void => {
    ipcRenderer.on('pill:activate', callback)
  },

  // Desktop preferences only Electron can act on
  getPreferences: (): Promise<{ launchOnLogin: boolean; minimizeToTray: boolean }> =>
    ipcRenderer.invoke('prefs:get'),
  setPreferences: (
    prefs: Partial<{ launchOnLogin: boolean; minimizeToTray: boolean }>
  ): Promise<{ launchOnLogin: boolean; minimizeToTray: boolean }> =>
    ipcRenderer.invoke('prefs:set', prefs),

  // Updates — downloaded in the background, installed only when the user asks
  onUpdateReady: (callback: (info: { version: string }) => void): void => {
    ipcRenderer.on('update:ready', (_e, info) => callback(info))
  },
  installUpdate: (): void => ipcRenderer.send('update:install'),

  // Credentials — encrypted by the main process, never sent to the backend
  // from here and never read back in plaintext.
  getCredentialStatus: (): Promise<{
    encryptionAvailable: boolean
    stored: Record<string, boolean>
  }> => ipcRenderer.invoke('credentials:status'),
  setCredentials: (updates: Record<string, string>): Promise<{ ok: boolean; reason?: string }> =>
    ipcRenderer.invoke('credentials:set', updates),

  // Backend readiness — the renderer holds its first requests until 'ready'
  getBackendPhase: (): Promise<'starting' | 'ready' | 'failed'> =>
    ipcRenderer.invoke('backend:getPhase'),
  onBackendPhase: (callback: (phase: 'starting' | 'ready' | 'failed') => void): void => {
    ipcRenderer.on('backend:phase', (_e, phase) => callback(phase))
  },

  // Backend health
  getBackendHealth: (): Promise<BackendHealth> => ipcRenderer.invoke('backend:getHealth'),
  onBackendHealth: (callback: (_e: unknown, health: BackendHealth) => void): void => {
    ipcRenderer.on('backend:health', callback)
  },
  onBackendStatus: (callback: (status: 'online' | 'offline') => void): void => {
    ipcRenderer.on('backend:status', (_e, status: 'online' | 'offline') => callback(status))
  },

  // Event listeners
  onOverlayActivate: (callback: () => void): void => {
    ipcRenderer.on('overlay:activate', callback)
  },
  onClipboardChanged: (callback: (_e: unknown, change: ClipboardChangeEvent) => void): void => {
    ipcRenderer.on('clipboard:changed', callback)
  },
  onScreenWatchToggle: (callback: (_e: unknown, enabled: boolean) => void): void => {
    ipcRenderer.on('screenwatch:toggle', callback)
  },

  // Remove listeners
  removeOverlayActivate: (): void => {
    ipcRenderer.removeAllListeners('overlay:activate')
  },
  removeClipboardChanged: (): void => {
    ipcRenderer.removeAllListeners('clipboard:changed')
  },
  removeScreenWatchToggle: (): void => {
    ipcRenderer.removeAllListeners('screenwatch:toggle')
  },
  removeBackendHealth: (): void => {
    ipcRenderer.removeAllListeners('backend:health')
  },
  removeBackendStatus: (): void => {
    ipcRenderer.removeAllListeners('backend:status')
  },

  getClipboardEntries: (): Promise<
    Array<{ id: string; text: string; timestamp: number; dateKey: string }>
  > => ipcRenderer.invoke('clipboard:list'),
  copyToClipboard: (text: string): void => ipcRenderer.send('clipboard:copy', text)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('torchAPI', torchAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  const currentWindow = window as unknown as {
    electron: typeof electronAPI
    torchAPI: typeof torchAPI
  }

  currentWindow.electron = electronAPI
  currentWindow.torchAPI = torchAPI
}
