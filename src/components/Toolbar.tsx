import { useRef, useState } from 'react'
import { useEditor } from '../store/editorStore'
import { exportLottieString } from '../core/builder'
import { importSvg } from '../core/svgImport'
import { ICON_LIBRARY } from '../core/iconLibrary'
import type { Composition } from '../core/model'
import { Icon } from './Icons'

// ---------------------------------------------------------------------------
// Top bar: file actions, shape creation, transport controls, undo/redo.
// "Export Lottie" writes a player-ready document; Save/Open round-trip the
// editor project so work in progress (incl. animated flags) survives reloads.
// ---------------------------------------------------------------------------

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'animation'

export function Toolbar() {
  const comp = useEditor((s) => s.comp)
  const playing = useEditor((s) => s.playing)
  const playhead = useEditor((s) => s.playhead)
  const autoKey = useEditor((s) => s.autoKey)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)

  const addLayer = useEditor((s) => s.addLayer)
  const togglePlaying = useEditor((s) => s.togglePlaying)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const step = useEditor((s) => s.step)
  const toggleAutoKey = useEditor((s) => s.toggleAutoKey)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const newProject = useEditor((s) => s.newProject)
  const loadComposition = useEditor((s) => s.loadComposition)
  const addLayers = useEditor((s) => s.addLayers)
  const setPreview = useEditor((s) => s.setPreview)

  const fileRef = useRef<HTMLInputElement>(null)
  const svgRef = useRef<HTMLInputElement>(null)
  const [iconsOpen, setIconsOpen] = useState(false)

  const insertIcon = (svg: string) => {
    const { layers } = importSvg(svg, useEditor.getState().comp)
    if (layers.length) addLayers(layers)
    setIconsOpen(false)
  }

  const exportLottie = () => download(`${slug(comp.name)}.json`, exportLottieString(comp))
  const saveProject = () =>
    download(`${slug(comp.name)}.lottiestudio.json`, JSON.stringify(comp, null, 2))

  const openProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Composition
        if (data && Array.isArray(data.layers)) loadComposition(data)
        else alert('That file does not look like a Lottie Studio project.')
      } catch {
        alert('Could not read that file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const openSvg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { layers, warnings } = importSvg(String(reader.result), useEditor.getState().comp)
      if (layers.length) addLayers(layers)
      if (warnings.length && !layers.length) alert(warnings.join('\n'))
      else if (warnings.length) console.warn('SVG import:', warnings.join('; '))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="logo" />
        Lottie Studio
      </div>

      <span className="tool-sep" />

      <div className="group">
        <button onClick={newProject} title="New project">
          <Icon name="file-plus" /> New
        </button>
        <button onClick={() => fileRef.current?.click()} title="Open project">
          <Icon name="folder-open" /> Open
        </button>
        <button onClick={saveProject} title="Save project (.lottiestudio.json)">
          <Icon name="save" /> Save
        </button>
        <button onClick={() => setPreview(true)} title="Full preview (loops, no editor UI)">
          <Icon name="play" /> Preview
        </button>
        <button className="primary" onClick={exportLottie} title="Export Lottie JSON">
          <Icon name="download" /> Export Lottie
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={openProject} />
      </div>

      <span className="tool-sep" />

      <div className="group">
        <button onClick={() => addLayer('rect')}>
          <Icon name="square" /> Rectangle
        </button>
        <button onClick={() => addLayer('ellipse')}>
          <Icon name="circle" /> Ellipse
        </button>
        <button onClick={() => svgRef.current?.click()} title="Import an SVG as editable layers">
          <Icon name="image" /> Import SVG
        </button>
        <input ref={svgRef} type="file" accept=".svg,image/svg+xml" hidden onChange={openSvg} />
        <div className="icon-picker-wrap">
          <button
            className={iconsOpen ? 'toggle on' : ''}
            onClick={() => setIconsOpen((v) => !v)}
            title="Insert an icon to animate"
          >
            <Icon name="sparkles" /> Icons
          </button>
          {iconsOpen && (
            <>
              <div className="icon-picker-backdrop" onPointerDown={() => setIconsOpen(false)} />
              <div className="icon-picker">
                <div className="icon-picker-head">Insert an icon</div>
                <div className="icon-picker-grid">
                  {ICON_LIBRARY.map((ic) => (
                    <button
                      key={ic.id}
                      className="icon-pick"
                      title={ic.name}
                      onClick={() => insertIcon(ic.svg)}
                      dangerouslySetInnerHTML={{ __html: ic.svg }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="group transport">
        <button className="icon-btn" onClick={() => setPlayhead(0)} title="Go to start">
          <Icon name="skip-back" />
        </button>
        <button className="icon-btn" onClick={() => step(-1)} title="Previous frame">
          <Icon name="chevron-left" />
        </button>
        <button className="icon-btn play" onClick={togglePlaying} title="Play / pause (space)">
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button className="icon-btn" onClick={() => step(1)} title="Next frame">
          <Icon name="chevron-right" />
        </button>
        <button className="icon-btn" onClick={() => setPlayhead(comp.duration)} title="Go to end">
          <Icon name="skip-forward" />
        </button>
      </div>
      <span className="frame-readout">
        {Math.round(playhead)} <span className="muted">/ {comp.duration}</span>
      </span>

      <div className="group right">
        <button
          className={'toggle' + (autoKey ? ' on' : '')}
          onClick={toggleAutoKey}
          title="Auto-keyframe: record edits as keyframes when a property is animated"
        >
          <span className="rec-dot" /> Auto-key
        </button>
        <span className="tool-sep" />
        <button className="icon-btn bordered" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Icon name="undo" />
        </button>
        <button className="icon-btn bordered" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Icon name="redo" />
        </button>
      </div>
    </header>
  )
}
