import type { Composition, Layer, Property } from './model'
import { CURVES } from './interpolate'

// ---------------------------------------------------------------------------
// Editor model  ->  Lottie (bodymovin) JSON.
//
// Output is a minimal but valid Lottie document that lottie-web renders and
// that other Lottie players accept. We only emit shape layers (ty:4) with a
// single shape group (rect or ellipse) + fill + transform.
// ---------------------------------------------------------------------------

const LOTTIE_VERSION = '5.12.2'

type Dim = 'scalar' | 'vec2' | 'scale' | 'color'

/** A property is treated as static unless it has 2+ keyframes. */
function isAnimated(p: Property) {
  return p.animated && p.keyframes.length >= 2
}

/** Map a stored value (number[]) to the Lottie `s`/`k` payload for its dim. */
function toLottieValue(value: number[], dim: Dim): number | number[] {
  switch (dim) {
    case 'scalar':
      return value[0]
    case 'vec2':
      return [value[0], value[1]]
    case 'scale':
      return [value[0], value[1], 100]
    case 'color':
      return [value[0], value[1], value[2], 1]
  }
}

/** Build a Lottie animatable value object from an editor Property. */
function buildProp(p: Property, dim: Dim) {
  if (!isAnimated(p)) {
    const value = p.keyframes.length === 1 ? p.keyframes[0].value : p.value
    return { a: 0, k: toLottieValue(value, dim) }
  }

  const kfs = [...p.keyframes].sort((a, b) => a.t - b.t)
  const k = kfs.map((kf, idx) => {
    const s = toLottieValue(kf.value, dim)
    // Final keyframe holds the end value with no outgoing tangent.
    if (idx === kfs.length - 1) {
      return { t: kf.t, s: Array.isArray(s) ? s : [s] }
    }
    const [x1, y1, x2, y2] = CURVES[kf.easing]
    return {
      t: kf.t,
      s: Array.isArray(s) ? s : [s],
      o: { x: [x1], y: [y1] }, // out tangent of this keyframe
      i: { x: [x2], y: [y2] }, // in tangent toward the next keyframe
    }
  })
  return { a: 1, k }
}

function buildShapeItem(layer: Layer) {
  const [w, h] = layer.size
  if (layer.shape === 'ellipse') {
    return {
      ty: 'el',
      nm: 'Ellipse',
      d: 1,
      p: { a: 0, k: [0, 0] },
      s: { a: 0, k: [w, h] },
    }
  }
  return {
    ty: 'rc',
    nm: 'Rectangle',
    d: 1,
    p: { a: 0, k: [0, 0] },
    s: { a: 0, k: [w, h] },
    r: { a: 0, k: layer.cornerRadius },
  }
}

function buildLayer(layer: Layer, index: number, op: number) {
  const fillColor = buildProp(layer.fillColor, 'color')
  return {
    ddd: 0,
    ind: index + 1,
    ty: 4, // shape layer
    nm: layer.name,
    sr: 1,
    ks: {
      o: buildProp(layer.opacity, 'scalar'),
      r: buildProp(layer.rotation, 'scalar'),
      p: buildProp(layer.position, 'vec2'),
      a: { a: 0, k: [0, 0, 0] }, // anchor at shape center
      s: buildProp(layer.scale, 'scale'),
    },
    ao: 0,
    shapes: [
      {
        ty: 'gr',
        nm: 'Group',
        it: [
          buildShapeItem(layer),
          { ty: 'fl', nm: 'Fill', c: fillColor, o: { a: 0, k: 100 }, r: 1, bm: 0 },
          {
            ty: 'tr',
            p: { a: 0, k: [0, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
        ],
      },
    ],
    ip: 0,
    op,
    st: 0,
    bm: 0,
  }
}

export function buildLottie(comp: Composition) {
  const op = Math.max(1, Math.round(comp.duration))
  const layers = comp.layers
    .filter((l) => l.visible)
    .map((l, i) => buildLayer(l, i, op))

  return {
    v: LOTTIE_VERSION,
    fr: comp.fr,
    ip: 0,
    op,
    w: comp.w,
    h: comp.h,
    nm: comp.name,
    ddd: 0,
    assets: [],
    layers,
  }
}

export function exportLottieString(comp: Composition) {
  return JSON.stringify(buildLottie(comp), null, 2)
}
