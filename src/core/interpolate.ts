import type { Easing, Property } from './model'

// ---------------------------------------------------------------------------
// Property evaluation — value of an animated property at a given frame.
// Used by the Stage for selection overlays and by presets/UI for "current
// value" reads. The exported Lottie keeps its own keyframes (see builder.ts),
// so this only needs to match Lottie's easing closely enough for editing.
// ---------------------------------------------------------------------------

const CURVES: Record<Easing, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
}

/** Returns a function mapping progress x (0..1) -> eased y (0..1). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  const solveX = (x: number) => {
    // Newton-Raphson first, bisection as a fallback.
    let t = x
    for (let i = 0; i < 8; i++) {
      const xe = sampleX(t) - x
      if (Math.abs(xe) < 1e-6) return t
      const d = sampleDX(t)
      if (Math.abs(d) < 1e-6) break
      t -= xe / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 20; i++) {
      const xe = sampleX(t)
      if (Math.abs(xe - x) < 1e-6) break
      if (x > xe) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return t
  }

  return (x: number) => sampleY(solveX(x))
}

const easeCache = new Map<Easing, (x: number) => number>()
function easeFn(e: Easing) {
  let fn = easeCache.get(e)
  if (!fn) {
    if (e === 'linear') fn = (x: number) => x
    else fn = cubicBezier(...CURVES[e])
    easeCache.set(e, fn)
  }
  return fn
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Sorted copy of a property's keyframes (defensive — store keeps them sorted). */
export function sortedKeyframes(prop: Property) {
  return [...prop.keyframes].sort((a, b) => a.t - b.t)
}

/** Evaluate a property's value (as a number[]) at the given frame. */
export function evalProperty(prop: Property, frame: number): number[] {
  if (!prop.animated || prop.keyframes.length === 0) return prop.value
  const kfs = sortedKeyframes(prop)
  if (kfs.length === 1) return kfs[0].value
  if (frame <= kfs[0].t) return kfs[0].value
  if (frame >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1].value

  let i = 0
  while (i < kfs.length - 1 && kfs[i + 1].t <= frame) i++
  const a = kfs[i]
  const b = kfs[i + 1]
  const span = b.t - a.t || 1
  const raw = (frame - a.t) / span
  const eased = easeFn(a.easing)(raw)

  const out: number[] = []
  for (let d = 0; d < a.value.length; d++) {
    out.push(lerp(a.value[d], b.value[d] ?? a.value[d], eased))
  }
  return out
}

export { CURVES }
