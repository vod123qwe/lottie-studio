import { useEffect } from 'react'
import { useEditor } from './store/editorStore'
import { Toolbar } from './components/Toolbar'
import { Stage } from './components/Stage'
import { LayerPanel } from './components/LayerPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import { Timeline } from './components/Timeline'

export default function App() {
  const playing = useEditor((s) => s.playing)

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
        const k = st.selectedKeyframe
        if (k) {
          st.removeKeyframe(k.layerId, k.prop, k.kfId)
          st.selectKeyframe(null)
        } else if (e.key === 'Delete' && st.selectedLayerId) {
          st.deleteLayer(st.selectedLayerId)
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

  return (
    <div className="app">
      <Toolbar />
      <main className="workspace">
        <LayerPanel />
        <Stage />
        <PropertiesPanel />
      </main>
      <Timeline />
    </div>
  )
}
