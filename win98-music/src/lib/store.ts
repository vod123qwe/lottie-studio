import { create } from 'zustand'
import type { FolderNode, FsNode, Track } from './types'
import { isFolder, uid } from './types'
import { defaultFileSystem } from './library'

export type WindowKind = 'explorer' | 'winamp' | 'about' | 'add-youtube'

export interface WinWindow {
  id: string
  kind: WindowKind
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  /** For explorer windows: the folder it opened on. */
  folderId?: string
}

interface StoreState {
  fs: FolderNode
  windows: WinWindow[]
  topZ: number

  // --- player ---
  queue: Track[]
  index: number
  isPlaying: boolean
  /** Bumped whenever a fresh load should happen (covers replaying same index). */
  playToken: number

  // --- window actions ---
  openWindow: (kind: WindowKind, opts?: { folderId?: string; title?: string }) => void
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  toggleMinimize: (id: string) => void
  moveWindow: (id: string, x: number, y: number) => void

  // --- filesystem ---
  addTracks: (folderId: string, tracks: Track[]) => void
  findFolder: (folderId: string) => FolderNode | undefined

  // --- player actions ---
  playTracks: (tracks: Track[], index: number) => void
  setIndex: (index: number) => void
  next: () => void
  prev: () => void
  setPlaying: (playing: boolean) => void
}

function findFolderIn(node: FsNode, id: string): FolderNode | undefined {
  if (node.kind === 'folder') {
    if (node.id === id) return node
    for (const child of node.children) {
      const hit = findFolderIn(child, id)
      if (hit) return hit
    }
  }
  return undefined
}

const WINDOW_DEFAULTS: Record<WindowKind, { title: string; w: number; h: number }> = {
  explorer: { title: 'Mój komputer', w: 540, h: 380 },
  winamp: { title: 'Winamp', w: 300, h: 348 },
  about: { title: 'Informacje', w: 380, h: 240 },
  'add-youtube': { title: 'Dodaj z YouTube', w: 420, h: 220 },
}

export const useStore = create<StoreState>((set, get) => ({
  fs: defaultFileSystem(),
  windows: [],
  topZ: 10,
  queue: [],
  index: -1,
  isPlaying: false,
  playToken: 0,

  openWindow: (kind, opts) => {
    const state = get()
    // winamp / about / add-youtube are singletons — focus the existing one.
    if (kind !== 'explorer') {
      const existing = state.windows.find((w) => w.kind === kind)
      if (existing) {
        // keep the target folder / title fresh when re-opening a singleton
        set({
          windows: state.windows.map((w) =>
            w.id === existing.id
              ? { ...w, folderId: opts?.folderId ?? w.folderId, title: opts?.title ?? w.title }
              : w,
          ),
        })
        get().focusWindow(existing.id)
        if (existing.minimized) get().toggleMinimize(existing.id)
        return
      }
    }
    const def = WINDOW_DEFAULTS[kind]
    const z = state.topZ + 1
    const offset = state.windows.length * 24
    const win: WinWindow = {
      id: uid('win'),
      kind,
      title: opts?.title ?? def.title,
      x: 80 + (offset % 200),
      y: 60 + (offset % 160),
      w: def.w,
      h: def.h,
      z,
      minimized: false,
      folderId: opts?.folderId,
    }
    set({ windows: [...state.windows, win], topZ: z })
  },

  closeWindow: (id) => set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),

  focusWindow: (id) =>
    set((s) => {
      const z = s.topZ + 1
      return {
        topZ: z,
        windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)),
      }
    }),

  toggleMinimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)),
    })),

  moveWindow: (id, x, y) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),

  findFolder: (folderId) => findFolderIn(get().fs, folderId),

  addTracks: (folderId, tracks) =>
    set((s) => {
      const clone = structuredClone(s.fs)
      const folder = findFolderIn(clone, folderId)
      if (folder) {
        for (const track of tracks) {
          folder.children.push({ kind: 'track', id: track.id, track })
        }
      }
      return { fs: clone }
    }),

  playTracks: (tracks, index) => {
    if (tracks.length === 0) return
    set((s) => ({
      queue: tracks,
      index: Math.max(0, Math.min(index, tracks.length - 1)),
      isPlaying: true,
      playToken: s.playToken + 1,
    }))
    get().openWindow('winamp')
  },

  setIndex: (index) =>
    set((s) => {
      if (index < 0 || index >= s.queue.length) return {}
      return { index, isPlaying: true, playToken: s.playToken + 1 }
    }),

  next: () => {
    const { index, queue } = get()
    if (queue.length === 0) return
    get().setIndex((index + 1) % queue.length)
  },

  prev: () => {
    const { index, queue } = get()
    if (queue.length === 0) return
    get().setIndex((index - 1 + queue.length) % queue.length)
  },

  setPlaying: (playing) => set({ isPlaying: playing }),
}))

/** Collect the track list (in order) of a folder's direct children. */
export function folderTracks(folder: FolderNode): Track[] {
  return folder.children.filter((c) => c.kind === 'track').map((c) => (c as { track: Track }).track)
}

export { isFolder }
