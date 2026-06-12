import type { Composition, Layer, Property, ShapeType, Stroke, SubPath, Vec2 } from './model'

// ---------------------------------------------------------------------------
// Factories + small helpers for creating model objects and converting colors.
// ---------------------------------------------------------------------------

let counter = 0
/** Stable-ish unique id. crypto.randomUUID when available, counter fallback. */
export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }
  counter += 1
  return `${prefix}_${counter.toString(36)}`
}

export function staticProp(value: number[]): Property {
  return { animated: false, value, keyframes: [] }
}

const SWATCHES = ['#00DDB3', '#FF6B6B', '#4D96FF', '#FFD166', '#A66CFF', '#FF8FB1']

let layerNum = 0

export function createLayer(shape: ShapeType, comp: Composition): Layer {
  layerNum += 1
  const color = SWATCHES[(layerNum - 1) % SWATCHES.length]
  const center: Vec2 = [comp.w / 2, comp.h / 2]
  const size: Vec2 = [Math.round(comp.w * 0.3), Math.round(comp.w * 0.3)]
  return {
    id: uid('layer'),
    name: `${shape === 'rect' ? 'Rectangle' : 'Ellipse'} ${layerNum}`,
    shape,
    size,
    cornerRadius: shape === 'rect' ? 0 : 0,
    visible: true,
    position: staticProp([center[0], center[1]]),
    scale: staticProp([100, 100]),
    rotation: staticProp([0]),
    opacity: staticProp([100]),
    fillColor: staticProp(hexToRgb(color)),
  }
}

/** Build a path layer from imported geometry (already in comp pixel space). */
export function createPathLayer(opts: {
  name: string
  subpaths: SubPath[]
  center: Vec2
  size: Vec2
  fill: number[] | null
  stroke: Stroke | null
  opacity: number // 0..100
}): Layer {
  return {
    id: uid('layer'),
    name: opts.name,
    shape: 'path',
    size: [Math.max(1, opts.size[0]), Math.max(1, opts.size[1])],
    cornerRadius: 0,
    visible: true,
    path: opts.subpaths,
    fillEnabled: opts.fill != null,
    stroke: opts.stroke,
    position: staticProp([opts.center[0], opts.center[1]]),
    scale: staticProp([100, 100]),
    rotation: staticProp([0]),
    opacity: staticProp([Math.max(0, Math.min(100, opts.opacity))]),
    fillColor: staticProp(opts.fill ?? opts.stroke?.color ?? [0.1, 0.1, 0.12]),
  }
}

export function createComposition(): Composition {
  return {
    name: 'Composition 1',
    w: 512,
    h: 512,
    fr: 30,
    duration: 90,
    bg: '#ffffff',
    layers: [],
  }
}

// --- color conversion: hex <-> [r,g,b] in 0..1 -----------------------------

export function hexToRgb(hex: string): number[] {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function rgbToHex(rgb: number[]): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`
}
