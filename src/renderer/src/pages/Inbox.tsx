import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconInbox as InboxIcon, IconRefresh as RefreshIcon } from '../components/icons'
import { API_BASE, torchFetch } from '../config/api'
import { useTorchStore } from '../store/torchStore'
import type { EmailDetail, EmailSummary } from '../types/email'
import { SenderAvatar } from '../components/mail/SenderAvatar'
import { formatFullDate, formatTime, sanitizeEmailHtml, stripHtml } from '../utils/emailFormat'

const PAGE_SIZE = 50

const SYNC_TIMEOUT_MS = 45000

function friendlyError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError')
    return 'Sync timed out. The mail server was too slow — try again.'
  if (err instanceof TypeError)
    return 'Could not reach the mail server. Check your connection and try again.'
  return err instanceof Error ? err.message : 'Inbox sync failed'
}

export function Inbox(): JSX.Element {
  const navigate = useNavigate()
  const setInboxUnread = useTorchStore((s) => s.setInboxUnread)
  const inboxCache = useTorchStore((s) => s.inboxCache)
  const setInboxCache = useTorchStore((s) => s.setInboxCache)

  const [configured, setConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emails, setEmails] = useState<EmailSummary[]>(inboxCache?.emails ?? [])
  const [total, setTotal] = useState(inboxCache?.total ?? 0)
  const [offset, setOffset] = useState(inboxCache?.offset ?? 0)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<EmailSummary | null>(null)
  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const abortRef = useRef<AbortController | null>(null)

  const stateRef = useRef({ emails, total, offset })
  useEffect(() => {
    stateRef.current = { emails, total, offset }
  }, [emails, total, offset])

  const commit = useCallback(
    (nextEmails: EmailSummary[], nextTotal: number, nextOffset: number): void => {
      setEmails(nextEmails)
      setTotal(nextTotal)
      setOffset(nextOffset)
      setInboxUnread(nextEmails.filter((e) => !e.read).length)
      setInboxCache({
        emails: nextEmails,
        total: nextTotal,
        offset: nextOffset,
        syncedAt: Date.now()
      })
    },
    [setInboxUnread, setInboxCache]
  )

  const loadFirstPage = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
    try {
      const res = await torchFetch(`${API_BASE}/api/email/inbox?limit=${PAGE_SIZE}&offset=0`, {
        signal: controller.signal
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Inbox sync failed')
      }
      const data = await res.json()
      const next = (data.messages || []) as EmailSummary[]
      commit(next, data.total || 0, next.length)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError' || abortRef.current === controller)
        setError(friendlyError(err))
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [commit])

  const loadMore = useCallback(async (): Promise<void> => {
    setSyncing(true)
    setError('')
    const current = stateRef.current
    try {
      const res = await fetch(
        `${API_BASE}/api/email/inbox?limit=${PAGE_SIZE}&offset=${current.offset}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Inbox sync failed')
      }
      const data = await res.json()
      const seen = new Set(current.emails.map((e) => e.uid))
      const added = ((data.messages || []) as EmailSummary[]).filter((e) => !seen.has(e.uid))
      commit(
        [...current.emails, ...added],
        data.total || current.total,
        current.emails.length + added.length
      )
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSyncing(false)
    }
  }, [commit])

  useEffect(() => {
    let active = true
    torchFetch(`${API_BASE}/api/settings`)
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

  const openEmail = useCallback(
    async (summary: EmailSummary): Promise<void> => {
      setSelected(summary)
      setDetail(null)
      setDetailError('')
      setDetailLoading(true)
      try {
        const res = await torchFetch(
          `${API_BASE}/api/email/read?uid=${encodeURIComponent(summary.uid)}`
        )
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Could not open that message')
        }
        const data = await res.json()
        setDetail(data)
        if (!summary.read) {
          void torchFetch(`${API_BASE}/api/email/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: summary.uid, read: true })
          })
          const current = stateRef.current
          const next = current.emails.map((e) => (e.uid === summary.uid ? { ...e, read: true } : e))
          commit(next, current.total, current.offset)
        }
      } catch (err) {
        setDetailError((err as Error).message)
      } finally {
        setDetailLoading(false)
      }
    },
    [commit]
  )

  const toggleRead = useCallback(
    async (read: boolean): Promise<void> => {
      if (!selected) return
      try {
        await torchFetch(`${API_BASE}/api/email/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: selected.uid, read })
        })
      } catch {
        // non-fatal
      }
      setSelected((prev) => (prev ? { ...prev, read } : prev))
      const current = stateRef.current
      const next = current.emails.map((e) => (e.uid === selected.uid ? { ...e, read } : e))
      commit(next, current.total, current.offset)
    },
    [selected, commit]
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
    const hasHtml = Boolean(detail.html && /<[a-z][\s\S]*>/i.test(detail.html))
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
              <div className="inbox-detail__sender">
                <SenderAvatar from={detail.from} fromEmail={detail.from_email} large />
                <div className="inbox-detail__sender-meta">
                  <h2 className="inbox-detail__subject">{detail.subject}</h2>
                  <div className="inbox-detail__meta">
                    <span className="inbox-detail__from">{detail.from}</span>
                    {detail.to && <span className="inbox-detail__to">To: {detail.to}</span>}
                    <span className="inbox-detail__time">{formatFullDate(detail.date)}</span>
                  </div>
                </div>
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
            {hasHtml ? (
              <div
                className="inbox-detail__body inbox-detail__body--html"
                dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(detail.html) }}
              />
            ) : (
              <div className="inbox-detail__body">{bodyText}</div>
            )}
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
          {loading && emails.length > 0 ? 'Syncing…' : 'Sync now'}
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
                  <SenderAvatar from={email.from} fromEmail={email.from_email} />
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
