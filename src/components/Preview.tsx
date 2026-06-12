import { useEffect, useMemo, useRef, useState } from 'react'
import lottie, { type AnimationItem } from 'lottie-web'
import { useEditor } from '../store/editorStore'
import { buildLottie } from '../core/builder'
import { Icon } from './Icons'

// ---------------------------------------------------------------------------
// Full-screen preview: plays the built animation on a loop with no editor
// chrome, a simple transport and a few backdrops. Opened from the toolbar,
// closed with Esc / backdrop click. Uses its own lottie instance.
// ---------------------------------------------------------------------------

type BgMode = 'checker' | 'light' | 'dark' | 'comp'

const BGS: { id: BgMode; label: string }[] = [
  { id: 'checker', label: 'Transparent' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'comp', label: 'Canvas color' },
]

export function Preview() {
  const open = useEditor((s) => s.previewOpen)
  const comp = useEditor((s) => s.comp)
  const setPreview = useEditor((s) => s.setPreview)

  const holderRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const [playing, setPlaying] = useState(true)
  const [bg, setBg] = useState<BgMode>('checker')

  const data = useMemo(() => (open ? JSON.stringify(buildLottie(comp)) : ''), [open, comp])

  useEffect(() => {
    if (!open || !holderRef.current) return
    const anim = lottie.loadAnimation({
      container: holderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: JSON.parse(data),
    })
    animRef.current = anim
    setPlaying(true)
    return () => {
      anim.destroy()
      animRef.current = null
    }
  }, [open, data])

  useEffect(() => {
    if (!open) return
    const toggle = () => {
      const a = animRef.current
      if (!a) return
      if (a.isPaused) {
        a.play()
        setPlaying(true)
      } else {
        a.pause()
        setPlaying(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(false)
      else if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setPreview])

  if (!open) return null

  const toggle = () => {
    const a = animRef.current
    if (!a) return
    if (a.isPaused) {
      a.play()
      setPlaying(true)
    } else {
      a.pause()
      setPlaying(false)
    }
  }

  const maxW = Math.min(window.innerWidth * 0.82, 1100)
  const maxH = window.innerHeight * 0.66
  const fit = Math.min(maxW / comp.w, maxH / comp.h)
  const w = comp.w * fit
  const h = comp.h * fit

  return (
    <div className="preview-backdrop" onPointerDown={() => setPreview(false)}>
      <div className="preview-card" onPointerDown={(e) => e.stopPropagation()}>
        <div className="preview-head">
          <span className="preview-title">{comp.name}</span>
          <span className="muted">
            {comp.w}×{comp.h} · {comp.fr} fps · {comp.duration}f
          </span>
          <button className="icon-btn" title="Close (Esc)" onClick={() => setPreview(false)}>
            <Icon name="x" />
          </button>
        </div>

        <div className={'preview-stage bg-' + bg}>
          <div
            ref={holderRef}
            style={{ width: w, height: h, background: bg === 'comp' ? comp.bg : undefined }}
          />
        </div>

        <div className="preview-controls">
          <button className="icon-btn bordered" title="Restart" onClick={() => animRef.current?.goToAndPlay(0, true)}>
            <Icon name="skip-back" />
          </button>
          <button className="primary" onClick={toggle}>
            <Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pause' : 'Play'}
          </button>
          <span className="preview-bgs">
            {BGS.map((b) => (
              <button
                key={b.id}
                className={'bg-chip bg-' + b.id + (bg === b.id ? ' active' : '')}
                title={b.label}
                onClick={() => setBg(b.id)}
                style={b.id === 'comp' ? { background: comp.bg } : undefined}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
