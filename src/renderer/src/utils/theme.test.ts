// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getThemeChoice,
  onThemeChoiceChange,
  resolveTheme,
  setThemeChoice
} from './theme'

function mockSystem(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  )
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('follows the system until the user chooses', () => {
    expect(getThemeChoice()).toBe('system')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('an explicit choice wins over the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('ignores a stored value it does not recognise', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'solarized')
    expect(getThemeChoice()).toBe('system')
  })

  it('applies the resolved theme to the document', () => {
    mockSystem(true)
    expect(applyTheme('system')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(applyTheme('light')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('remembers the choice and tells listeners', () => {
    mockSystem(false)
    const listener = vi.fn()
    const stop = onThemeChoiceChange(listener)
    setThemeChoice('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(listener).toHaveBeenCalledWith('dark')
    stop()
    setThemeChoice('light')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
