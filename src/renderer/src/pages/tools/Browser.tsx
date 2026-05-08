import { Globe2, Globe } from 'lucide-react'
import { useState } from 'react'

export function Browser(): JSX.Element {
  const [url, setUrl] = useState('')

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <Globe2 size={14} className="text-[#666]" />
        <span className="label">BROWSER AUTOMATION</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <Globe2 size={32} className="text-[#1c1c1c] mb-4" />
        <h3 className="heading-md mb-2">Browser Control</h3>
        <p className="text-[11px] text-[#444] mb-6 text-center max-w-[400px]">
          TORCH uses Playwright to automate browser actions — navigate, click, fill forms,
          scrape content, and interact with any website
        </p>
        <div className="flex items-center gap-2 w-full max-w-[480px]">
          <div className="flex-1 relative">
            <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333]" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to automate..."
              className="w-full pl-8 text-[12px]"
            />
          </div>
          <button className="btn-primary">Open</button>
        </div>
      </div>
    </div>
  )
}
