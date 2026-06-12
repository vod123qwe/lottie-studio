import { useEffect } from 'react'
import { useEditor } from '../store/editorStore'
import { Icon } from './Icons'

// Right-click menu for a layer (from the layer panel or the timeline).
export function ContextMenu() {
  const menu = useEditor((s) => s.contextMenu)
  const layer = useEditor((s) => s.comp.layers.find((l) => l.id === menu?.layerId))
  const closeMenu = useEditor((s) => s.closeMenu)
  const resetLayer = useEditor((s) => s.resetLayer)
  const duplicateLayer = useEditor((s) => s.duplicateLayer)
  const toggleVisible = useEditor((s) => s.toggleVisible)
  const deleteLayer = useEditor((s) => s.deleteLayer)
  const requestRename = useEditor((s) => s.requestRename)

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, closeMenu])

  if (!menu || !layer) return null
  const run = (fn: () => void) => {
    fn()
    closeMenu()
  }
  const x = Math.min(menu.x, window.innerWidth - 200)
  const y = Math.min(menu.y, window.innerHeight - 220)

  return (
    <>
      <div
        className="ctx-backdrop"
        onPointerDown={closeMenu}
        onContextMenu={(e) => {
          e.preventDefault()
          closeMenu()
        }}
      />
      <div className="ctx-menu" style={{ left: x, top: y }}>
        <div className="ctx-title">{layer.name}</div>
        <button className="ctx-item" onClick={() => run(() => requestRename(layer.id))}>
          <Icon name="pencil" size={15} /> Rename
        </button>
        <button className="ctx-item" onClick={() => run(() => duplicateLayer(layer.id))}>
          <Icon name="copy" size={15} /> Duplicate
        </button>
        <button className="ctx-item" onClick={() => run(() => resetLayer(layer.id))}>
          <Icon name="rotate" size={15} /> Reset layer
        </button>
        <button className="ctx-item" onClick={() => run(() => toggleVisible(layer.id))}>
          <Icon name={layer.visible ? 'eye-off' : 'eye'} size={15} /> {layer.visible ? 'Hide' : 'Show'}
        </button>
        <div className="ctx-sep" />
        <button className="ctx-item danger" onClick={() => run(() => deleteLayer(layer.id))}>
          <Icon name="trash" size={15} /> Delete
        </button>
      </div>
    </>
  )
}
