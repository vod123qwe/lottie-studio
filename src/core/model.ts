// ---------------------------------------------------------------------------
// Editor data model
//
// This is the *authoring* model — what the UI edits. It is intentionally
// simpler and friendlier than raw Lottie JSON. `builder.ts` turns it into a
// valid Lottie document for preview and export.
//
// Every animatable value is stored as a `number[]` so a single interpolation
// routine works for scalars, vectors and colors alike:
//   opacity  -> [v]            (0..100)
//   rotation -> [deg]
//   position -> [x, y]
//   scale    -> [sx, sy]       (percent)
//   color    -> [r, g, b]      (0..1)
// ---------------------------------------------------------------------------

export type Vec2 = [number, number]

export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export const EASINGS: Easing[] = ['linear', 'easeIn', 'easeOut', 'easeInOut']

/** A single keyframe. `easing` describes the segment *leaving* this keyframe. */
export interface Keyframe {
  id: string
  t: number // frame number
  value: number[]
  easing: Easing
}

export interface Property {
  animated: boolean
  value: number[] // used when not animated (or as fallback)
  keyframes: Keyframe[] // kept sorted by `t`
}

export type ShapeType = 'rect' | 'ellipse' | 'path'

/**
 * A single closed/open bezier contour, stored Lottie-style and **relative to
 * the layer center** (anchor). `v` are vertices; `i`/`o` are the in/out
 * tangents expressed relative to their vertex. Imported SVG paths become one
 * or more of these.
 */
export interface SubPath {
  v: Vec2[]
  i: Vec2[]
  o: Vec2[]
  closed: boolean
}

/** Optional stroke for path layers (solid color, constant width). */
export interface Stroke {
  color: number[] // [r,g,b] 0..1
  width: number
}

/** The transform/appearance properties every layer exposes to the timeline. */
export type PropKind =
  | 'position'
  | 'scale'
  | 'rotation'
  | 'opacity'
  | 'fillColor'

export const PROP_KINDS: PropKind[] = [
  'position',
  'scale',
  'rotation',
  'opacity',
  'fillColor',
]

export const PROP_LABELS: Record<PropKind, string> = {
  position: 'Position',
  scale: 'Scale',
  rotation: 'Rotation',
  opacity: 'Opacity',
  fillColor: 'Fill',
}

export interface Layer {
  id: string
  name: string
  shape: ShapeType
  size: Vec2 // shape width/height in px (bounding box for paths)
  cornerRadius: number // rect only
  visible: boolean
  // path geometry — present only when shape === 'path'
  path?: SubPath[]
  // appearance extras
  fillEnabled?: boolean // undefined = filled (back-compat); false = no fill
  stroke?: Stroke | null
  // animatable transform + appearance
  position: Property
  scale: Property
  rotation: Property
  opacity: Property
  fillColor: Property
}

export interface Composition {
  name: string
  w: number
  h: number
  fr: number // frame rate
  duration: number // total frames (out point)
  bg: string // editor canvas color (hex) — not exported into the Lottie
  layers: Layer[] // index 0 renders on top (matches the layer panel order)
}

export const PROP_OF = (layer: Layer, kind: PropKind): Property => layer[kind]
