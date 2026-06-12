import { useEffect, useMemo, useRef, useState } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import { useEditor } from '../store/editorStore'
import { buildLottie } from '../core/builder'
import { evalProperty } from '../core/interpolate'
import type { Composition } from '../core/model'

// ---------------------------------------------------------------------------
// Live preview. lottie-web renders the built document; an HTML overlay draws
// selection boxes (shift-click multi-select, drag to move, marquee) and — when
// a path layer is in vector-edit mode — its editable vertices + bezier handles.
// ---------------------------------------------------------------------------

interface DragState {
  ids: string[]
  startX: number
  startY: number
  orig: Record<string, [number, number]>
}
interface Marquee {
  x0: number
  y0: number
  x1: number
  y1: number
}
interface PtDrag {
  sub: number
  idx: number
  kind: 'v' | 'i' | 'o'
  startX: number
  startY: number
  orig: { v: number[]; i: number[]; o: number[] }
}

const distToSeg = (p: number[], a: number[], b: number[]) => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy || 1
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = a[0] + t * dx
  const cy = a[1] + t * dy
  return Math.hypot(p[0] - cx, p[1] - cy)
}

export function Stage() {
  const comp = useEditor((s) => s.comp)
  const playhead = useEditor((s) => s.playhead)
  const selectedIds = useEditor((s) => s.selectedLayerIds)
  const selectLayer = useEditor((s) => s.selectLayer)
  const toggleSelect = useEditor((s) => s.toggleSelect)
  const selectLayers = useEditor((s) => s.selectLayers)
  const beginInteractive = useEditor((s) => s.beginInteractive)
  const setLayerPositionsLive = useEditor((s) => s.setLayerPositionsLive)
  const endInteractive = useEditor((s) => s.endInteractive)
  const mutateLive = useEditor((s) => s.mutateLive)
  const pathEditId = useEditor((s) => s.pathEditId)
  const selectedPoint = useEditor((s) => s.selectedPoint)
  const selectPoint = useEditor((s) => s.selectPoint)
  const addPathPoint = useEditor((s) => s.addPathPoint)

  const wrapRef = useRef<HTMLDivElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const marqueeRef = useRef<Marquee | null>(null)
  const ptRef = useRef<PtDrag | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [marquee, setMarquee] = useState<Marquee | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const lottieKey = useMemo(() => JSON.stringify(buildLottie(comp)), [comp])

  useEffect(() => {
    if (!holderRef.current) return
    const anim = lottie.loadAnimation({
      container: holderRef.current,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData: JSON.parse(lottieKey),
    })
    animRef.current = anim
    const goToCurrent = () => anim.goToAndStop(useEditor.getState().playhead, true)
    anim.addEventListener('DOMLoaded', goToCurrent)
    return () => {
      anim.destroy()
      animRef.current = null
    }
  }, [lottieKey])

  useEffect(() => {
    animRef.current?.goToAndStop(playhead, true)
  }, [playhead, lottieKey])

  const fit = box.w && box.h ? Math.min(box.w / comp.w, box.h / comp.h) * 0.9 : 0
  const dispW = comp.w * fit
  const dispH = comp.h * fit

  const editLayer = pathEditId
    ? comp.layers.find((l) => l.id === pathEditId && l.visible && l.shape === 'path' && l.path && !l.pathKeyframes)
    : undefined
  const editPos = editLayer ? evalProperty(editLayer.position, playhead) : [0, 0]

  // ---- moving the selection -------------------------------------------
  function onBoxDown(e: React.PointerEvent, layerId: string) {
    e.stopPropagation()
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      toggleSelect(layerId)
      return
    }
    let ids = useEditor.getState().selectedLayerIds
    if (!ids.includes(layerId)) {
      selectLayer(layerId)
      ids = [layerId]
    }
    const orig: Record<string, [number, number]> = {}
    for (const id of ids) {
      const l = comp.layers.find((x) => x.id === id)
      if (l) {
        const p = evalProperty(l.position, playhead)
        orig[id] = [p[0], p[1]]
      }
    }
    dragRef.current = { ids, startX: e.clientX, startY: e.clientY, orig }
    beginInteractive()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  function onBoxMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d || !fit) return
    const dx = (e.clientX - d.startX) / fit
    const dy = (e.clientY - d.startY) / fit
    const positions: Record<string, [number, number]> = {}
    for (const id of d.ids) {
      const o = d.orig[id]
      if (o) positions[id] = [Math.round(o[0] + dx), Math.round(o[1] + dy)]
    }
    setLayerPositionsLive(positions)
  }
  function onBoxUp() {
    if (dragRef.current) {
      dragRef.current = null
      endInteractive()
    }
  }

  // ---- marquee selection ----------------------------------------------
  const toComp = (e: React.PointerEvent, rectLeft: number, rectTop: number): [number, number] => [
    (e.clientX - rectLeft) / fit,
    (e.clientY - rectTop) / fit,
  ]

  function onOverlayDown(e: React.PointerEvent) {
    if (!fit) return
    if (editLayer) {
      selectPoint(null)
      return
    }
    const r = (e.currentTarget as Element).getBoundingClientRect()
    const [x, y] = toComp(e, r.left, r.top)
    marqueeRef.current = { x0: x, y0: y, x1: x, y1: y }
    setMarquee(marqueeRef.current)
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  function onOverlayMove(e: React.PointerEvent) {
    const m = marqueeRef.current
    if (!m) return
    const r = (e.currentTarget as Element).getBoundingClientRect()
    const [x, y] = toComp(e, r.left, r.top)
    marqueeRef.current = { ...m, x1: x, y1: y }
    setMarquee(marqueeRef.current)
  }
  function onOverlayUp() {
    const m = marqueeRef.current
    marqueeRef.current = null
    setMarquee(null)
    if (!m) return
    const minX = Math.min(m.x0, m.x1)
    const maxX = Math.max(m.x0, m.x1)
    const minY = Math.min(m.y0, m.y1)
    const maxY = Math.max(m.y0, m.y1)
    if (maxX - minX < 3 && maxY - minY < 3) {
      selectLayer(null)
      return
    }
    const hits = comp.layers
      .filter((l) => l.visible)
      .filter((l) => {
        const p = evalProperty(l.position, playhead)
        const s = evalProperty(l.scale, playhead)
        const w = (l.size[0] * s[0]) / 100
        const h = (l.size[1] * s[1]) / 100
        return !(p[0] + w / 2 < minX || p[0] - w / 2 > maxX || p[1] + h / 2 < minY || p[1] - h / 2 > maxY)
      })
      .map((l) => l.id)
    selectLayers(hits)
  }

  // ---- vector point editing -------------------------------------------
  function ptDown(e: React.PointerEvent, sub: number, idx: number, kind: 'v' | 'i' | 'o') {
    e.stopPropagation()
    if (!editLayer?.path) return
    selectPoint({ sub, idx })
    const sp = editLayer.path[sub]
    ptRef.current = {
      sub,
      idx,
      kind,
      startX: e.clientX,
      startY: e.clientY,
      orig: { v: [...sp.v[idx]], i: [...sp.i[idx]], o: [...sp.o[idx]] },
    }
    beginInteractive()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  function ptMove(e: React.PointerEvent) {
    const d = ptRef.current
    if (!d || !fit || !editLayer) return
    const dx = (e.clientX - d.startX) / fit
    const dy = (e.clientY - d.startY) / fit
    mutateLive((draft: Composition) => {
      const sp = draft.layers.find((l) => l.id === editLayer.id)?.path?.[d.sub]
      if (!sp) return
      const arr = d.kind === 'v' ? sp.v : d.kind === 'i' ? sp.i : sp.o
      arr[d.idx] = [d.orig[d.kind][0] + dx, d.orig[d.kind][1] + dy]
    })
  }
  function ptUp() {
    if (ptRef.current) {
      ptRef.current = null
      endInteractive()
    }
  }
  function onOverlayDouble(e: React.PointerEvent) {
    if (!editLayer?.path || !fit) return
    const r = (e.currentTarget as Element).getBoundingClientRect()
    const px = (e.clientX - r.left) / fit - editPos[0]
    const py = (e.clientY - r.top) / fit - editPos[1]
    let best = { sub: 0, idx: 0, dist: Infinity }
    editLayer.path.forEach((sp, si) => {
      const n = sp.v.length
      const segs = sp.closed ? n : n - 1
      for (let k = 0; k < segs; k++) {
        const dimv = distToSeg([px, py], sp.v[k], sp.v[(k + 1) % n])
        if (dimv < best.dist) best = { sub: si, idx: k, dist: dimv }
      }
    })
    addPathPoint(editLayer.id, best.sub, best.idx + 1, [px, py])
    selectPoint({ sub: best.sub, idx: best.idx + 1 })
  }

  const sp2px = (rel: number[]) => ({ left: (editPos[0] + rel[0]) * fit, top: (editPos[1] + rel[1]) * fit })

  return (
    <div className="stage" ref={wrapRef} onPointerDown={() => selectLayer(null)}>
      {fit > 0 && (
        <div className="artboard" style={{ width: dispW, height: dispH, background: comp.bg }}>
          <div ref={holderRef} className="lottie-holder" style={{ width: dispW, height: dispH }} />
          <div
            className={'overlay' + (editLayer ? ' editing' : '')}
            ref={overlayRef}
            onPointerDown={(e) => {
              e.stopPropagation()
              onOverlayDown(e)
            }}
            onPointerMove={onOverlayMove}
            onPointerUp={onOverlayUp}
            onDoubleClick={(e) => editLayer && onOverlayDouble(e as unknown as React.PointerEvent)}
          >
            {comp.layers
              .filter((l) => l.visible && l.id !== editLayer?.id)
              .map((l) => {
                const p = evalProperty(l.position, playhead)
                const s = evalProperty(l.scale, playhead)
                const r = evalProperty(l.rotation, playhead)[0]
                const w = (l.size[0] * s[0]) / 100
                const h = (l.size[1] * s[1]) / 100
                return (
                  <div
                    key={l.id}
                    className={'sel-box' + (selectedIds.includes(l.id) ? ' selected' : '')}
                    style={{
                      left: (p[0] - w / 2) * fit,
                      top: (p[1] - h / 2) * fit,
                      width: w * fit,
                      height: h * fit,
                      transform: `rotate(${r}deg)`,
                      pointerEvents: editLayer ? 'none' : undefined,
                    }}
                    onPointerDown={(e) => onBoxDown(e, l.id)}
                    onPointerMove={onBoxMove}
                    onPointerUp={onBoxUp}
                  />
                )
              })}

            {marquee && (
              <div
                className="marquee"
                style={{
                  left: Math.min(marquee.x0, marquee.x1) * fit,
                  top: Math.min(marquee.y0, marquee.y1) * fit,
                  width: Math.abs(marquee.x1 - marquee.x0) * fit,
                  height: Math.abs(marquee.y1 - marquee.y0) * fit,
                }}
              />
            )}

            {/* vector edit overlay */}
            {editLayer?.path && (
              <>
                <svg className="vedit-lines" width={dispW} height={dispH}>
                  {editLayer.path.map((sp, si) =>
                    sp.v.map((v, vi) => {
                      if (!(selectedPoint?.sub === si && selectedPoint?.idx === vi)) return null
                      const vp = { x: (editPos[0] + v[0]) * fit, y: (editPos[1] + v[1]) * fit }
                      const ip = { x: (editPos[0] + v[0] + sp.i[vi][0]) * fit, y: (editPos[1] + v[1] + sp.i[vi][1]) * fit }
                      const op = { x: (editPos[0] + v[0] + sp.o[vi][0]) * fit, y: (editPos[1] + v[1] + sp.o[vi][1]) * fit }
                      return (
                        <g key={`${si}-${vi}`}>
                          <line x1={vp.x} y1={vp.y} x2={ip.x} y2={ip.y} />
                          <line x1={vp.x} y1={vp.y} x2={op.x} y2={op.y} />
                        </g>
                      )
                    }),
                  )}
                </svg>
                {editLayer.path.map((sp, si) =>
                  sp.v.map((v, vi) => {
                    const sel = selectedPoint?.sub === si && selectedPoint?.idx === vi
                    return (
                      <div
                        key={`v-${si}-${vi}`}
                        className={'vpt' + (sel ? ' sel' : '')}
                        style={sp2px(v)}
                        onPointerDown={(e) => ptDown(e, si, vi, 'v')}
                        onPointerMove={ptMove}
                        onPointerUp={ptUp}
                      />
                    )
                  }),
                )}
                {selectedPoint &&
                  editLayer.path[selectedPoint.sub] &&
                  (['i', 'o'] as const).map((kind) => {
                    const sp = editLayer.path![selectedPoint.sub]
                    const v = sp.v[selectedPoint.idx]
                    const t = kind === 'i' ? sp.i[selectedPoint.idx] : sp.o[selectedPoint.idx]
                    return (
                      <div
                        key={`h-${kind}`}
                        className="vhandle"
                        style={sp2px([v[0] + t[0], v[1] + t[1]])}
                        onPointerDown={(e) => ptDown(e, selectedPoint.sub, selectedPoint.idx, kind)}
                        onPointerMove={ptMove}
                        onPointerUp={ptUp}
                      />
                    )
                  })}
              </>
            )}
          </div>
          <span className="artboard-dim">
            {comp.w} × {comp.h} · {comp.fr} fps{editLayer ? ' · editing points' : ''}
          </span>
        </div>
      )}
    </div>
  )
}
