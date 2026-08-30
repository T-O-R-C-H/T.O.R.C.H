import { describe, it, expect } from 'vitest'
import { permissionsFromSettings, type Permissions } from './permissions'

/**
 * The onboarding permissions screen saves all three capabilities on
 * Continue, so its toggles must start from what is actually configured.
 * Twice during development, walking through onboarding switched off an email
 * capability that had already been enabled, because the toggle defaulted to
 * a constant instead of reading the backend.
 */

const DEFAULTS: Permissions = { files: true, apps: true, email: true }

describe('permissionsFromSettings', () => {
  it('takes the configured values over the current toggle state', () => {
    const seeded = permissionsFromSettings(
      { allow_files: false, allow_apps: false, allow_email: false },
      DEFAULTS
    )
    expect(seeded).toEqual({ files: false, apps: false, email: false })
  })

  it('preserves a capability the user had switched off', () => {
    const seeded = permissionsFromSettings(
      { allow_files: true, allow_apps: true, allow_email: false },
      DEFAULTS
    )
    expect(seeded.email).toBe(false)
  })

  it('preserves a capability the user had switched on', () => {
    const seeded = permissionsFromSettings({ allow_email: true }, { ...DEFAULTS, email: false })
    expect(seeded.email).toBe(true)
  })

  it('leaves a toggle alone when its field is missing', () => {
    const seeded = permissionsFromSettings({ allow_files: false }, DEFAULTS)
    expect(seeded).toEqual({ files: false, apps: true, email: true })
  })

  it('ignores non-boolean values rather than reading them as off', () => {
    // "false" is a truthy string and null is falsy; neither may become a
    // silent write of the wrong value.
    const seeded = permissionsFromSettings(
      { allow_files: 'false', allow_apps: null, allow_email: 0 },
      DEFAULTS
    )
    expect(seeded).toEqual(DEFAULTS)
  })

  it('survives a response that is not an object at all', () => {
    expect(permissionsFromSettings(null, DEFAULTS)).toEqual(DEFAULTS)
    expect(permissionsFromSettings(undefined, DEFAULTS)).toEqual(DEFAULTS)
  })
})
