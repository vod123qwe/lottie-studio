import { useRef, useState, type CSSProperties } from 'react'
import { hexToRgb, rgbToHex } from '../core/factory'
import { hsvToRgb, rgbToHsv } from '../core/color'
import type { Gradient, GradientStop } from '../core/model'

// ---------------------------------------------------------------------------
// Figma-style color picker: SV square + hue slider, hex, swatches, and an
// optional gradient editor (linear / radial) with draggable stops + alpha.
// `Paint` is either a solid rgb or a gradient; the picker is uncontrolled once
// open (seeded from `initial`) and streams changes through onChange.
// ---------------------------------------------------------------------------

export type Paint = { kind: 'solid'; rgb: number[] } | { kind: 'gradient'; gradient: Gradient }

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const SWATCHES = ['#111827', '#ffffff', '#2f5bf6', '#f5365c', '#16a34a', '#ffd166', '#a66cff', '#00ddb3', '#ff8fb1', '#0a5bff']

const rgba = (c: number[], o: number) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${o})`
const stopsCss = (stops: GradientStop[]) =>
  [...stops].sort((a, b) => a.offset - b.offset).map((s) => `${rgba(s.color, s.opacity)} ${Math.round(s.offset * 100)}%`).join(', ')

export function paintCss(p: Paint): string {
  if (p.kind === 'solid') return rgbToHex(p.rgb)
  const g = p.gradient
  return g.type === 'radial' ? `radial-gradient(circle, ${stopsCss(g.stops)})` : `linear-gradient(${g.angle}deg, ${stopsCss(g.stops)})`
}

type Mode = 'solid' | 'linear' | 'radial'

export function ColorPicker({
  initial,
  allowGradient,
  onChange,
  style,
}: {
  initial: Paint
  allowGradient: boolean
  onChange: (p: Paint) => void
  style?: CSSProperties
}) {
  const seedStops: GradientStop[] =
    initial.kind === 'gradient'
      ? initial.gradient.stops.map((s) => ({ offset: s.offset, color: [...s.color], opacity: s.opacity }))
      : [
          { offset: 0, color: initial.kind === 'solid' ? [...initial.rgb] : [0.18, 0.36, 0.96], opacity: 1 },
          { offset: 1, color: [0.96, 0.21, 0.36], opacity: 1 },
        ]
  const seedColor = initial.kind === 'solid' ? initial.rgb : initial.gradient.stops[0].color

  const [mode, setMode] = useState<Mode>(initial.kind === 'gradient' ? initial.gradient.type : 'solid')
  const [solid, setSolid] = useState<number[]>(initial.kind === 'solid' ? [...initial.rgb] : [0.18, 0.36, 0.96])
  const [stops, setStops] = useState<GradientStop[]>(seedStops)
  const [angle, setAngle] = useState(initial.kind === 'gradient' ? initial.gradient.angle : 90)
  const [active, setActive] = useState(0)
  const [hsv, setHsv] = useState(() => rgbToHsv(seedColor[0], seedColor[1], seedColor[2]))
  const [alpha, setAlpha] = useState(initial.kind === 'gradient' ? initial.gradient.stops[0].opacity : 1)
  const [hexDraft, setHexDraft] = useState(rgbToHex(seedColor))

  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const alphaRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const drag = useRef<string | null>(null)

  const isGrad = mode !== 'solid'

  const emit = (o: { mode?: Mode; stops?: GradientStop[]; angle?: number; solid?: number[] }) => {
    const m = o.mode ?? mode
    if (m === 'solid') onChange({ kind: 'solid', rgb: o.solid ?? solid })
    else onChange({ kind: 'gradient', gradient: { type: m, angle: o.angle ?? angle, stops: o.stops ?? stops } })
  }

  const applyColor = (rgb: number[], a: number) => {
    setHexDraft(rgbToHex(rgb))
    if (mode === 'solid') {
      setSolid(rgb)
      emit({ solid: rgb })
    } else {
      const st = stops.map((s, i) => (i === active ? { ...s, color: rgb, opacity: a } : s))
      setStops(st)
      emit({ stops: st })
    }
  }
  const onHsv = (h: number, s: number, v: number) => {
    setHsv({ h, s, v })
    applyColor(hsvToRgb(h, s, v), alpha)
  }
  const onAlpha = (a: number) => {
    setAlpha(a)
    applyColor(hsvToRgb(hsv.h, hsv.s, hsv.v), a)
  }
  const setHex = (t: string) => {
    setHexDraft(t)
    if (/^#?[0-9a-fA-F]{6}$/.test(t.trim())) {
      const rgb = hexToRgb(t.trim())
      setHsv(rgbToHsv(rgb[0], rgb[1], rgb[2]))
      applyColor(rgb, alpha)
    }
  }

  const selectStop = (i: number) => {
    setActive(i)
    const s = stops[i]
    setHsv(rgbToHsv(s.color[0], s.color[1], s.color[2]))
    setAlpha(s.opacity)
    setHexDraft(rgbToHex(s.color))
  }
  const switchMode = (m: Mode) => {
    // seed the first stop from the current solid color when entering gradient mode
    if (m !== 'solid' && mode === 'solid') {
      const st = stops.map((s, i) => (i === 0 ? { ...s, color: [...solid], opacity: 1 } : s))
      setStops(st)
      setActive(0)
      setHsv(rgbToHsv(solid[0], solid[1], solid[2]))
      setAlpha(1)
      setHexDraft(rgbToHex(solid))
      setMode(m)
      emit({ mode: m, stops: st })
    } else {
      setMode(m)
      emit({ mode: m })
    }
  }
  const addStopAt = (offset: number) => {
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
    const st = [...stops, { offset: clamp01(offset), color: rgb, opacity: alpha }].sort((a, b) => a.offset - b.offset)
    setStops(st)
    setActive(st.findIndex((s) => s.offset === clamp01(offset)))
    emit({ stops: st })
  }
  const removeActiveStop = () => {
    if (stops.length <= 2) return
    const st = stops.filter((_, i) => i !== active)
    setStops(st)
    selectStop(0)
    emit({ stops: st })
  }

  // ---- pointer helpers --------------------------------------------------
  const frac = (e: React.PointerEvent, el: HTMLElement | null, axis: 'x' | 'y') => {
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return clamp01(axis === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height)
  }
  const start = (e: React.PointerEvent, kind: string, fn: (e: React.PointerEvent) => void) => {
    drag.current = kind
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    fn(e)
  }
  const move = (e: React.PointerEvent, kind: string, fn: (e: React.PointerEvent) => void) => {
    if (drag.current === kind) fn(e)
  }
  const end = () => (drag.current = null)

  const curRgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const hueColor = rgbToHex(hsvToRgb(hsv.h, 1, 1))

  return (
    <div className="color-pop" style={style} onPointerDown={(e) => e.stopPropagation()}>
      {allowGradient && (
        <div className="seg cp-tabs">
          {(['solid', 'linear', 'radial'] as Mode[]).map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => switchMode(m)}>
              {m === 'solid' ? 'Solid' : m === 'linear' ? 'Linear' : 'Radial'}
            </button>
          ))}
        </div>
      )}

      <div
        className="cp-sv"
        ref={svRef}
        style={{ backgroundColor: hueColor }}
        onPointerDown={(e) => start(e, 'sv', (ev) => onHsv(hsv.h, frac(ev, svRef.current, 'x'), 1 - frac(ev, svRef.current, 'y')))}
        onPointerMove={(e) => move(e, 'sv', (ev) => onHsv(hsv.h, frac(ev, svRef.current, 'x'), 1 - frac(ev, svRef.current, 'y')))}
        onPointerUp={end}
      >
        <div className="cp-sv-dot" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: rgbToHex(curRgb) }} />
      </div>

      <div className="cp-row">
        <span className="cp-preview" style={{ background: rgbToHex(curRgb) }} />
        <div className="cp-sliders">
          <div
            className="cp-hue"
            ref={hueRef}
            onPointerDown={(e) => start(e, 'hue', (ev) => onHsv(frac(ev, hueRef.current, 'x') * 360, hsv.s, hsv.v))}
            onPointerMove={(e) => move(e, 'hue', (ev) => onHsv(frac(ev, hueRef.current, 'x') * 360, hsv.s, hsv.v))}
            onPointerUp={end}
          >
            <div className="cp-knob" style={{ left: `${(hsv.h / 360) * 100}%` }} />
          </div>
          {isGrad && (
            <div
              className="cp-alpha"
              ref={alphaRef}
              style={{ ['--c' as string]: rgbToHex(curRgb) }}
              onPointerDown={(e) => start(e, 'alpha', (ev) => onAlpha(frac(ev, alphaRef.current, 'x')))}
              onPointerMove={(e) => move(e, 'alpha', (ev) => onAlpha(frac(ev, alphaRef.current, 'x')))}
              onPointerUp={end}
            >
              <div className="cp-knob" style={{ left: `${alpha * 100}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="cp-fields">
        <label className="cp-hex">
          <span>#</span>
          <input value={hexDraft.replace('#', '')} maxLength={7} onChange={(e) => setHex(e.target.value)} />
        </label>
        {isGrad && (
          <label className="cp-alpha-num">
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(alpha * 100)}
              onChange={(e) => onAlpha(clamp01((parseFloat(e.target.value) || 0) / 100))}
            />
            <span>%</span>
          </label>
        )}
      </div>

      <div className="cp-swatches">
        {SWATCHES.map((hx) => (
          <button
            key={hx}
            className="cp-sw"
            style={{ background: hx }}
            onClick={() => {
              const rgb = hexToRgb(hx)
              setHsv(rgbToHsv(rgb[0], rgb[1], rgb[2]))
              applyColor(rgb, alpha)
            }}
          />
        ))}
      </div>

      {isGrad && (
        <>
          <div
            className="cp-grad-bar"
            ref={barRef}
            style={{ background: `linear-gradient(90deg, ${stopsCss(stops)})` }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).classList.contains('cp-stop')) return
              addStopAt(frac(e, barRef.current, 'x'))
            }}
          >
            {stops.map((s, i) => (
              <div
                key={i}
                className={'cp-stop' + (i === active ? ' active' : '')}
                style={{ left: `${s.offset * 100}%`, background: rgba(s.color, s.opacity) }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  selectStop(i)
                  start(e, 'stop', (ev) => {
                    const off = frac(ev, barRef.current, 'x')
                    setStops((prev) => {
                      const st = prev.map((p, j) => (j === i ? { ...p, offset: off } : p))
                      emit({ stops: st })
                      return st
                    })
                  })
                }}
                onPointerMove={(e) =>
                  move(e, 'stop', (ev) => {
                    const off = frac(ev, barRef.current, 'x')
                    setStops((prev) => {
                      const st = prev.map((p, j) => (j === i ? { ...p, offset: off } : p))
                      emit({ stops: st })
                      return st
                    })
                  })
                }
                onPointerUp={end}
              />
            ))}
          </div>
          <div className="cp-grad-foot">
            {mode === 'linear' && (
              <label className="cp-angle">
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={angle}
                  onChange={(e) => {
                    const a = parseFloat(e.target.value)
                    setAngle(a)
                    emit({ angle: a })
                  }}
                />
                <span>{Math.round(angle)}°</span>
              </label>
            )}
            <button className="cp-del" disabled={stops.length <= 2} onClick={removeActiveStop}>
              Remove stop
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Trigger swatch that opens the picker in a popover.
export function ColorSwatch({
  value,
  allowGradient = false,
  onChange,
  begin,
  end,
  title,
}: {
  value: Paint
  allowGradient?: boolean
  onChange: (p: Paint) => void
  begin?: () => void
  end?: () => void
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const setOpenSafe = (next: boolean) => {
    if (next && !open) {
      begin?.()
      const r = btnRef.current?.getBoundingClientRect()
      if (r) {
        const W = 260
        const H = 440
        const left = Math.max(8, Math.min(r.right - 240, window.innerWidth - W))
        const top = r.bottom + 8 + H > window.innerHeight ? Math.max(8, r.top - H - 8) : r.bottom + 8
        setPos({ left, top })
      }
    }
    if (!next && open) end?.()
    setOpen(next)
  }
  return (
    <span className="cp-swatch-wrap">
      <button
        ref={btnRef}
        type="button"
        className="cp-swatch"
        title={title}
        style={{ background: paintCss(value) }}
        onClick={() => setOpenSafe(!open)}
      />
      {open && (
        <>
          <div className="cp-backdrop" onPointerDown={() => setOpenSafe(false)} />
          <ColorPicker initial={value} allowGradient={allowGradient} onChange={onChange} style={pos} />
        </>
      )}
    </span>
  )
}
