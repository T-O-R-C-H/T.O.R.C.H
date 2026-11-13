/**
 * Theme selection.
 *
 * Three choices, because "follow my computer" is what most people want and
 * should not need a decision: System tracks the OS setting live, Light and
 * Dark pin one. The choice is stored per machine in localStorage and applied
 * as `data-theme` on <html>, which is the only thing the stylesheets key on.
 *
 * index.html applies the stored theme with an inline script before the bundle
 * loads, so a dark-theme user never sees a white flash on launch. That script
 * and `resolveTheme` must agree - if you change the key or the fallback here,
 * change it there too.
 */

export type ThemeChoice = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'torch_theme'

const listeners = new Set<(choice: ThemeChoice) => void>()

function systemPrefersDark(): boolean {
  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
}

export function getThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Storage can be unavailable in a locked-down window; fall through.
  }
  return 'system'
}

export function resolveTheme(
  choice: ThemeChoice,
  prefersDark = systemPrefersDark()
): ResolvedTheme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light'
  return choice
}

export function applyTheme(choice: ThemeChoice = getThemeChoice()): ResolvedTheme {
  const resolved = resolveTheme(choice)
  document.documentElement.dataset.theme = resolved
  return resolved
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Still apply for this session even if it cannot be remembered.
  }
  applyTheme(choice)
  listeners.forEach((listener) => listener(choice))
}

export function onThemeChoiceChange(listener: (choice: ThemeChoice) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Keep the theme in step with the OS and with the app's other windows.
 *
 * Every TORCH window (main, pill, task panel, companion) is its own renderer,
 * so a change made in Settings reaches the others through the `storage`
 * event rather than through shared state.
 */
export function startThemeSync(): () => void {
  applyTheme()

  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onSystemChange = (): void => {
    if (getThemeChoice() === 'system') applyTheme('system')
  }
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== THEME_STORAGE_KEY) return
    const choice = getThemeChoice()
    applyTheme(choice)
    listeners.forEach((listener) => listener(choice))
  }

  media?.addEventListener?.('change', onSystemChange)
  window.addEventListener('storage', onStorage)
  return () => {
    media?.removeEventListener?.('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  }
}
