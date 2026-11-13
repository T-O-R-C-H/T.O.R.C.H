import type { Step } from '../../store/torchStore'
import { toPlainLanguage } from '../../utils/plainLanguage'
import { StepTimeline, type TimelineStep } from './StepTimeline'

interface StepListProps {
  steps: Step[]
}

function getStepPhrase(
  tool: string,
  args: Record<string, unknown>,
  status: string,
  fallbackLabel: string
): string {
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
      open_app: "Couldn't open the app."
    }
    return failMap[tool] || "This step didn't finish."
  }

  const isPending = status === 'pending' || status === 'active' || status === 'hitl_required'

  let name = (args?.name ||
    args?.filename ||
    args?.query ||
    args?.filepath ||
    args?.path ||
    args?.url ||
    args?.to ||
    '') as string
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

/**
 * A step the user cancelled is not a step that went wrong.
 *
 * Cancelling carried the same "failed" status as a real error, so declining
 * an approval was reported back as "That didn't work" and "What went wrong" —
 * blaming the app for something the user chose.
 */
function isCancelled(step: Step): boolean {
  if (step.cancelled) return true
  return /you cancelled|cancelled this task/i.test(step.error || '')
}

/*
 * A step waiting on the user is its own state. It used to be drawn as a
 * failure - red text, an X - so the approval prompt always arrived looking
 * like something had already gone wrong.
 */
function mapStatus(step: Step): TimelineStep['status'] {
  if (isCancelled(step)) return 'cancelled'
  switch (step.status) {
    case 'done':
      return 'done'
    case 'active':
      return 'active'
    case 'failed':
      return 'failed'
    case 'hitl_required':
      return 'waiting'
    default:
      return 'pending'
  }
}

export function StepList({ steps }: StepListProps): JSX.Element {
  const timeline: TimelineStep[] = steps.map((step) => ({
    id: step.id,
    label: isCancelled(step)
      ? step.label || 'Cancelled.'
      : getStepPhrase(step.tool, step.args, step.status, step.label),
    status: mapStatus(step)
  }))

  return (
    <div className="step-block">
      <StepTimeline steps={timeline} />
      {steps.map((step) => {
        const isFailed = step.status === 'failed'
        if (!step.error && !(isFailed && step.result)) return null

        // A cancelled step is already marked as such in the timeline; a card
        // repeating "You cancelled this" underneath adds nothing.
        if (isCancelled(step)) return null

        return (
          <div key={step.id} className="chat-error-card chat-error-card--step">
            <span className="chat-error-card__title">What went wrong</span>
            <p className="chat-error-card__body">
              {toPlainLanguage(step.error || step.result || '')}
            </p>
          </div>
        )
      })}
    </div>
  )
}
