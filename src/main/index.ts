import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let backendProcess: ChildProcess | null = null
let backendHealthTimer: NodeJS.Timeout | null = null
let backendRestartTimer: NodeJS.Timeout | null = null
let backendStopping = false
let backendRestarting = false
let backendFailedChecks = 0

const backendHealthIntervalMs = Number(process.env['TORCH_BACKEND_HEALTH_INTERVAL_MS'] ?? 10000)
const backendHealthTimeoutMs = Number(process.env['TORCH_BACKEND_HEALTH_TIMEOUT_MS'] ?? 3000)
const backendMaxFailedChecks = Number(process.env['TORCH_BACKEND_MAX_FAILED_CHECKS'] ?? 3)
const backendRestartDelayMs = Number(process.env['TORCH_BACKEND_RESTART_DELAY_MS'] ?? 1000)

type BackendHealth = {
  status: 'starting' | 'running' | 'stopped' | 'unhealthy' | 'restarting'
  pid: number | null
  lastCheckedAt: number | null
  failureCount: number
  error?: string
}

let backendHealth: BackendHealth = {
  status: 'stopped',
  pid: null,
  lastCheckedAt: null,
  failureCount: 0
}

function publishBackendHealth(update: Partial<BackendHealth>): void {
  backendHealth = {
    ...backendHealth,
    ...update,
    pid: backendProcess?.pid ?? null
  }

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('backend:health', backendHealth)
  }
}

function startBackend(): void {
  if (backendRestartTimer) {
    clearTimeout(backendRestartTimer)
    backendRestartTimer = null
  }

  if (backendProcess) {
    console.log('[TORCH] Backend already running')
    return
  }

  backendStopping = false

  // In dev, __dirname is in out/main, so go up 2 levels to project root, then into backend
  // In production, backend is bundled next to the app
  const projectRoot = is.dev ? join(__dirname, '..', '..') : join(app.getAppPath(), '..')
  const backendDir = join(projectRoot, 'backend')
  const venvPython = join(backendDir, 'venv', 'Scripts', 'python.exe')
  const pythonExe = existsSync(venvPython) ? venvPython : 'python'

  console.log('[TORCH] Starting backend from:', backendDir)
  console.log('[TORCH] Using Python:', pythonExe)

  backendProcess = spawn(pythonExe, ['main.py'], {
    cwd: backendDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      TORCH_RELOAD: 'false'
    }
  })

  publishBackendHealth({
    status: 'starting',
    lastCheckedAt: Date.now(),
    failureCount: 0,
    error: undefined
  })

  backendProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[Backend]', data.toString().trim())
  })

  backendProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Backend]', data.toString().trim())
  })

  backendProcess.on('exit', (code) => {
    console.log(`[TORCH] Backend exited with code ${code}`)
    backendProcess = null
    publishBackendHealth({
      status: backendRestarting ? 'restarting' : 'stopped',
      lastCheckedAt: Date.now(),
      failureCount: backendFailedChecks
    })

    if (!backendStopping && !backendRestarting) {
      scheduleBackendRestart('backend process exited unexpectedly')
    }
  })

  backendProcess.on('error', (error) => {
    console.error('[TORCH] Backend process error:', error)
    publishBackendHealth({
      status: 'unhealthy',
      lastCheckedAt: Date.now(),
      failureCount: backendFailedChecks,
      error: error.message
    })
  })

  startBackendHealthMonitor()
}

function stopBackend(): void {
  backendStopping = true
  stopBackendHealthMonitor()

  if (backendRestartTimer) {
    clearTimeout(backendRestartTimer)
    backendRestartTimer = null
  }

  backendRestarting = false

  if (backendProcess) {
    console.log('[TORCH] Stopping backend...')
    backendProcess.kill()
    backendProcess = null
  }

  backendFailedChecks = 0
  publishBackendHealth({
    status: 'stopped',
    lastCheckedAt: Date.now(),
    failureCount: 0,
    error: undefined
  })
}

function startBackendHealthMonitor(): void {
  if (backendHealthTimer) {
    return
  }

  void checkBackendHealth()
  backendHealthTimer = setInterval(() => {
    void checkBackendHealth()
  }, backendHealthIntervalMs)
}

function stopBackendHealthMonitor(): void {
  if (backendHealthTimer) {
    clearInterval(backendHealthTimer)
    backendHealthTimer = null
  }
}

async function checkBackendHealth(): Promise<void> {
  if (!backendProcess || backendStopping) {
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), backendHealthTimeoutMs)

  try {
    const response = await fetch('http://127.0.0.1:8000/api/status', {
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`Health check returned ${response.status}`)
    }

    backendFailedChecks = 0
    publishBackendHealth({
      status: 'running',
      lastCheckedAt: Date.now(),
      failureCount: 0,
      error: undefined
    })
  } catch (error) {
    backendFailedChecks += 1
    const message = error instanceof Error ? error.message : 'Unknown backend health check error'

    publishBackendHealth({
      status: 'unhealthy',
      lastCheckedAt: Date.now(),
      failureCount: backendFailedChecks,
      error: message
    })

    if (backendFailedChecks >= backendMaxFailedChecks) {
      scheduleBackendRestart(message)
    }
  } finally {
    clearTimeout(timeout)
  }
}

function scheduleBackendRestart(reason: string): void {
  if (backendRestarting || backendStopping) {
    return
  }

  backendRestarting = true
  stopBackendHealthMonitor()
  publishBackendHealth({
    status: 'restarting',
    lastCheckedAt: Date.now(),
    failureCount: backendFailedChecks,
    error: reason
  })

  const processToStop = backendProcess
  if (processToStop) {
    processToStop.kill()
    backendProcess = null
  }

  backendRestartTimer = setTimeout(() => {
    backendRestartTimer = null
    backendFailedChecks = 0
    backendRestarting = false
    startBackend()
  }, backendRestartDelayMs)
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1.0
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.setZoomFactor(1.0)
    mainWindow?.webContents.setZoomLevel(0)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing
    e.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createOverlayWindow(): void {
  const display = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = display.workAreaSize

  overlayWindow = new BrowserWindow({
    width: 400,
    height: 320,
    x: Math.round((screenWidth - 400) / 2),
    y: screenHeight - 400,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1.0
    }
  })

  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow?.webContents.setZoomFactor(1.0)
    overlayWindow?.webContents.setZoomLevel(0)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/overlay')
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/overlay' })
  }
}

function createTray(): void {
  // Create a simple torch icon using nativeImage
  const trayIcon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADASURBVDiNrZMxDsIwDEV/nBbBzMIFOAYrhytxCMTOwsIROAALEmJhYGBgQKK0cUJSNYD0pci2/v+OYwf+rAqAA3YPuAb2f+EPwAloNYOl8BNQA8fAQ3bRA3f/8FcChsAVcA5sA0tAr4BzYJd0aaBF5hNgGxqBNjYOTTfGnACXwCawAKyEpv3QgLHqy8BFZjkH7IUmjbEjDQiwAqwDi0AfeHnifTzYNpKcA3thZpENwE02d8AhMKLyrE/Af8UL9jdPB+7ZF0YAAAAASUVORK5CYII='
  )

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open TORCH',
      click: (): void => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    {
      label: 'Hey TORCH',
      click: (): void => {
        overlayWindow?.show()
        overlayWindow?.webContents.send('overlay:activate')
      }
    },
    { type: 'separator' },
    {
      label: 'Screen Watch',
      type: 'checkbox',
      checked: false,
      click: (menuItem): void => {
        mainWindow?.webContents.send('screenwatch:toggle', menuItem.checked)
      }
    },
    { type: 'separator' },
    {
      label: 'Quit TORCH',
      click: (): void => {
        mainWindow?.destroy()
        overlayWindow?.destroy()
        app.quit()
      }
    }
  ])

  tray.setToolTip('TORCH — AI Agent')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

// ─── APP LIFECYCLE ───

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.torch.agent')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ─── IPC HANDLERS ───

  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.hide())

  // Overlay controls
  ipcMain.on('overlay:show', () => {
    overlayWindow?.show()
    overlayWindow?.webContents.send('overlay:activate')
  })
  ipcMain.on('overlay:hide', () => {
    overlayWindow?.hide()
  })

  // Open external links
  ipcMain.on('shell:openExternal', (_, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('backend:getHealth', () => backendHealth)

  createMainWindow()
  createOverlayWindow()
  createTray()
  startBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Keep running in tray
})

app.on('before-quit', () => {
  stopBackend()
})

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}
