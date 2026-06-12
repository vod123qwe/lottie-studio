import { useEditor } from '../store/editorStore'
import { rgbToHex } from '../core/factory'
import { Icon } from './Icons'

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
      <div className="panel-head">
        Layers
        {layers.length > 0 && <span className="muted">{layers.length}</span>}
      </div>
      <div className="layer-list">
        {layers.length === 0 && (
          <p className="empty">No layers yet. Add a Rectangle or Ellipse from the toolbar.</p>
        )}
        {layers.map((l, i) => (
          <div
            key={l.id}
            className={
              'layer-row' +
              (l.id === selectedId ? ' selected' : '') +
              (l.visible ? '' : ' hidden')
            }
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
              <Icon name={l.visible ? 'eye' : 'eye-off'} size={15} />
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
                className="icon-btn"
                title="Move up"
                disabled={i === 0}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  reorderLayer(l.id, -1)
                }}
              >
                <Icon name="chevron-up" size={15} />
              </button>
              <button
                className="icon-btn"
                title="Move down"
                disabled={i === layers.length - 1}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  reorderLayer(l.id, 1)
                }}
              >
                <Icon name="chevron-down" size={15} />
              </button>
              <button
                className="icon-btn"
                title="Duplicate"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  duplicateLayer(l.id)
                }}
              >
                <Icon name="copy" size={15} />
              </button>
              <button
                className="icon-btn danger"
                title="Delete"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  deleteLayer(l.id)
                }}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
