import type { Composition, Easing, Keyframe, Layer, PropKind } from './model'
import { uid } from './factory'
import { evalProperty } from './interpolate'

// ---------------------------------------------------------------------------
// Animation presets. Each preset turns one or more layer properties into
// keyframed animations, anchored to the layer's *current* values so applying
// a preset never throws away where the user placed the shape.
// ---------------------------------------------------------------------------

export interface PresetChange {
  prop: PropKind
  keyframes: Keyframe[]
}

export interface Preset {
  id: string
  name: string
  hint: string
  build: (layer: Layer, comp: Composition) => PresetChange[]
}

const kf = (t: number, value: number[], easing: Easing = 'easeInOut'): Keyframe => ({
  id: uid('kf'),
  t: Math.round(t),
  value,
  easing,
})

/** A short intro window: ~30% of the timeline, capped to a sensible length. */
const introLen = (comp: Composition) => Math.min(comp.duration * 0.3, comp.fr)

export const PRESETS: Preset[] = [
  {
    id: 'fadeIn',
    name: 'Fade In',
    hint: 'Opacity 0 → 100',
    build: (_l, comp) => [
      { prop: 'opacity', keyframes: [kf(0, [0], 'easeOut'), kf(introLen(comp), [100])] },
    ],
  },
  {
    id: 'fadeOut',
    name: 'Fade Out',
    hint: 'Opacity 100 → 0 at the end',
    build: (_l, comp) => [
      {
        prop: 'opacity',
        keyframes: [kf(comp.duration - introLen(comp), [100], 'easeIn'), kf(comp.duration, [0])],
      },
    ],
  },
  {
    id: 'popIn',
    name: 'Pop In',
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
    id: 'slideInLeft',
    name: 'Slide In ←',
    hint: 'Enter from the left edge',
    build: (layer, comp) => {
      const rest = evalProperty(layer.position, 0)
      const startX = -layer.size[0]
      return [
        {
          prop: 'position',
          keyframes: [kf(0, [startX, rest[1]], 'easeOut'), kf(introLen(comp), [rest[0], rest[1]])],
        },
      ]
    },
  },
  {
    id: 'slideInRight',
    name: 'Slide In →',
    hint: 'Enter from the right edge',
    build: (layer, comp) => {
      const rest = evalProperty(layer.position, 0)
      const startX = comp.w + layer.size[0]
      return [
        {
          prop: 'position',
          keyframes: [kf(0, [startX, rest[1]], 'easeOut'), kf(introLen(comp), [rest[0], rest[1]])],
        },
      ]
    },
  },
  {
    id: 'spin',
    name: 'Spin',
    hint: 'Rotate 360° over the whole timeline',
    build: (_l, comp) => [
      { prop: 'rotation', keyframes: [kf(0, [0], 'linear'), kf(comp.duration, [360])] },
    ],
  },
  {
    id: 'pulse',
    name: 'Pulse',
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
    id: 'dropIn',
    name: 'Drop In',
    hint: 'Fall in from above + fade',
    build: (layer, comp) => {
      const rest = evalProperty(layer.position, 0)
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
]
