// ---------------------------------------------------------------------------
// Built-in icon library. Each icon is a tiny SVG that runs through the normal
// SVG importer, so it lands on the canvas as native, per-element path layers —
// ready for any preset (morph, flag wave, motion, FX…). Stroke icons inherit a
// neutral slate via the wrapping <g>; filled glyphs use the same.
// ---------------------------------------------------------------------------

type Kind = 'fill' | 'stroke'

interface IconDef {
  id: string
  name: string
  kind: Kind
  body: string
}

const COLOR = '#334155'

const DEFS: IconDef[] = [
  { id: 'heart', name: 'Heart', kind: 'fill', body: '<path d="M12 21s-7-4.6-9.5-8.6C.6 9.3 2.6 4.8 6.6 4.8 9 4.8 12 7.2 12 7.2s3-2.4 5.4-2.4C21.4 4.8 23.4 9.3 21.5 12.4 19 16.4 12 21 12 21z"/>' },
  { id: 'star', name: 'Star', kind: 'fill', body: '<path d="M12 2.5l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.8 6.3 20l1.2-6.4-4.7-4.4 6.4-.8z"/>' },
  { id: 'bolt', name: 'Bolt', kind: 'fill', body: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>' },
  { id: 'cloud', name: 'Cloud', kind: 'fill', body: '<path d="M6.5 19a4.5 4.5 0 0 1-.5-8.98 6 6 0 0 1 11.5-1.2A4 4 0 0 1 17.5 19z"/>' },
  { id: 'drop', name: 'Drop', kind: 'fill', body: '<path d="M12 2.5c3.8 4.7 6.5 7.6 6.5 11A6.5 6.5 0 0 1 5.5 13.5C5.5 10.1 8.2 7.2 12 2.5z"/>' },
  { id: 'moon', name: 'Moon', kind: 'fill', body: '<path d="M21 12.8A8 8 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8z"/>' },
  { id: 'bookmark', name: 'Bookmark', kind: 'fill', body: '<path d="M6 3h12v18l-6-4-6 4z"/>' },
  { id: 'pin', name: 'Pin', kind: 'fill', body: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z"/>' },
  { id: 'play', name: 'Play', kind: 'fill', body: '<path d="M8 5v14l11-7z"/>' },
  { id: 'chat', name: 'Chat', kind: 'fill', body: '<path d="M4 4h16v12H8l-4 4z"/>' },
  { id: 'sun', name: 'Sun', kind: 'stroke', body: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
  { id: 'bell', name: 'Bell', kind: 'stroke', body: '<path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 5.5 2 6H4c.5-.5 2-1.5 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>' },
  { id: 'arrow', name: 'Arrow', kind: 'stroke', body: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>' },
  { id: 'check', name: 'Check', kind: 'stroke', body: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5 5-6"/>' },
  { id: 'smiley', name: 'Smiley', kind: 'stroke', body: '<circle cx="12" cy="12" r="9"/><path d="M9 14a4 4 0 0 0 6 0"/><circle cx="9" cy="10" r="1" fill="' + COLOR + '"/><circle cx="15" cy="10" r="1" fill="' + COLOR + '"/>' },
  { id: 'flag', name: 'Flag', kind: 'stroke', body: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 3 2.5 3H6z" fill="' + COLOR + '"/>' },
  { id: 'bike', name: 'Bike', kind: 'stroke', body: '<circle cx="6.5" cy="16" r="4"/><circle cx="17.5" cy="16" r="4"/><path d="M6.5 16l4-8h5"/><path d="M9.5 8h4"/><path d="M17.5 16l-4-8"/>' },
  { id: 'rocket', name: 'Rocket', kind: 'stroke', body: '<path d="M5 15c-1 1-1 4-1 4s3 0 4-1l9-9a3 3 0 0 0-4-4z"/><path d="M9 11l4 4"/><path d="M14 6l4 4"/>' },
]

function compose(def: IconDef): string {
  const g =
    def.kind === 'fill'
      ? `<g fill="${COLOR}">${def.body}</g>`
      : `<g fill="none" stroke="${COLOR}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${def.body}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${g}</svg>`
}

export interface LibraryIcon {
  id: string
  name: string
  svg: string
}

export const ICON_LIBRARY: LibraryIcon[] = DEFS.map((d) => ({ id: d.id, name: d.name, svg: compose(d) }))
