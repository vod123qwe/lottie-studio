import { useStore, type WinWindow } from '../lib/store'

export function About({ win }: { win: WinWindow }) {
  const { closeWindow } = useStore()
  return (
    <div className="window-body">
      <div className="dialog-body">
        <p>
          <b>Win98 Music</b> — pulpit Windows 98 w przeglądarce.
        </p>
        <p>
          Otwórz <b>Mój komputer</b> → <b>Dysk lokalny (C:)</b> → <b>Muzyka</b>. Kliknij dwukrotnie utwór, żeby zagrał w Winampie.
        </p>
        <p className="hint">
          Dodaj własne MP3 (przeciągnij plik do folderu lub „＋ MP3"), albo wklej link z YouTube („＋ YouTube").
          Muzyka z YouTube leci przez oficjalny odtwarzacz — nic nie jest pobierane.
        </p>
        <div className="dialog-actions">
          <button className="btn" onClick={() => closeWindow(win.id)}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
