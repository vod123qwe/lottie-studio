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

/** Shape (geometry) items for a layer's group — one or more for paths. */
function buildShapeItems(layer: Layer): object[] {
  const [w, h] = layer.size
  if (layer.shape === 'ellipse') {
    return [{ ty: 'el', nm: 'Ellipse', d: 1, p: { a: 0, k: [0, 0] }, s: { a: 0, k: [w, h] } }]
  }
  if (layer.shape === 'rect') {
    return [
      {
        ty: 'rc',
        nm: 'Rectangle',
        d: 1,
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [w, h] },
        r: { a: 0, k: layer.cornerRadius },
      },
    ]
  }
  // animated path (flag wave / morph): one animated shape per contour
  const pks = layer.pathKeyframes
  if (pks && pks.length >= 2) {
    const count = pks[0].subpaths.length
    const items: object[] = []
    for (let ci = 0; ci < count; ci++) {
      const k = pks.map((pk, idx) => {
        const sp = pk.subpaths[ci]
        const s = [{ c: sp.closed, v: sp.v, i: sp.i, o: sp.o }]
        if (idx === pks.length - 1) return { t: pk.t, s }
        const [x1, y1, x2, y2] = CURVES[pk.easing]
        return { t: pk.t, s, o: { x: [x1], y: [y1] }, i: { x: [x2], y: [y2] } }
      })
      items.push({ ty: 'sh', nm: `Path ${ci + 1}`, ind: ci, ks: { a: 1, k } })
    }
    return items
  }
  // static path: one Lottie shape per contour, geometry already relative to center
  return (layer.path ?? []).map((sp, i) => ({
    ty: 'sh',
    nm: `Path ${i + 1}`,
    ind: i,
    ks: { a: 0, k: { c: sp.closed, v: sp.v, i: sp.i, o: sp.o } },
  }))
}

/** Shared gradient payload (type + start/end points + color/alpha ramp). */
function gradientParts(g: NonNullable<Layer['gradient']>, w: number, h: number) {
  const stops = [...g.stops].sort((a, b) => a.offset - b.offset)
  let s: number[]
  let e: number[]
  if (g.type === 'radial') {
    s = [0, 0]
    e = [w / 2, 0]
  } else {
    const a = ((g.angle ?? 0) * Math.PI) / 180
    s = [(-Math.cos(a) * w) / 2, (-Math.sin(a) * h) / 2]
    e = [(Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2]
  }
  const colorPart = stops.flatMap((st) => [st.offset, st.color[0], st.color[1], st.color[2]])
  const alphaPart = stops.flatMap((st) => [st.offset, st.opacity])
  return {
    t: g.type === 'radial' ? 2 : 1,
    s: { a: 0, k: s },
    e: { a: 0, k: e },
    g: { p: stops.length, k: { a: 0, k: [...colorPart, ...alphaPart] } },
  }
}

/** Lottie gradient fill (gf) from a layer's static gradient + bbox. */
function buildGradientFill(layer: Layer) {
  const [w, h] = layer.size
  return { ty: 'gf', nm: 'Gradient', ...gradientParts(layer.gradient!, w, h), o: { a: 0, k: 100 }, r: 1, bm: 0 }
}

/** Lottie gradient stroke (gs). */
function buildGradientStroke(layer: Layer) {
  const [w, h] = layer.size
  return {
    ty: 'gs',
    nm: 'Gradient Stroke',
    ...gradientParts(layer.stroke!.gradient!, w, h),
    w: { a: 0, k: layer.stroke!.width },
    o: { a: 0, k: 100 },
    lc: 2,
    lj: 2,
    ml: 4,
    bm: 0,
  }
}

function buildLayer(layer: Layer, index: number, op: number) {
  const items: object[] = [...buildShapeItems(layer)]
  // paint order: fill underneath, stroke on top, then the group transform
  if (layer.fillEnabled !== false) {
    if (layer.gradient && layer.gradient.stops.length >= 2) {
      items.push(buildGradientFill(layer))
    } else {
      items.push({
        ty: 'fl',
        nm: 'Fill',
        c: buildProp(layer.fillColor, 'color'),
        o: { a: 0, k: 100 },
        r: 1,
        bm: 0,
      })
    }
  }
  if (layer.stroke) {
    if (layer.stroke.gradient && layer.stroke.gradient.stops.length >= 2) {
      items.push(buildGradientStroke(layer))
    } else {
      items.push({
        ty: 'st',
        nm: 'Stroke',
        c: { a: 0, k: [layer.stroke.color[0], layer.stroke.color[1], layer.stroke.color[2], 1] },
        o: { a: 0, k: 100 },
        w: { a: 0, k: layer.stroke.width },
        lc: 2,
        lj: 2,
        ml: 4,
        bm: 0,
      })
    }
  }
  items.push({
    ty: 'tr',
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  })

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
    shapes: [{ ty: 'gr', nm: 'Group', it: items }],
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
