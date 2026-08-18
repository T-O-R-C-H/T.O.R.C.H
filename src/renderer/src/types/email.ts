export interface EmailSummary {
  uid: string
  subject: string
  from: string
  date: string
  snippet: string
  read: boolean
}

export interface EmailDetail {
  uid: string
  subject: string
  from: string
  to: string
  date: string
  text: string
  html: string
}

export interface InboxCache {
  emails: EmailSummary[]
  total: number
  offset: number
  syncedAt: number
}
