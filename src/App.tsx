import { useCallback, useEffect, useState } from 'react'
import { useEditor } from './store/editorStore'
import { Toolbar } from './components/Toolbar'
import { Stage } from './components/Stage'
import { LayerPanel } from './components/LayerPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import { Timeline } from './components/Timeline'
import { Preview } from './components/Preview'
import { Icon } from './components/Icons'

// Mobile shell kicks in below this width.
function useIsMobile() {
  const query = '(max-width: 820px)'
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

type MobileTab = 'layers' | 'props' | 'timeline'

// Persisted, drag-resizable layout sizes (panel widths + timeline height).
const LAYOUT_KEY = 'lottie-studio:layout'
const DEFAULT_LAYOUT = { left: 252, right: 320, timeline: 268 }
const LIMITS = {
  left: [190, 440],
  right: [296, 480],
  timeline: [150, 560],
} as const

type LayoutKey = keyof typeof DEFAULT_LAYOUT
type Layout = Record<LayoutKey, number>

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (raw) return { ...DEFAULT_LAYOUT, ...(JSON.parse(raw) as Partial<Layout>) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_LAYOUT }
}

export default function App() {
  const playing = useEditor((s) => s.playing)
  const [layout, setLayout] = useState(loadLayout)
  const isMobile = useIsMobile()
  const [mtab, setMtab] = useState<MobileTab | null>('props')

  // persist layout whenever it settles
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
    } catch {
      /* ignore */
    }
  }, [layout])

  // generic splitter drag — sign flips for right-edge panels, axis picks x/y
  const startResize = useCallback(
    (key: LayoutKey, axis: 'x' | 'y', sign: 1 | -1) => (e: React.PointerEvent) => {
      e.preventDefault()
      const startPos = axis === 'x' ? e.clientX : e.clientY
      const startVal = layout[key]
      const [min, max] = LIMITS[key]
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      const onMove = (ev: PointerEvent) => {
        const pos = axis === 'x' ? ev.clientX : ev.clientY
        const next = Math.max(min, Math.min(max, startVal + sign * (pos - startPos)))
        setLayout((l: Layout) => (l[key] === next ? l : { ...l, [key]: next }))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [layout],
  )

  // playback loop — advances the playhead while playing, looping at duration
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let frame = useEditor.getState().playhead
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const { comp, setPlayhead } = useEditor.getState()
      frame += dt * comp.fr
      if (frame >= comp.duration) frame %= comp.duration
      setPlayhead(frame)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // keyboard shortcuts (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const st = useEditor.getState()
      const mod = e.ctrlKey || e.metaKey
      if (e.code === 'Space') {
        e.preventDefault()
        st.togglePlaying()
      } else if (e.key === 'ArrowLeft') {
        st.step(-1)
      } else if (e.key === 'ArrowRight') {
        st.step(1)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selectedKeyframes.length) {
          st.removeSelectedKeyframes()
        } else if (e.key === 'Delete' && (st.selectedLayerIds.length || st.selectedLayerId)) {
          st.deleteSelected()
        }
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        st.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (isMobile) {
    const toggle = (t: MobileTab) => setMtab((cur) => (cur === t ? null : t))
    return (
      <div className="app mobile">
        <Toolbar />
        <div className="m-stage">
          <Stage />
        </div>
        {mtab && (
          <div className="m-sheet">
            {mtab === 'layers' && <LayerPanel />}
            {mtab === 'props' && <PropertiesPanel />}
            {mtab === 'timeline' && <Timeline />}
          </div>
        )}
        <nav className="m-tabs">
          <button className={mtab === 'layers' ? 'active' : ''} onClick={() => toggle('layers')}>
            <Icon name="layers" />
            <span>Layers</span>
          </button>
          <button className={mtab === 'props' ? 'active' : ''} onClick={() => toggle('props')}>
            <Icon name="sliders" />
            <span>Design</span>
          </button>
          <button className={mtab === 'timeline' ? 'active' : ''} onClick={() => toggle('timeline')}>
            <Icon name="film" />
            <span>Animate</span>
          </button>
        </nav>
        <Preview />
      </div>
    )
  }

  return (
    <div className="app" style={{ ['--timeline-h' as string]: `${layout.timeline}px` }}>
      <Toolbar />
      <main
        className="workspace"
        style={{ gridTemplateColumns: `${layout.left}px 5px 1fr 5px ${layout.right}px` }}
      >
        <LayerPanel />
        <div className="splitter col" onPointerDown={startResize('left', 'x', 1)} title="Drag to resize" />
        <Stage />
        <div className="splitter col" onPointerDown={startResize('right', 'x', -1)} title="Drag to resize" />
        <PropertiesPanel />
      </main>
      <div className="splitter row" onPointerDown={startResize('timeline', 'y', -1)} title="Drag to resize" />
      <Timeline />
      <Preview />
    </div>
  )
}
