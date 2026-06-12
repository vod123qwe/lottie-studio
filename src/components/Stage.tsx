import { useEffect, useMemo, useRef, useState } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import { useEditor } from '../store/editorStore'
import { buildLottie } from '../core/builder'
import { evalProperty } from '../core/interpolate'

// ---------------------------------------------------------------------------
// Live preview. lottie-web renders the built document; an HTML overlay draws
// selection boxes computed from each layer's transform at the current frame
// and lets you drag a shape to reposition it.
// ---------------------------------------------------------------------------

interface DragState {
  id: string
  startX: number
  startY: number
  origPos: [number, number]
}

export function Stage() {
  const comp = useEditor((s) => s.comp)
  const playhead = useEditor((s) => s.playhead)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectLayer = useEditor((s) => s.selectLayer)
  const beginInteractive = useEditor((s) => s.beginInteractive)
  const setPropertyLive = useEditor((s) => s.setPropertyLive)
  const endInteractive = useEditor((s) => s.endInteractive)

  const wrapRef = useRef<HTMLDivElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  // measure the available area
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // only rebuild the lottie instance when the document genuinely changes
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

  // keep the rendered frame in sync with the playhead
  useEffect(() => {
    animRef.current?.goToAndStop(playhead, true)
  }, [playhead, lottieKey])

  const fit = box.w && box.h ? Math.min(box.w / comp.w, box.h / comp.h) * 0.9 : 0
  const dispW = comp.w * fit
  const dispH = comp.h * fit

  function onBoxDown(e: React.PointerEvent, layerId: string) {
    e.stopPropagation()
    selectLayer(layerId)
    const layer = comp.layers.find((l) => l.id === layerId)
    if (!layer) return
    const p = evalProperty(layer.position, playhead)
    dragRef.current = { id: layerId, startX: e.clientX, startY: e.clientY, origPos: [p[0], p[1]] }
    beginInteractive()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  function onBoxMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d || !fit) return
    const dx = (e.clientX - d.startX) / fit
    const dy = (e.clientY - d.startY) / fit
    setPropertyLive(d.id, 'position', [Math.round(d.origPos[0] + dx), Math.round(d.origPos[1] + dy)])
  }
  function onBoxUp() {
    if (dragRef.current) {
      dragRef.current = null
      endInteractive()
    }
  }

  return (
    <div className="stage" ref={wrapRef} onPointerDown={() => selectLayer(null)}>
      {fit > 0 && (
        <div
          className="artboard"
          style={{ width: dispW, height: dispH, background: comp.bg }}
        >
          <div ref={holderRef} className="lottie-holder" style={{ width: dispW, height: dispH }} />
          <div className="overlay" onPointerDown={(e) => e.stopPropagation()}>
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
                    className={'sel-box' + (l.id === selectedLayerId ? ' selected' : '')}
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
          </div>
          <span className="artboard-dim">
            {comp.w} × {comp.h} · {comp.fr} fps
          </span>
        </div>
      )}
    </div>
  )
}
