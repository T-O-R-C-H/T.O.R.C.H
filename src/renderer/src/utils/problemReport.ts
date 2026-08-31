import type { Message, Step } from '../store/torchStore'

/**
 * Building a problem report.
 *
 * TORCH collects nothing on its own. This exists so a user who hits a problem
 * can hand over something useful without us reaching into their machine: the
 * report is assembled here, shown to them in full, and only becomes a GitHub
 * issue if they choose to open it.
 *
 * What goes in is kept narrow on purpose — the command, what the steps did,
 * the error, and two version strings. Step results are excluded: a result can
 * be a directory listing, the contents of a document, or the body of an
 * email, and none of that belongs in a public issue tracker.
 */

export const GITHUB_ISSUE_URL = 'https://github.com/T-O-R-C-H/T.O.R.C.H/issues/new'

/** GitHub rejects very long URLs; keep well inside what browsers accept. */
export const MAX_REPORT_CHARS = 6000

export interface ReportInfo {
  appVersion: string
  electron: string
  os: string
}

export interface ProblemReport {
  title: string
  body: string
}

function describeStep(step: Step, index: number): string {
  const status = step.status === 'done' ? 'ok' : step.status
  const line = `${index + 1}. ${step.label || step.tool} — ${status}`
  // The error is the useful part; the result is the user's own data.
  return step.error ? `${line}\n   error: ${step.error}` : line
}

/**
 * A one-line title that says something without leaking the whole command.
 *
 * Truncated rather than omitted: an issue list of identical titles helps
 * nobody, and the full command is in the body the user has already read.
 */
export function reportTitle(command: string): string {
  const flat = (command || '').replace(/\s+/g, ' ').trim()
  if (!flat) return 'Problem with a task'
  const short = flat.length > 60 ? `${flat.slice(0, 60).trimEnd()}…` : flat
  return `Problem with: ${short}`
}

export function buildProblemReport(
  userMessage: Message | null,
  agentMessage: Message | null,
  info: ReportInfo | null
): ProblemReport {
  const rawCommand = userMessage?.content?.trim() || ''
  // The placeholder belongs in the body, not the title: an issue list full of
  // "Problem with: (not recorded)" is worse than a generic title.
  const command = rawCommand || '(not recorded)'
  const steps = agentMessage?.steps ?? []
  const failed = steps.filter((s) => s.status === 'failed')

  const lines: string[] = [
    '**What I asked TORCH to do**',
    '',
    command,
    '',
    '**What happened**',
    '',
    agentMessage?.content?.trim() || '(no reply was shown)',
    ''
  ]

  if (steps.length > 0) {
    lines.push('**Steps**', '', ...steps.map(describeStep), '')
  }

  if (failed.length === 0 && steps.length > 0) {
    // Worth stating: plenty of reports are "it finished but did the wrong
    // thing", and a maintainer reading only the step list would miss that.
    lines.push('No step reported an error.', '')
  }

  lines.push(
    '**Version**',
    '',
    `TORCH ${info?.appVersion ?? 'unknown'} · Electron ${info?.electron ?? 'unknown'}`,
    `${info?.os ?? 'unknown OS'}`,
    '',
    '---',
    '',
    '_Sent from TORCH. Nothing was sent automatically — I reviewed this first._'
  )

  let body = lines.join('\n')
  if (body.length > MAX_REPORT_CHARS) {
    body = `${body.slice(0, MAX_REPORT_CHARS)}\n\n_(report truncated)_`
  }

  return { title: reportTitle(rawCommand), body }
}

/** The pre-filled issue URL. */
export function issueUrl(report: ProblemReport): string {
  const params = new URLSearchParams({
    title: report.title,
    body: report.body,
    labels: 'from-app'
  })
  return `${GITHUB_ISSUE_URL}?${params.toString()}`
}
