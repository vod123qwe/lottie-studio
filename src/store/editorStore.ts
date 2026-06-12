import { create } from 'zustand'
import type {
  Composition,
  Easing,
  Gradient,
  Layer,
  Property,
  PropKind,
  ShapeType,
} from '../core/model'
import { createComposition, createLayer, uid } from '../core/factory'
import { evalProperty } from '../core/interpolate'
import { PRESETS, type PresetResult } from '../core/presets'

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
  selectedLayerId: string | null // "primary" selection (drives the inspector)
  selectedLayerIds: string[] // full multi-selection (includes the primary)
  selectedKeyframe: KeyframeRef | null // primary keyframe (drives easing UI)
  selectedKeyframes: KeyframeRef[] // full keyframe multi-selection
  renameRequest: string | null // layer id whose name field should focus
  playhead: number
  playing: boolean
  autoKey: boolean
  previewOpen: boolean
  contextMenu: { x: number; y: number; layerId: string } | null
  past: Composition[]
  future: Composition[]
  interactiveBase: Composition | null

  // transient
  setPlayhead: (frame: number) => void
  step: (delta: number) => void
  setPlaying: (playing: boolean) => void
  togglePlaying: () => void
  toggleAutoKey: () => void
  setPreview: (open: boolean) => void
  selectLayer: (id: string | null) => void
  toggleSelect: (id: string) => void
  selectLayers: (ids: string[]) => void
  deleteSelected: () => void
  selectKeyframe: (ref: KeyframeRef | null) => void
  toggleKeyframe: (ref: KeyframeRef) => void
  selectKeyframes: (refs: KeyframeRef[]) => void
  removeSelectedKeyframes: () => void
  setKeyframeTimesLive: (updates: { layerId: string; prop: PropKind; kfId: string; t: number }[]) => void

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
  moveLayerTo: (id: string, index: number) => void
  requestRename: (id: string | null) => void
  setLayerSize: (id: string, size: [number, number]) => void
  setCornerRadius: (id: string, r: number) => void
  setFillEnabled: (id: string, enabled: boolean) => void
  setStrokeColor: (id: string, color: number[]) => void
  setStrokeWidth: (id: string, width: number) => void
  setGradient: (id: string, gradient: Gradient | null) => void
  resetLayer: (id: string) => void
  openLayerMenu: (x: number, y: number, layerId: string) => void
  closeMenu: () => void

  // properties / keyframes
  setProperty: (layerId: string, prop: PropKind, value: number[]) => void
  // live drag: snapshot once, stream updates, commit once
  beginInteractive: () => void
  setPropertyLive: (layerId: string, prop: PropKind, value: number[]) => void
  setGradientLive: (id: string, gradient: Gradient | null) => void
  setStrokeColorLive: (id: string, color: number[]) => void
  setStrokeGradientLive: (id: string, gradient: Gradient | null) => void
  setCompLive: (patch: Partial<Composition>) => void
  setLayerPositionsLive: (positions: Record<string, [number, number]>) => void
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
  applyPresetToSelected: (presetId: string) => void

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
    selectedLayerIds: [],
    selectedKeyframe: null,
    selectedKeyframes: [],
    renameRequest: null,
    playhead: 0,
    playing: false,
    autoKey: true,
    previewOpen: false,
    contextMenu: null,
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
    setPreview: (open) => set({ previewOpen: open, playing: false }),
    selectLayer: (id) =>
      set({ selectedLayerId: id, selectedLayerIds: id ? [id] : [], selectedKeyframe: null, selectedKeyframes: [] }),
    toggleSelect: (id) =>
      set((s) => {
        const has = s.selectedLayerIds.includes(id)
        const ids = has ? s.selectedLayerIds.filter((x) => x !== id) : [...s.selectedLayerIds, id]
        return {
          selectedLayerIds: ids,
          selectedLayerId: has ? (ids[ids.length - 1] ?? null) : id,
          selectedKeyframe: null,
          selectedKeyframes: [],
        }
      }),
    selectLayers: (ids) =>
      set({ selectedLayerIds: ids, selectedLayerId: ids[ids.length - 1] ?? null, selectedKeyframe: null, selectedKeyframes: [] }),
    deleteSelected: () =>
      set((s) => {
        const kill = new Set(s.selectedLayerIds.length ? s.selectedLayerIds : s.selectedLayerId ? [s.selectedLayerId] : [])
        if (!kill.size) return s
        const draft = clone(s.comp)
        draft.layers = draft.layers.filter((l) => !kill.has(l.id))
        return {
          comp: draft,
          past: [...s.past, s.comp].slice(-80),
          future: [],
          selectedLayerId: null,
          selectedLayerIds: [],
          selectedKeyframe: null,
          selectedKeyframes: [],
        }
      }),
    selectKeyframe: (ref) => set({ selectedKeyframe: ref, selectedKeyframes: ref ? [ref] : [] }),
    toggleKeyframe: (ref) =>
      set((s) => {
        const eq = (a: KeyframeRef, b: KeyframeRef) => a.layerId === b.layerId && a.prop === b.prop && a.kfId === b.kfId
        const has = s.selectedKeyframes.some((r) => eq(r, ref))
        const refs = has ? s.selectedKeyframes.filter((r) => !eq(r, ref)) : [...s.selectedKeyframes, ref]
        return { selectedKeyframes: refs, selectedKeyframe: has ? refs[refs.length - 1] ?? null : ref }
      }),
    selectKeyframes: (refs) => set({ selectedKeyframes: refs, selectedKeyframe: refs[refs.length - 1] ?? null }),
    removeSelectedKeyframes: () => {
      const refs = get().selectedKeyframes
      if (!refs.length) return
      withHistory((c) => {
        for (const ref of refs) {
          const l = findLayer(c, ref.layerId)
          if (!l) continue
          const p = l[ref.prop]
          p.keyframes = p.keyframes.filter((k) => k.id !== ref.kfId)
          if (p.keyframes.length === 0) p.animated = false
        }
      })
      set({ selectedKeyframe: null, selectedKeyframes: [] })
    },
    setKeyframeTimesLive: (updates) => {
      set((s) => {
        const dur = s.comp.duration
        const draft = clone(s.comp)
        const touched = new Set<string>()
        for (const u of updates) {
          const l = draft.layers.find((x) => x.id === u.layerId)
          const k = l?.[u.prop].keyframes.find((x) => x.id === u.kfId)
          if (k) {
            k.t = Math.max(0, Math.min(dur, Math.round(u.t)))
            touched.add(`${u.layerId}::${u.prop}`)
          }
        }
        for (const key of touched) {
          const [lid, pr] = key.split('::')
          const l = draft.layers.find((x) => x.id === lid)
          l?.[pr as PropKind].keyframes.sort((a, b) => a.t - b.t)
        }
        return { comp: draft }
      })
    },

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
        selectedLayerIds: [],
        selectedKeyframe: null,
        selectedKeyframes: [],
        playhead: 0,
        playing: false,
        past: [],
        future: [],
      }),
    loadComposition: (comp) =>
      set({
        comp,
        selectedLayerId: null,
        selectedLayerIds: [],
        selectedKeyframe: null,
        selectedKeyframes: [],
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
      set({ selectedLayerId: layer.id, selectedLayerIds: [layer.id] })
    },
    addLayers: (layers) => {
      if (!layers.length) return
      withHistory((c) => {
        c.layers.unshift(...layers)
      })
      set({ selectedLayerId: layers[0].id, selectedLayerIds: layers.map((l) => l.id) })
    },
    deleteLayer: (id) => {
      withHistory((c) => {
        c.layers = c.layers.filter((l) => l.id !== id)
      })
      set((s) => ({
        selectedLayerIds: s.selectedLayerIds.filter((x) => x !== id),
        selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
        selectedKeyframe: s.selectedLayerId === id ? null : s.selectedKeyframe,
      }))
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
      if (newId) set({ selectedLayerId: newId, selectedLayerIds: [newId] })
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
    moveLayerTo: (id, index) =>
      withHistory((c) => {
        const from = c.layers.findIndex((l) => l.id === id)
        if (from < 0) return
        const [item] = c.layers.splice(from, 1)
        c.layers.splice(Math.max(0, Math.min(c.layers.length, index)), 0, item)
      }),
    requestRename: (id) => set({ renameRequest: id }),
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
    setGradient: (id, gradient) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (l) l.gradient = gradient
      }),
    resetLayer: (id) =>
      withHistory((c) => {
        const l = findLayer(c, id)
        if (!l) return
        // de-animate everything; keep where it sits, neutralize transform
        const pos = evalProperty(l.position, 0)
        l.position = { animated: false, value: [pos[0], pos[1]], keyframes: [] }
        l.scale = { animated: false, value: [100, 100], keyframes: [] }
        l.rotation = { animated: false, value: [0], keyframes: [] }
        l.opacity = { animated: false, value: [100], keyframes: [] }
        l.fillColor = { animated: false, value: l.fillColor.value, keyframes: [] }
        l.pathKeyframes = undefined
      }),
    openLayerMenu: (x, y, layerId) => set({ contextMenu: { x, y, layerId } }),
    closeMenu: () => set({ contextMenu: null }),

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
    setGradientLive: (id, gradient) =>
      set((s) => {
        const draft = clone(s.comp)
        const l = draft.layers.find((x) => x.id === id)
        if (l) l.gradient = gradient
        return { comp: draft }
      }),
    setStrokeColorLive: (id, color) =>
      set((s) => {
        const draft = clone(s.comp)
        const l = draft.layers.find((x) => x.id === id)
        if (l && l.stroke) l.stroke = { ...l.stroke, color }
        return { comp: draft }
      }),
    setStrokeGradientLive: (id, gradient) =>
      set((s) => {
        const draft = clone(s.comp)
        const l = draft.layers.find((x) => x.id === id)
        if (l && l.stroke) l.stroke = { ...l.stroke, gradient }
        return { comp: draft }
      }),
    setCompLive: (patch) =>
      set((s) => ({ comp: { ...clone(s.comp), ...patch } })),
    setLayerPositionsLive: (positions) => {
      const { playhead, autoKey } = get()
      set((s) => {
        const draft = clone(s.comp)
        for (const id in positions) writeProperty(draft, id, 'position', positions[id], playhead, autoKey)
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
      set((s) => {
        if (!s.interactiveBase) return s
        // only record history if the interaction actually changed something —
        // a plain click (no drag) must not pollute undo with a no-op step
        const changed = JSON.stringify(s.interactiveBase) !== JSON.stringify(s.comp)
        if (!changed) return { interactiveBase: null }
        return { past: [...s.past, s.interactiveBase].slice(-80), future: [], interactiveBase: null }
      }),
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
      const out = preset.build(layer, comp)
      const result = Array.isArray(out) ? { changes: out } : out
      withHistory((c) => {
        const l = findLayer(c, layerId)
        if (!l) return
        for (const change of result.changes ?? []) {
          const p = l[change.prop]
          p.animated = true
          p.keyframes = change.keyframes
        }
        if (result.pathKeyframes?.length) l.pathKeyframes = result.pathKeyframes
        if (result.addLayers?.length) {
          const idx = c.layers.findIndex((x) => x.id === layerId)
          // helper layers sit just behind the target in the stack
          c.layers.splice(idx < 0 ? c.layers.length : idx + 1, 0, ...result.addLayers)
        }
      })
    },
    applyPresetToSelected: (presetId) => {
      const preset = PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      const { comp, selectedLayerIds, selectedLayerId } = get()
      const ids = selectedLayerIds.length ? selectedLayerIds : selectedLayerId ? [selectedLayerId] : []
      if (!ids.length) return
      // build per layer against the current comp, then commit as one history step
      const builds = ids
        .map((id) => {
          const l = findLayer(comp, id)
          if (!l) return null
          const out = preset.build(l, comp)
          return { id, res: Array.isArray(out) ? { changes: out } : out }
        })
        .filter((b): b is { id: string; res: PresetResult } => b !== null)
      withHistory((c) => {
        for (const b of builds) {
          const l = findLayer(c, b.id)
          if (!l) continue
          for (const change of b.res.changes ?? []) {
            const p = l[change.prop]
            p.animated = true
            p.keyframes = change.keyframes
          }
          if (b.res.pathKeyframes?.length) l.pathKeyframes = b.res.pathKeyframes
          if (b.res.addLayers?.length) {
            const idx = c.layers.findIndex((x) => x.id === b.id)
            c.layers.splice(idx < 0 ? c.layers.length : idx + 1, 0, ...b.res.addLayers)
          }
        }
      })
    },

    // ---- history --------------------------------------------------------
    undo: () =>
      set((s) => {
        if (s.past.length === 0) return s
        const prev = s.past[s.past.length - 1]
        const present = new Set(prev.layers.map((l) => l.id))
        const ids = s.selectedLayerIds.filter((id) => present.has(id))
        return {
          comp: prev,
          past: s.past.slice(0, -1),
          future: [s.comp, ...s.future].slice(0, 80),
          playhead: Math.min(s.playhead, prev.duration),
          selectedLayerIds: ids,
          selectedLayerId: present.has(s.selectedLayerId ?? '') ? s.selectedLayerId : ids[ids.length - 1] ?? null,
          selectedKeyframe: null,
          selectedKeyframes: [],
        }
      }),
    redo: () =>
      set((s) => {
        if (s.future.length === 0) return s
        const next = s.future[0]
        const present = new Set(next.layers.map((l) => l.id))
        const ids = s.selectedLayerIds.filter((id) => present.has(id))
        return {
          comp: next,
          future: s.future.slice(1),
          past: [...s.past, s.comp].slice(-80),
          playhead: Math.min(s.playhead, next.duration),
          selectedLayerIds: ids,
          selectedLayerId: present.has(s.selectedLayerId ?? '') ? s.selectedLayerId : ids[ids.length - 1] ?? null,
          selectedKeyframe: null,
          selectedKeyframes: [],
        }
      }),
  }
})

/** Convenience selector for the currently selected layer. */
export const useSelectedLayer = (): Layer | undefined =>
  useEditor((s) => s.comp.layers.find((l) => l.id === s.selectedLayerId))
