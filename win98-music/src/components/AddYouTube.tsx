import { useState } from 'react'
import { useStore, type WinWindow } from '../lib/store'
import { uid } from '../lib/types'
import { parseVideoId } from '../lib/youtube'
import { YOUTUBE_FOLDER_ID } from '../lib/library'

export function AddYouTube({ win }: { win: WinWindow }) {
  const { addTracks, closeWindow, findFolder } = useStore()
  const targetId = win.folderId ?? YOUTUBE_FOLDER_ID
  const targetName = findFolder(targetId)?.name ?? 'Muzyka'

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const videoId = parseVideoId(url)
    if (!videoId) {
      setError('Nie rozpoznaję tego linku. Wklej adres utworu z YouTube / YouTube Music.')
      return
    }
    addTracks(targetId, [
      {
        id: uid('yt'),
        title: title.trim() || 'Utwór z YouTube',
        artist: targetName,
        source: { kind: 'youtube', videoId },
      },
    ])
    closeWindow(win.id)
  }

  return (
    <div className="window-body">
      <div className="dialog-body">
        <p>
          Wklej link do utworu (najlepiej „official audio" / kanał <b>… – Topic</b> — wtedy to sama muzyka, bez teledysku).
          Trafi do folderu: <b>{targetName}</b>.
        </p>
        <div>
          <div className="hint">Link / ID z YouTube</div>
          <input
            className="field"
            style={{ width: '100%' }}
            placeholder="https://music.youtube.com/watch?v=..."
            value={url}
            autoFocus
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div>
          <div className="hint">Tytuł (opcjonalnie)</div>
          <input
            className="field"
            style={{ width: '100%' }}
            placeholder="np. Artysta — Tytuł"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        {error && <div style={{ color: '#a00' }}>{error}</div>}
        <div className="dialog-actions">
          <button className="btn" onClick={submit}>
            Dodaj
          </button>
          <button className="btn" onClick={() => closeWindow(win.id)}>
            Anuluj
          </button>
        </div>
      </div>
    </div>
  )
}
