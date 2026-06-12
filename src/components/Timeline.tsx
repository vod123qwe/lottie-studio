import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../store/editorStore'
import {
  PROP_KINDS,
  PROP_LABELS,
  type Composition,
  type Keyframe,
  type Layer,
  type PropKind,
} from '../core/model'
import { Icon } from './Icons'

// ---------------------------------------------------------------------------
// Timeline: a scrubbable ruler plus one row per layer. The selected layer
// expands into per-property tracks whose keyframes can be selected and dragged.
// Horizontally zoomable (1×–24×) with sticky row labels; Ctrl/Cmd + wheel zooms
// around the cursor. Left gutter width is shared between CSS (--gutter) and JS.
// ---------------------------------------------------------------------------

const GUTTER = 140
const MIN_ZOOM = 1
const MAX_ZOOM = 24

interface KfDrag {
  layerId: string
  prop: PropKind
  kfId: string
  startX: number
  origT: number
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
  const selectedKeyframe = useEditor((s) => s.selectedKeyframe)
  const selectKeyframe = useEditor((s) => s.selectKeyframe)
  const beginInteractive = useEditor((s) => s.beginInteractive)
  const mutateLive = useEditor((s) => s.mutateLive)
  const endInteractive = useEditor((s) => s.endInteractive)
  const duration = useEditor((s) => s.comp.duration)
  const dragRef = useRef<KfDrag | null>(null)

  const isSel =
    selectedKeyframe?.layerId === layer.id &&
    selectedKeyframe?.prop === prop &&
    selectedKeyframe?.kfId === kf.id

  return (
    <div
      className={'kf' + (isSel ? ' sel' : '')}
      style={{ left: kf.t * pxPerFrame }}
      title={`Frame ${kf.t} · ${kf.easing}`}
      onPointerDown={(e) => {
        e.stopPropagation()
        selectKeyframe({ layerId: layer.id, prop, kfId: kf.id })
        dragRef.current = { layerId: layer.id, prop, kfId: kf.id, startX: e.clientX, origT: kf.t }
        beginInteractive()
        ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        if (!d || !pxPerFrame) return
        const t = Math.max(0, Math.min(duration, Math.round(d.origT + (e.clientX - d.startX) / pxPerFrame)))
        mutateLive((c: Composition) => {
          const l = c.layers.find((x) => x.id === d.layerId)
          const k = l?.[d.prop].keyframes.find((x) => x.id === d.kfId)
          if (k) k.t = t
          l?.[d.prop].keyframes.sort((a, b) => a.t - b.t)
        })
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
  const selectLayer = useEditor((s) => s.selectLayer)
  const setPlayhead = useEditor((s) => s.setPlayhead)

  const bodyRef = useRef<HTMLDivElement>(null)
  const rulerTrackRef = useRef<HTMLDivElement>(null)
  const handleDrag = useRef(false)
  const [viewW, setViewW] = useState(0)
  const [zoom, setZoom] = useState(1)
  const scrubbing = useRef(false)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewW(el.clientWidth))
    ro.observe(el)
    setViewW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const trackView = Math.max(1, viewW - GUTTER - 1) // visible track width at zoom 1 (1px safety)
  const pxPerFrame = comp.duration > 0 ? (trackView / comp.duration) * zoom : 0
  const contentW = trackView * zoom
  const rowW = GUTTER + contentW

  // Ctrl/Cmd + wheel zoom, anchored under the cursor (non-passive listener)
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

  const scrubFrom = (clientX: number, rectLeft: number) => {
    if (!pxPerFrame) return
    setPlayhead((clientX - rectLeft) / pxPerFrame)
  }

  const zoomBy = (factor: number) => setZoom((z) => clampZoom(z * factor))

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
          const expanded = layer.id === selectedLayerId
          const unionTimes = new Set<number>()
          for (const k of PROP_KINDS) for (const kf of layer[k].keyframes) unionTimes.add(kf.t)
          return (
            <div key={layer.id} className="tl-layer-block">
              <div className={'tl-row layer' + (expanded ? ' expanded' : '')} style={{ width: rowW }}>
                <div className="tl-label" onPointerDown={() => selectLayer(layer.id)}>
                  <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={13} className="caret" />
                  {layer.name}
                </div>
                <div
                  className="tl-track"
                  style={{ width: contentW }}
                  onPointerDown={(e) => scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect().left)}
                >
                  {!expanded &&
                    [...unionTimes].map((t) => (
                      <div key={t} className="kf summary" style={{ left: t * pxPerFrame }} />
                    ))}
                </div>
              </div>

              {expanded &&
                PROP_KINDS.map((prop) => (
                  <div key={prop} className="tl-row prop" style={{ width: rowW }}>
                    <div className="tl-label sub">{PROP_LABELS[prop]}</div>
                    <div
                      className="tl-track"
                      style={{ width: contentW }}
                      onPointerDown={(e) =>
                        scrubFrom(e.clientX, e.currentTarget.getBoundingClientRect().left)
                      }
                    >
                      {layer[prop].animated &&
                        layer[prop].keyframes.map((kf) => (
                          <Diamond
                            key={kf.id}
                            layer={layer}
                            prop={prop}
                            kf={kf}
                            pxPerFrame={pxPerFrame}
                          />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )
        })}

        {/* playhead line spanning all tracks */}
        <div className="playhead" style={{ left: GUTTER + playhead * pxPerFrame }} />
      </div>
    </section>
  )
}
