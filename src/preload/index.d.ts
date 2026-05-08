import { ElectronAPI } from '@electron-toolkit/preload'

interface TorchAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  showOverlay: () => void
  hideOverlay: () => void
  openExternal: (url: string) => void
  onOverlayActivate: (callback: () => void) => void
  onScreenWatchToggle: (callback: (_e: unknown, enabled: boolean) => void) => void
  removeOverlayActivate: () => void
  removeScreenWatchToggle: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    torchAPI: TorchAPI
  }
}
