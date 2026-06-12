import svgpath from 'svgpath'
import type { Composition, Layer, Stroke, SubPath, Vec2 } from './model'
import { createPathLayer, hexToRgb } from './factory'

// ---------------------------------------------------------------------------
// SVG import — turns an SVG document into native editor layers.
//
// Every drawable element (path / rect / circle / ellipse / line / poly*) is
// converted to a bezier contour set and becomes its own layer, centered on its
// bounding box so the existing transform + preset machinery animates it as a
// unit. Geometry is normalized with `svgpath` (arcs → cubics, shorthand
// expanded) and all ancestor + element transforms are flattened in.
// ---------------------------------------------------------------------------

const MAX_ELEMENTS = 600

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', gray: '#808080', grey: '#808080', silver: '#c0c0c0',
  maroon: '#800000', yellow: '#ffff00', olive: '#808000', lime: '#00ff00',
  aqua: '#00ffff', cyan: '#00ffff', teal: '#008080', navy: '#000080',
  fuchsia: '#ff00ff', magenta: '#ff00ff', purple: '#800080', orange: '#ffa500',
}

type Color = number[] | 'none' | null

function parseColor(v?: string | null): Color {
  if (!v) return null
  const s = v.trim().toLowerCase()
  if (s === 'none' || s === 'transparent') return 'none'
  if (s === 'currentcolor' || s === 'inherit') return null
  if (s[0] === '#') {
    try {
      return hexToRgb(s)
    } catch {
      return null
    }
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(/[,\s/]+/).map(Number)
    if (p.length >= 3 && p.slice(0, 3).every((n) => !isNaN(n)))
      return [p[0] / 255, p[1] / 255, p[2] / 255]
  }
  if (NAMED[s]) return hexToRgb(NAMED[s])
  return null
}

/** Inline `style="a:b;c:d"` plus presentation attributes, style winning. */
function readProps(el: Element): Record<string, string> {
  const out: Record<string, string> = {}
  for (const a of Array.from(el.attributes)) out[a.name] = a.value
  const style = el.getAttribute('style')
  if (style) {
    for (const decl of style.split(';')) {
      const i = decl.indexOf(':')
      if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim()
    }
  }
  return out
}

const num = (el: Element, name: string, def = 0) => {
  const n = parseFloat(el.getAttribute(name) ?? '')
  return isNaN(n) ? def : n
}

const pairs = (str: string): number[] => (str.match(/-?[\d.]+(?:[eE][-+]?\d+)?/g) ?? []).map(Number)

/** Convert a primitive element into an SVG path `d` string. */
function elementToD(el: Element): string | null {
  switch (el.tagName.toLowerCase()) {
    case 'path':
      return el.getAttribute('d')
    case 'rect': {
      const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height')
      if (w <= 0 || h <= 0) return null
      let rx = num(el, 'rx', NaN), ry = num(el, 'ry', NaN)
      if (isNaN(rx) && isNaN(ry)) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`
      rx = Math.min(isNaN(rx) ? ry : rx, w / 2)
      ry = Math.min(isNaN(ry) ? rx : ry, h / 2)
      return (
        `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}` +
        `V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}` +
        `H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}` +
        `V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
      )
    }
    case 'circle': {
      const cx = num(el, 'cx'), cy = num(el, 'cy'), r = num(el, 'r')
      if (r <= 0) return null
      return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`
    }
    case 'ellipse': {
      const cx = num(el, 'cx'), cy = num(el, 'cy'), rx = num(el, 'rx'), ry = num(el, 'ry')
      if (rx <= 0 || ry <= 0) return null
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`
    }
    case 'line':
      return `M${num(el, 'x1')} ${num(el, 'y1')}L${num(el, 'x2')} ${num(el, 'y2')}`
    case 'polyline':
    case 'polygon': {
      const p = pairs(el.getAttribute('points') ?? '')
      if (p.length < 4) return null
      let d = `M${p[0]} ${p[1]}`
      for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`
      return el.tagName.toLowerCase() === 'polygon' ? d + 'Z' : d
    }
    default:
      return null
  }
}

const add = (cur: SubPath, v: Vec2, i: Vec2 = [0, 0], o: Vec2 = [0, 0]) => {
  cur.v.push(v)
  cur.i.push(i)
  cur.o.push(o)
}

/** Normalize a `d` (+ accumulated transform) into absolute bezier contours. */
function toSubpaths(d: string, transform: string): SubPath[] {
  let sp = svgpath(d).abs().unarc().unshort()
  if (transform.trim()) {
    try {
      sp = sp.transform(transform).abs()
    } catch {
      /* ignore bad transform */
    }
  }
  const out: SubPath[] = []
  let cur: SubPath | null = null
  let start: Vec2 | null = null
  const flush = () => {
    if (cur && cur.v.length > 1) out.push(cur)
    cur = null
  }
  sp.iterate((seg, _i, x, y) => {
    const c = seg[0]
    if (c === 'M') {
      flush()
      cur = { v: [], i: [], o: [], closed: false }
      start = [seg[1], seg[2]]
      add(cur, [seg[1], seg[2]])
    } else if (!cur) {
      return
    } else if (c === 'L') {
      add(cur, [seg[1], seg[2]])
    } else if (c === 'H') {
      add(cur, [seg[1], y])
    } else if (c === 'V') {
      add(cur, [x, seg[1]])
    } else if (c === 'C') {
      cur.o[cur.o.length - 1] = [seg[1] - x, seg[2] - y]
      add(cur, [seg[5], seg[6]], [seg[3] - seg[5], seg[4] - seg[6]])
    } else if (c === 'Q') {
      const qx = seg[1], qy = seg[2], ex = seg[3], ey = seg[4]
      cur.o[cur.o.length - 1] = [(2 / 3) * (qx - x), (2 / 3) * (qy - y)]
      add(cur, [ex, ey], [(2 / 3) * (qx - ex), (2 / 3) * (qy - ey)])
    } else if (c === 'Z' || c === 'z') {
      cur.closed = true
      if (start && cur.v.length > 1) {
        const last = cur.v[cur.v.length - 1]
        if (Math.abs(last[0] - start[0]) < 1e-4 && Math.abs(last[1] - start[1]) < 1e-4) {
          const inTan = cur.i[cur.i.length - 1]
          cur.v.pop()
          cur.i.pop()
          cur.o.pop()
          cur.i[0] = inTan
        }
      }
      flush()
    }
  })
  flush()
  return out
}

interface RawEl {
  name: string
  subpaths: SubPath[]
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
  fill: number[] | null
  stroke: { color: number[]; width: number } | null
  opacity: number
}

function bboxOf(subs: SubPath[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const sp of subs) {
    for (let k = 0; k < sp.v.length; k++) {
      const [vx, vy] = sp.v[k]
      for (const [dx, dy] of [[0, 0], sp.i[k], sp.o[k]]) {
        const px = vx + dx, py = vy + dy
        if (px < minX) minX = px
        if (py < minY) minY = py
        if (px > maxX) maxX = px
        if (py > maxY) maxY = py
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

interface Ctx {
  fill: Color
  stroke: Color
  strokeWidth: number
  opacity: number
  transform: string
}

const SKIP = new Set(['defs', 'clippath', 'mask', 'title', 'desc', 'metadata', 'style', 'symbol', 'filter', 'lineargradient', 'radialgradient', 'pattern'])

function walk(el: Element, ctx: Ctx, out: RawEl[], warn: Set<string>) {
  if (out.length >= MAX_ELEMENTS) return
  const tag = el.tagName.toLowerCase()
  if (SKIP.has(tag)) return

  const p = readProps(el)
  const ownFill = parseColor(p['fill'])
  const ownStroke = parseColor(p['stroke'])
  const sw = parseFloat(p['stroke-width'])
  const op = parseFloat(p['opacity'])
  const tf = p['transform'] ? `${ctx.transform} ${p['transform']}` : ctx.transform

  const next: Ctx = {
    fill: ownFill !== null ? ownFill : ctx.fill,
    stroke: ownStroke !== null ? ownStroke : ctx.stroke,
    strokeWidth: isNaN(sw) ? ctx.strokeWidth : sw,
    opacity: ctx.opacity * (isNaN(op) ? 1 : Math.max(0, Math.min(1, op))),
    transform: tf,
  }

  if (tag === 'svg' || tag === 'g' || tag === 'a') {
    for (const child of Array.from(el.children)) walk(child, next, out, warn)
    return
  }
  if (tag === 'use' || tag === 'text' || tag === 'image' || tag === 'foreignobject') {
    warn.add(`<${tag}> is not supported and was skipped`)
    return
  }

  const d = elementToD(el)
  if (!d) return
  let subpaths: SubPath[]
  try {
    subpaths = toSubpaths(d, next.transform)
  } catch {
    return
  }
  if (!subpaths.length) return

  // line has no fillable area
  const fillC = tag === 'line' ? 'none' : next.fill
  const fill = fillC === 'none' ? null : fillC ?? [0, 0, 0]
  const strokeC = next.stroke
  const stroke =
    strokeC && strokeC !== 'none'
      ? { color: strokeC, width: isNaN(next.strokeWidth) ? 1 : next.strokeWidth }
      : null
  if (!fill && !stroke) return // nothing visible

  out.push({
    name: el.getAttribute('id') || `${tag} ${out.length + 1}`,
    subpaths,
    bbox: bboxOf(subpaths),
    fill,
    stroke,
    opacity: next.opacity,
  })
}

export interface SvgImportResult {
  layers: Layer[]
  warnings: string[]
}

/** Parse `svgText` into editor layers fitted/centered inside `comp`. */
export function importSvg(svgText: string, comp: Composition): SvgImportResult {
  const warn = new Set<string>()
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (doc.querySelector('parsererror')) return { layers: [], warnings: ['Could not parse that SVG file.'] }
  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== 'svg')
    return { layers: [], warnings: ['That file does not look like an SVG.'] }

  const els: RawEl[] = []
  walk(root, { fill: null, stroke: 'none', strokeWidth: 1, opacity: 1, transform: '' }, els, warn)
  if (!els.length) return { layers: [], warnings: ['No drawable shapes found in that SVG.'] }
  if (els.length >= MAX_ELEMENTS) warn.add(`Import capped at ${MAX_ELEMENTS} elements.`)

  // union bbox of the whole drawing → fit + center into the comp
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const e of els) {
    minX = Math.min(minX, e.bbox.minX)
    minY = Math.min(minY, e.bbox.minY)
    maxX = Math.max(maxX, e.bbox.maxX)
    maxY = Math.max(maxY, e.bbox.maxY)
  }
  const unionW = Math.max(1e-3, maxX - minX)
  const unionH = Math.max(1e-3, maxY - minY)
  const scale = Math.min((comp.w * 0.9) / unionW, (comp.h * 0.9) / unionH)
  const ucx = (minX + maxX) / 2
  const ucy = (minY + maxY) / 2

  const layers = els.map((e) => {
    const ecx = (e.bbox.minX + e.bbox.maxX) / 2
    const ecy = (e.bbox.minY + e.bbox.maxY) / 2
    const subpaths: SubPath[] = e.subpaths.map((sp) => ({
      closed: sp.closed,
      v: sp.v.map(([vx, vy]) => [(vx - ecx) * scale, (vy - ecy) * scale] as Vec2),
      i: sp.i.map(([ix, iy]) => [ix * scale, iy * scale] as Vec2),
      o: sp.o.map(([ox, oy]) => [ox * scale, oy * scale] as Vec2),
    }))
    const size: Vec2 = [(e.bbox.maxX - e.bbox.minX) * scale, (e.bbox.maxY - e.bbox.minY) * scale]
    const center: Vec2 = [(ecx - ucx) * scale + comp.w / 2, (ecy - ucy) * scale + comp.h / 2]
    const stroke: Stroke | null = e.stroke
      ? { color: e.stroke.color, width: Math.max(0.1, e.stroke.width * scale) }
      : null
    return createPathLayer({
      name: e.name,
      subpaths,
      center,
      size,
      fill: e.fill,
      stroke,
      opacity: e.opacity * 100,
    })
  })

  // document order paints back→front; layer index 0 is the top of the stack
  layers.reverse()
  return { layers, warnings: [...warn] }
}
