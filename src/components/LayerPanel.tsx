import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../store/editorStore'
import { rgbToHex } from '../core/factory'
import { Icon } from './Icons'

// ---------------------------------------------------------------------------
// Layer list. Top of the list = top of the stack (renders in front). Reorder by
// dragging the grip on the left; per-layer actions (rename / duplicate / reset /
// delete) live in the right-click menu.
// ---------------------------------------------------------------------------

export function LayerPanel() {
  const layers = useEditor((s) => s.comp.layers)
  const selectedIds = useEditor((s) => s.selectedLayerIds)
  const primaryId = useEditor((s) => s.selectedLayerId)
  const selectLayer = useEditor((s) => s.selectLayer)
  const toggleSelect = useEditor((s) => s.toggleSelect)
  const toggleVisible = useEditor((s) => s.toggleVisible)
  const renameLayer = useEditor((s) => s.renameLayer)
  const moveLayerTo = useEditor((s) => s.moveLayerTo)
  const openLayerMenu = useEditor((s) => s.openLayerMenu)
  const renameRequest = useEditor((s) => s.renameRequest)
  const requestRename = useEditor((s) => s.requestRename)

  const listRef = useRef<HTMLDivElement>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const dragId = useRef<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; y: number } | null>(null)

  // a "Rename" from the context menu focuses the matching name field
  useEffect(() => {
    if (!renameRequest) return
    const el = inputRefs.current[renameRequest]
    if (el) {
      el.focus()
      el.select()
    }
    requestRename(null)
  }, [renameRequest, requestRename])

  const rows = () => Array.from(listRef.current?.querySelectorAll('.layer-row') ?? [])
  const computeDrop = (clientY: number) => {
    let idx = 0
    for (const r of rows()) {
      const rect = r.getBoundingClientRect()
      if (clientY > rect.top + rect.height / 2) idx++
    }
    return idx
  }
  const dropY = (idx: number) => {
    const list = listRef.current
    if (!list) return 0
    const rs = rows()
    const lr = list.getBoundingClientRect()
    if (idx < rs.length) return rs[idx].getBoundingClientRect().top - lr.top
    const last = rs[rs.length - 1]
    return last ? last.getBoundingClientRect().bottom - lr.top : 0
  }

  return (
    <section className="panel layers-panel">
      <div className="panel-head">
        Layers
        {layers.length > 0 && <span className="muted">{layers.length}</span>}
      </div>
      <div className="layer-list" ref={listRef}>
        {layers.length === 0 && (
          <p className="empty">No layers yet. Add a Rectangle or Ellipse from the toolbar.</p>
        )}
        {drag && <div className="layer-drop" style={{ top: drag.y }} />}
        {layers.map((l) => (
          <div
            key={l.id}
            className={
              'layer-row' +
              (selectedIds.includes(l.id) ? ' selected' : '') +
              (l.id === primaryId ? ' primary' : '') +
              (l.visible ? '' : ' hidden') +
              (drag?.id === l.id ? ' dragging' : '')
            }
            onPointerDown={(e) => (e.shiftKey || e.metaKey || e.ctrlKey ? toggleSelect(l.id) : selectLayer(l.id))}
            onContextMenu={(e) => {
              e.preventDefault()
              selectLayer(l.id)
              openLayerMenu(e.clientX, e.clientY, l.id)
            }}
          >
            <button
              className="grip"
              title="Drag to reorder"
              onPointerDown={(e) => {
                e.stopPropagation()
                dragId.current = l.id
                setDrag({ id: l.id, y: dropY(layers.findIndex((x) => x.id === l.id)) })
                ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (dragId.current !== l.id) return
                setDrag({ id: l.id, y: dropY(computeDrop(e.clientY)) })
              }}
              onPointerUp={(e) => {
                if (dragId.current !== l.id) return
                const from = layers.findIndex((x) => x.id === l.id)
                let to = computeDrop(e.clientY)
                if (from < to) to -= 1
                if (to !== from && to >= 0) moveLayerTo(l.id, to)
                dragId.current = null
                setDrag(null)
              }}
            >
              <Icon name="grip" size={15} />
            </button>
            <button
              className="eye"
              title={l.visible ? 'Hide' : 'Show'}
              onPointerDown={(e) => {
                e.stopPropagation()
                toggleVisible(l.id)
              }}
            >
              <Icon name={l.visible ? 'eye' : 'eye-off'} size={15} />
            </button>
            <span className="swatch" style={{ background: rgbToHex(l.fillColor.value) }} />
            <input
              className="layer-name"
              ref={(el) => (inputRefs.current[l.id] = el)}
              value={l.name}
              onChange={(e) => renameLayer(l.id, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
