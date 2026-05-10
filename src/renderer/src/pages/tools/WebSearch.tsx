import { IconGlobe as Globe, IconSearch as Search } from '../../components/icons'
import { useState } from 'react'

export function WebSearch(): JSX.Element {
  const [query, setQuery] = useState('')

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1c1c1c] flex-shrink-0">
        <Globe size={14} className="text-[#666]" />
        <span className="label">WEB SEARCH</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <Globe size={32} className="text-[#1c1c1c] mb-4" />
        <h3 className="heading-md mb-2">Search the Web</h3>
        <p className="text-[11px] text-[#444] mb-6 text-center max-w-[400px]">
          TORCH will search, scrape, and summarize web results for you
        </p>
        <div className="flex items-center gap-2 w-full max-w-[480px]">
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything..."
              className="w-full pl-8 text-[12px]"
            />
          </div>
          <button className="btn-primary">Search</button>
        </div>
      </div>
    </div>
  )
}
