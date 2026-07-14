import { useState, useEffect, useRef } from 'react'
import { TorchOrb } from './TorchOrb'
import { WaveStrip } from '../input/WaveStrip'
import { useTorchStore } from '../../store/torchStore'
import { useMemoryStore } from '../../store/memoryStore'

export function HeyTorch(): JSX.Element {
  const overlayStatus = useTorchStore((s) => s.overlayStatus)
  const overlayReply = useTorchStore((s) => s.overlayReply)
  const setOverlayVisible = useTorchStore((s) => s.setOverlayVisible)
  const activityLog = useMemoryStore((s) => s.activityLog)
  const [displayedReply, setDisplayedReply] = useState('')
  const typewriterRef = useRef<any>(undefined)

  // Listen for Electron main process activation event
  useEffect(() => {
    const handleActivate = (): void => {
      useTorchStore.getState().setOverlayStatus('listening')
      useTorchStore.getState().setOverlayVisible(true)
    }
    window.torchAPI?.onOverlayActivate(handleActivate)
    return (): void => {
      window.torchAPI?.removeOverlayActivate()
    }
  }, [])

  // Typewriter effect for reply
  useEffect(() => {
    if (overlayStatus === 'speaking' && overlayReply) {
      setDisplayedReply('')
      let charIndex = 0
      typewriterRef.current = setInterval(() => {
        if (charIndex < overlayReply.length) {
          setDisplayedReply(overlayReply.slice(0, charIndex + 1))
          charIndex++
        } else {
          clearInterval(typewriterRef.current)
        }
      }, 30)
    } else {
      setDisplayedReply('')
    }

    return (): void => {
      clearInterval(typewriterRef.current)
    }
  }, [overlayStatus, overlayReply])

  const statusText =
    overlayStatus === 'listening'
      ? 'listening...'
      : overlayStatus === 'processing'
        ? 'processing...'
        : overlayStatus === 'speaking'
          ? 'torch speaking'
          : ''

  const handleDismiss = (): void => {
    setOverlayVisible(false)
    window.torchAPI?.hideOverlay()
  }

  return (
    <div className="w-[380px] bg-[#000] border border-[#1c1c1c] flex flex-col items-center py-6 px-6">
      {/* Orb */}
      <TorchOrb
        isActive={overlayStatus === 'listening' || overlayStatus === 'processing'}
        size={48}
      />

      {/* Wave bars - only when listening */}
      {overlayStatus === 'listening' && (
        <div className="mt-4">
          <WaveStrip />
        </div>
      )}

      {/* Status text */}
      <div className="mono-xs text-[#444] mt-4">{statusText}</div>

      {/* Background context indicator - show during listening/processing */}
      {(overlayStatus === 'listening' || overlayStatus === 'processing') && activityLog.length > 0 && (
        <div className="mt-3 w-full text-[10px] text-[#333] border-t border-[#1c1c1c] pt-2">
          <div className="truncate text-[#555]">context: {activityLog[activityLog.length - 1]?.app || 'unknown'}</div>
        </div>
      )}

      {/* Reply area */}
      {overlayStatus === 'speaking' && displayedReply && (
        <div className="mt-4 w-full">
          <p
            className={`text-[12px] text-[#ccc] leading-relaxed ${
              displayedReply.length < overlayReply.length ? 'typewriter-cursor' : ''
            }`}
          >
            {displayedReply}
          </p>
        </div>
      )}

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="mt-6 mono-xs text-[#2a2a2a] hover:text-[#666] transition-colors duration-120"
      >
        dismiss
      </button>
    </div>
  )
}
