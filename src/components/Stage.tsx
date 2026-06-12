import { useEffect, useMemo, useRef, useState } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import { useEditor } from '../store/editorStore'
import { buildLottie } from '../core/builder'
import { evalProperty } from '../core/interpolate'

// ---------------------------------------------------------------------------
// Live preview. lottie-web renders the built document; an HTML overlay draws
// selection boxes computed from each layer's transform at the current frame.
// You can shift-click to multi-select, drag any selected box to move the whole
// selection, or rubber-band an empty area to marquee-select.
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

  const wrapRef = useRef<HTMLDivElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const marqueeRef = useRef<Marquee | null>(null)
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
      selectLayer(null) // treated as a click on empty space
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

  const marqueeStyle = marquee
    ? {
        left: Math.min(marquee.x0, marquee.x1) * fit,
        top: Math.min(marquee.y0, marquee.y1) * fit,
        width: Math.abs(marquee.x1 - marquee.x0) * fit,
        height: Math.abs(marquee.y1 - marquee.y0) * fit,
      }
    : null

  return (
    <div className="stage" ref={wrapRef} onPointerDown={() => selectLayer(null)}>
      {fit > 0 && (
        <div className="artboard" style={{ width: dispW, height: dispH, background: comp.bg }}>
          <div ref={holderRef} className="lottie-holder" style={{ width: dispW, height: dispH }} />
          <div
            className="overlay"
            onPointerDown={(e) => {
              e.stopPropagation()
              onOverlayDown(e)
            }}
            onPointerMove={onOverlayMove}
            onPointerUp={onOverlayUp}
          >
            {comp.layers
              .filter((l) => l.visible)
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
                    }}
                    onPointerDown={(e) => onBoxDown(e, l.id)}
                    onPointerMove={onBoxMove}
                    onPointerUp={onBoxUp}
                  />
                )
              })}
            {marqueeStyle && <div className="marquee" style={marqueeStyle} />}
          </div>
          <span className="artboard-dim">
            {comp.w} × {comp.h} · {comp.fr} fps
          </span>
        </div>
      )}
    </div>
  )
}
