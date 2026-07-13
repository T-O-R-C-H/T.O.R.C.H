import { IconMessage as MessageSquare } from '../../components/icons'

export function Messaging(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <MessageSquare size={14} className="text-[#666]" />
        <span className="label">MESSAGING</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <MessageSquare size={32} className="text-[#1c1c1c] mb-4" />
        <h3 className="heading-md mb-2">Messaging Hub</h3>
        <p className="text-[11px] text-[#444] mb-6 text-center max-w-[400px]">
          Send and manage messages across platforms — WhatsApp, Telegram, Slack, and more. TORCH
          automates conversations with HITL approval for every message sent.
        </p>
        <div className="flex gap-2">
          <div className="px-4 py-2 border border-[#1c1c1c] mono-xs text-[#333]">WhatsApp</div>
          <div className="px-4 py-2 border border-[#1c1c1c] mono-xs text-[#333]">Telegram</div>
          <div className="px-4 py-2 border border-[#1c1c1c] mono-xs text-[#333]">Slack</div>
          <div className="px-4 py-2 border border-[#1c1c1c] mono-xs text-[#333]">Discord</div>
        </div>
      </div>
    </div>
  )
}
