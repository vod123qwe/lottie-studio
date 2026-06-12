import { useEffect, useRef, useState } from 'react'
import { useEditor, type KeyframeRef } from '../store/editorStore'
import {
  PROP_KINDS,
  PROP_LABELS,
  type Keyframe,
  type Layer,
  type PropKind,
} from '../core/model'
import { Icon } from './Icons'

// ---------------------------------------------------------------------------
// Timeline: scrubbable ruler + layer rows. Any number of layers can be expanded
// into per-property tracks at once. Keyframes support canvas-style multi-select
// (shift-click, marquee across rows/layers), group move, and a selection
// bracket whose edges squeeze / stretch the group in time. Zoomable 1×–24×.
// ---------------------------------------------------------------------------

const GUTTER = 140
const ROW = 28
const RULER = 34
const MIN_ZOOM = 1
const MAX_ZOOM = 24

const eqRef = (a: KeyframeRef, b: KeyframeRef) =>
  a.layerId === b.layerId && a.prop === b.prop && a.kfId === b.kfId
const rowKey = (layerId: string, prop: PropKind) => `${layerId}::${prop}`

interface SnapKf {
  layerId: string
  prop: PropKind
  kfId: string
  t0: number
}

function niceStep(duration: number, pxPerFrame: number) {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  for (const s of steps) if (s * pxPerFrame >= 48) return s
  return Math.max(1, Math.round(duration / 8))
}

const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))

function Diamond({
  layer,
  prop,
  kf,
  pxPerFrame,
}: {
  layer: Layer
  prop: PropKind
  kf: Keyframe
  pxPerFrame: number
}) {
  const selectedKeyframes = useEditor((s) => s.selectedKeyframes)
  const selectKeyframe = useEditor((s) => s.selectKeyframe)
  const toggleKeyframe = useEditor((s) => s.toggleKeyframe)
  const beginInteractive = useEditor((s) => s.beginInteractive)
  const setKeyframeTimesLive = useEditor((s) => s.setKeyframeTimesLive)
  const endInteractive = useEditor((s) => s.endInteractive)
  const duration = useEditor((s) => s.comp.duration)
  const dragRef = useRef<{ startX: number; snap: SnapKf[] } | null>(null)

  const ref: KeyframeRef = { layerId: layer.id, prop, kfId: kf.id }
  const isSel = selectedKeyframes.some((r) => eqRef(r, ref))

  return (
    <div
      className={'kf' + (isSel ? ' sel' : '')}
      style={{ left: kf.t * pxPerFrame }}
      title={`Frame ${kf.t} · ${kf.easing}`}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          toggleKeyframe(ref)
          return
        }
        const st = useEditor.getState()
        let sel = st.selectedKeyframes
        if (!sel.some((r) => eqRef(r, ref))) {
          selectKeyframe(ref)
          sel = [ref]
        }
        const comp = st.comp
        const snap = sel
          .map((r) => {
            const l = comp.layers.find((x) => x.id === r.layerId)
            const k = l?.[r.prop].keyframes.find((x) => x.id === r.kfId)
            return k ? { layerId: r.layerId, prop: r.prop, kfId: r.kfId, t0: k.t } : null
          })
          .filter((x): x is SnapKf => x !== null)
        dragRef.current = { startX: e.clientX, snap }
        beginInteractive()
        ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        if (!d || !pxPerFrame) return
        const raw = Math.round((e.clientX - d.startX) / pxPerFrame)
        const minT = Math.min(...d.snap.map((s) => s.t0))
        const maxT = Math.max(...d.snap.map((s) => s.t0))
        const delta = Math.max(-minT, Math.min(duration - maxT, raw))
        setKeyframeTimesLive(d.snap.map((s) => ({ layerId: s.layerId, prop: s.prop, kfId: s.kfId, t: s.t0 + delta })))
      }}
      onPointerUp={() => {
        if (dragRef.current) {
          dragRef.current = null
          endInteractive()
        }
      }}
    />
  )
}

export function Timeline() {
  const comp = useEditor((s) => s.comp)
  const playhead = useEditor((s) => s.playhead)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedKeyframes = useEditor((s) => s.selectedKeyframes)
  const selectLayer = useEditor((s) => s.selectLayer)
  const selectKeyframes = useEditor((s) => s.selectKeyframes)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const beginInteractive = useEditor((s) => s.beginInteractive)
  const setKeyframeTimesLive = useEditor((s) => s.setKeyframeTimesLive)
  const endInteractive = useEditor((s) => s.endInteractive)
  const openLayerMenu = useEditor((s) => s.openLayerMenu)

  const bodyRef = useRef<HTMLDivElement>(null)
  const rulerTrackRef = useRef<HTMLDivElement>(null)
  const handleDrag = useRef(false)
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number; moved: boolean } | null>(null)
  const bracketRef = useRef<{ mode: 'move' | 'left' | 'right'; minT: number; maxT: number; startX: number; snap: SnapKf[] } | null>(null)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [viewW, setViewW] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(selectedLayerId ? [selectedLayerId] : []))
  const scrubbing = useRef(false)

  // selecting a layer expands it (without collapsing the others)
  useEffect(() => {
    if (selectedLayerId) setExpanded((s) => (s.has(selectedLayerId) ? s : new Set(s).add(selectedLayerId)))
  }, [selectedLayerId])

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewW(el.clientWidth))
    ro.observe(el)
    setViewW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const trackView = Math.max(1, viewW - GUTTER - 1)
  const pxPerFrame = comp.duration > 0 ? (trackView / comp.duration) * zoom : 0
  const contentW = trackView * zoom
  const rowW = GUTTER + contentW

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const dur = useEditor.getState().comp.duration
      const tv = Math.max(1, el.clientWidth - GUTTER)
      const cursorX = e.clientX - el.getBoundingClientRect().left
      const frame = ((el.scrollLeft + cursorX - GUTTER) / ((tv / dur) * zoom)) || 0
      const next = clampZoom(zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18))
      setZoom(next)
      requestAnimationFrame(() => {
        const ppf = (tv / dur) * next
        el.scrollLeft = frame * ppf + GUTTER - cursorX
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom])

  const step = niceStep(comp.duration, pxPerFrame)
  const ticks: number[] = []
  for (let f = 0; f <= comp.duration; f += step) ticks.push(f)

  // content-y of every visible property row, keyed by layer::prop
  const rowY = new Map<string, number>()
  {
    let cursor = RULER
    for (const layer of comp.layers) {
      cursor += ROW // layer row
      if (expanded.has(layer.id)) for (const prop of PROP_KINDS) rowY.set(rowKey(layer.id, prop), (cursor += 0, cursor)), (cursor += ROW)
    }
  }

  const scrubFrom = (clientX: number, rectLeft: number) => {
    if (!pxPerFrame) return
    setPlayhead((clientX - rectLeft) / pxPerFrame)
  }
  const zoomBy = (factor: number) => setZoom((z) => clampZoom(z * factor))

  const contentXY = (e: React.PointerEvent): [number, number] => {
    const el = bodyRef.current
    if (!el) return [0, 0]
    const r = el.getBoundingClientRect()
    return [e.clientX - r.left + el.scrollLeft, e.clientY - r.top + el.scrollTop]
  }

  // ---- marquee over any expanded property tracks -----------------------
  function onTrackDown(e: React.PointerEvent) {
    const [x, y] = contentXY(e)
    marqueeRef.current = { x0: x, y0: y, x1: x, y1: y, moved: false }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  function onTrackMove(e: React.PointerEvent) {
    const m = marqueeRef.current
    if (!m) return
    const [x, y] = contentXY(e)
    m.x1 = x
    m.y1 = y
    if (Math.abs(x - m.x0) > 4 || Math.abs(y - m.y0) > 4) m.moved = true
    setMarquee({ x0: m.x0, y0: m.y0, x1: x, y1: y })
  }
  function onTrackUp() {
    const m = marqueeRef.current
    marqueeRef.current = null
    setMarquee(null)
    if (!m || !pxPerFrame) return
    if (!m.moved) {
      setPlayhead((m.x0 - GUTTER) / pxPerFrame)
      return
    }
    const tA = (Math.min(m.x0, m.x1) - GUTTER) / pxPerFrame
    const tB = (Math.max(m.x0, m.x1) - GUTTER) / pxPerFrame
    const yA = Math.min(m.y0, m.y1)
    const yB = Math.max(m.y0, m.y1)
    const refs: KeyframeRef[] = []
    for (const layer of comp.layers) {
      if (!expanded.has(layer.id)) continue
      for (const prop of PROP_KINDS) {
        const ry = rowY.get(rowKey(layer.id, prop))
        if (ry === undefined || ry + ROW < yA || ry > yB) continue
        const p = layer[prop]
        if (!p.animated) continue
        for (const k of p.keyframes) if (k.t >= tA && k.t <= tB) refs.push({ layerId: layer.id, prop, kfId: k.id })
      }
    }
    selectKeyframes(refs)
  }

  // ---- selection bracket (move / squeeze) ------------------------------
  const findKf = (r: KeyframeRef) =>
    comp.layers.find((l) => l.id === r.layerId)?.[r.prop].keyframes.find((k) => k.id === r.kfId)
  const selRowYs = selectedKeyframes.map((r) => rowY.get(rowKey(r.layerId, r.prop)))
  const selTimes = selectedKeyframes.map((r) => findKf(r)?.t)
  const allVisible = selRowYs.every((y) => y !== undefined) && selTimes.every((t) => t !== undefined)
  const showBracket = selectedKeyframes.length >= 2 && allVisible
  const bMinT = showBracket ? Math.min(...(selTimes as number[])) : 0
  const bMaxT = showBracket ? Math.max(...(selTimes as number[])) : 0
  const bTop = showBracket ? Math.min(...(selRowYs as number[])) : 0
  const bBottom = showBracket ? Math.max(...(selRowYs as number[])) + ROW : 0

  const snapshotSel = (): SnapKf[] =>
    selectedKeyframes
      .map((r) => {
        const k = findKf(r)
        return k ? { layerId: r.layerId, prop: r.prop, kfId: r.kfId, t0: k.t } : null
      })
      .filter((x): x is SnapKf => x !== null)

  function onBracketDown(e: React.PointerEvent, mode: 'move' | 'left' | 'right') {
    e.stopPropagation()
    bracketRef.current = { mode, minT: bMinT, maxT: bMaxT, startX: e.clientX, snap: snapshotSel() }
    beginInteractive()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  function onBracketMove(e: React.PointerEvent) {
    const b = bracketRef.current
    if (!b || !pxPerFrame) return
    const dur = comp.duration
    if (b.mode === 'move') {
      const raw = Math.round((e.clientX - b.startX) / pxPerFrame)
      const delta = Math.max(-b.minT, Math.min(dur - b.maxT, raw))
      setKeyframeTimesLive(b.snap.map((s) => ({ layerId: s.layerId, prop: s.prop, kfId: s.kfId, t: s.t0 + delta })))
      return
    }
    const [cx] = contentXY(e)
    const span = b.maxT - b.minT || 1
    if (b.mode === 'right') {
      const newMax = Math.max(b.minT + 1, Math.min(dur, (cx - GUTTER) / pxPerFrame))
      const f = (newMax - b.minT) / span
      setKeyframeTimesLive(b.snap.map((s) => ({ layerId: s.layerId, prop: s.prop, kfId: s.kfId, t: b.minT + (s.t0 - b.minT) * f })))
    } else {
      const newMin = Math.max(0, Math.min(b.maxT - 1, (cx - GUTTER) / pxPerFrame))
      const f = (b.maxT - newMin) / span
      setKeyframeTimesLive(b.snap.map((s) => ({ layerId: s.layerId, prop: s.prop, kfId: s.kfId, t: b.maxT + (s.t0 - b.maxT) * f })))
    }
  }
  function onBracketUp() {
    if (bracketRef.current) {
      bracketRef.current = null
      endInteractive()
    }
  }

  return (
    <section
      className="panel timeline"
      style={{
        ['--gutter' as string]: `${GUTTER}px`,
        ['--grid' as string]: `${Math.max(1, step * pxPerFrame)}px`,
      }}
    >
      <div className="tl-zoom">
        <button className="icon-btn" title="Zoom out" onClick={() => zoomBy(1 / 1.4)} disabled={zoom <= MIN_ZOOM}>
          <Icon name="minus" size={15} />
        </button>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(clampZoom(parseFloat(e.target.value)))}
          title="Timeline zoom"
        />
        <button className="icon-btn" title="Zoom in" onClick={() => zoomBy(1.4)} disabled={zoom >= MAX_ZOOM}>
          <Icon name="plus" size={15} />
        </button>
        <button className="icon-btn" title="Fit timeline" onClick={() => setZoom(1)} disabled={zoom === 1}>
          <Icon name="maximize" size={14} />
        </button>
        <span className="tl-zoom-val">{zoom.toFixed(1)}×</span>
      </div>

      <div className="tl-body" ref={bodyRef}>
        {/* ruler */}
        <div className="tl-row ruler-row" style={{ width: rowW }}>
          <div className="tl-label corner">Timeline</div>
          <div
            className="tl-track ruler"
            ref={rulerTrackRef}
            style={{ width: contentW }}
            onPointerDown={(e) => {
              scrubbing.current = true
              ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
              scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect().left)
            }}
            onPointerMove={(e) => {
              if (scrubbing.current) scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect().left)
            }}
            onPointerUp={() => (scrubbing.current = false)}
          >
            {ticks.map((f) => (
              <span key={f} className="tick" style={{ left: f * pxPerFrame }}>
                {f}
              </span>
            ))}
            <div
              className="ph-handle"
              style={{ left: playhead * pxPerFrame }}
              title="Drag to scrub"
              onPointerDown={(e) => {
                e.stopPropagation()
                handleDrag.current = true
                ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (handleDrag.current && rulerTrackRef.current)
                  scrubFrom(e.clientX, rulerTrackRef.current.getBoundingClientRect().left)
              }}
              onPointerUp={(e) => {
                handleDrag.current = false
                ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
              }}
            >
              <span className="ph-frame">{Math.round(playhead)}</span>
            </div>
          </div>
        </div>

        {/* layer rows */}
        {comp.layers.map((layer) => {
          const isExpanded = expanded.has(layer.id)
          const unionTimes = new Set<number>()
          for (const k of PROP_KINDS) for (const kf of layer[k].keyframes) unionTimes.add(kf.t)
          return (
            <div key={layer.id} className="tl-layer-block">
              <div
                className={'tl-row layer' + (isExpanded ? ' expanded' : '') + (layer.id === selectedLayerId ? ' selected' : '')}
                style={{ width: rowW }}
              >
                <div
                  className="tl-label"
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('.caret-btn')) return
                    selectLayer(layer.id)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    selectLayer(layer.id)
                    openLayerMenu(e.clientX, e.clientY, layer.id)
                  }}
                >
                  <button
                    className="caret-btn"
                    title={isExpanded ? 'Collapse' : 'Expand'}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      toggleExpand(layer.id)
                    }}
                  >
                    <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={13} className="caret" />
                  </button>
                  {layer.name}
                </div>
                <div
                  className="tl-track"
                  style={{ width: contentW }}
                  onPointerDown={(e) => scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect().left)}
                >
                  {!isExpanded &&
                    [...unionTimes].map((t) => (
                      <div key={t} className="kf summary" style={{ left: t * pxPerFrame }} />
                    ))}
                </div>
              </div>

              {isExpanded &&
                PROP_KINDS.map((prop) => (
                  <div key={prop} className="tl-row prop" style={{ width: rowW }}>
                    <div className="tl-label sub">{PROP_LABELS[prop]}</div>
                    <div
                      className="tl-track"
                      style={{ width: contentW }}
                      onPointerDown={onTrackDown}
                      onPointerMove={onTrackMove}
                      onPointerUp={onTrackUp}
                    >
                      {layer[prop].animated &&
                        layer[prop].keyframes.map((kf) => (
                          <Diamond key={kf.id} layer={layer} prop={prop} kf={kf} pxPerFrame={pxPerFrame} />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )
        })}

        {/* marquee rubber-band */}
        {marquee && (
          <div
            className="tl-marquee"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}

        {/* selection bracket (move + squeeze) */}
        {showBracket && (
          <div
            className="kf-bracket"
            style={{
              left: GUTTER + bMinT * pxPerFrame,
              top: bTop,
              width: Math.max(2, (bMaxT - bMinT) * pxPerFrame),
              height: bBottom - bTop,
            }}
            onPointerDown={(e) => onBracketDown(e, 'move')}
            onPointerMove={onBracketMove}
            onPointerUp={onBracketUp}
          >
            <div className="kf-bracket-edge left" onPointerDown={(e) => onBracketDown(e, 'left')} onPointerMove={onBracketMove} onPointerUp={onBracketUp} />
            <div className="kf-bracket-edge right" onPointerDown={(e) => onBracketDown(e, 'right')} onPointerMove={onBracketMove} onPointerUp={onBracketUp} />
          </div>
        )}

        {/* playhead line spanning all tracks */}
        <div className="playhead" style={{ left: GUTTER + playhead * pxPerFrame }} />
      </div>
    </section>
  )
}
