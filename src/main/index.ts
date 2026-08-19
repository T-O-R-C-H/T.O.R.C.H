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
  session,
  globalShortcut
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
import { loadOverlayState, saveOverlayState } from './overlayPosition'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let guidanceWindow: BrowserWindow | null = null
let controlBorderWindow: BrowserWindow | null = null
let controlBorderDisplayListenersRegistered = false
let tray: Tray | null = null
let backendProcess: ChildProcess | null = null
let backendExternal = false
let backendHealthTimer: NodeJS.Timeout | null = null
let backendRestartTimer: NodeJS.Timeout | null = null
let backendStopping = false
let backendRestarting = false
let backendFailedChecks = 0
let backendStartTime = 0
let isQuitting = false

const backendHealthIntervalMs = Number(process.env['TORCH_BACKEND_HEALTH_INTERVAL_MS'] ?? 10000)
const backendHealthTimeoutMs = Number(process.env['TORCH_BACKEND_HEALTH_TIMEOUT_MS'] ?? 3000)
const backendMaxFailedChecks = Number(process.env['TORCH_BACKEND_MAX_FAILED_CHECKS'] ?? 3)
const backendRestartDelayMs = Number(process.env['TORCH_BACKEND_RESTART_DELAY_MS'] ?? 1000)
const backendStatusUrl = 'http://127.0.0.1:8000/api/status'
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // A second dev launch briefly starts another Chromium process before the
  // primary instance can be activated. Isolate that short-lived cache so it
  // cannot contend with the running app's session directory.
  const secondarySessionPath = join(app.getPath('temp'), `torch-secondary-${process.pid}`)
  app.setPath('sessionData', secondarySessionPath)
  app.commandLine.appendSwitch('disk-cache-dir', join(secondarySessionPath, 'Cache'))
  console.log('[TORCH] TORCH is already running. Activating the existing window.')
  app.exit(0)
}

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

async function isBackendReachable(): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), backendHealthTimeoutMs)

  try {
    const response = await fetch(backendStatusUrl, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function startBackend(): Promise<void> {
  if (backendRestartTimer) {
    clearTimeout(backendRestartTimer)
    backendRestartTimer = null
  }

  if (backendProcess || backendExternal) {
    console.log('[TORCH] Backend already running')
    startBackendHealthMonitor()
    void checkBackendHealth()
    return
  }

  backendStopping = false
  backendStartTime = Date.now()

  const backendAlreadyReachable = await isBackendReachable()
  if (backendStopping || isQuitting) {
    return
  }

  if (backendAlreadyReachable) {
    console.log('[TORCH] Reusing backend already listening at http://127.0.0.1:8000')
    backendExternal = true
    backendFailedChecks = 0
    publishBackendHealth({
      status: 'running',
      lastCheckedAt: Date.now(),
      failureCount: 0,
      error: undefined
    })
    startBackendHealthMonitor()
    return
  }

  backendExternal = false

  // In production, electron-builder places the backend in resources/backend.
  const runtimeRoot = is.dev ? join(__dirname, '..', '..') : process.resourcesPath
  const backendDir = join(runtimeRoot, 'backend')
  const backendVenvPython = join(backendDir, 'venv', 'Scripts', 'python.exe')
  const projectVenvPython = join(runtimeRoot, '.venv', 'Scripts', 'python.exe')
  const pythonExe = existsSync(backendVenvPython)
    ? backendVenvPython
    : is.dev && existsSync(projectVenvPython)
      ? projectVenvPython
      : 'python'

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
  backendExternal = false

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
  if ((!backendProcess && !backendExternal) || backendStopping) {
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), backendHealthTimeoutMs)

  try {
    const response = await fetch(backendStatusUrl, {
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
  backendExternal = false
  if (processToStop) {
    processToStop.kill()
    backendProcess = null
  }

  backendRestartTimer = setTimeout(() => {
    backendRestartTimer = null
    backendFailedChecks = 0
    backendRestarting = false
    void startBackend()
  }, backendRestartDelayMs)
}

let overlaySaveTimer: NodeJS.Timeout | null = null
let overlayCaptureSuspended = false
let overlayWasVisibleBeforeCapture = false
let overlayCaptureRestoreTimer: NodeJS.Timeout | null = null

function getProjectRoot(): string {
  return is.dev ? join(__dirname, '..', '..') : join(app.getAppPath(), '..')
}

function showFloatingOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed() || isQuitting) return
  positionOverlayBottomRight()
  // Chromium can temporarily demote an always-on-top BrowserWindow when a
  // newly launched native application takes the foreground. Reassert the
  // Windows z-order every time TORCH presents its compact command panel.
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.show()
  overlayWindow.moveTop()
  overlayWindow.focus()
  overlayWindow.webContents.send('overlay:activate')
}

function hideFloatingOverlay(): void {
  overlayWindow?.hide()
}

function suspendOverlayForVisionCapture(): void {
  if (overlayCaptureSuspended || !overlayWindow || overlayWindow.isDestroyed()) return
  overlayCaptureSuspended = true
  overlayWasVisibleBeforeCapture = overlayWindow.isVisible()
  if (overlayWasVisibleBeforeCapture) overlayWindow.hide()
  if (overlayCaptureRestoreTimer) clearTimeout(overlayCaptureRestoreTimer)
  // A lost renderer event must never strand the command panel off-screen.
  overlayCaptureRestoreTimer = setTimeout(restoreOverlayAfterVisionCapture, 1500)
}

function restoreOverlayAfterVisionCapture(): void {
  if (overlayCaptureRestoreTimer) {
    clearTimeout(overlayCaptureRestoreTimer)
    overlayCaptureRestoreTimer = null
  }
  if (!overlayCaptureSuspended) return
  overlayCaptureSuspended = false
  if (
    overlayWasVisibleBeforeCapture &&
    overlayWindow &&
    !overlayWindow.isDestroyed() &&
    !isQuitting
  ) {
    overlayWindow.showInactive()
  }
  overlayWasVisibleBeforeCapture = false
}

function completeVisionControl(): void {
  restoreOverlayAfterVisionCapture()
  hideControlBorder()
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    !mainWindow.isVisible() &&
    overlayWindow &&
    !overlayWindow.isDestroyed() &&
    !isQuitting
  ) {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    overlayWindow.showInactive()
    overlayWindow.moveTop()
  }
}

function minimizeToOverlay(): void {
  if (!mainWindow || mainWindow.isDestroyed() || isQuitting) return
  hideGuidanceOverlay()
  mainWindow.hide()
  // Show on the next event-loop turn, after Windows has finished processing
  // the native minimize transition.
  setTimeout(showFloatingOverlay, 0)
}

const OVERLAY_DEFAULT_WIDTH = 360
const OVERLAY_DEFAULT_HEIGHT = 180
const OVERLAY_MIN_WIDTH = 300
const OVERLAY_MIN_HEIGHT = 160

function positionOverlayBottomRight(): void {
  if (!overlayWindow) return

  const saved = loadOverlayState()
  if (saved) {
    if (saved.width && saved.height) {
      overlayWindow.setSize(
        Math.max(OVERLAY_MIN_WIDTH, saved.width),
        Math.max(OVERLAY_MIN_HEIGHT, saved.height)
      )
    }
    const savedBounds = {
      x: saved.x,
      y: saved.y,
      width: saved.width ?? OVERLAY_DEFAULT_WIDTH,
      height: saved.height ?? OVERLAY_DEFAULT_HEIGHT
    }
    const isOnScreen = screen.getAllDisplays().some((display) => {
      const area = display.workArea
      return (
        savedBounds.x < area.x + area.width &&
        savedBounds.x + savedBounds.width > area.x &&
        savedBounds.y < area.y + area.height &&
        savedBounds.y + savedBounds.height > area.y
      )
    })
    if (isOnScreen) {
      overlayWindow.setPosition(saved.x, saved.y)
      return
    }
  }

  const display = screen.getPrimaryDisplay()
  const area = display.workArea
  const [width, height] = overlayWindow.getSize()
  overlayWindow.setPosition(
    Math.round(area.x + area.width - width - 24),
    Math.round(area.y + area.height - height - 24)
  )
}

function hideGuidanceOverlay(): void {
  if (!guidanceWindow || guidanceWindow.isDestroyed()) return
  guidanceWindow.hide()
  guidanceWindow.webContents.send('guidance:clear')
}

function getVirtualDisplayBounds(): { x: number; y: number; width: number; height: number } {
  const displays = screen.getAllDisplays()
  const left = Math.min(...displays.map((display) => display.bounds.x))
  const top = Math.min(...displays.map((display) => display.bounds.y))
  const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width))
  const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height))

  return { x: left, y: top, width: right - left, height: bottom - top }
}

function updateControlBorderBounds(): void {
  if (!controlBorderWindow || controlBorderWindow.isDestroyed()) return
  controlBorderWindow.setBounds(getVirtualDisplayBounds())
}

function registerControlBorderDisplayListeners(): void {
  if (controlBorderDisplayListenersRegistered) return
  controlBorderDisplayListenersRegistered = true

  screen.on('display-added', updateControlBorderBounds)
  screen.on('display-removed', updateControlBorderBounds)
  screen.on('display-metrics-changed', updateControlBorderBounds)
}

function createControlBorderWindow(): void {
  const bounds = getVirtualDisplayBounds()
  controlBorderWindow = new BrowserWindow({
    ...bounds,
    show: false, transparent: true, frame: false, alwaysOnTop: true,
    skipTaskbar: true, focusable: false, hasShadow: false, roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'), sandbox: false,
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
    }
  })
  registerControlBorderDisplayListeners()
  controlBorderWindow.setIgnoreMouseEvents(true, { forward: true })
  controlBorderWindow.setAlwaysOnTop(true, 'screen-saver')
  controlBorderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    controlBorderWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/control-border')
  } else {
    controlBorderWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/control-border' })
  }
}

function showControlBorder(): void {
  if (!controlBorderWindow || controlBorderWindow.isDestroyed()) createControlBorderWindow()
  updateControlBorderBounds()
  controlBorderWindow?.showInactive()
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    !mainWindow.isVisible() &&
    overlayWindow &&
    !overlayWindow.isDestroyed() &&
    overlayWindow.isVisible()
  ) {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
    overlayWindow.moveTop()
  }
}

function hideControlBorder(): void {
  controlBorderWindow?.hide()
}

function quitTorch(): void {
  if (isQuitting) return
  isQuitting = true
  hideGuidanceOverlay()
  hideControlBorder()
  overlayWindow?.hide()
  app.quit()
}

function scheduleOverlayStateSave(): void {
  if (!overlayWindow) return
  if (overlaySaveTimer) clearTimeout(overlaySaveTimer)
  overlaySaveTimer = setTimeout(() => {
    if (!overlayWindow) return
    const [x, y] = overlayWindow.getPosition()
    const [width, height] = overlayWindow.getSize()
    saveOverlayState({ x, y, width, height })
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
    if (!isQuitting) {
      e.preventDefault()
      quitTorch()
    }
  })

  mainWindow.on('hide', () => {
    hideGuidanceOverlay()
    if (!isQuitting) showFloatingOverlay()
  })

  mainWindow.on('minimize', () => {
    setTimeout(() => {
      if (mainWindow?.isMinimized()) mainWindow.restore()
      minimizeToOverlay()
    }, 0)
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
  const saved = loadOverlayState()
  overlayWindow = new BrowserWindow({
    width: saved?.width ?? OVERLAY_DEFAULT_WIDTH,
    height: saved?.height ?? OVERLAY_DEFAULT_HEIGHT,
    minWidth: OVERLAY_MIN_WIDTH,
    minHeight: OVERLAY_MIN_HEIGHT,
    show: false,
    frame: false,
    // Transparent BrowserWindows can remain present but stop painting after a
    // native minimize transition on Windows. The overlay is intentionally a
    // solid TORCH surface, so an opaque window is both safer and equivalent.
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: true,
    hasShadow: true,
    thickFrame: false,
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1.0
    }
  })

  positionOverlayBottomRight()
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  overlayWindow.on('moved', () => {
    scheduleOverlayStateSave()
  })

  overlayWindow.on('resized', () => {
    scheduleOverlayStateSave()
  })

  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow?.webContents.setZoomFactor(1.0)
    overlayWindow?.webContents.setZoomLevel(0)
  })

  overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[TORCH] Overlay failed to load (${errorCode}): ${errorDescription}`)
  })

  overlayWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[TORCH] Overlay renderer exited: ${details.reason}`)
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
    const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 960, height: 960 },
      fetchWindowIcons: false
    })
    const activeSources = sources.filter((source) => source.display_id === String(activeDisplay.id))
    return (activeSources.length > 0 ? activeSources : sources.slice(0, 1)).map((source, index) => {
      const display = displays.find((candidate) => String(candidate.id) === source.display_id) ?? displays[index]
      const thumbnail = source.thumbnail
      const size = thumbnail.getSize()
      return {
        displayId: source.display_id || String(display?.id ?? index),
        width: size.width,
        height: size.height,
        bounds: display?.bounds ?? { x: 0, y: 0, width: size.width, height: size.height },
        dataUrl: thumbnail.toJPEG(68).toString('base64').replace(/^/, 'data:image/jpeg;base64,')
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
        quitTorch()
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
  if (!gotTheLock) return

  electronApp.setAppUserModelId('com.torch.agent')

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ─── GLOBAL SHORTCUTS ───
  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (overlayWindow?.isVisible()) {
        hideFloatingOverlay()
      } else {
        showFloatingOverlay()
        overlayWindow?.webContents.send('overlay:activate')
      }
    })
  } catch (e) {
    console.warn('[TORCH] Could not register global shortcut:', e)
  }

  // ─── IPC HANDLERS ───

  // Window controls
  ipcMain.on('window:minimize', minimizeToOverlay)
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => quitTorch())

  // Overlay controls
  ipcMain.on('overlay:show', () => {
    showFloatingOverlay()
  })
  ipcMain.on('overlay:hide', () => {
    hideFloatingOverlay()
  })
  ipcMain.on('vision-capture:start', () => {
    suspendOverlayForVisionCapture()
  })
  ipcMain.on('vision-capture:end', () => {
    restoreOverlayAfterVisionCapture()
  })
  ipcMain.on('vision-control:complete', () => {
    completeVisionControl()
  })
  ipcMain.on('overlay:openMain', () => {
    mainWindow?.show()
    mainWindow?.focus()
    hideFloatingOverlay()
  })
  ipcMain.on('overlay:setSize', (_, size: { width: number; height: number }) => {
    if (!overlayWindow) return
    const previous = overlayWindow.getBounds()
    const width = Math.max(OVERLAY_MIN_WIDTH, Math.round(size.width))
    const height = Math.max(OVERLAY_MIN_HEIGHT, Math.round(size.height))
    const area = screen.getDisplayMatching(previous).workArea
    const right = previous.x + previous.width
    const bottom = previous.y + previous.height
    const x = Math.min(
      Math.max(area.x, right - width),
      area.x + Math.max(0, area.width - width)
    )
    const y = Math.min(
      Math.max(area.y, bottom - height),
      area.y + Math.max(0, area.height - height)
    )
    overlayWindow.setBounds({ x, y, width, height })
    scheduleOverlayStateSave()
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
  ipcMain.on('control-border:show', () => showControlBorder())
  ipcMain.on('control-border:hide', () => hideControlBorder())
  ipcMain.on('task-event:publish', (ipcEvent, taskEvent: unknown) => {
    if (!taskEvent || typeof taskEvent !== 'object' || Array.isArray(taskEvent)) return

    const eventType = (taskEvent as { type?: unknown }).type
    const relayedEventTypes = new Set([
      'agent_response',
      'content_delta',
      'content_done',
      'step_update',
      'status',
      'vision_control_start',
      'vision_control_end',
      'vision_capture_start',
      'vision_capture_end',
      'hitl_request',
      'clarification_request',
      'clarification_result',
      'approval_result',
      'terminal',
      'overlay',
      'metrics',
      'task_completed_metadata',
      'undo_result'
    ])
    if (typeof eventType !== 'string' || !relayedEventTypes.has(eventType)) return

    for (const target of [mainWindow, overlayWindow]) {
      if (target && !target.isDestroyed() && target.webContents.id !== ipcEvent.sender.id) {
        target.webContents.send('task-event:update', taskEvent)
      }
    }
  })
  ipcMain.on('task-command:publish', (ipcEvent, command: unknown) => {
    if (!command || typeof command !== 'object') return
    const taskCommand = command as { type?: unknown; taskId?: unknown; response?: unknown }
    const validStop = taskCommand.type === 'stop_task'
    const validClarification =
      taskCommand.type === 'clarification_response' &&
      typeof taskCommand.taskId === 'string' &&
      typeof taskCommand.response === 'string'
    if (!validStop && !validClarification) return
    for (const target of [mainWindow, overlayWindow]) {
      if (target && !target.isDestroyed() && target.webContents.id !== ipcEvent.sender.id) {
        target.webContents.send('task-command:update', taskCommand)
      }
    }
  })

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
  createControlBorderWindow()
  createTray()
  void startBackend()
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
  hideControlBorder()
  isQuitting = true
  guidanceWindow?.setIgnoreMouseEvents(true, { forward: true })
  guidanceWindow?.hide()
  overlayWindow?.hide()
  stopClipboardMonitor()
  stopBackend()
})

if (gotTheLock) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      hideFloatingOverlay()
    }
  })
}
