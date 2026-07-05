import type { Step } from '../../store/torchStore'
import { IconCheck, IconLoader, IconAlertTriangle, IconCircle } from '../icons'
import { toPlainLanguage } from '../../utils/plainLanguage'

interface StepListProps {
  steps: Step[]
}

function formatStepResult(result: string | undefined): { text: string; hasOverflow: boolean } {
  if (!result) return { text: '', hasOverflow: false }

  const lines = result.split(/\r?\n/)
  let targetLine = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^[-=\s]+$/.test(trimmed)) continue
    targetLine = trimmed
    break
  }

  if (!targetLine) return { text: '', hasOverflow: false }

  const hasOverflow = targetLine.length > 120
  const truncated = hasOverflow ? `${targetLine.substring(0, 120)}...` : targetLine
  return { text: `↳ ${truncated}`, hasOverflow }
}

interface StepListProps {
  steps: Step[]
}

function getStepPhrase(tool: string, args: Record<string, unknown>, status: string, fallbackLabel: string): string {
  if (status === 'failed') {
    const failMap: Record<string, string> = {
      analyse_screen: "Couldn't read your screen.",
      screenshot: "Couldn't capture your screen.",
      run_terminal: "Command didn't finish.",
      find_file: "Couldn't find that file.",
      move_file: "Couldn't move the file.",
      create_folder: "Couldn't create the folder.",
      send_email: "Email didn't send.",
      read_inbox: "Couldn't read your inbox.",
      open_app: "Couldn't open the app.",
    }
    return failMap[tool] || "This step didn't finish."
  }

  const isPending = status === 'pending' || status === 'active' || status === 'hitl_required'

  let name = (args?.name || args?.filename || args?.query || args?.filepath || args?.path || args?.url || args?.to || '') as string
  if (typeof name === 'string') {
    name = name.split(/[/\\]/).pop() || name
  } else {
    name = ''
  }

  const map: Record<string, [string, string]> = {
    find_file: ['Looking for your file...', 'Found your file.'],
    find_file_fuzzy: ['Looking for your file...', 'Found your file.'],
    list_directory: ['Checking the folder...', 'Checked the folder.'],
    read_pdf: ['Reading your document...', 'Read the document.'],
    read_word: ['Reading your document...', 'Read the document.'],
    read_excel: ['Reading your spreadsheet...', 'Read the spreadsheet.'],
    send_email: ['Sending your email...', 'Sent your email.'],
    read_inbox: ['Checking your inbox...', 'Checked your inbox.'],
    open_browser: ['Opening your browser...', 'Opened your browser.'],
    click: ['Clicking on the screen...', 'Clicked on the screen.'],
    type_text: ['Typing...', 'Typed.'],
    screenshot: ['Taking a picture of your screen...', 'Took a picture of your screen.'],
    analyse_screen: ['Looking at the screen...', 'Looked at the screen.'],
    search_web: ['Searching the web...', 'Searched the web.'],
    download_file: ['Downloading a file...', 'Downloaded the file.'],
    open_app: [`Opening ${name || 'app'}...`, `Opened ${name || 'app'}.`],
    post_social: ['Posting to social media...', 'Posted to social media.'],
    send_message: ['Sending your message...', 'Sent your message.'],
    run_terminal: ['Running system action...', 'Completed system action.'],
    move_file: ['Moving your file...', 'Moved your file.'],
    delete_file: ['Deleting your file...', 'Deleted your file.'],
    create_folder: ['Creating a folder...', 'Created the folder.'],
    zip_files: ['Compressing files...', 'Compressed files.'],
    save_skill: ['Saving shortcut...', 'Saved shortcut.']
  }

  const phrases = map[tool]
  if (phrases) return isPending ? phrases[0] : phrases[1]
  return fallbackLabel || (isPending ? 'Working on it...' : 'Completed.')
}

export function StepList({ steps }: StepListProps): JSX.Element {
  return (
    <div className="step-list">
      {steps.map((step) => {
        const isDone = step.status === 'done'
        const isActive = step.status === 'active'
        const isFailed = step.status === 'failed' || step.status === 'hitl_required'
        const { text: previewText, hasOverflow } = formatStepResult(step.result)
        const displayLabel = getStepPhrase(step.tool, step.args, step.status, step.label)

        const rowClass = isActive ? 'step-row step-row--active'
          : isDone ? 'step-row step-row--done'
          : isFailed ? 'step-row step-row--failed'
          : 'step-row'

        return (
          <div key={step.id}>
            <div className={rowClass}>
              <span className="step-row__icon">
                {isActive ? <IconLoader size={14} className="spinner" />
                  : isDone ? <IconCheck size={14} className="text-[var(--color-torch-success)]" />
                  : isFailed ? <IconAlertTriangle size={14} className="text-[var(--color-torch-error)]" />
                  : <IconCircle size={13} className="text-[var(--color-torch-text-tertiary)]" />}
              </span>
              <span>{displayLabel}</span>
            </div>

            {step.result && !isFailed && previewText && (
              <div className="step-preview">
                <div className="step-preview__line">{previewText}</div>
                {hasOverflow && (
                  <div className="step-preview__hint">(see full output in Activity Log)</div>
                )}
              </div>
            )}

            {(step.error || isFailed || (isActive && !step.result)) && (
              <div className="step-preview">
                {isActive && !step.result && !step.error && (
                  <span className="step-preview__line">Working on this step…</span>
                )}
                {step.error && (
                  <div className="chat-error-card chat-error-card--step">
                    <span className="chat-error-card__title">What went wrong</span>
                    <p className="chat-error-card__body">{toPlainLanguage(step.error)}</p>
                  </div>
                )}
                {!step.error && isFailed && step.result && (
                  <div className="chat-error-card chat-error-card--step">
                    <span className="chat-error-card__title">What went wrong</span>
                    <p className="chat-error-card__body">{toPlainLanguage(step.result)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
