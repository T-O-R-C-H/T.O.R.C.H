import { useState } from 'react'
import type { Message } from '../../store/torchStore'
import { buildProblemReport, issueUrl, type ReportInfo } from '../../utils/problemReport'

/**
 * "Something went wrong" — on every task result.
 *
 * TORCH collects nothing on its own, so this is the only route a problem has
 * to reach us, and it is entirely the user's decision. Pressing the button
 * shows the whole report; nothing leaves the machine until they press the
 * second button, which opens a pre-filled issue in their browser.
 *
 * Showing the text first is the point. A report that is assembled and sent on
 * one click is telemetry with a friendly label.
 */
export function ReportProblem({
  userMessage,
  agentMessage
}: {
  userMessage: Message | null
  agentMessage: Message | null
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<ReportInfo | null>(null)

  const reveal = async (): Promise<void> => {
    setOpen(true)
    try {
      const details = await window.torchAPI?.getReportInfo?.()
      if (details) setInfo(details)
    } catch {
      // The report is still useful without the version lines.
    }
  }

  const report = buildProblemReport(userMessage, agentMessage, info)

  if (!open) {
    return (
      <button type="button" className="report-problem__trigger" onClick={() => void reveal()}>
        Something went wrong
      </button>
    )
  }

  return (
    <div className="report-problem">
      <p className="report-problem__lead">
        This is everything TORCH would send. Nothing has been sent yet.
      </p>
      <pre className="report-problem__body">{report.body}</pre>
      <div className="report-problem__actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => window.torchAPI?.openExternal?.(issueUrl(report))}
        >
          Open a report on GitHub
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
