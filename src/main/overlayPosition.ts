import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface OverlayState {
  x: number
  y: number
  width?: number
  height?: number
}

function storePath(): string {
  const dir = app.getPath('userData')
  return join(dir, 'overlay-position.json')
}

export function loadOverlayState(): OverlayState | null {
  try {
    const path = storePath()
    if (!existsSync(path)) return null
    const data = JSON.parse(readFileSync(path, 'utf-8')) as OverlayState
    if (typeof data.x === 'number' && typeof data.y === 'number') return data
    return null
  } catch {
    return null
  }
}

export function saveOverlayState(state: OverlayState): void {
  try {
    const path = storePath()
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(path, JSON.stringify(state), 'utf-8')
  } catch {
    // ignore persistence errors
  }
}

/** @deprecated use loadOverlayState */
export const loadOverlayPosition = loadOverlayState

/** @deprecated use saveOverlayState */
export function saveOverlayPosition(pos: { x: number; y: number }): void {
  saveOverlayState(pos)
}
