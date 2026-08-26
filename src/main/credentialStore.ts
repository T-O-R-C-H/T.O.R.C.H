import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import { join } from 'path'

/**
 * Encrypted storage for API keys and the Gmail app password.
 *
 * These used to sit in plaintext in the repository's .env. They now live in
 * the user's app-data directory, encrypted with the OS keystore (DPAPI on
 * Windows, Keychain on macOS, libsecret on Linux) through Electron's
 * safeStorage.
 *
 * The Python backend needs the plaintext to actually use a credential, and it
 * cannot call safeStorage. So main decrypts at spawn time and passes the
 * values as environment variables, the same route the session token takes.
 * Nothing is written back to .env.
 */

/** Setting name -> environment variable the backend reads it from. */
export const SECRET_ENV_VARS: Record<string, string> = {
  gemini_api_key: 'GEMINI_API_KEY',
  openai_api_key: 'OPENAI_API_KEY',
  anthropic_api_key: 'ANTHROPIC_API_KEY',
  deepseek_api_key: 'DEEPSEEK_API_KEY',
  gmail_app_password: 'GMAIL_APP_PASSWORD'
}

type StoredCredentials = Record<string, string>

let cache: StoredCredentials | null = null

function storePath(): string {
  return join(app.getPath('userData'), 'credentials.enc')
}

export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function readStore(): StoredCredentials {
  if (cache) return cache

  const path = storePath()
  if (!existsSync(path)) {
    cache = {}
    return cache
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, string>
    const decrypted: StoredCredentials = {}
    for (const [key, ciphertext] of Object.entries(raw)) {
      try {
        decrypted[key] = safeStorage.decryptString(Buffer.from(ciphertext, 'base64'))
      } catch {
        // A value encrypted under a different OS user or machine cannot be
        // read back. Drop it rather than failing every other credential.
        console.warn(`[TORCH] Could not decrypt stored credential: ${key}`)
      }
    }
    cache = decrypted
  } catch (error) {
    console.error('[TORCH] Credential store unreadable:', error)
    cache = {}
  }
  return cache
}

function writeStore(values: StoredCredentials): void {
  const encrypted: Record<string, string> = {}
  for (const [key, plaintext] of Object.entries(values)) {
    if (!plaintext) continue
    encrypted[key] = safeStorage.encryptString(plaintext).toString('base64')
  }

  const path = storePath()
  writeFileSync(path, JSON.stringify(encrypted, null, 2), { encoding: 'utf-8', mode: 0o600 })
  try {
    chmodSync(path, 0o600)
  } catch {
    // Best effort; Windows ACLs do not map onto POSIX modes.
  }
  cache = { ...values }
}

/**
 * Save credentials. Refuses rather than silently writing plaintext when the OS
 * keystore is unavailable — a user told their keys are encrypted must not have
 * them stored in the clear instead.
 */
export function setCredentials(updates: Record<string, string>): { ok: boolean; reason?: string } {
  if (!isEncryptionAvailable()) {
    return { ok: false, reason: 'This computer has no secure storage available.' }
  }

  const current = readStore()
  const next = { ...current }
  for (const [key, value] of Object.entries(updates)) {
    if (!(key in SECRET_ENV_VARS)) continue
    // An empty value clears the credential; a blank field in the UI means
    // "unchanged" and is filtered out before reaching here.
    if (value) next[key] = value
    else delete next[key]
  }

  try {
    writeStore(next)
    return { ok: true }
  } catch (error) {
    console.error('[TORCH] Failed to write credential store:', error)
    return { ok: false, reason: 'Could not save to secure storage.' }
  }
}

/** Which credentials are set. Never returns the values themselves. */
export function getCredentialStatus(): Record<string, boolean> {
  const stored = readStore()
  const status: Record<string, boolean> = {}
  for (const key of Object.keys(SECRET_ENV_VARS)) {
    status[key] = Boolean(stored[key])
  }
  return status
}

/** Environment variables for the backend process. */
export function credentialEnv(): Record<string, string> {
  const stored = readStore()
  const env: Record<string, string> = {}
  for (const [key, envVar] of Object.entries(SECRET_ENV_VARS)) {
    if (stored[key]) env[envVar] = stored[key]
  }
  return env
}

/**
 * Move any plaintext secrets out of .env on first run.
 *
 * Returns the keys that were imported so the caller can report it. The .env
 * values are blanked, not deleted, so the file keeps its shape.
 */
export function migratePlaintextSecrets(envPath: string): string[] {
  if (!isEncryptionAvailable() || !existsSync(envPath)) return []

  let contents: string
  try {
    contents = readFileSync(envPath, 'utf-8')
  } catch {
    return []
  }

  const envToSetting = Object.fromEntries(
    Object.entries(SECRET_ENV_VARS).map(([setting, envVar]) => [envVar, setting])
  )

  const found: Record<string, string> = {}
  const lines = contents.split(/\r?\n/)
  const rewritten = lines.map((line) => {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (!match) return line
    const [, envVar, rawValue] = match
    const setting = envToSetting[envVar]
    const value = rawValue.trim()
    if (!setting || !value) return line
    found[setting] = value
    return `${envVar}=`
  })

  if (Object.keys(found).length === 0) return []

  const result = setCredentials(found)
  if (!result.ok) return []

  try {
    writeFileSync(envPath, rewritten.join('\n'), 'utf-8')
  } catch (error) {
    console.error('[TORCH] Imported credentials but could not clear .env:', error)
  }

  return Object.keys(found)
}
