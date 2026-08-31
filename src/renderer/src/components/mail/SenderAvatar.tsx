import { useMemo, useState } from 'react'
import { domainFromEmail, initialsOf } from '../../utils/emailFormat'

export function SenderAvatar({
  from,
  fromEmail,
  large
}: {
  from: string
  fromEmail?: string
  large?: boolean
}): JSX.Element {
  const [failed, setFailed] = useState(false)
  const domain = useMemo(() => domainFromEmail(fromEmail), [fromEmail])
  const cls = 'inbox-avatar' + (large ? ' inbox-avatar--lg' : '')
  if (!domain || failed) {
    return <span className={cls}>{initialsOf(from)}</span>
  }
  return (
    <span className={cls + ' inbox-avatar--img'}>
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  )
}
