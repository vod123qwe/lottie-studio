import { useRef, useState } from 'react'
import { folderTracks, useStore, type WinWindow } from '../lib/store'
import { isFolder, uid, type FsNode, type Track } from '../lib/types'

const FOLDER_GLYPHS: Record<string, string> = {
  drive: '💽',
  music: '🎶',
  folder: '📁',
}

export function Explorer({ win }: { win: WinWindow }) {
  const { findFolder, addTracks, playTracks, openWindow } = useStore()
  // navigation stack of folder ids, starting at the window's root
  const [stack, setStack] = useState<string[]>([win.folderId ?? 'my-computer'])
  const [selected, setSelected] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const currentId = stack[stack.length - 1]
  const folder = findFolder(currentId)
  if (!folder) return <div className="window-body">Nie znaleziono folderu.</div>

  const pathLabel = stack
    .map((id) => findFolder(id)?.name ?? '?')
    .join(' \\ ')

  const open = (node: FsNode) => {
    if (isFolder(node)) {
      setStack((s) => [...s, node.id])
      setSelected(null)
    } else {
      const tracks = folderTracks(folder)
      const idx = tracks.findIndex((t) => t.id === node.track.id)
      playTracks(tracks, Math.max(0, idx))
    }
  }

  const goUp = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const tracks: Track[] = Array.from(files)
      .filter((f) => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|flac)$/i.test(f.name))
      .map((f) => ({
        id: uid('trk'),
        title: f.name.replace(/\.[^.]+$/, ''),
        artist: folder.name,
        source: { kind: 'audio', url: URL.createObjectURL(f) },
      }))
    if (tracks.length) addTracks(currentId, tracks)
  }

  // top-level "Mój komputer" only holds the drive — no point hinting about MP3s there
  const canHoldMusic = currentId !== 'my-computer'

  return (
    <div className="window-body" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="explorer-toolbar">
        <button className="btn" style={{ minWidth: 40 }} onClick={goUp} disabled={stack.length <= 1}>
          ⬆ W górę
        </button>
        <button className="btn" style={{ minWidth: 40 }} onClick={() => fileInput.current?.click()}>
          ＋ MP3
        </button>
        <button className="btn" style={{ minWidth: 40 }} onClick={() => openWindow('add-youtube', { folderId: currentId })}>
          ＋ YouTube
        </button>
        <div className="explorer-path" title={pathLabel}>
          {pathLabel}
        </div>
      </div>

      <div
        className="explorer-grid"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFiles(e.dataTransfer.files)
        }}
        style={dragOver ? { outline: '2px dashed #000080', outlineOffset: -4 } : undefined}
      >
        {folder.children.length === 0 && (
          <div className="explorer-empty">
            Pusty folder.{canHoldMusic ? ' Przeciągnij tu pliki MP3 albo dodaj utwór z YouTube („＋ YouTube").' : ''}
          </div>
        )}
        {folder.children.map((node) => {
          const isF = isFolder(node)
          const glyph = isF ? FOLDER_GLYPHS[node.icon ?? 'folder'] : '🎵'
          const name = isF ? node.name : `${node.track.title}`
          return (
            <div
              key={node.id}
              className={`file-item ${selected === node.id ? 'selected' : ''}`}
              onClick={() => setSelected(node.id)}
              onDoubleClick={() => open(node)}
              title={name}
            >
              <div className="glyph">{glyph}</div>
              <div className="name">{name}</div>
            </div>
          )
        })}
      </div>

      <div className="statusbar bevel-in" style={{ margin: 2 }}>
        {folder.children.length} obiekt(ów)
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="audio/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
