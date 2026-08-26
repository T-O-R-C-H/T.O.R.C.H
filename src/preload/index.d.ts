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
  showOverlay: () => void
  hideOverlay: () => void
  openMainWindow: () => void
  setOverlaySize: (width: number, height: number) => void
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
  suspendOverlayForVisionCapture: () => void
  restoreOverlayAfterVisionCapture: () => void
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
  getDesktopContext: () => Promise<{
    windowTitle: string
    appName: string
    clipboardText: string
    focusLabel?: string
  }>
  getAuthToken: () => Promise<string>
  getBackendPhase: () => Promise<'starting' | 'ready' | 'failed'>
  onBackendPhase: (callback: (phase: 'starting' | 'ready' | 'failed') => void) => void
  getBackendHealth: () => Promise<BackendHealth>
  onBackendHealth: (callback: (_e: unknown, health: BackendHealth) => void) => void
  onBackendStatus: (callback: (status: 'online' | 'offline') => void) => void
  onOverlayActivate: (callback: () => void) => void
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
  removeOverlayActivate: () => void
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
