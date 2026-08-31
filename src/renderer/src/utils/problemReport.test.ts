import { describe, it, expect } from 'vitest'
import {
  buildProblemReport,
  reportTitle,
  issueUrl,
  MAX_REPORT_CHARS,
  type ReportInfo
} from './problemReport'
import type { Message, Step } from '../store/torchStore'

/**
 * What a problem report may and may not contain.
 *
 * The report becomes a public GitHub issue, so the rule is narrower than
 * "useful": the command and the step outcomes go in, and the user's own data
 * does not. A step result can be a directory listing, a document's contents,
 * or the body of an email.
 */

const INFO: ReportInfo = {
  appVersion: '1.0.0',
  electron: '39.0.0',
  os: 'Windows_NT 10.0.26200 (x64)'
}

function step(overrides: Partial<Step> = {}): Step {
  return {
    id: 's1',
    label: 'Looking for your file',
    tool: 'find_file',
    args: {},
    status: 'done',
    requiresApproval: false,
    ...overrides
  } as Step
}

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    role: 'torch',
    content: 'That did not work.',
    timestamp: Date.now(),
    ...overrides
  } as Message
}

describe('reportTitle', () => {
  it('names the task so an issue list is readable', () => {
    expect(reportTitle('open notepad')).toBe('Problem with: open notepad')
  })

  it('shortens a long command rather than dropping it', () => {
    const title = reportTitle('x'.repeat(200))
    expect(title.length).toBeLessThan(90)
    expect(title.endsWith('…')).toBe(true)
  })

  it('still produces a title with no command', () => {
    expect(reportTitle('')).toBe('Problem with a task')
  })

  it('flattens newlines out of the title', () => {
    expect(reportTitle('find my\n\nfile')).toBe('Problem with: find my file')
  })
})

describe('buildProblemReport', () => {
  const user = message({ role: 'user', content: 'find my invoice' })

  it('includes the command and what TORCH said back', () => {
    const report = buildProblemReport(user, message(), INFO)

    expect(report.body).toContain('find my invoice')
    expect(report.body).toContain('That did not work.')
  })

  it('includes the version and OS a maintainer needs', () => {
    const report = buildProblemReport(user, message(), INFO)

    expect(report.body).toContain('1.0.0')
    expect(report.body).toContain('39.0.0')
    expect(report.body).toContain('Windows_NT 10.0.26200')
  })

  it('lists each step and its outcome', () => {
    const report = buildProblemReport(
      user,
      message({ steps: [step(), step({ id: 's2', label: 'Sending', status: 'failed' })] }),
      INFO
    )

    expect(report.body).toContain('Looking for your file — ok')
    expect(report.body).toContain('Sending — failed')
  })

  it('includes a step error, which is the useful part', () => {
    const report = buildProblemReport(
      user,
      message({ steps: [step({ status: 'failed', error: 'That folder does not exist.' })] }),
      INFO
    )

    expect(report.body).toContain('That folder does not exist.')
  })

  it('never includes a step result', () => {
    // Results carry the user's own data — a listing of their home folder, the
    // text of a document, the body of an email.
    const secret = 'CONFIDENTIAL-Q3-SALARY-REVIEW.xlsx'
    const report = buildProblemReport(
      user,
      message({ steps: [step({ result: `Found 1 file: ${secret}` })] }),
      INFO
    )

    expect(report.body).not.toContain(secret)
  })

  it('says so when nothing reported an error', () => {
    // "It finished but did the wrong thing" is a real report, and a step list
    // of all-ok would otherwise read as nothing being wrong.
    const report = buildProblemReport(user, message({ steps: [step()] }), INFO)

    expect(report.body).toContain('No step reported an error.')
  })

  it('survives a missing command, reply, and version info', () => {
    const report = buildProblemReport(null, null, null)

    expect(report.title).toBe('Problem with a task')
    expect(report.body).toContain('(not recorded)')
    expect(report.body).toContain('unknown')
  })

  it('caps the report so the issue URL stays usable', () => {
    const long = message({ content: 'y'.repeat(MAX_REPORT_CHARS * 2) })
    const report = buildProblemReport(user, long, INFO)

    expect(report.body.length).toBeLessThanOrEqual(MAX_REPORT_CHARS + 40)
    expect(report.body).toContain('truncated')
  })

  it('states that nothing was sent automatically', () => {
    const report = buildProblemReport(user, message(), INFO)
    expect(report.body).toContain('Nothing was sent automatically')
  })
})

describe('issueUrl', () => {
  it('pre-fills the issue rather than opening a blank one', () => {
    const url = issueUrl({ title: 'Problem with: open notepad', body: 'hello & goodbye' })

    expect(url).toContain('github.com/T-O-R-C-H/T.O.R.C.H/issues/new')
    expect(url).toContain('title=')
    expect(url).toContain('body=')
  })

  it('escapes characters that would break the URL', () => {
    const url = issueUrl({ title: 'a&b', body: 'c=d&e' })

    // The ampersand must be encoded, not read as a parameter separator.
    expect(url).not.toContain('title=a&b')
    expect(url).toContain('a%26b')
  })
})
