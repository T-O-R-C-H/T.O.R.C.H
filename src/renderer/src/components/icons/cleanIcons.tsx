/**
 * Clean stroke icons for onboarding & command center (Lucide).
 */
import {
  ArrowRight,
  Check,
  FileSearch,
  FolderOpen,
  Mail,
  Monitor,
  MousePointerClick,
  Sparkles
} from 'lucide-react'

type IconProps = { size?: number; className?: string; strokeWidth?: number }

export function ObArrowRight({ size = 16, className, strokeWidth = 1.75 }: IconProps): JSX.Element {
  return <ArrowRight size={size} className={className} strokeWidth={strokeWidth} />
}

export function ObCheck({ size = 16, className, strokeWidth = 1.75 }: IconProps): JSX.Element {
  return <Check size={size} className={className} strokeWidth={strokeWidth} />
}

export function ObFile({ size = 16, className, strokeWidth = 1.75 }: IconProps): JSX.Element {
  return <FileSearch size={size} className={className} strokeWidth={strokeWidth} />
}

export function ObMail({ size = 16, className, strokeWidth = 1.75 }: IconProps): JSX.Element {
  return <Mail size={size} className={className} strokeWidth={strokeWidth} />
}

export function ObMonitor({ size = 16, className, strokeWidth = 1.75 }: IconProps): JSX.Element {
  return <Monitor size={size} className={className} strokeWidth={strokeWidth} />
}

export function ObPointer({ size = 20, className, strokeWidth = 1.75 }: IconProps): JSX.Element {
  return <MousePointerClick size={size} className={className} strokeWidth={strokeWidth} />
}

export function CmdFileSearch({ size = 18, className, strokeWidth = 1.5 }: IconProps): JSX.Element {
  return <FileSearch size={size} className={className} strokeWidth={strokeWidth} />
}

export function CmdFolder({ size = 18, className, strokeWidth = 1.5 }: IconProps): JSX.Element {
  return <FolderOpen size={size} className={className} strokeWidth={strokeWidth} />
}

export function CmdMail({ size = 18, className, strokeWidth = 1.5 }: IconProps): JSX.Element {
  return <Mail size={size} className={className} strokeWidth={strokeWidth} />
}

export function CmdSparkles({ size = 18, className, strokeWidth = 1.5 }: IconProps): JSX.Element {
  return <Sparkles size={size} className={className} strokeWidth={strokeWidth} />
}

export function CmdMonitor({ size = 18, className, strokeWidth = 1.5 }: IconProps): JSX.Element {
  return <Monitor size={size} className={className} strokeWidth={strokeWidth} />
}

export function CmdArrowUp({ size = 18, className, strokeWidth = 1.75 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}
