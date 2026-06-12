import type { Composition, Easing, Keyframe, Layer, PropKind } from './model'
import { uid } from './factory'
import { evalProperty } from './interpolate'

// ---------------------------------------------------------------------------
// Animation presets. Each preset turns one or more layer properties into
// keyframed animations, anchored to the layer's *current* values so applying
// a preset never throws away where the user placed the shape.
//
// Grouped into families (in / out / emphasis / loop) so the inspector can
// offer a segmented filter instead of one long list.
// ---------------------------------------------------------------------------

export type PresetCategory = 'in' | 'out' | 'emphasis' | 'loop'

export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'in', label: 'In' },
  { id: 'out', label: 'Out' },
  { id: 'emphasis', label: 'Emphasis' },
  { id: 'loop', label: 'Loop' },
]

export interface PresetChange {
  prop: PropKind
  keyframes: Keyframe[]
}

export interface Preset {
  id: string
  name: string
  category: PresetCategory
  hint: string
  build: (layer: Layer, comp: Composition) => PresetChange[]
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
]
