import type {
  Composition,
  Easing,
  Keyframe,
  Layer,
  PathKeyframe,
  Property,
  PropKind,
  SubPath,
  Vec2,
} from './model'
import { createPathLayer, createSolidLayer, uid } from './factory'
import { evalProperty } from './interpolate'
import { ringFromPath, targetRing, type MorphTarget } from './pathSample'

// ---------------------------------------------------------------------------
// Animation presets. Each preset turns one or more layer properties into
// keyframed animations, anchored to the layer's *current* values so applying
// a preset never throws away where the user placed the shape.
//
// Grouped into families (in / out / emphasis / loop) so the inspector can
// offer a segmented filter instead of one long list.
// ---------------------------------------------------------------------------

export type PresetCategory = 'in' | 'out' | 'emphasis' | 'loop' | 'motion' | 'fx' | 'path'

export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'in', label: 'In' },
  { id: 'out', label: 'Out' },
  { id: 'emphasis', label: 'Emphasis' },
  { id: 'loop', label: 'Loop' },
  { id: 'motion', label: 'Motion' },
  { id: 'fx', label: 'FX' },
  { id: 'path', label: 'Path' },
]

export interface PresetChange {
  prop: PropKind
  keyframes: Keyframe[]
}

/**
 * A preset may keyframe the target layer's properties (`changes`) and/or add
 * brand-new helper layers (`addLayers`, e.g. speed lines). `build` can return
 * either the bare change list or a richer result.
 */
export interface PresetResult {
  changes?: PresetChange[]
  addLayers?: Layer[]
  pathKeyframes?: PathKeyframe[] // animate the target layer's path (flag/morph)
}

export interface Preset {
  id: string
  name: string
  category: PresetCategory
  hint: string
  build: (layer: Layer, comp: Composition) => PresetChange[] | PresetResult
}

const kf = (t: number, value: number[], easing: Easing = 'easeInOut'): Keyframe => ({
  id: uid('kf'),
  t: Math.round(t),
  value,
  easing,
})

/** A short intro/outro window: ~30% of the timeline, capped to a sensible length. */
const introLen = (comp: Composition) => Math.min(comp.duration * 0.3, comp.fr)
const restPos = (layer: Layer) => evalProperty(layer.position, 0)
const animProp = (value: number[], keyframes: Keyframe[]): Property => ({
  animated: true,
  value,
  keyframes,
})
const clampT = (comp: Composition, t: number) => Math.max(0, Math.min(comp.duration, Math.round(t)))

const CONFETTI = [
  [0.18, 0.36, 0.96],
  [0.96, 0.21, 0.36],
  [1, 0.82, 0.4],
  [0.1, 0.78, 0.7],
  [0.65, 0.42, 1],
]

/** A faded clone of a layer (for motion trails). */
function ghost(layer: Layer, name: string, center: Vec2, opacity: number): Layer {
  const fill = evalProperty(layer.fillColor, 0)
  if (layer.shape === 'path' && layer.path) {
    return createPathLayer({
      name,
      subpaths: layer.path.map((sp) => ({
        closed: sp.closed,
        v: sp.v.map((p) => [p[0], p[1]] as Vec2),
        i: sp.i.map((p) => [p[0], p[1]] as Vec2),
        o: sp.o.map((p) => [p[0], p[1]] as Vec2),
      })),
      center,
      size: [layer.size[0], layer.size[1]],
      fill: layer.fillEnabled === false ? null : fill,
      stroke: layer.stroke ? { ...layer.stroke } : null,
      opacity,
    })
  }
  return createSolidLayer({
    name,
    shape: layer.shape === 'ellipse' ? 'ellipse' : 'rect',
    center,
    size: [layer.size[0], layer.size[1]],
    fill,
    cornerRadius: layer.cornerRadius,
    opacity,
  })
}

/** Morph a path layer to a primitive shape and back (loops). */
function morphTo(layer: Layer, comp: Composition, kind: MorphTarget): PresetResult {
  if (layer.shape !== 'path' || !layer.path?.length) return {}
  const N = 64
  const src = ringFromPath(layer.path, N)
  const tgt = targetRing(kind, Math.max(1, layer.size[0]) / 2, Math.max(1, layer.size[1]) / 2, N)
  const sub = (pts: Vec2[]): SubPath => ({
    closed: true,
    v: pts.map((p) => [p[0], p[1]] as Vec2),
    i: pts.map(() => [0, 0] as Vec2),
    o: pts.map(() => [0, 0] as Vec2),
  })
  const d = comp.duration
  return {
    pathKeyframes: [
      { t: 0, subpaths: [sub(src)], easing: 'easeInOut' },
      { t: clampT(comp, d * 0.5), subpaths: [sub(tgt)], easing: 'easeInOut' },
      { t: d, subpaths: [sub(src)], easing: 'easeInOut' },
    ],
  }
}

export const PRESETS: Preset[] = [
  // ---- entrances --------------------------------------------------------
  {
    id: 'fadeIn',
    name: 'Fade In',
    category: 'in',
    hint: 'Opacity 0 → 100',
    build: (_l, comp) => [
      { prop: 'opacity', keyframes: [kf(0, [0], 'easeOut'), kf(introLen(comp), [100])] },
    ],
  },
  {
    id: 'popIn',
    name: 'Pop In',
    category: 'in',
    hint: 'Scale 0 → 115 → 100 (overshoot)',
    build: (_l, comp) => {
      const end = introLen(comp)
      return [
        {
          prop: 'scale',
          keyframes: [
            kf(0, [0, 0], 'easeOut'),
            kf(end * 0.7, [115, 115], 'easeInOut'),
            kf(end, [100, 100]),
          ],
        },
      ]
    },
  },
  {
    id: 'zoomIn',
    name: 'Zoom In',
    category: 'in',
    hint: 'Scale 0 → 100 with a soft overshoot',
    build: (_l, comp) => [
      { prop: 'scale', keyframes: [kf(0, [0, 0], 'backOut'), kf(introLen(comp), [100, 100])] },
    ],
  },
  {
    id: 'bounceIn',
    name: 'Bounce In',
    category: 'in',
    hint: 'Drop in from above and bounce',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const end = Math.min(comp.duration, introLen(comp) * 1.6)
      const H = comp.h * 0.5
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [x, y - H], 'easeIn'),
            kf(end * 0.45, [x, y], 'easeOut'),
            kf(end * 0.62, [x, y - H * 0.22], 'easeIn'),
            kf(end * 0.78, [x, y], 'easeOut'),
            kf(end * 0.9, [x, y - H * 0.08], 'easeIn'),
            kf(end, [x, y]),
          ],
        },
      ]
    },
  },
  {
    id: 'slideInLeft',
    name: 'Slide In ←',
    category: 'in',
    hint: 'Enter from the left edge',
    build: (layer, comp) => {
      const rest = restPos(layer)
      return [
        {
          prop: 'position',
          keyframes: [kf(0, [-layer.size[0], rest[1]], 'easeOut'), kf(introLen(comp), [rest[0], rest[1]])],
        },
      ]
    },
  },
  {
    id: 'slideInRight',
    name: 'Slide In →',
    category: 'in',
    hint: 'Enter from the right edge',
    build: (layer, comp) => {
      const rest = restPos(layer)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [comp.w + layer.size[0], rest[1]], 'easeOut'),
            kf(introLen(comp), [rest[0], rest[1]]),
          ],
        },
      ]
    },
  },
  {
    id: 'slideInUp',
    name: 'Slide In ↑',
    category: 'in',
    hint: 'Enter from below',
    build: (layer, comp) => {
      const rest = restPos(layer)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [rest[0], comp.h + layer.size[1]], 'easeOut'),
            kf(introLen(comp), [rest[0], rest[1]]),
          ],
        },
      ]
    },
  },
  {
    id: 'slideInDown',
    name: 'Slide In ↓',
    category: 'in',
    hint: 'Enter from above',
    build: (layer, comp) => {
      const rest = restPos(layer)
      return [
        {
          prop: 'position',
          keyframes: [kf(0, [rest[0], -layer.size[1]], 'easeOut'), kf(introLen(comp), [rest[0], rest[1]])],
        },
      ]
    },
  },
  {
    id: 'rollIn',
    name: 'Roll In',
    category: 'in',
    hint: 'Slide in from the left while spinning',
    build: (layer, comp) => {
      const rest = restPos(layer)
      const end = introLen(comp)
      return [
        {
          prop: 'position',
          keyframes: [kf(0, [-layer.size[0], rest[1]], 'easeOut'), kf(end, [rest[0], rest[1]])],
        },
        { prop: 'rotation', keyframes: [kf(0, [-180], 'easeOut'), kf(end, [0])] },
      ]
    },
  },
  {
    id: 'flyIn',
    name: 'Fly In',
    category: 'in',
    hint: 'From the corner, scaling + fading up',
    build: (layer, comp) => {
      const rest = restPos(layer)
      const end = introLen(comp)
      return [
        {
          prop: 'position',
          keyframes: [kf(0, [-layer.size[0], -layer.size[1]], 'easeOut'), kf(end, [rest[0], rest[1]])],
        },
        { prop: 'scale', keyframes: [kf(0, [40, 40], 'easeOut'), kf(end, [100, 100])] },
        { prop: 'opacity', keyframes: [kf(0, [0], 'easeOut'), kf(end * 0.7, [100])] },
      ]
    },
  },
  {
    id: 'dropIn',
    name: 'Drop In',
    category: 'in',
    hint: 'Fall in from above + fade',
    build: (layer, comp) => {
      const rest = restPos(layer)
      const end = introLen(comp)
      return [
        {
          prop: 'position',
          keyframes: [kf(0, [rest[0], -layer.size[1]], 'easeIn'), kf(end, [rest[0], rest[1]])],
        },
        { prop: 'opacity', keyframes: [kf(0, [0], 'easeOut'), kf(end * 0.6, [100])] },
      ]
    },
  },

  // ---- exits ------------------------------------------------------------
  {
    id: 'fadeOut',
    name: 'Fade Out',
    category: 'out',
    hint: 'Opacity 100 → 0 at the end',
    build: (_l, comp) => [
      {
        prop: 'opacity',
        keyframes: [kf(comp.duration - introLen(comp), [100], 'easeIn'), kf(comp.duration, [0])],
      },
    ],
  },
  {
    id: 'zoomOut',
    name: 'Zoom Out',
    category: 'out',
    hint: 'Scale 100 → 0 at the end',
    build: (_l, comp) => {
      const start = comp.duration - introLen(comp)
      return [{ prop: 'scale', keyframes: [kf(start, [100, 100], 'backIn'), kf(comp.duration, [0, 0])] }]
    },
  },
  {
    id: 'slideOutLeft',
    name: 'Slide Out ←',
    category: 'out',
    hint: 'Exit past the left edge',
    build: (layer, comp) => {
      const rest = restPos(layer)
      const start = comp.duration - introLen(comp)
      return [
        {
          prop: 'position',
          keyframes: [kf(start, [rest[0], rest[1]], 'easeIn'), kf(comp.duration, [-layer.size[0], rest[1]])],
        },
      ]
    },
  },
  {
    id: 'slideOutRight',
    name: 'Slide Out →',
    category: 'out',
    hint: 'Exit past the right edge',
    build: (layer, comp) => {
      const rest = restPos(layer)
      const start = comp.duration - introLen(comp)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(start, [rest[0], rest[1]], 'easeIn'),
            kf(comp.duration, [comp.w + layer.size[0], rest[1]]),
          ],
        },
      ]
    },
  },
  {
    id: 'slideOutUp',
    name: 'Slide Out ↑',
    category: 'out',
    hint: 'Exit past the top edge',
    build: (layer, comp) => {
      const rest = restPos(layer)
      const start = comp.duration - introLen(comp)
      return [
        {
          prop: 'position',
          keyframes: [kf(start, [rest[0], rest[1]], 'easeIn'), kf(comp.duration, [rest[0], -layer.size[1]])],
        },
      ]
    },
  },
  {
    id: 'fallOut',
    name: 'Fall Out',
    category: 'out',
    hint: 'Drop out the bottom + fade',
    build: (layer, comp) => {
      const rest = restPos(layer)
      const start = comp.duration - introLen(comp)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(start, [rest[0], rest[1]], 'easeIn'),
            kf(comp.duration, [rest[0], comp.h + layer.size[1]]),
          ],
        },
        { prop: 'opacity', keyframes: [kf(start, [100], 'easeIn'), kf(comp.duration, [0])] },
      ]
    },
  },

  // ---- emphasis ---------------------------------------------------------
  {
    id: 'shake',
    name: 'Shake',
    category: 'emphasis',
    hint: 'Quick horizontal shake',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const A = Math.min(comp.w * 0.04, 24)
      const d = comp.duration
      const n = 8
      const ks: Keyframe[] = []
      for (let i = 0; i <= n; i++) {
        const off = i === 0 || i === n ? 0 : i % 2 ? A : -A
        ks.push(kf((d * i) / n, [x + off, y], 'easeInOut'))
      }
      return [{ prop: 'position', keyframes: ks }]
    },
  },
  {
    id: 'wobble',
    name: 'Wobble',
    category: 'emphasis',
    hint: 'Rock back and forth, settling',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'rotation',
          keyframes: [
            kf(0, [0]),
            kf(d * 0.15, [-12]),
            kf(d * 0.3, [10]),
            kf(d * 0.45, [-8]),
            kf(d * 0.6, [6]),
            kf(d * 0.75, [-3]),
            kf(d, [0]),
          ],
        },
      ]
    },
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    category: 'emphasis',
    hint: 'Two quick scale pulses',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'scale',
          keyframes: [
            kf(0, [100, 100]),
            kf(d * 0.14, [118, 118]),
            kf(d * 0.28, [100, 100]),
            kf(d * 0.42, [112, 112]),
            kf(d * 0.56, [100, 100]),
            kf(d, [100, 100]),
          ],
        },
      ]
    },
  },
  {
    id: 'flash',
    name: 'Flash',
    category: 'emphasis',
    hint: 'Blink the opacity on and off',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'opacity',
          keyframes: [
            kf(0, [100], 'linear'),
            kf(d * 0.2, [0], 'linear'),
            kf(d * 0.4, [100], 'linear'),
            kf(d * 0.6, [0], 'linear'),
            kf(d * 0.8, [100], 'linear'),
            kf(d, [100]),
          ],
        },
      ]
    },
  },
  {
    id: 'tada',
    name: 'Tada',
    category: 'emphasis',
    hint: 'Scale up with a rotation wiggle',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'scale',
          keyframes: [
            kf(0, [100, 100]),
            kf(d * 0.1, [90, 90]),
            kf(d * 0.2, [110, 110]),
            kf(d * 0.8, [110, 110]),
            kf(d, [100, 100]),
          ],
        },
        {
          prop: 'rotation',
          keyframes: [
            kf(0, [0]),
            kf(d * 0.2, [-9]),
            kf(d * 0.3, [9]),
            kf(d * 0.4, [-9]),
            kf(d * 0.5, [9]),
            kf(d * 0.6, [-9]),
            kf(d * 0.7, [9]),
            kf(d * 0.8, [-9]),
            kf(d, [0]),
          ],
        },
      ]
    },
  },
  {
    id: 'rubberBand',
    name: 'Rubber Band',
    category: 'emphasis',
    hint: 'Stretch and squash non-uniformly',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'scale',
          keyframes: [
            kf(0, [100, 100]),
            kf(d * 0.3, [140, 75]),
            kf(d * 0.4, [75, 125]),
            kf(d * 0.5, [115, 85]),
            kf(d * 0.65, [95, 105]),
            kf(d * 0.75, [105, 95]),
            kf(d, [100, 100]),
          ],
        },
      ]
    },
  },

  // ---- loops ------------------------------------------------------------
  {
    id: 'spin',
    name: 'Spin',
    category: 'loop',
    hint: 'Rotate 360° over the whole timeline',
    build: (_l, comp) => [
      { prop: 'rotation', keyframes: [kf(0, [0], 'linear'), kf(comp.duration, [360])] },
    ],
  },
  {
    id: 'pulse',
    name: 'Pulse',
    category: 'loop',
    hint: 'Scale 100 → 110 → 100',
    build: (_l, comp) => [
      {
        prop: 'scale',
        keyframes: [
          kf(0, [100, 100], 'easeInOut'),
          kf(comp.duration / 2, [110, 110], 'easeInOut'),
          kf(comp.duration, [100, 100]),
        ],
      },
    ],
  },
  {
    id: 'float',
    name: 'Float',
    category: 'loop',
    hint: 'Gently drift up and back down',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const A = Math.min(comp.h * 0.04, 18)
      const d = comp.duration
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [x, y], 'easeInOut'),
            kf(d * 0.5, [x, y - A], 'easeInOut'),
            kf(d, [x, y], 'easeInOut'),
          ],
        },
      ]
    },
  },
  {
    id: 'breathe',
    name: 'Breathe',
    category: 'loop',
    hint: 'Subtle scale in and out',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'scale',
          keyframes: [
            kf(0, [100, 100], 'easeInOut'),
            kf(d * 0.5, [106, 106], 'easeInOut'),
            kf(d, [100, 100], 'easeInOut'),
          ],
        },
      ]
    },
  },
  {
    id: 'swing',
    name: 'Swing',
    category: 'loop',
    hint: 'Pendulum rotation back and forth',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'rotation',
          keyframes: [
            kf(0, [0], 'easeInOut'),
            kf(d * 0.25, [15], 'easeInOut'),
            kf(d * 0.5, [-10], 'easeInOut'),
            kf(d * 0.75, [6], 'easeInOut'),
            kf(d, [0], 'easeInOut'),
          ],
        },
      ]
    },
  },

  // ---- motion (bring it to life with transforms) ------------------------
  {
    id: 'ride',
    name: 'Ride',
    category: 'motion',
    hint: 'Rolling bob + tilt — like riding along',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const A = Math.min(comp.h * 0.03, 12)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [x, y], 'easeInOut'),
            kf(d * 0.25, [x, y - A], 'easeInOut'),
            kf(d * 0.5, [x, y], 'easeInOut'),
            kf(d * 0.75, [x, y - A * 0.6], 'easeInOut'),
            kf(d, [x, y], 'easeInOut'),
          ],
        },
        {
          prop: 'rotation',
          keyframes: [kf(0, [-3], 'easeInOut'), kf(d * 0.5, [3], 'easeInOut'), kf(d, [-3], 'easeInOut')],
        },
      ]
    },
  },
  {
    id: 'hover',
    name: 'Hover',
    category: 'motion',
    hint: 'Float up and down while gently breathing',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const A = Math.min(comp.h * 0.05, 22)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [x, y], 'easeInOut'),
            kf(d * 0.5, [x, y - A], 'easeInOut'),
            kf(d, [x, y], 'easeInOut'),
          ],
        },
        {
          prop: 'scale',
          keyframes: [
            kf(0, [100, 100], 'easeInOut'),
            kf(d * 0.5, [103, 103], 'easeInOut'),
            kf(d, [100, 100], 'easeInOut'),
          ],
        },
      ]
    },
  },
  {
    id: 'jump',
    name: 'Jump',
    category: 'motion',
    hint: 'Hop with squash & stretch',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const H = Math.min(comp.h * 0.25, 140)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [x, y], 'easeOut'),
            kf(d * 0.45, [x, y - H], 'easeIn'),
            kf(d * 0.9, [x, y], 'easeOut'),
            kf(d, [x, y]),
          ],
        },
        {
          prop: 'scale',
          keyframes: [
            kf(0, [100, 100], 'easeOut'),
            kf(d * 0.18, [90, 112], 'easeOut'),
            kf(d * 0.45, [100, 100], 'easeInOut'),
            kf(d * 0.85, [112, 88], 'easeOut'),
            kf(d, [100, 100], 'easeOut'),
          ],
        },
      ]
    },
  },
  {
    id: 'wheelie',
    name: 'Wheelie',
    category: 'motion',
    hint: 'Tip back, hold, then settle',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'rotation',
          keyframes: [
            kf(0, [0], 'easeOut'),
            kf(d * 0.2, [-18], 'easeOut'),
            kf(d * 0.8, [-18], 'easeIn'),
            kf(d, [0], 'easeInOut'),
          ],
        },
      ]
    },
  },
  {
    id: 'sway',
    name: 'Sway',
    category: 'motion',
    hint: 'Gentle side-to-side rocking',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'rotation',
          keyframes: [
            kf(0, [0], 'easeInOut'),
            kf(d * 0.25, [8], 'easeInOut'),
            kf(d * 0.5, [0], 'easeInOut'),
            kf(d * 0.75, [-8], 'easeInOut'),
            kf(d, [0], 'easeInOut'),
          ],
        },
      ]
    },
  },
  {
    id: 'walkBob',
    name: 'Walk Bob',
    category: 'motion',
    hint: 'Small stepping bob, like walking',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const A = Math.min(comp.h * 0.022, 9)
      const n = 6
      const ks: Keyframe[] = []
      for (let i = 0; i <= n; i++) ks.push(kf((d * i) / n, [x, y - (i % 2 ? A : 0)], 'easeInOut'))
      return [{ prop: 'position', keyframes: ks }]
    },
  },

  // ---- FX (add helper layers that imply motion / energy) ----------------
  {
    id: 'speedLines',
    name: 'Speed Lines',
    category: 'fx',
    hint: 'Streaks behind the shape — suggests it’s moving',
    build: (layer, comp) => {
      const [cx, cy] = restPos(layer)
      const [tw, th] = layer.size
      const d = comp.duration
      const fill = evalProperty(layer.fillColor, 0)
      const lineW = Math.max(10, tw * 0.45)
      const lineH = Math.max(2, th * 0.04)
      const left = cx - tw * 0.5
      const n = 4
      const seg = d * 0.45
      const fade = seg * 0.3
      const out: Layer[] = []
      for (let i = 0; i < n; i++) {
        const yy = cy - th * 0.3 + (th * 0.6 * i) / Math.max(1, n - 1)
        const startX = left - lineW * 0.1
        const endX = startX - tw * 0.7
        const t0 = Math.min(d - seg, d * 0.1 * i)
        const L = createSolidLayer({
          name: `Speed line ${i + 1}`,
          shape: 'rect',
          center: [startX, yy],
          size: [lineW, lineH],
          fill,
          cornerRadius: lineH / 2,
          opacity: 0,
        })
        L.position = animProp(
          [startX, yy],
          [kf(clampT(comp, t0), [startX, yy], 'linear'), kf(clampT(comp, t0 + seg), [endX, yy], 'linear')],
        )
        L.opacity = animProp(
          [0],
          [
            kf(clampT(comp, t0), [0], 'linear'),
            kf(clampT(comp, t0 + fade), [75], 'linear'),
            kf(clampT(comp, t0 + seg - fade), [75], 'linear'),
            kf(clampT(comp, t0 + seg), [0], 'linear'),
          ],
        )
        out.push(L)
      }
      return { addLayers: out }
    },
  },
  {
    id: 'dust',
    name: 'Dust',
    category: 'fx',
    hint: 'Little puffs kicking up from the base',
    build: (layer, comp) => {
      const [cx, cy] = restPos(layer)
      const [tw, th] = layer.size
      const d = comp.duration
      const fill = evalProperty(layer.fillColor, 0)
      const baseY = cy + th * 0.45
      const n = 5
      const life = d * 0.4
      const out: Layer[] = []
      for (let i = 0; i < n; i++) {
        const px = cx + (i - (n - 1) / 2) * (tw * 0.18)
        const sz = Math.max(4, tw * 0.06)
        const t0 = Math.min(d - 1, d * 0.08 * i)
        const L = createSolidLayer({ name: `Dust ${i + 1}`, shape: 'ellipse', center: [px, baseY], size: [sz, sz], fill, opacity: 0 })
        L.scale = animProp([30, 30], [kf(clampT(comp, t0), [30, 30], 'easeOut'), kf(clampT(comp, t0 + life), [115, 115], 'easeOut')])
        L.opacity = animProp(
          [0],
          [kf(clampT(comp, t0), [0], 'easeOut'), kf(clampT(comp, t0 + life * 0.3), [55], 'easeOut'), kf(clampT(comp, t0 + life), [0], 'easeIn')],
        )
        L.position = animProp(
          [px, baseY],
          [kf(clampT(comp, t0), [px, baseY], 'easeOut'), kf(clampT(comp, t0 + life), [px + (i - (n - 1) / 2) * 8, baseY - th * 0.15], 'easeOut')],
        )
        out.push(L)
      }
      return { addLayers: out }
    },
  },
  {
    id: 'sparkle',
    name: 'Sparkle',
    category: 'fx',
    hint: 'Twinkles popping around the shape',
    build: (layer, comp) => {
      const [cx, cy] = restPos(layer)
      const [tw, th] = layer.size
      const d = comp.duration
      const life = d * 0.35
      const pts = [
        [-0.4, -0.4],
        [0.45, -0.3],
        [0.35, 0.4],
        [-0.35, 0.35],
        [0.05, -0.52],
      ]
      const out: Layer[] = []
      pts.forEach((p, i) => {
        const px = cx + p[0] * tw
        const py = cy + p[1] * th
        const sz = Math.max(5, tw * 0.07)
        const t0 = Math.min(d - 1, d * 0.12 * i)
        const L = createSolidLayer({ name: `Sparkle ${i + 1}`, shape: 'ellipse', center: [px, py], size: [sz, sz], fill: [1, 1, 1], opacity: 0 })
        L.scale = animProp(
          [0, 0],
          [kf(clampT(comp, t0), [0, 0], 'easeOut'), kf(clampT(comp, t0 + life * 0.4), [120, 120], 'easeInOut'), kf(clampT(comp, t0 + life), [0, 0], 'easeIn')],
        )
        L.opacity = animProp(
          [0],
          [kf(clampT(comp, t0), [0]), kf(clampT(comp, t0 + life * 0.4), [100]), kf(clampT(comp, t0 + life), [0])],
        )
        out.push(L)
      })
      return { addLayers: out }
    },
  },
  {
    id: 'glow',
    name: 'Glow Pulse',
    category: 'fx',
    hint: 'Soft pulsing halo behind the shape',
    build: (layer, comp) => {
      const [cx, cy] = restPos(layer)
      const [tw, th] = layer.size
      const d = comp.duration
      const fill = evalProperty(layer.fillColor, 0)
      const sz = Math.max(tw, th) * 1.4
      const L = createSolidLayer({ name: 'Glow', shape: 'ellipse', center: [cx, cy], size: [sz, sz], fill, opacity: 0 })
      L.opacity = animProp([0], [kf(0, [0], 'easeInOut'), kf(d * 0.5, [38], 'easeInOut'), kf(d, [0], 'easeInOut')])
      L.scale = animProp([90, 90], [kf(0, [90, 90], 'easeInOut'), kf(d * 0.5, [112, 112], 'easeInOut'), kf(d, [90, 90], 'easeInOut')])
      return { addLayers: [L] }
    },
  },

  // ---- path (animated geometry) -----------------------------------------
  {
    id: 'flagWave',
    name: 'Flag Wave',
    category: 'path',
    hint: 'Ripple a path like a flag in the wind (path layers)',
    build: (layer, comp) => {
      if (layer.shape !== 'path' || !layer.path || !layer.path.length) return {}
      const base = layer.path
      const tw = Math.max(1, layer.size[0])
      const minX = -tw / 2
      const A = Math.max(4, tw * 0.08)
      const waves = 1.5
      const N = 8
      const pks: PathKeyframe[] = []
      for (let s = 0; s <= N; s++) {
        const phase = 2 * Math.PI * (s / N)
        const subpaths: SubPath[] = base.map((sp) => ({
          closed: sp.closed,
          i: sp.i.map((p) => [p[0], p[1]] as Vec2),
          o: sp.o.map((p) => [p[0], p[1]] as Vec2),
          v: sp.v.map(([vx, vy]) => {
            const w = (vx - minX) / tw
            const dy = A * w * Math.sin((vx / tw) * 2 * Math.PI * waves + phase)
            return [vx, vy + dy] as Vec2
          }),
        }))
        pks.push({ t: clampT(comp, (comp.duration * s) / N), subpaths, easing: 'easeInOut' })
      }
      return { pathKeyframes: pks }
    },
  },
  {
    id: 'morphCircle',
    name: 'Morph → Circle',
    category: 'path',
    hint: 'Morph a path layer into a circle and back',
    build: (l, c) => morphTo(l, c, 'circle'),
  },
  {
    id: 'morphSquare',
    name: 'Morph → Square',
    category: 'path',
    hint: 'Morph a path layer into a square and back',
    build: (l, c) => morphTo(l, c, 'square'),
  },
  {
    id: 'morphTriangle',
    name: 'Morph → Triangle',
    category: 'path',
    hint: 'Morph a path layer into a triangle and back',
    build: (l, c) => morphTo(l, c, 'triangle'),
  },
  {
    id: 'morphStar',
    name: 'Morph → Star',
    category: 'path',
    hint: 'Morph a path layer into a star and back',
    build: (l, c) => morphTo(l, c, 'star'),
  },

  // ===== second wave =====================================================
  // entrances
  {
    id: 'spiralIn',
    name: 'Spiral In',
    category: 'in',
    hint: 'Unwind into place while scaling up',
    build: (_l, comp) => {
      const e = introLen(comp)
      return [
        { prop: 'scale', keyframes: [kf(0, [0, 0], 'easeOut'), kf(e, [100, 100])] },
        { prop: 'rotation', keyframes: [kf(0, [-270], 'easeOut'), kf(e, [0])] },
        { prop: 'opacity', keyframes: [kf(0, [0], 'easeOut'), kf(e * 0.7, [100])] },
      ]
    },
  },
  {
    id: 'expandIn',
    name: 'Expand In',
    category: 'in',
    hint: 'Reveal horizontally (scale X 0 → 100)',
    build: (_l, comp) => [{ prop: 'scale', keyframes: [kf(0, [0, 100], 'easeOut'), kf(introLen(comp), [100, 100])] }],
  },
  {
    id: 'unfoldIn',
    name: 'Unfold In',
    category: 'in',
    hint: 'Reveal vertically (scale Y 0 → 100)',
    build: (_l, comp) => [{ prop: 'scale', keyframes: [kf(0, [100, 0], 'easeOut'), kf(introLen(comp), [100, 100])] }],
  },
  {
    id: 'backInUp',
    name: 'Back In ↑',
    category: 'in',
    hint: 'Rise from below with an overshoot',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const e = introLen(comp)
      const off = Math.min(comp.h * 0.4, 160)
      return [
        { prop: 'position', keyframes: [kf(0, [x, y + off], 'backOut'), kf(e, [x, y])] },
        { prop: 'opacity', keyframes: [kf(0, [0], 'easeOut'), kf(e * 0.6, [100])] },
      ]
    },
  },

  // exits
  {
    id: 'spiralOut',
    name: 'Spiral Out',
    category: 'out',
    hint: 'Wind up and shrink away at the end',
    build: (_l, comp) => {
      const s = comp.duration - introLen(comp)
      const d = comp.duration
      return [
        { prop: 'scale', keyframes: [kf(s, [100, 100], 'easeIn'), kf(d, [0, 0])] },
        { prop: 'rotation', keyframes: [kf(s, [0], 'easeIn'), kf(d, [270])] },
        { prop: 'opacity', keyframes: [kf(s, [100], 'easeIn'), kf(d, [0])] },
      ]
    },
  },
  {
    id: 'slideOutDown',
    name: 'Slide Out ↓',
    category: 'out',
    hint: 'Exit past the bottom edge',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const s = comp.duration - introLen(comp)
      return [{ prop: 'position', keyframes: [kf(s, [x, y], 'easeIn'), kf(comp.duration, [x, comp.h + layer.size[1]])] }]
    },
  },
  {
    id: 'collapseOut',
    name: 'Collapse Out',
    category: 'out',
    hint: 'Flatten vertically to nothing',
    build: (_l, comp) => {
      const s = comp.duration - introLen(comp)
      return [{ prop: 'scale', keyframes: [kf(s, [100, 100], 'easeIn'), kf(comp.duration, [100, 0])] }]
    },
  },

  // emphasis
  {
    id: 'bounce',
    name: 'Bounce',
    category: 'emphasis',
    hint: 'Bounce in place a few times',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const H = Math.min(comp.h * 0.2, 110)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [x, y], 'easeOut'),
            kf(d * 0.25, [x, y - H], 'easeIn'),
            kf(d * 0.5, [x, y], 'easeOut'),
            kf(d * 0.7, [x, y - H * 0.5], 'easeIn'),
            kf(d * 0.85, [x, y], 'easeOut'),
            kf(d * 0.93, [x, y - H * 0.18], 'easeIn'),
            kf(d, [x, y]),
          ],
        },
      ]
    },
  },
  {
    id: 'jiggle',
    name: 'Jiggle',
    category: 'emphasis',
    hint: 'Fast settling rotation wiggle',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'rotation',
          keyframes: [
            kf(0, [0]),
            kf(d * 0.1, [-8]),
            kf(d * 0.2, [8]),
            kf(d * 0.3, [-6]),
            kf(d * 0.4, [6]),
            kf(d * 0.5, [-3]),
            kf(d * 0.6, [3]),
            kf(d * 0.7, [0]),
            kf(d, [0]),
          ],
        },
      ]
    },
  },
  {
    id: 'squash',
    name: 'Squash',
    category: 'emphasis',
    hint: 'Squash & stretch wobble',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'scale',
          keyframes: [
            kf(0, [100, 100], 'easeOut'),
            kf(d * 0.2, [115, 85], 'easeInOut'),
            kf(d * 0.4, [90, 112], 'easeInOut'),
            kf(d * 0.6, [106, 95], 'easeInOut'),
            kf(d * 0.8, [98, 103], 'easeInOut'),
            kf(d, [100, 100]),
          ],
        },
      ]
    },
  },
  {
    id: 'buzz',
    name: 'Buzz',
    category: 'emphasis',
    hint: 'Tiny rapid vibration',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const A = Math.min(comp.w * 0.015, 6)
      const n = 12
      const ks: Keyframe[] = []
      for (let i = 0; i <= n; i++) {
        const off = i === 0 || i === n ? 0 : i % 2 ? A : -A
        ks.push(kf((d * i) / n, [x + off, y], 'linear'))
      }
      return [{ prop: 'position', keyframes: ks }]
    },
  },
  {
    id: 'headShake',
    name: 'Head Shake',
    category: 'emphasis',
    hint: 'No-no shake with a little tilt',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const A = Math.min(comp.w * 0.06, 40)
      return [
        {
          prop: 'position',
          keyframes: [
            kf(0, [x, y]),
            kf(d * 0.16, [x - A, y]),
            kf(d * 0.33, [x + A * 0.8, y]),
            kf(d * 0.5, [x - A * 0.5, y]),
            kf(d * 0.66, [x + A * 0.25, y]),
            kf(d, [x, y]),
          ],
        },
        {
          prop: 'rotation',
          keyframes: [kf(0, [0]), kf(d * 0.16, [6]), kf(d * 0.33, [-5]), kf(d * 0.5, [3]), kf(d * 0.66, [-2]), kf(d, [0])],
        },
      ]
    },
  },

  // loops
  {
    id: 'orbit',
    name: 'Orbit',
    category: 'loop',
    hint: 'Travel a small circular path',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const R = Math.min(comp.w, comp.h) * 0.06
      const n = 12
      const ks: Keyframe[] = []
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + 2 * Math.PI * (i / n)
        ks.push(kf((d * i) / n, [x + Math.cos(a) * R, y + Math.sin(a) * R], 'linear'))
      }
      return [{ prop: 'position', keyframes: ks }]
    },
  },
  {
    id: 'tickTock',
    name: 'Tick Tock',
    category: 'loop',
    hint: 'Metronome rotation',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'rotation',
          keyframes: [
            kf(0, [0], 'easeInOut'),
            kf(d * 0.25, [14], 'easeInOut'),
            kf(d * 0.5, [0], 'easeInOut'),
            kf(d * 0.75, [-14], 'easeInOut'),
            kf(d, [0], 'easeInOut'),
          ],
        },
      ]
    },
  },
  {
    id: 'blinkLoop',
    name: 'Blink',
    category: 'loop',
    hint: 'Dim out and back on a loop',
    build: (_l, comp) => {
      const d = comp.duration
      return [
        {
          prop: 'opacity',
          keyframes: [
            kf(0, [100], 'easeInOut'),
            kf(d * 0.4, [100], 'easeInOut'),
            kf(d * 0.5, [20], 'easeInOut'),
            kf(d * 0.6, [100], 'easeInOut'),
            kf(d, [100]),
          ],
        },
      ]
    },
  },

  // motion
  {
    id: 'run',
    name: 'Run',
    category: 'motion',
    hint: 'Energetic bob + lean',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const A = Math.min(comp.h * 0.04, 16)
      const n = 8
      const ks: Keyframe[] = []
      for (let i = 0; i <= n; i++) ks.push(kf((d * i) / n, [x, y - (i % 2 ? A : 0)], 'easeInOut'))
      return [
        { prop: 'position', keyframes: ks },
        { prop: 'rotation', keyframes: [kf(0, [5], 'easeInOut'), kf(d * 0.5, [-5], 'easeInOut'), kf(d, [5], 'easeInOut')] },
      ]
    },
  },
  {
    id: 'drift',
    name: 'Drift',
    category: 'motion',
    hint: 'Slow side-to-side glide',
    build: (layer, comp) => {
      const [x, y] = restPos(layer)
      const d = comp.duration
      const A = Math.min(comp.w * 0.05, 30)
      return [
        {
          prop: 'position',
          keyframes: [kf(0, [x, y], 'easeInOut'), kf(d * 0.5, [x + A, y], 'easeInOut'), kf(d, [x, y], 'easeInOut')],
        },
      ]
    },
  },

  // fx
  {
    id: 'shockwave',
    name: 'Shockwave',
    category: 'fx',
    hint: 'Expanding ring radiating out',
    build: (layer, comp) => {
      const [cx, cy] = restPos(layer)
      const [tw, th] = layer.size
      const d = comp.duration
      const fill = evalProperty(layer.fillColor, 0)
      const base = Math.max(tw, th)
      const L = createSolidLayer({ name: 'Shockwave', shape: 'ellipse', center: [cx, cy], size: [base, base], fill })
      L.fillEnabled = false
      L.stroke = { color: fill, width: Math.max(2, base * 0.04) }
      L.scale = animProp([20, 20], [kf(0, [20, 20], 'easeOut'), kf(d, [200, 200], 'easeOut')])
      L.opacity = animProp([0], [kf(0, [70], 'easeOut'), kf(d, [0], 'easeOut')])
      return { addLayers: [L] }
    },
  },
  {
    id: 'confetti',
    name: 'Confetti',
    category: 'fx',
    hint: 'Colorful bits burst outward',
    build: (layer, comp) => {
      const [cx, cy] = restPos(layer)
      const [tw, th] = layer.size
      const d = comp.duration
      const R = Math.max(tw, th) * 0.8
      const life = d * 0.7
      const n = 10
      const out: Layer[] = []
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n + 0.3
        const dist = R * (0.6 + 0.4 * (((i * 37) % 10) / 10))
        const ex = cx + Math.cos(a) * dist
        const ey = cy + Math.sin(a) * dist
        const sz = Math.max(5, tw * 0.06)
        const L = createSolidLayer({
          name: `Confetti ${i + 1}`,
          shape: i % 2 ? 'rect' : 'ellipse',
          center: [cx, cy],
          size: [sz, sz],
          fill: CONFETTI[i % CONFETTI.length],
          opacity: 0,
        })
        L.position = animProp([cx, cy], [kf(0, [cx, cy], 'easeOut'), kf(clampT(comp, life), [ex, ey], 'easeOut')])
        L.opacity = animProp([0], [kf(0, [0]), kf(clampT(comp, d * 0.08), [100]), kf(clampT(comp, life), [0])])
        L.rotation = animProp([0], [kf(0, [0]), kf(clampT(comp, life), [(i % 2 ? 1 : -1) * 180])])
        L.scale = animProp(
          [0, 0],
          [kf(0, [0, 0], 'easeOut'), kf(clampT(comp, d * 0.1), [100, 100]), kf(clampT(comp, life), [60, 60])],
        )
        out.push(L)
      }
      return { addLayers: out }
    },
  },
  {
    id: 'trail',
    name: 'Motion Trail',
    category: 'fx',
    hint: 'Faded ghosts shimmering behind',
    build: (layer, comp) => {
      const [cx, cy] = restPos(layer)
      const tw = layer.size[0]
      const d = comp.duration
      const g1 = ghost(layer, 'Trail 1', [cx - tw * 0.3, cy], 0)
      const g2 = ghost(layer, 'Trail 2', [cx - tw * 0.6, cy], 0)
      // out-of-phase opacity pulses read as a moving trail
      g1.opacity = animProp([36], [kf(0, [36], 'easeInOut'), kf(d * 0.5, [10], 'easeInOut'), kf(d, [36], 'easeInOut')])
      g2.opacity = animProp([10], [kf(0, [10], 'easeInOut'), kf(d * 0.5, [26], 'easeInOut'), kf(d, [10], 'easeInOut')])
      return { addLayers: [g1, g2] }
    },
  },

  // path
  {
    id: 'morphHexagon',
    name: 'Morph → Hexagon',
    category: 'path',
    hint: 'Morph a path layer into a hexagon and back',
    build: (l, c) => morphTo(l, c, 'hexagon'),
  },
  {
    id: 'morphHeart',
    name: 'Morph → Heart',
    category: 'path',
    hint: 'Morph a path layer into a heart and back',
    build: (l, c) => morphTo(l, c, 'heart'),
  },
]
