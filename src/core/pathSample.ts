import type { SubPath, Vec2 } from './model'

// ---------------------------------------------------------------------------
// Path sampling helpers for morphing. To tween between two shapes Lottie needs
// the same vertex count, so we flatten a contour to a dense polyline, then
// resample it to N evenly arc-length-spaced points. Target primitives (circle,
// square, …) are generated the same way. Rings are normalized (consistent
// winding + top start) so the correspondence between source and target lines up.
// ---------------------------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function cubic(p0: Vec2, c1: Vec2, c2: Vec2, p1: Vec2, t: number): Vec2 {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]]
}

/** Flatten a bezier contour into a polyline (perSeg samples per segment). */
function flattenSub(sp: SubPath, perSeg = 16): Vec2[] {
  const n = sp.v.length
  const pts: Vec2[] = []
  if (!n) return pts
  const segs = sp.closed ? n : n - 1
  for (let k = 0; k < segs; k++) {
    const a = k
    const b = (k + 1) % n
    const p0 = sp.v[a]
    const p1 = sp.v[b]
    const c1: Vec2 = [p0[0] + sp.o[a][0], p0[1] + sp.o[a][1]]
    const c2: Vec2 = [p1[0] + sp.i[b][0], p1[1] + sp.i[b][1]]
    for (let s = 0; s < perSeg; s++) pts.push(cubic(p0, c1, c2, p1, s / perSeg))
  }
  return pts
}

function bboxArea(v: Vec2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of v) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return (maxX - minX) * (maxY - minY)
}

function largest(subs: SubPath[]): SubPath {
  let best = subs[0]
  let ba = -1
  for (const sp of subs) {
    const area = bboxArea(sp.v)
    if (area > ba) {
      ba = area
      best = sp
    }
  }
  return best
}

/** Resample a closed polyline to N evenly arc-length-spaced points. */
export function resample(poly: Vec2[], N: number): Vec2[] {
  if (poly.length < 2) return Array.from({ length: N }, () => [0, 0] as Vec2)
  const cum = [0]
  for (let i = 1; i <= poly.length; i++) {
    const a = poly[i - 1]
    const b = poly[i % poly.length]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = cum[cum.length - 1] || 1
  const out: Vec2[] = []
  let j = 0
  for (let i = 0; i < N; i++) {
    const target = (total * i) / N
    while (j < cum.length - 1 && cum[j + 1] < target) j++
    const segLen = cum[j + 1] - cum[j] || 1
    const t = (target - cum[j]) / segLen
    const a = poly[j % poly.length]
    const b = poly[(j + 1) % poly.length]
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)])
  }
  return out
}

function signedArea(p: Vec2[]) {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

/** Consistent winding (CW) + start at the topmost point, so two rings line up. */
function normalizeRing(poly: Vec2[]): Vec2[] {
  let p = poly
  if (signedArea(p) < 0) p = p.slice().reverse()
  let bi = 0
  for (let i = 1; i < p.length; i++) {
    if (p[i][1] < p[bi][1] || (p[i][1] === p[bi][1] && p[i][0] < p[bi][0])) bi = i
  }
  return p.slice(bi).concat(p.slice(0, bi))
}

/** A normalized N-point ring sampled from a path's largest contour. */
export function ringFromPath(subs: SubPath[], N: number): Vec2[] {
  return normalizeRing(resample(flattenSub(largest(subs)), N))
}

export type MorphTarget = 'circle' | 'square' | 'triangle' | 'star' | 'hexagon' | 'heart'

/** A normalized N-point ring for a primitive shape, fit to half-extents rx/ry. */
export function targetRing(kind: MorphTarget, rx: number, ry: number, N: number): Vec2[] {
  if (kind === 'circle') {
    const out: Vec2[] = []
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / N
      out.push([Math.cos(a) * rx, Math.sin(a) * ry])
    }
    return normalizeRing(out)
  }
  if (kind === 'heart') {
    const pts: Vec2[] = []
    const steps = 120
    for (let i = 0; i < steps; i++) {
      const t = (2 * Math.PI * i) / steps
      const x = 16 * Math.sin(t) ** 3
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
      pts.push([(x / 16) * rx, (y / 17) * ry])
    }
    return normalizeRing(resample(pts, N))
  }
  let corners: Vec2[] = []
  if (kind === 'square') corners = [[-rx, -ry], [rx, -ry], [rx, ry], [-rx, ry]]
  else if (kind === 'triangle') corners = [[0, -ry], [rx, ry], [-rx, ry]]
  else if (kind === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / 6
      corners.push([Math.cos(a) * rx, Math.sin(a) * ry])
    }
  } else {
    // 5-point star, alternating outer/inner radius
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? 0.45 : 1
      const a = -Math.PI / 2 + (Math.PI * i) / 5
      corners.push([Math.cos(a) * rx * rr, Math.sin(a) * ry * rr])
    }
  }
  return normalizeRing(resample(corners, N))
}
