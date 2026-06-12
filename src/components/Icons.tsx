// ---------------------------------------------------------------------------
// Thin line-style icon set (Lucide-flavored, 24px grid, currentColor stroke).
// One <Icon name=… /> component keeps stroke width and sizing consistent
// across the toolbar, panels and timeline — no emoji glyphs anywhere.
// ---------------------------------------------------------------------------

import type { CSSProperties } from 'react'

export type IconName =
  | 'file-plus'
  | 'folder-open'
  | 'save'
  | 'download'
  | 'square'
  | 'circle'
  | 'skip-back'
  | 'skip-forward'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'play'
  | 'pause'
  | 'undo'
  | 'redo'
  | 'eye'
  | 'eye-off'
  | 'copy'
  | 'trash'
  | 'clock'
  | 'diamond'
  | 'plus'
  | 'x'
  | 'record'
  | 'sun'
  | 'sunset'
  | 'sparkles'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-down'
  | 'rotate'
  | 'activity'

const PATHS: Record<IconName, JSX.Element> = {
  'file-plus': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 12v6M9 15h6" />
    </>
  ),
  'folder-open': (
    <>
      <path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6A2 2 0 0 1 18.46 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  square: <rect x="4" y="4" width="16" height="16" rx="2" />,
  circle: <circle cx="12" cy="12" r="9" />,
  'skip-back': (
    <>
      <path d="M19 20L9 12l10-8v16z" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </>
  ),
  'skip-forward': (
    <>
      <path d="M5 4l10 8-10 8V4z" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </>
  ),
  'chevron-left': <polyline points="15 18 9 12 15 6" />,
  'chevron-right': <polyline points="9 18 15 12 9 6" />,
  'chevron-down': <polyline points="6 9 12 15 18 9" />,
  'chevron-up': <polyline points="18 15 12 9 6 15" />,
  play: <path d="M6 4l14 8-14 8V4z" />,
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 2.92" />
      <path d="M6.6 6.6A13.2 13.2 0 0 0 2 11s3.5 7 10 7a9.1 9.1 0 0 0 3.4-.66" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </>
  ),
  diamond: <path d="M12 3l9 9-9 9-9-9 9-9z" />,
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  record: <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  sunset: (
    <>
      <path d="M12 10V2M8.5 5.5L12 2l3.5 3.5" />
      <path d="M2 18h20M4 14h2M18 14h2" />
      <path d="M7.5 14a4.5 4.5 0 0 1 9 0" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 14l.7 1.8L21.5 16l-1.8.7L19 18l-.7-1.3L16.5 16l1.8-.2L19 14z" />
    </>
  ),
  'arrow-left': (
    <>
      <line x1="20" y1="12" x2="6" y2="12" />
      <polyline points="11 7 6 12 11 17" />
      <line x1="3" y1="5" x2="3" y2="19" />
    </>
  ),
  'arrow-right': (
    <>
      <line x1="4" y1="12" x2="18" y2="12" />
      <polyline points="13 7 18 12 13 17" />
      <line x1="21" y1="5" x2="21" y2="19" />
    </>
  ),
  'arrow-down': (
    <>
      <line x1="12" y1="4" x2="12" y2="18" />
      <polyline points="7 13 12 18 17 13" />
      <line x1="5" y1="21" x2="19" y2="21" />
    </>
  ),
  rotate: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <polyline points="21 3 21 8 16 8" />
    </>
  ),
  activity: <polyline points="3 12 7 12 10 4 14 20 17 12 21 12" />,
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.75,
  className,
  style,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      className={'icon' + (className ? ' ' + className : '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
