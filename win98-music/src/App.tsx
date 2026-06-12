import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { Window } from './components/Window'
import { Explorer } from './components/Explorer'
import { Winamp } from './components/Winamp'
import { AddYouTube } from './components/AddYouTube'
import { About } from './components/About'

const DESKTOP_ICONS = [
  { id: 'my-computer', glyph: '🖥️', label: 'Mój komputer', action: 'explorer' as const, folderId: 'my-computer' },
  { id: 'winamp', glyph: '🎵', label: 'Winamp', action: 'winamp' as const },
  { id: 'recycle', glyph: '🗑️', label: 'Kosz', action: 'about' as const },
]

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span>{now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
}

export default function App() {
  const { windows, openWindow, focusWindow, toggleMinimize, topZ } = useStore()
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null)
  const [startOpen, setStartOpen] = useState(false)

  const launch = (icon: (typeof DESKTOP_ICONS)[number]) => {
    openWindow(icon.action, icon.folderId ? { folderId: icon.folderId } : undefined)
    setStartOpen(false)
  }

  return (
    <>
      <div className="desktop" onPointerDown={() => { setSelectedIcon(null); setStartOpen(false) }}>
        <div className="desktop-icons">
          {DESKTOP_ICONS.map((icon) => (
            <div
              key={icon.id}
              className={`desktop-icon ${selectedIcon === icon.id ? 'selected' : ''}`}
              onPointerDown={(e) => {
                e.stopPropagation()
                setSelectedIcon(icon.id)
              }}
              onDoubleClick={() => launch(icon)}
            >
              <div className="glyph">{icon.glyph}</div>
              <div className="label">{icon.label}</div>
            </div>
          ))}
        </div>

        {windows.map((win) => (
          <Window key={win.id} win={win}>
            {win.kind === 'explorer' && <Explorer win={win} />}
            {win.kind === 'winamp' && <Winamp win={win} />}
            {win.kind === 'add-youtube' && <AddYouTube win={win} />}
            {win.kind === 'about' && <About win={win} />}
          </Window>
        ))}
      </div>

      {startOpen && (
        <div className="start-menu" onPointerDown={(e) => e.stopPropagation()}>
          <div className="sidebar">Win98 Music</div>
          <div className="items">
            <div className="item" onClick={() => { openWindow('explorer', { folderId: 'my-computer' }); setStartOpen(false) }}>
              🖥️ Mój komputer
            </div>
            <div className="item" onClick={() => { openWindow('winamp'); setStartOpen(false) }}>
              🎵 Winamp
            </div>
            <div className="item" onClick={() => { openWindow('add-youtube'); setStartOpen(false) }}>
              📺 Dodaj z YouTube
            </div>
            <div className="sep" />
            <div className="item" onClick={() => { openWindow('about'); setStartOpen(false) }}>
              ℹ️ Informacje
            </div>
          </div>
        </div>
      )}

      <div className="taskbar" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className={`start-button ${startOpen ? 'open' : ''}`}
          onClick={() => setStartOpen((s) => !s)}
        >
          🪟 Start
        </button>
        <div className="taskbar-divider" />
        <div className="task-tabs">
          {windows.map((win) => (
            <div
              key={win.id}
              className={`task-tab ${win.z === topZ && !win.minimized ? 'active' : ''}`}
              onClick={() => {
                if (win.minimized) toggleMinimize(win.id)
                focusWindow(win.id)
              }}
            >
              {win.title}
            </div>
          ))}
        </div>
        <div className="tray">
          <Clock />
        </div>
      </div>
    </>
  )
}
