import { ElectronAPI } from '@electron-toolkit/preload'

interface BackendHealth {
  status: 'starting' | 'running' | 'stopped' | 'unhealthy' | 'restarting'
  pid: number | null
  lastCheckedAt: number | null
  failureCount: number
  error?: string
}

interface TorchAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  showOverlay: () => void
  hideOverlay: () => void
  openExternal: (url: string) => void
  getBackendHealth: () => Promise<BackendHealth>
  onBackendHealth: (callback: (_e: unknown, health: BackendHealth) => void) => void
  onBackendStatus: (callback: (status: 'online' | 'offline') => void) => void
  onOverlayActivate: (callback: () => void) => void
  onScreenWatchToggle: (callback: (_e: unknown, enabled: boolean) => void) => void
  removeOverlayActivate: () => void
  removeScreenWatchToggle: () => void
  removeBackendHealth: () => void
  removeBackendStatus: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    torchAPI: TorchAPI
  }
}
