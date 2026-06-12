import type { FolderNode } from './types'

// The default contents of "Mój komputer". The C: drive holds a Muzyka folder
// with one folder per artist; each artist holds tracks.
//
// The "Demo" tracks are SoundHelix sample songs — freely usable for demos —
// so the player works the moment you open it, with zero setup. Add your own
// MP3s (drag & drop) or YouTube tracks (paste a link) from inside the app.

export function defaultFileSystem(): FolderNode {
  return {
    kind: 'folder',
    id: 'my-computer',
    name: 'Mój komputer',
    icon: 'folder',
    children: [
      {
        kind: 'folder',
        id: 'c-drive',
        name: 'Dysk lokalny (C:)',
        icon: 'drive',
        children: [
          {
            kind: 'folder',
            id: 'muzyka',
            name: 'Muzyka',
            icon: 'music',
            children: [
              {
                kind: 'folder',
                id: 'artist-demo',
                name: 'Demo (działa od razu)',
                icon: 'folder',
                children: [
                  {
                    kind: 'track',
                    id: 't-demo-1',
                    track: {
                      id: 't-demo-1',
                      title: 'SoundHelix Song 1',
                      artist: 'SoundHelix',
                      source: { kind: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
                    },
                  },
                  {
                    kind: 'track',
                    id: 't-demo-2',
                    track: {
                      id: 't-demo-2',
                      title: 'SoundHelix Song 2',
                      artist: 'SoundHelix',
                      source: { kind: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
                    },
                  },
                ],
              },
              {
                kind: 'folder',
                id: 'artist-youtube',
                name: 'Z YouTube (wklej link)',
                icon: 'folder',
                children: [],
              },
              {
                kind: 'folder',
                id: 'artist-moje-mp3',
                name: 'Moje MP3 (przeciągnij plik)',
                icon: 'folder',
                children: [],
              },
            ],
          },
        ],
      },
    ],
  }
}

/** A reasonable default folder to drop newly added tracks into. */
export const YOUTUBE_FOLDER_ID = 'artist-youtube'
export const MP3_FOLDER_ID = 'artist-moje-mp3'
