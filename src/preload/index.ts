import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type BackendHealth = {
  status: 'starting' | 'running' | 'stopped' | 'unhealthy' | 'restarting'
  pid: number | null
  lastCheckedAt: number | null
  failureCount: number
  error?: string
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

  // External links
  openExternal: (url: string): void => ipcRenderer.send('shell:openExternal', url),

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
  onScreenWatchToggle: (callback: (_e: unknown, enabled: boolean) => void): void => {
    ipcRenderer.on('screenwatch:toggle', callback)
  },

  // Remove listeners
  removeOverlayActivate: (): void => {
    ipcRenderer.removeAllListeners('overlay:activate')
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
