# Pomysły / koncepty — Win98 Music

Log pomysłów. Status: 💡 koncept · 🔜 następne · ✅ zrobione.

## 💡 Wspólny dysk C: — kolekcje imienne + „kto czego słucha" (KONCEPT)

> _Notatka od Jarka (2026-06-12): nostalgiczny pomysł, który łączy ludzi._

Pomysł: na dysku **C:** są **foldery imienne** — np. `Jarek`, `Blanka`, `Rafał`,
`Marcin`, `Emisia`, `Kaśka`, `Róża`. Każdy wrzuca do swojego folderu swoje
piosenki / całe albumy. Każdy może:

- wejść na stronę i słuchać **swojej** muzyki,
- wejść do **cudzego** folderu i słuchać czyjejś kolekcji,
- zobaczyć **obecność**: „**Jarek** słucha teraz _Tej i Tej_ z kolekcji **Blanki**".

Klimat: jak wspólny komputer / serwer ze znajomymi — retro, osobiste, łączące ludzi.

### Co to zmienia technicznie (ważne)

Obecne v0 jest w 100% po stronie przeglądarki (zero backendu). Ten koncept
wymaga **backendu**, bo dane są *współdzielone* między ludźmi:

1. **Tożsamość** — kto jest kim (proste logowanie / nick + hasło / link zapraszający dla grupy znajomych).
2. **Wspólne przechowywanie kolekcji**:
   - **Lokalne MP3** → trzeba je gdzieś trzymać (object storage: S3 / R2 / Supabase Storage).
     Uwaga prawno-autorska: hostowanie cudzych plików muzycznych publicznie to ryzyko —
     bezpieczniej trzymać to jako **zamknięta grupa** (prywatny dostęp) i/lub używać linków YouTube zamiast plików.
   - **Utwory z YouTube** → przechowujemy tylko **listę ID** (lekkie, brak hostowania audio) — to najczystsza droga dla tego konceptu.
3. **Obecność / „kto czego słucha" w czasie rzeczywistym** — WebSocket lub gotowiec
   (Supabase Realtime / Firebase / Ably / własny mały serwer Node + socket.io).
   Każdy klient publikuje „teraz gram: utwór X z folderu Y", reszta to widzi (np. na pulpicie albo w „Sieci/Otoczeniu sieciowym").

### Szkic MVP (gdy zdecydujemy budować)

- Stack: obecny front + **Supabase** (auth + Postgres + Storage + Realtime) — najmniej kodu backendu.
- Model: `users`, `folders (owner_id)`, `tracks (folder_id, source: youtube|file)`, `presence (user_id, track_id, started_at)`.
- Tryb „tylko YouTube" jako wersja 1 (brak hostowania plików = brak problemów prawnych i kosztów storage).
- Na pulpicie ikona **„Otoczenie sieciowe"** pokazująca, kto jest online i czego słucha (idealnie retro!).

### Otwarte pytania

- Grupa **prywatna** (znajomi, zaproszenia) czy publiczna? (rekomendacja: prywatna).
- MP3 hostowane czy tylko linki YouTube? (rekomendacja na start: tylko YouTube).
- Czy historia odsłuchań / „ostatnio grane przez znajomych" (taki feed)?

---

## Mniejsze usprawnienia (do v0)

- 💡 Webamp (prawdziwe skórki `.wsz`) zamiast własnej skórki.
- 💡 Wyszukiwarka YouTube (Data API — wymaga darmowego klucza).
- 💡 Zapis dysku C: i playlist do `localStorage`, retro tapeta, dźwięki systemowe.
- 💡 Okno „Właściwości: Dysk C:" z paskiem zajętości (te kultowe 2 GB).
