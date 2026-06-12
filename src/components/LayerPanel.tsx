import { useEditor } from '../store/editorStore'
import { rgbToHex } from '../core/factory'

// ---------------------------------------------------------------------------
// Layer list. Top of the list = top of the stack (renders in front), matching
// how the builder orders layers for export.
// ---------------------------------------------------------------------------

export function LayerPanel() {
  const layers = useEditor((s) => s.comp.layers)
  const selectedId = useEditor((s) => s.selectedLayerId)
  const selectLayer = useEditor((s) => s.selectLayer)
  const toggleVisible = useEditor((s) => s.toggleVisible)
  const reorderLayer = useEditor((s) => s.reorderLayer)
  const duplicateLayer = useEditor((s) => s.duplicateLayer)
  const deleteLayer = useEditor((s) => s.deleteLayer)
  const renameLayer = useEditor((s) => s.renameLayer)

  return (
    <section className="panel layers-panel">
      <div className="panel-head">Layers</div>
      <div className="layer-list">
        {layers.length === 0 && (
          <p className="empty">No layers yet. Add a Rectangle or Ellipse from the toolbar.</p>
        )}
        {layers.map((l, i) => (
          <div
            key={l.id}
            className={'layer-row' + (l.id === selectedId ? ' selected' : '')}
            onPointerDown={() => selectLayer(l.id)}
          >
            <button
              className="eye"
              title={l.visible ? 'Hide' : 'Show'}
              onPointerDown={(e) => {
                e.stopPropagation()
                toggleVisible(l.id)
              }}
            >
              {l.visible ? '👁' : '–'}
            </button>
            <span className="swatch" style={{ background: rgbToHex(l.fillColor.value) }} />
            <input
              className="layer-name"
              value={l.name}
              onChange={(e) => renameLayer(l.id, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <div className="layer-actions">
              <button
                title="Move up"
                disabled={i === 0}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  reorderLayer(l.id, -1)
                }}
              >
                ↑
              </button>
              <button
                title="Move down"
                disabled={i === layers.length - 1}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  reorderLayer(l.id, 1)
                }}
              >
                ↓
              </button>
              <button
                title="Duplicate"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  duplicateLayer(l.id)
                }}
              >
                ⧉
              </button>
              <button
                className="danger"
                title="Delete"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  deleteLayer(l.id)
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
