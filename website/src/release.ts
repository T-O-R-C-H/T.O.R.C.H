import { useEffect, useState } from 'react'

export const REPO = 'T-O-R-C-H/T.O.R.C.H'
export const GITHUB_URL = `https://github.com/${REPO}`
export const RELEASES_URL = `${GITHUB_URL}/releases`
/**
 * The newest installer, as a file. electron-builder names it TORCH-Setup.exe
 * on every release (electron-builder.yml), so this one address always
 * downloads the latest version with no API call.
 */
export const INSTALLER_NAME = 'TORCH-Setup.exe'
export const DOWNLOAD_URL = `${GITHUB_URL}/releases/latest/download/${INSTALLER_NAME}`

export type Release =
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'ready'; version: string; url: string; sizeMb: number; date: string; notesUrl: string }

const CACHE_KEY = 'torch-release-v1'

function readCache(): Release | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Release) : null
  } catch {
    return null
  }
}

function writeCache(release: Release): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(release))
  } catch {
    /* private mode: fine, we just ask GitHub again next time */
  }
}

let inflight: Promise<Release> | null = null

/** The newest published Windows installer on GitHub Releases, if there is one. */
async function fetchRelease(): Promise<Release> {
  // The list, not /releases/latest: with no release yet, the list is simply
  // empty, where /latest answers 404 and leaves an error in the console.
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) return { state: 'none' }
  const list = (await response.json()) as {
    tag_name: string
    html_url: string
    published_at: string
    draft: boolean
    prerelease: boolean
    assets: { name: string; browser_download_url: string; size: number }[]
  }[]
  const exe = (r: (typeof list)[number]): (typeof list)[number]['assets'][number] | undefined =>
    r.assets.find((a) => /setup.*\.exe$/i.test(a.name)) ?? r.assets.find((a) => a.name.endsWith('.exe'))
  const data = list.find((r) => !r.draft && !r.prerelease && exe(r))
  const installer = data && exe(data)
  if (!data || !installer) return { state: 'none' }
  return {
    state: 'ready',
    version: data.tag_name.replace(/^v/, ''),
    url: installer.browser_download_url,
    sizeMb: Math.round(installer.size / 1024 / 1024),
    date: new Date(data.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    notesUrl: data.html_url
  }
}

export function useRelease(): Release {
  const [release, setRelease] = useState<Release>(() => readCache() ?? { state: 'loading' })
  useEffect(() => {
    if (release.state !== 'loading') return
    inflight ??= fetchRelease().catch((): Release => ({ state: 'none' }))
    let alive = true
    void inflight.then((result) => {
      writeCache(result)
      if (alive) setRelease(result)
    })
    return () => {
      alive = false
    }
  }, [release.state])
  return release
}
