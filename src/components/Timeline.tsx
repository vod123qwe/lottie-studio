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
// Left gutter width is shared between CSS (--gutter) and JS (GUTTER).
// ---------------------------------------------------------------------------

const GUTTER = 140

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

  const rulerRef = useRef<HTMLDivElement>(null)
  const [trackW, setTrackW] = useState(0)
  const scrubbing = useRef(false)

  useEffect(() => {
    const el = rulerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth))
    ro.observe(el)
    setTrackW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const pxPerFrame = comp.duration > 0 ? trackW / comp.duration : 0
  const step = niceStep(comp.duration, pxPerFrame)
  const ticks: number[] = []
  for (let f = 0; f <= comp.duration; f += step) ticks.push(f)

  const scrubFrom = (clientX: number, rectLeft: number) => {
    if (!pxPerFrame) return
    setPlayhead((clientX - rectLeft) / pxPerFrame)
  }

  return (
    <section
      className="panel timeline"
      style={{
        ['--gutter' as string]: `${GUTTER}px`,
        ['--grid' as string]: `${Math.max(1, step * pxPerFrame)}px`,
      }}
    >
      <div className="tl-body">
        {/* ruler */}
        <div className="tl-row ruler-row">
          <div className="tl-label corner">Timeline</div>
          <div
            className="tl-track ruler"
            ref={rulerRef}
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
          </div>
        </div>

        {/* layer rows */}
        {comp.layers.map((layer) => {
          const expanded = layer.id === selectedLayerId
          const unionTimes = new Set<number>()
          for (const k of PROP_KINDS) for (const kf of layer[k].keyframes) unionTimes.add(kf.t)
          return (
            <div key={layer.id} className="tl-layer-block">
              <div className={'tl-row layer' + (expanded ? ' expanded' : '')}>
                <div className="tl-label" onPointerDown={() => selectLayer(layer.id)}>
                  <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={13} className="caret" />
                  {layer.name}
                </div>
                <div
                  className="tl-track"
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
                  <div key={prop} className="tl-row prop">
                    <div className="tl-label sub">{PROP_LABELS[prop]}</div>
                    <div
                      className="tl-track"
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
