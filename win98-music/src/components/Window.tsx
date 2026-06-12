import type { ReactNode } from 'react'
import { useStore, type WinWindow } from '../lib/store'
import { useTitleDrag } from '../lib/useDrag'

const ICONS: Record<string, string> = {
  explorer: '🖥️',
  winamp: '🎵',
  about: 'ℹ️',
  'add-youtube': '📺',
}

export function Window({ win, children }: { win: WinWindow; children: ReactNode }) {
  const { moveWindow, focusWindow, closeWindow, toggleMinimize, topZ } = useStore()
  const isActive = win.z === topZ

  const { onPointerDown } = useTitleDrag(
    () => ({ x: win.x, y: win.y }),
    (x, y) => moveWindow(win.id, x, y),
    () => focusWindow(win.id),
  )

  if (win.minimized) return null

  return (
    <div
      className={`window ${isActive ? '' : 'inactive'}`}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={() => focusWindow(win.id)}
    >
      <div className="title-bar" onPointerDown={onPointerDown} onDoubleClick={() => toggleMinimize(win.id)}>
        <span className="title-icon">{ICONS[win.kind]}</span>
        <span className="title-text">{win.title}</span>
        <div className="title-buttons">
          <button className="title-btn" onClick={() => toggleMinimize(win.id)} title="Minimalizuj">
            _
          </button>
          <button className="title-btn" onClick={() => closeWindow(win.id)} title="Zamknij">
            ✕
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
