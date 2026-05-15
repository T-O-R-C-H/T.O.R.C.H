import { useState } from 'react'

/* ─── ICONS ─── */
function IconFilePdf() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15h6" /><path d="M9 11h6" /></svg> }
function IconFileWord() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15h6" /><path d="M9 11h6" /></svg> }
function IconFileExcel() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15h6" /><path d="M9 11h6" /></svg> }
function IconFileImage() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg> }
function IconFileCode() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="10 13 8 15 10 17" /><polyline points="14 13 16 15 14 17" /></svg> }
function IconFileGeneric() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> }
function IconFolder() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg> }
function IconTerminal() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg> }
function IconChevronDown() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg> }

interface ParsedFile {
  name: string
  path: string
  size?: string
  isDir: boolean
}

function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return <IconFolder />
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <IconFilePdf />
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) return <IconFileWord />
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <IconFileExcel />
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext || '')) return <IconFileImage />
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'json'].includes(ext || '')) return <IconFileCode />
  return <IconFileGeneric />
}

export function FileResultCard({ file }: { file: ParsedFile }): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: hovered ? '#080808' : '#050505',
        border: `1px solid ${hovered ? '#222' : '#141414'}`,
        height: '52px',
        padding: '0 16px',
        marginBottom: '6px',
        transition: 'all 120ms ease',
        cursor: 'default',
        width: '100%',
      }}
    >
      <div style={{ flexShrink: 0, marginRight: '14px', paddingTop: '4px' }}>
        {getFileIcon(file.name, file.isDir)}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          fontWeight: 500,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.2
        }}>
          {file.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            color: '#666',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.02em',
            lineHeight: 1
          }}>
            {file.path || (file.isDir ? 'Directory' : 'File')}
          </div>
          {file.size && (
            <>
              <div style={{ width: '3px', height: '3px', background: '#333', borderRadius: '50%' }} />
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px',
                color: '#666',
                lineHeight: 1
              }}>
                {file.size}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', opacity: hovered ? 1 : 0, transition: 'opacity 120ms ease' }}>
        <button style={{
          background: '#111', border: '1px solid #222', color: '#fff',
          fontFamily: "'Inter', sans-serif", fontSize: '11px', padding: '4px 10px',
          cursor: 'pointer'
        }}>
          Open
        </button>
      </div>
    </div>
  )
}

export function ResultRenderer({ result, rawOutput }: { result: string, rawOutput?: boolean }): JSX.Element {
  const [showTerminal, setShowTerminal] = useState(false)

  // Try to parse file results from python backend format
  const parsedFiles: ParsedFile[] = []
  
  // Format 1: find_file
  // "Found 2 file(s):" followed by "  C:\path\to\file.pdf (1.2MB)"
  // Format 2: list_directory
  // "Directories:" followed by "  [DIR]  name"
  // "Files:" followed by "  name.txt (1.2MB)"

  const lines = result.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Detect [DIR]
    if (trimmed.startsWith('[DIR]')) {
      const name = trimmed.replace('[DIR]', '').trim()
      parsedFiles.push({ name, path: '', isDir: true })
      continue
    }

    // Detect file with size e.g. "Sales.pdf (1.2MB)" or "C:\...\Sales.pdf (1.2MB)"
    const match = trimmed.match(/^(.*?)\s+\(([\d.]+[A-Z]+)\)$/)
    if (match) {
      let fullPath = match[1]
      let size = match[2]
      let name = fullPath
      if (fullPath.includes('\\') || fullPath.includes('/')) {
        name = fullPath.split(/[\\/]/).pop() || fullPath
      }
      parsedFiles.push({ name, path: fullPath, size, isDir: false })
      continue
    }
  }

  // If we found parseable files, render them cleanly.
  if (parsedFiles.length > 0 && !rawOutput) {
    return (
      <div style={{ marginTop: '8px', width: '100%', maxWidth: '600px' }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '12px',
          color: '#a0a0a0',
          marginBottom: '10px',
        }}>
          Found {parsedFiles.length} item{parsedFiles.length !== 1 ? 's' : ''}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {parsedFiles.map((f, i) => (
            <div key={i} style={{ animation: `fade-in-up 300ms ease-out ${i * 40}ms both` }}>
              <FileResultCard file={f} />
            </div>
          ))}
        </div>

        <button 
          onClick={() => setShowTerminal(!showTerminal)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'transparent', border: 'none',
            color: '#555', fontFamily: "'Inter', sans-serif", fontSize: '11px',
            padding: '8px 0', cursor: 'pointer',
            marginTop: '4px'
          }}
        >
          <IconTerminal />
          {showTerminal ? 'Hide execution details' : 'View execution details'}
          <div style={{ transform: showTerminal ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease' }}>
            <IconChevronDown />
          </div>
        </button>

        {showTerminal && (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            background: '#050505',
            border: '1px solid #111',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            color: '#666',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.6
          }}>
            {result}
          </div>
        )}

        <style>{`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  // Fallback to pure terminal view if no parseable entities found
  return (
    <div style={{
      marginTop: '6px',
      paddingLeft: '28px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '10px',
      color: '#4f4f4f',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      lineHeight: 1.7
    }}>
      {result}
    </div>
  )
}
