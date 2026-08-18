import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconInbox as InboxIcon, IconRefresh as RefreshIcon } from '../components/icons'
import { API_BASE } from '../config/api'
import { useTorchStore } from '../store/torchStore'

interface EmailSummary {
  uid: string
  subject: string
  from: string
  date: string
  snippet: string
  read: boolean
}

interface EmailDetail {
  uid: string
  subject: string
  from: string
  to: string
  date: string
  text: string
  html: string
}

const PAGE_SIZE = 50

const SYNC_TIMEOUT_MS = 45000

function friendlyError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError')
    return 'Sync timed out. The mail server was too slow — try again.'
  if (err instanceof TypeError)
    return 'Could not reach the mail server. Check your connection and try again.'
  return err instanceof Error ? err.message : 'Inbox sync failed'
}

function formatTime(raw: string): string {
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function stripHtml(html: string): string {
  const doc = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  const text = doc
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function Inbox(): JSX.Element {
  const navigate = useNavigate()
  const setInboxUnread = useTorchStore((s) => s.setInboxUnread)

  const [configured, setConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<EmailSummary | null>(null)
  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const abortRef = useRef<AbortController | null>(null)

  const loadFirstPage = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
    try {
      const res = await fetch(`${API_BASE}/api/email/inbox?limit=${PAGE_SIZE}&offset=0`, {
        signal: controller.signal
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Inbox sync failed')
      }
      const data = await res.json()
      setEmails(data.messages || [])
      setTotal(data.total || 0)
      setOffset(data.messages?.length || 0)
      setInboxUnread((data.messages || []).filter((e: EmailSummary) => !e.read).length)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError' || abortRef.current === controller)
        setError(friendlyError(err))
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [setInboxUnread])

  const loadMore = useCallback(async (): Promise<void> => {
    setSyncing(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/email/inbox?limit=${PAGE_SIZE}&offset=${offset}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Inbox sync failed')
      }
      const data = await res.json()
      setEmails((prev) => {
        const seen = new Set(prev.map((e) => e.uid))
        return [...prev, ...(data.messages || []).filter((e: EmailSummary) => !seen.has(e.uid))]
      })
      setOffset(offset + (data.messages?.length || 0))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSyncing(false)
    }
  }, [offset])

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (active) setConfigured(Boolean(data.gmail_configured))
      })
      .catch(() => {
        if (active) setConfigured(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (configured !== true) return
    const timer = window.setTimeout(() => void loadFirstPage(), 0)
    return () => window.clearTimeout(timer)
  }, [configured, loadFirstPage])

  useEffect(() => {
    if (configured !== true) return
    const timer = window.setInterval(() => void loadFirstPage(), 60000)
    return () => window.clearInterval(timer)
  }, [configured, loadFirstPage])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const openEmail = useCallback(async (summary: EmailSummary): Promise<void> => {
    setSelected(summary)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/email/read?uid=${encodeURIComponent(summary.uid)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Could not open that message')
      }
      const data = await res.json()
      setDetail(data)
      if (!summary.read) {
        void fetch(`${API_BASE}/api/email/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: summary.uid, read: true })
        })
        setEmails((prev) => prev.map((e) => (e.uid === summary.uid ? { ...e, read: true } : e)))
      }
    } catch (err) {
      setDetailError((err as Error).message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const toggleRead = useCallback(
    async (read: boolean): Promise<void> => {
      if (!selected) return
      try {
        await fetch(`${API_BASE}/api/email/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: selected.uid, read })
        })
      } catch {
        // non-fatal
      }
      setSelected((prev) => (prev ? { ...prev, read } : prev))
      setEmails((prev) => prev.map((e) => (e.uid === selected.uid ? { ...e, read } : e)))
    },
    [selected]
  )

  const backToList = useCallback((): void => {
    setSelected(null)
    setDetail(null)
    setDetailError('')
  }, [])

  if (configured === null) {
    return (
      <div className="page-shell page-enter">
        <div className="page-shell__body flex items-center justify-center h-full">
          <div className="inbox-empty">Checking email connection…</div>
        </div>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="page-shell page-enter">
        <div className="page-shell__body flex flex-col items-center justify-center text-center p-8 max-w-lg mx-auto h-full">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-full mb-6"
            style={{
              background: 'var(--color-torch-bg-secondary, rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--color-torch-border, rgba(255, 255, 255, 0.08))'
            }}
          >
            <InboxIcon size={24} className="text-[var(--color-torch-text-secondary)]" />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-torch-text)' }}>
            Inbox
          </h1>
          <p
            className="text-sm mb-8"
            style={{ color: 'var(--color-torch-text-secondary)', lineHeight: 1.5 }}
          >
            Connect Gmail to sync your inbox here. Add your Gmail address and an App Password in
            Settings — no spaces needed in the password.
          </p>

          <div className="flex gap-4">
            <button type="button" className="btn-primary" onClick={() => navigate('/settings')}>
              Configure Email Settings
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
              Go to Command Center
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (selected && detailLoading) {
    return (
      <div className="page-shell page-enter">
        <div className="page-shell__body flex items-center justify-center h-full">
          <div className="inbox-empty">Opening message…</div>
        </div>
      </div>
    )
  }

  if (selected && detailError) {
    return (
      <div className="page-shell page-enter">
        <div className="page-shell__body flex items-center justify-center h-full">
          <div className="inbox-empty">
            <p>{detailError}</p>
            <button type="button" className="btn-secondary text-[12px]" onClick={backToList}>
              ← Back to inbox
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (selected && detail) {
    const bodyText = detail.text || stripHtml(detail.html)
    return (
      <div className="page-shell page-enter">
        <div className="page-shell__header">
          <div className="page-shell__title">Inbox</div>
          <button type="button" className="btn-secondary text-[11px]" onClick={backToList}>
            ← Back to inbox
          </button>
        </div>
        <div className="page-shell__body">
          <article className="inbox-detail">
            <header className="inbox-detail__header">
              <h2 className="inbox-detail__subject">{detail.subject}</h2>
              <div className="inbox-detail__meta">
                <span>
                  <strong>{detail.from}</strong>
                  {detail.to ? ` → ${detail.to}` : ''}
                </span>
                <span className="inbox-detail__time">{formatTime(detail.date)}</span>
              </div>
              <div className="inbox-detail__actions">
                <button
                  type="button"
                  className="btn-secondary text-[11px]"
                  onClick={() => void toggleRead(!selected.read)}
                >
                  {selected.read ? 'Mark unread' : 'Mark read'}
                </button>
              </div>
            </header>
            <div className="inbox-detail__body">{bodyText}</div>
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell page-enter">
      <div className="page-shell__header">
        <div className="page-shell__title">Inbox</div>
        <button
          type="button"
          className="btn-secondary text-[11px] inline-flex items-center gap-1.5"
          onClick={() => void loadFirstPage()}
          disabled={loading}
        >
          <RefreshIcon size={12} className={loading ? 'inbox-spin' : ''} />
          Sync now
        </button>
      </div>
      <div className="page-shell__body">
        {error && (
          <div className="inbox-error">
            {error}
            <button
              type="button"
              className="inbox-error__retry"
              onClick={() => void loadFirstPage()}
            >
              Retry
            </button>
          </div>
        )}

        {!error && loading && emails.length === 0 && (
          <div className="inbox-empty">Syncing your inbox…</div>
        )}

        {!error && !loading && emails.length === 0 && (
          <div className="inbox-empty">
            <p>Your inbox is empty.</p>
          </div>
        )}

        {emails.length > 0 && (
          <>
            <div className="inbox-list">
              {emails.map((email) => (
                <button
                  key={email.uid}
                  type="button"
                  className={'inbox-item' + (email.read ? '' : ' inbox-item--unread')}
                  onClick={() => void openEmail(email)}
                >
                  <span className="inbox-item__dot" />
                  <span className="inbox-item__content">
                    <span className="inbox-item__row">
                      <span className="inbox-item__from">{email.from}</span>
                      <span className="inbox-item__time">{formatTime(email.date)}</span>
                    </span>
                    <span className="inbox-item__subject">{email.subject}</span>
                    {email.snippet && <span className="inbox-item__snippet">{email.snippet}</span>}
                  </span>
                </button>
              ))}
            </div>

            {emails.length < total && (
              <div className="inbox-load">
                <button
                  type="button"
                  className="btn-secondary text-[12px]"
                  onClick={() => void loadMore()}
                  disabled={syncing}
                >
                  {syncing ? 'Loading…' : `Load more (${emails.length} of ${total})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
