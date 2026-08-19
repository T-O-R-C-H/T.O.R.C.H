import { useState } from 'react'
import type { EmailDetail, EmailSummary } from '../../types/email'
import { API_BASE } from '../../config/api'
import { SenderAvatar } from './SenderAvatar'
import { formatFullDate, formatTime, sanitizeEmailHtml, stripHtml } from '../../utils/emailFormat'

interface MailResultsProps {
  emails: EmailSummary[]
}

export function MailResults({ emails }: MailResultsProps): JSX.Element {
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const openEmail = async (summary: EmailSummary): Promise<void> => {
    if (openUid === summary.uid) {
      setOpenUid(null)
      setDetail(null)
      setError('')
      return
    }
    setOpenUid(summary.uid)
    setDetail(null)
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/email/read?uid=${encodeURIComponent(summary.uid)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Could not open that message')
      }
      setDetail(await res.json())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mail-results">
      <div className="mail-results__count">
        {emails.length} email{emails.length === 1 ? '' : 's'} found
      </div>
      <div className="mail-results__list">
        {emails.map((email) => {
          const isOpen = openUid === email.uid
          return (
            <div key={email.uid} className={'mail-card' + (isOpen ? ' mail-card--open' : '')}>
              <button
                type="button"
                className="mail-card__row"
                onClick={() => void openEmail(email)}
              >
                <SenderAvatar from={email.from} fromEmail={email.from_email} />
                <span className="mail-card__main">
                  <span className="mail-card__line">
                    <span className="mail-card__from">{email.from}</span>
                    <span className="mail-card__time">{formatTime(email.date)}</span>
                  </span>
                  <span className="mail-card__subject">{email.subject}</span>
                  {!isOpen && email.snippet && (
                    <span className="mail-card__snippet">{email.snippet}</span>
                  )}
                </span>
              </button>

              {isOpen && loading && <div className="mail-card__status">Opening message…</div>}
              {isOpen && error && (
                <div className="mail-card__status mail-card__status--error">{error}</div>
              )}
              {isOpen && detail && !loading && !error && (
                <div className="mail-card__detail">
                  <div className="mail-card__detail-meta">
                    <span className="mail-card__detail-to">To: {detail.to || 'you'}</span>
                    <span className="mail-card__detail-time">{formatFullDate(detail.date)}</span>
                  </div>
                  {detail.html && /<[a-z][\s\S]*>/i.test(detail.html) ? (
                    <div
                      className="mail-card__detail-body mail-card__detail-body--html"
                      dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(detail.html) }}
                    />
                  ) : (
                    <div className="mail-card__detail-body">
                      {detail.text || stripHtml(detail.html || '')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
