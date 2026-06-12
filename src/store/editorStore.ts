import { create } from 'zustand'
import type {
  Composition,
  Easing,
  Layer,
  Property,
  PropKind,
  ShapeType,
} from '../core/model'
import { createComposition, createLayer, uid } from '../core/factory'
import { evalProperty } from '../core/interpolate'
import { PRESETS } from '../core/presets'

// ---------------------------------------------------------------------------
// Central editor store.
//
// `comp` is the single source of truth. Structural edits go through
// `withHistory` so undo/redo works; transient UI state (playhead, selection,
// playing, autoKey) is set directly and never recorded in history.
// ---------------------------------------------------------------------------

export interface KeyframeRef {
  layerId: string
  prop: PropKind
  kfId: string
}

interface EditorState {
  comp: Composition
  selectedLayerId: string | null
  selectedKeyframe: KeyframeRef | null
  playhead: number
  playing: boolean
  autoKey: boolean
  past: Composition[]
  future: Composition[]
  interactiveBase: Composition | null

  // transient
  setPlayhead: (frame: number) => void
  step: (delta: number) => void
  setPlaying: (playing: boolean) => void
  togglePlaying: () => void
  toggleAutoKey: () => void
  selectLayer: (id: string | null) => void
  selectKeyframe: (ref: KeyframeRef | null) => void

  // composition
  setComp: (patch: Partial<Composition>) => void
  newProject: () => void
  loadComposition: (comp: Composition) => void

  // layers
  addLayer: (shape: ShapeType) => void
  addLayers: (layers: Layer[]) => void
  deleteLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  renameLayer: (id: string, name: string) => void
  toggleVisible: (id: string) => void
  reorderLayer: (id: string, dir: -1 | 1) => void
  setLayerSize: (id: string, size: [number, number]) => void
  setCornerRadius: (id: string, r: number) => void
  setFillEnabled: (id: string, enabled: boolean) => void
  setStrokeColor: (id: string, color: number[]) => void
  setStrokeWidth: (id: string, width: number) => void

  // properties / keyframes
  setProperty: (layerId: string, prop: PropKind, value: number[]) => void
  // live drag: snapshot once, stream updates, commit once
  beginInteractive: () => void
  setPropertyLive: (layerId: string, prop: PropKind, value: number[]) => void
  mutateLive: (producer: (draft: Composition) => void) => void
  endInteractive: () => void
  toggleAnimated: (layerId: string, prop: PropKind) => void
  addKeyframe: (layerId: string, prop: PropKind) => void
  removeKeyframe: (layerId: string, prop: PropKind, kfId: string) => void
  moveKeyframe: (layerId: string, prop: PropKind, kfId: string, t: number) => void
  setKeyframeEasing: (
    layerId: string,
    prop: PropKind,
    kfId: string,
    easing: Easing,
  ) => void
  applyPreset: (layerId: string, presetId: string) => void

  // history
  undo: () => void
  redo: () => void
}

const clone = <T,>(o: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(o)
    : JSON.parse(JSON.stringify(o))

const findLayer = (comp: Composition, id: string | null) =>
  comp.layers.find((l) => l.id === id)

function upsertKeyframe(p: Property, t: number, value: number[], easing: Easing) {
  const rt = Math.round(t)
  const existing = p.keyframes.find((k) => k.t === rt)
  if (existing) {
    existing.value = value
  } else {
    p.keyframes.push({ id: uid('kf'), t: rt, value, easing })
    p.keyframes.sort((a, b) => a.t - b.t)
  }
}

/** Shared write path for both committed edits and live drags. */
function writeProperty(
  c: Composition,
  layerId: string,
  prop: PropKind,
  value: number[],
  playhead: number,
  autoKey: boolean,
) {
  const l = c.layers.find((x) => x.id === layerId)
  if (!l) return
  const p = l[prop]
  if (p.animated) {
    upsertKeyframe(p, playhead, value, 'easeInOut')
  } else if (autoKey) {
    p.animated = true
    p.value = value
    upsertKeyframe(p, playhead, value, 'easeInOut')
  } else {
    p.value = value
  }
}

export const useEditor = create<EditorState>((set, get) => {
  /** Apply a structural mutation to a cloned comp and record it for undo. */
  const withHistory = (producer: (draft: Composition) => void) =>
    set((s) => {
      const prev = s.comp
      const draft = clone(prev)
      producer(draft)
      return { comp: draft, past: [...s.past, prev].slice(-80), future: [] }
    })

  return {
    comp: createComposition(),
    selectedLayerId: null,
    selectedKeyframe: null,
    playhead: 0,
    playing: false,
    autoKey: true,
    past: [],
    future: [],
    interactiveBase: null,

    // ---- transient ------------------------------------------------------
    setPlayhead: (frame) =>
      set((s) => ({
        playhead: Math.max(0, Math.min(s.comp.duration, Math.round(frame))),
      })),
    step: (delta) =>
      set((s) => ({
        playhead: Math.max(
          0,
          Math.min(s.comp.duration, Math.round(s.playhead + delta)),
        ),
        playing: false,
      })),
    setPlaying: (playing) => set({ playing }),
    togglePlaying: () => set((s) => ({ playing: !s.playing })),
    toggleAutoKey: () => set((s) => ({ autoKey: !s.autoKey })),
    selectLayer: (id) => set({ selectedLayerId: id, selectedKeyframe: null }),
    selectKeyframe: (ref) => set({ selectedKeyframe: ref }),

    // ---- composition ----------------------------------------------------
    setComp: (patch) =>
      withHistory((c) => {
        Object.assign(c, patch)
        c.w = Math.max(1, Math.round(c.w))
        c.h = Math.max(1, Math.round(c.h))
        c.fr = Math.max(1, Math.round(c.fr))
        c.duration = Math.max(1, Math.round(c.duration))
      }),
    newProject: () =>
      set({
        comp: createComposition(),
        selectedLayerId: null,
        selectedKeyframe: null,
        playhead: 0,
        playing: false,
        past: [],
        future: [],
      }),
    loadComposition: (comp) =>
      set({
        comp,
        selectedLayerId: null,
        selectedKeyframe: null,
        playhead: 0,
        playing: false,
        past: [],
        future: [],
      }),

    // ---- layers ---------------------------------------------------------
    addLayer: (shape) => {
      const layer = createLayer(shape, get().comp)
      withHistory((c) => {
        c.layers.unshift(layer)
      })
      set({ selectedLayerId: layer.id })
    },
    addLayers: (layers) => {
      if (!layers.length) return
      withHistory((c) => {
        c.layers.unshift(...layers)
      })
      set({ selectedLayerId: layers[0].id })
    },
    deleteLayer: (id) => {
      withHistory((c) => {
        c.layers = c.layers.filter((l) => l.id !== id)
      })
      if (get().selectedLayerId === id)
        set({ selectedLayerId: null, selectedKeyframe: null })
    },
    duplicateLayer: (id) => {
      let newId: string | null = null
      withHistory((c) => {
        const idx = c.layers.findIndex((l) => l.id === id)
        if (idx < 0) return
        const copy = clone(c.layers[idx])
        copy.id = uid('layer')
        copy.name = `${copy.name} copy`
        // fresh keyframe ids so they never collide with the source
        for (const prop of ['position', 'scale', 'rotation', 'opacity', 'fillColor'] as PropKind[]) {
          copy[prop].keyframes = copy[prop].keyframes.map((k) => ({ ...k, id: uid('kf') }))
        }
        newId = copy.id
        c.layers.splice(idx, 0, copy)
      })
      if (newId) set({ selectedLayerId: newId })
    },
    renameLayer: (id, name) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (l) l.name = name
      }),
    toggleVisible: (id) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (l) l.visible = !l.visible
      }),
    reorderLayer: (id, dir) =>
      withHistory((c) => {
        const idx = c.layers.findIndex((l) => l.id === id)
        const next = idx + dir
        if (idx < 0 || next < 0 || next >= c.layers.length) return
        const [item] = c.layers.splice(idx, 1)
        c.layers.splice(next, 0, item)
      }),
    setLayerSize: (id, size) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (l) l.size = [Math.max(1, size[0]), Math.max(1, size[1])]
      }),
    setCornerRadius: (id, r) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (l) l.cornerRadius = Math.max(0, r)
      }),
    setFillEnabled: (id, enabled) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (l) l.fillEnabled = enabled
      }),
    setStrokeColor: (id, color) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (l && l.stroke) l.stroke = { ...l.stroke, color }
      }),
    setStrokeWidth: (id, width) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (l && l.stroke) l.stroke = { ...l.stroke, width: Math.max(0, width) }
      }),

    // ---- properties / keyframes ----------------------------------------
    setProperty: (layerId, prop, value) => {
      const { playhead, autoKey } = get()
      withHistory((c) => writeProperty(c, layerId, prop, value, playhead, autoKey))
    },
    beginInteractive: () =>
      set((s) => (s.interactiveBase ? s : { interactiveBase: clone(s.comp) })),
    setPropertyLive: (layerId, prop, value) => {
      const { playhead, autoKey } = get()
      set((s) => {
        const draft = clone(s.comp)
        writeProperty(draft, layerId, prop, value, playhead, autoKey)
        return { comp: draft }
      })
    },
    mutateLive: (producer) =>
      set((s) => {
        const draft = clone(s.comp)
        producer(draft)
        return { comp: draft }
      }),
    endInteractive: () =>
      set((s) =>
        s.interactiveBase
          ? {
              past: [...s.past, s.interactiveBase].slice(-80),
              future: [],
              interactiveBase: null,
            }
          : s,
      ),
    toggleAnimated: (layerId, prop) => {
      const { playhead } = get()
      withHistory((c) => {
        const l = findLayer(c, layerId)
        if (!l) return
        const p = l[prop]
        if (p.animated) {
          // bake current frame value, then drop keyframes
          p.value = evalProperty(p, playhead)
          p.animated = false
          p.keyframes = []
        } else {
          p.animated = true
          p.keyframes = [
            { id: uid('kf'), t: Math.round(playhead), value: p.value, easing: 'easeInOut' },
          ]
        }
      })
    },
    addKeyframe: (layerId, prop) => {
      const { playhead } = get()
      withHistory((c) => {
        const l = findLayer(c, layerId)
        if (!l) return
        const p = l[prop]
        const value = p.animated ? evalProperty(p, playhead) : p.value
        p.animated = true
        upsertKeyframe(p, playhead, value, 'easeInOut')
      })
    },
    removeKeyframe: (layerId, prop, kfId) =>
      withHistory((c) => {
        const l = findLayer(c, layerId)
        if (!l) return
        const p = l[prop]
        p.keyframes = p.keyframes.filter((k) => k.id !== kfId)
        if (p.keyframes.length === 0) p.animated = false
      }),
    moveKeyframe: (layerId, prop, kfId, t) => {
      const dur = get().comp.duration
      withHistory((c) => {
        const l = findLayer(c, layerId)
        if (!l) return
        const k = l[prop].keyframes.find((x) => x.id === kfId)
        if (!k) return
        k.t = Math.max(0, Math.min(dur, Math.round(t)))
        l[prop].keyframes.sort((a, b) => a.t - b.t)
      })
    },
    setKeyframeEasing: (layerId, prop, kfId, easing) =>
      withHistory((c) => {
        const l = findLayer(c, layerId)
        if (!l) return
        const k = l[prop].keyframes.find((x) => x.id === kfId)
        if (k) k.easing = easing
      }),
    applyPreset: (layerId, presetId) => {
      const preset = PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      const comp = get().comp
      const layer = findLayer(comp, layerId)
      if (!layer) return
      const changes = preset.build(layer, comp)
      withHistory((c) => {
        const l = findLayer(c, layerId)
        if (!l) return
        for (const change of changes) {
          const p = l[change.prop]
          p.animated = true
          p.keyframes = change.keyframes
        }
      })
    },

    // ---- history --------------------------------------------------------
    undo: () =>
      set((s) => {
        if (s.past.length === 0) return s
        const prev = s.past[s.past.length - 1]
        const selExists = prev.layers.some((l) => l.id === s.selectedLayerId)
        return {
          comp: prev,
          past: s.past.slice(0, -1),
          future: [s.comp, ...s.future].slice(0, 80),
          playhead: Math.min(s.playhead, prev.duration),
          selectedLayerId: selExists ? s.selectedLayerId : null,
          selectedKeyframe: null,
        }
      }),
    redo: () =>
      set((s) => {
        if (s.future.length === 0) return s
        const next = s.future[0]
        const selExists = next.layers.some((l) => l.id === s.selectedLayerId)
        return {
          comp: next,
          future: s.future.slice(1),
          past: [...s.past, s.comp].slice(-80),
          playhead: Math.min(s.playhead, next.duration),
          selectedLayerId: selExists ? s.selectedLayerId : null,
          selectedKeyframe: null,
        }
      }),
  }
})

/** Convenience selector for the currently selected layer. */
export const useSelectedLayer = (): Layer | undefined =>
  useEditor((s) => s.comp.layers.find((l) => l.id === s.selectedLayerId))
