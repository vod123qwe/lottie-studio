// Helpers for the official YouTube IFrame Player API.
//
// We do NOT download anything: this streams via Google's player, which is
// allowed. The player must stay visible (YouTube ToS), so the UI keeps a small
// "screen" rather than hiding it. No API key is needed just to play by ID.

/** Pull an 11-char video id out of any common YouTube / YouTube Music URL. */
export function parseVideoId(input: string): string | null {
  const s = input.trim()
  // Already a bare id?
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const url = new URL(s)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1)
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      // /embed/<id> or /shorts/<id>
      const m = url.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)
      if (m) return m[1]
    }
  } catch {
    /* not a URL */
  }
  return null
}

// ---- IFrame API loader -----------------------------------------------------

type YTNamespace = typeof window & { YT?: any; onYouTubeIframeAPIReady?: () => void }

let apiPromise: Promise<any> | null = null

/** Load the IFrame API exactly once; resolves with the global `YT` object. */
export function loadYouTubeApi(): Promise<any> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const w = window as YTNamespace
    if (w.YT && w.YT.Player) return resolve(w.YT)
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(w.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}
