import type { JSX, ReactNode } from 'react'

/** Line icons, 24px grid, drawn to match each other. */
function Icon({ children, size = 20 }: { children: ReactNode; size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

type P = { size?: number }

export const Arrow = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)
export const ArrowUpRight = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Icon>
)
export const Eye = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)
export const Scan = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M8 12h8" />
  </Icon>
)
export const Sparkle = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
  </Icon>
)
export const Pointer = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M5 3l14 7-6 1.6L11 18 5 3Z" />
    <path d="m13 13 5 5" />
  </Icon>
)
export const Check = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="m5 12.5 4.2 4L19 7" />
  </Icon>
)
export const CheckCircle = (p: P): JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.2 2.4 2.3 4.6-4.9" />
  </Icon>
)
export const Shield = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" />
    <path d="m9.3 12 2 2 3.6-3.8" />
  </Icon>
)
export const Hand = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.7 7.5-6.5 7.5S5 18.6 4 16l-1.3-3.3a1.5 1.5 0 0 1 2.7-1.3L8 14" />
  </Icon>
)
export const Key = (p: P): JSX.Element => (
  <Icon {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M14 9l2 2" />
  </Icon>
)
export const Stop = (p: P): JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </Icon>
)
export const Lock = (p: P): JSX.Element => (
  <Icon {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
)
export const Monitor = (p: P): JSX.Element => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="12.5" rx="2" />
    <path d="M8.5 20h7M12 16.5V20" />
  </Icon>
)
export const Globe = (p: P): JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" />
  </Icon>
)
export const Folder = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.2h8.5A1.5 1.5 0 0 1 21 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-11Z" />
  </Icon>
)
export const FileText = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
)
export const Calculator = (p: P): JSX.Element => (
  <Icon {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 15.5h.01M12 15.5h.01M15 15.5h.01" />
  </Icon>
)
export const Play = (p: P): JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m10 8.8 5 3.2-5 3.2V8.8Z" />
  </Icon>
)
export const Mail = (p: P): JSX.Element => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
)
export const Cart = (p: P): JSX.Element => (
  <Icon {...p}>
    <circle cx="9.5" cy="19.5" r="1.3" />
    <circle cx="17.5" cy="19.5" r="1.3" />
    <path d="M3 4h2.3l2.3 11h11l2-7.5H6.4" />
  </Icon>
)
export const Layers = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
)
export const Github = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </Icon>
)
export const Terminal = (p: P): JSX.Element => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="m7 9 3 3-3 3M13 15h4" />
  </Icon>
)
export const Download = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </Icon>
)
export const Windows = ({ size = 16 }: P): JSX.Element => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 5.3 10.3 4.3v7.1H3V5.3Zm8.3-1.1L21 2.9v8.5h-9.7V4.2ZM3 12.6h7.3v7.1L3 18.7v-6.1Zm8.3 0H21v8.5l-9.7-1.3v-7.2Z" />
  </svg>
)
export const Clock = (p: P): JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)
export const Bolt = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
  </Icon>
)
export const Mic = (p: P): JSX.Element => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </Icon>
)
export const Undo = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
)
export const Home = (p: P): JSX.Element => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.5Z" />
  </Icon>
)
export const Wheel = (p: P): JSX.Element => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.2" />
    <path d="M3.6 10.5h6.2M14.2 10.5h6.2M12 14.2V21" />
  </Icon>
)
