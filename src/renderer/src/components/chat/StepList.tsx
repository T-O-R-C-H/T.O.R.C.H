import type { Step } from '../../store/torchStore'
import { IconCheck, IconLoader, IconAlertTriangle, IconCircle } from '../icons'

interface StepListProps {
  steps: Step[]
}

/**
 * Parses raw tool / terminal results to extract a clean single-line preview.
 * Skips lines composed entirely of symbols/dashes, clamps to 120 chars, and prefixes a block symbol.
 */
function formatStepResult(result: string | undefined): { text: string; hasOverflow: boolean } {
  if (!result) return { text: '', hasOverflow: false };

  const lines = result.split(/\r?\n/);
  let targetLine = '';

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines or cosmetic divider artifacts (dashes, equals signs, whitespace)
    if (!trimmed || /^[-=\s]+$/.test(trimmed)) {
      continue;
    }
    
    targetLine = trimmed;
    break;
  }

  if (!targetLine) return { text: '', hasOverflow: false };

  const hasOverflow = targetLine.length > 120;
  const truncated = hasOverflow ? `${targetLine.substring(0, 120)}...` : targetLine;
  
  return { 
    text: `↳ ${truncated}`, 
    hasOverflow 
  };
}

function getStepPhrase(tool: string, args: any, status: string, fallbackLabel: string): string {
  const isPending = status === 'pending' || status === 'active' || status === 'hitl_required';
  
  let name = args?.name || args?.filename || args?.query || args?.filepath || args?.path || args?.url || args?.to || '';
  if (typeof name === 'string') {
    name = name.split(/[/\\]/).pop() || name;
  } else {
    name = '';
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
    save_skill: ['Saving shortcut...', 'Saved shortcut.'],
  };

  const phrases = map[tool];
  if (phrases) {
    return isPending ? phrases[0] : phrases[1];
  }
  
  return fallbackLabel || (isPending ? 'Working on it...' : 'Completed.');
}

function cleanErrorMessage(msg: string | undefined): string {
  if (!msg) return 'An unexpected error occurred.';
  const lower = msg.toLowerCase();
  if (lower.includes('file not found') || lower.includes('no such file')) {
    return "I couldn't find the file you were looking for. Please check the name and try again.";
  }
  if (lower.includes('permission') || lower.includes('access denied')) {
    return "Access was denied. Please make sure the file isn't open in another program and that you have permission to edit it.";
  }
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('connection')) {
    return "There was a connection issue. Please check your internet and try again.";
  }
  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('quota')) {
    return "AI helper service configuration issue. Please check settings.";
  }
  if (lower.includes('traceback') || lower.includes('line ') || lower.includes('exception') || msg.length > 120) {
    return "Something went wrong during this step. You can try rephrasing your request.";
  }
  return msg;
}

export function StepList({ steps }: StepListProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
      {steps.map((step) => {
        const isDone = step.status === 'done'
        const isActive = step.status === 'active'
        const isFailed = step.status === 'failed' || step.status === 'hitl_required'

        const { text: previewText, hasOverflow } = formatStepResult(step.result);
        const displayLabel = getStepPhrase(step.tool, step.args, step.status, step.label);

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              opacity: isDone ? 0.7 : isFailed ? 0.9 : 1,
              transition: 'all 300ms ease',
            }}
          >
            {/* Step Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px' }}>
                {isActive ? (
                  <IconLoader size={15} className="text-[#3b82f6]" />
                ) : isDone ? (
                  <IconCheck size={15} className="text-[#10b981]" />
                ) : isFailed ? (
                  <IconAlertTriangle size={15} className="text-[#ef4444]" />
                ) : (
                  <IconCircle size={14} className="text-[#475569]" />
                )}
              </div>
              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '13px',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#f8fafc' : isDone ? '#94a3b8' : isFailed ? '#f87171' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: '1.4'
              }}>
                <span>{displayLabel}</span>
              </div>
            </div>

            {/* Clean One-Line Terminal Preview (Only shown when not failed) */}
            {step.result && !isFailed && previewText && (
              <div style={{ paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: '#94a3b8',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {previewText}
                </div>
                
                {hasOverflow && (
                  <div style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '10px',
                    color: '#475569',
                    opacity: 0.8,
                    lineHeight: '1.2',
                    marginTop: '2px'
                  }}>
                    (see full output in Activity Log)
                  </div>
                )}
              </div>
            )}

            {/* Error or Active stub */}
            {(step.error || isFailed || (isActive && !step.result)) && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11.5px',
                lineHeight: 1.6,
                color: isFailed ? '#fca5a5' : '#64748b',
                paddingLeft: '28px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {isActive && !step.result && !step.error && `executing operation...`}
                
                {step.error && (
                  <div style={{
                    marginTop: '4px',
                    borderLeft: '2px solid #ef4444',
                    paddingLeft: '10px',
                    color: '#f87171',
                    background: 'rgba(239, 68, 68, 0.05)',
                    padding: '6px 10px',
                    borderRadius: '4px'
                  }}>
                    ERROR: {cleanErrorMessage(step.error)}
                  </div>
                )}

                {!step.error && isFailed && step.result && (
                  <div style={{
                    marginTop: '4px',
                    borderLeft: '2px solid #ef4444',
                    paddingLeft: '10px',
                    color: '#fca5a5',
                    background: 'rgba(239, 68, 68, 0.05)',
                    padding: '6px 10px',
                    borderRadius: '4px'
                  }}>
                    {cleanErrorMessage(step.result)}
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