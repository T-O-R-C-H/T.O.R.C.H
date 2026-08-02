import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  clipboard,
  desktopCapturer,
  session
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import {
  startClipboardMonitor,
  stopClipboardMonitor,
  getClipboardEntries,
  copyToClipboard
} from './clipboardManager'
import { getDesktopContext } from './contextService'
import { loadOverlayPosition, saveOverlayPosition } from './overlayPosition'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let guidanceWindow: BrowserWindow | null = null
let tray: Tray | null = null
let backendProcess: ChildProcess | null = null
let backendHealthTimer: NodeJS.Timeout | null = null
let backendRestartTimer: NodeJS.Timeout | null = null
let backendStopping = false
let backendRestarting = false
let backendFailedChecks = 0
let backendStartTime = 0

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
  backendStartTime = Date.now()

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
    console.error(
      `[TORCH] Backend health check failed (${backendFailedChecks}/${backendMaxFailedChecks}): ${message}`
    )

    publishBackendHealth({
      status: 'unhealthy',
      lastCheckedAt: Date.now(),
      failureCount: backendFailedChecks,
      error: message
    })

    if (backendFailedChecks >= backendMaxFailedChecks) {
      const startupGracePeriodMs = 60000 // 60s grace period for cold start
      const isStillStarting =
        backendHealth.status === 'starting' && Date.now() - backendStartTime < startupGracePeriodMs
      if (isStillStarting) {
        console.log(
          `[TORCH] Backend is still starting (elapsed: ${Math.round((Date.now() - backendStartTime) / 1000)}s). Skipping restart.`
        )
      } else {
        console.log(`[TORCH] Max failed checks reached. Restarting backend...`)
        scheduleBackendRestart(message)
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}

function scheduleBackendRestart(reason: string): void {
  if (backendRestarting || backendStopping) {
    return
  }

  console.log(`[TORCH] Scheduling backend restart. Reason: ${reason}`)
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

let overlaySaveTimer: NodeJS.Timeout | null = null

function getProjectRoot(): string {
  return is.dev ? join(__dirname, '..', '..') : join(app.getAppPath(), '..')
}

function showFloatingOverlay(): void {
  if (!overlayWindow) return
  overlayWindow.showInactive()
  overlayWindow.webContents.send('overlay:activate')
}

function hideFloatingOverlay(): void {
  overlayWindow?.hide()
}

function positionOverlayBottomRight(): void {
  if (!overlayWindow) return

  const saved = loadOverlayPosition()
  if (saved) {
    overlayWindow.setPosition(saved.x, saved.y)
    return
  }

  const display = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = display.workAreaSize
  const [width, height] = overlayWindow.getSize()
  overlayWindow.setPosition(Math.round(screenWidth - width - 24), Math.round(screenHeight - height - 24))
}

function scheduleOverlayPositionSave(): void {
  if (!overlayWindow) return
  if (overlaySaveTimer) clearTimeout(overlaySaveTimer)
  overlaySaveTimer = setTimeout(() => {
    if (!overlayWindow) return
    const [x, y] = overlayWindow.getPosition()
    saveOverlayPosition({ x, y })
  }, 300)
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

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Electron] Main window failed to load:', errorCode, errorDescription)
  })

  mainWindow.on('ready-to-show', () => {
    console.log('[Electron] ready-to-show event fired! Showing main window.')
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing
    e.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('hide', () => {
    showFloatingOverlay()
  })

  mainWindow.on('minimize', () => {
    mainWindow?.hide()
  })

  mainWindow.on('show', () => {
    hideFloatingOverlay()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createOverlayWindow(): void {
  overlayWindow = new BrowserWindow({
    width: 380,
    height: 520,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1.0
    }
  })

  positionOverlayBottomRight()

  overlayWindow.on('moved', () => {
    scheduleOverlayPositionSave()
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

function createGuidanceWindow(): void {
  const displays = screen.getAllDisplays()
  const left = Math.min(...displays.map((display) => display.bounds.x))
  const top = Math.min(...displays.map((display) => display.bounds.y))
  const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width))
  const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height))

  guidanceWindow = new BrowserWindow({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  guidanceWindow.setIgnoreMouseEvents(true, { forward: true })
  guidanceWindow.setAlwaysOnTop(true, 'screen-saver')
  guidanceWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    guidanceWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/guide')
  } else {
    guidanceWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/guide' })
  }
}

async function captureDesktopScreens(): Promise<unknown[]> {
  const overlayWasVisible = overlayWindow?.isVisible() ?? false
  overlayWindow?.hide()
  await new Promise((resolve) => setTimeout(resolve, 90))

  try {
    const displays = screen.getAllDisplays()
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 1280 },
      fetchWindowIcons: false
    })
    return sources.map((source, index) => {
      const display = displays.find((candidate) => String(candidate.id) === source.display_id) ?? displays[index]
      const thumbnail = source.thumbnail
      const size = thumbnail.getSize()
      return {
        displayId: source.display_id || String(display?.id ?? index),
        width: size.width,
        height: size.height,
        bounds: display?.bounds ?? { x: 0, y: 0, width: size.width, height: size.height },
        dataUrl: thumbnail.toJPEG(82).toString('base64').replace(/^/, 'data:image/jpeg;base64,')
      }
    })
  } finally {
    if (overlayWasVisible) overlayWindow?.showInactive()
  }
}

function createTray(): void {
  const logoPath = join(getProjectRoot(), 'resources', 'logo.png')
  const trayIcon = existsSync(logoPath)
    ? nativeImage.createFromPath(logoPath)
    : nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADASURBVDiNrZMxDsIwDEV/nBbBzMIFOAYrhytxCMTOwsIROAALEmJhYGBgQKK0cUJSNYD0pci2/v+OYwf+rAqAA3YPuAb2f+EPwAloNYOl8BNQA8fAQ3bRA3f/8FcChsAVcA5sA0tAr4BzYJd0aaBF5hNgGxqBNjYOTTfGnACXwCawAKyEpv3QgLHqy8BFZjkH7IUmjbEjDQiwAqwDi0AfeHnifTzYNpKcA3thZpENwE02d8AhMKLyrE/Af8UL9jdPB+7ZF0YAAAAASUVORK5CYII='
      )

  tray = new Tray(trayIcon.resize({ width: 18, height: 18 }))

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
        showFloatingOverlay()
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
        guidanceWindow?.destroy()
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
      hideFloatingOverlay()
    }
  })
}

// ─── APP LIFECYCLE ───

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.torch.agent')

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

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
    showFloatingOverlay()
  })
  ipcMain.on('overlay:hide', () => {
    hideFloatingOverlay()
  })
  ipcMain.on('overlay:openMain', () => {
    mainWindow?.show()
    mainWindow?.focus()
    hideFloatingOverlay()
  })
  ipcMain.handle('companion:captureScreens', captureDesktopScreens)
  ipcMain.on('guidance:show', (_, guidance) => {
    if (!guidanceWindow || guidanceWindow.isDestroyed()) createGuidanceWindow()
    const displays = screen.getAllDisplays()
    const left = Math.min(...displays.map((display) => display.bounds.x))
    const top = Math.min(...displays.map((display) => display.bounds.y))
    const overlayBounds = overlayWindow?.getBounds()
    const homeX = overlayBounds ? overlayBounds.x + overlayBounds.width / 2 : left + 80
    const homeY = overlayBounds ? overlayBounds.y + overlayBounds.height / 2 : top + 80
    guidanceWindow?.showInactive()
    guidanceWindow?.webContents.send('guidance:update', {
      ...guidance,
      x: Number(guidance.x) - left,
      y: Number(guidance.y) - top,
      homeX: homeX - left,
      homeY: homeY - top
    })
  })
  ipcMain.on('guidance:hide', () => guidanceWindow?.hide())

  ipcMain.handle('context:getDesktop', () => {
    const clipboardText = clipboard.readText() || ''
    return getDesktopContext(clipboardText)
  })

  // Open external links
  ipcMain.on('shell:openExternal', (_, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('backend:getHealth', () => backendHealth)

  ipcMain.handle('clipboard:list', () => getClipboardEntries())
  ipcMain.on('clipboard:copy', (_, text: string) => copyToClipboard(text))

  createMainWindow()
  createOverlayWindow()
  createGuidanceWindow()
  createTray()
  startBackend()
  startClipboardMonitor()

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
  stopClipboardMonitor()
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
