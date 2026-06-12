# Win98 Music 🖥️🎵

Pulpit **Windows 98** w przeglądarce: ikona *Mój komputer*, wirtualny **Dysk C:**
z folderami artystów, i odtwarzacz w stylu **Winampa**. Klikasz utwór → gra.

Działa z:

- **lokalnymi plikami MP3** — przeciągnij plik do folderu albo użyj „＋ MP3",
- **utworami z YouTube / YouTube Music** — wklej link („＋ YouTube"). Gra przez
  **oficjalny YouTube IFrame Player** (nic nie jest pobierane; odtwarzacz musi
  zostać widoczny zgodnie z regulaminem YouTube — dlatego jest jako mały „ekranik").

> ⚠️ Świadomie **nie** pobieramy audio z YouTube — to łamałoby regulamin YT i prawo
> autorskie. Dla starej muzyki najlepiej działają nagrania „official audio" /
> kanały „… – Topic" (statyczna okładka + dźwięk = sama muzyka, bez teledysku).

## Uruchomienie

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + produkcyjny build do dist/
```

## Jak używać

1. Dwuklik na **Mój komputer** → **Dysk lokalny (C:)** → **Muzyka**.
2. Folder **Demo** ma utwory, które grają od razu (próbki SoundHelix).
3. Dodaj swoje: „＋ MP3" (pliki z dysku) albo „＋ YouTube" (link).
4. Dwuklik na utwór otwiera **Winamp** i odtwarza całą zawartość folderu jako playlistę.

## Architektura

- `src/lib/types.ts` — model danych (wirtualny system plików + utwory).
- `src/lib/library.ts` — domyślna zawartość dysku C:.
- `src/lib/store.ts` — Zustand: okna, pulpit, kolejka odtwarzania.
- `src/lib/youtube.ts` — parser linków + loader YouTube IFrame API (bez klucza).
- `src/components/*` — `Window`, `Explorer`, `Winamp`, `AddYouTube`, `About`.

Stack: **Vite + React + TypeScript + Zustand**. Zero backendu — wszystko w przeglądarce.

## Pomysły na dalej

- Prawdziwa skórka Winampa przez [Webamp](https://webamp.org) (obsługa skórek `.wsz`).
- Wyszukiwarka YouTube (YouTube Data API — wtedy potrzebny darmowy klucz).
- Spotify Web Playback SDK jako alternatywne źródło (pełne utwory dla kont Premium).
- Zapis playlist / „dysku C:" do `localStorage`, retro tapeta, dźwięki systemowe.
- Pasek Start z prawdziwym menu, okno „Właściwości" dysku z paskiem zajętości 2 GB.
