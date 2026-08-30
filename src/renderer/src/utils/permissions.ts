export interface Permissions {
  files: boolean
  apps: boolean
  email: boolean
}

/**
 * Merge the backend's capability settings over the current toggle state.
 *
 * The onboarding permissions screen writes all three capabilities when the
 * user presses Continue, so whatever it shows is what gets saved. Seeding
 * those toggles from constants meant re-running onboarding silently switched
 * off a capability the user had already enabled.
 *
 * Only real booleans are taken. A missing or malformed field leaves the
 * toggle alone rather than guessing at `false` - the string "false" is
 * truthy and `null` is falsy, and either one read carelessly is another
 * silent write of the wrong value.
 */
export function permissionsFromSettings(data: unknown, current: Permissions): Permissions {
  const source = (data ?? {}) as Record<string, unknown>
  const take = (key: string, fallback: boolean): boolean =>
    typeof source[key] === 'boolean' ? (source[key] as boolean) : fallback

  return {
    files: take('allow_files', current.files),
    apps: take('allow_apps', current.apps),
    email: take('allow_email', current.email)
  }
}
