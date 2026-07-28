import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface OverlayPosition {
  x: number
  y: number
}

function storePath(): string {
  const dir = app.getPath('userData')
  return join(dir, 'overlay-position.json')
}

export function loadOverlayPosition(): OverlayPosition | null {
  try {
    const path = storePath()
    if (!existsSync(path)) return null
    const data = JSON.parse(readFileSync(path, 'utf-8')) as OverlayPosition
    if (typeof data.x === 'number' && typeof data.y === 'number') return data
    return null
  } catch {
    return null
  }
}

export function saveOverlayPosition(pos: OverlayPosition): void {
  try {
    const path = storePath()
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(path, JSON.stringify(pos), 'utf-8')
  } catch {
    // ignore persistence errors
  }
}
