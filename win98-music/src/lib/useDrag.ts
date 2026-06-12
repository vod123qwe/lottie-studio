import { useEffect, useRef } from 'react'

/**
 * Pointer-drag helper for window title bars. Calls `onMove` with the new
 * top-left while dragging, clamped to the viewport (minus the taskbar).
 */
export function useTitleDrag(
  getPos: () => { x: number; y: number },
  onMove: (x: number, y: number) => void,
  onStart?: () => void,
) {
  const start = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    // ignore drags that begin on the title buttons
    if ((e.target as HTMLElement).closest('.title-btn')) return
    onStart?.()
    const pos = getPos()
    start.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!start.current) return
      const dx = e.clientX - start.current.px
      const dy = e.clientY - start.current.py
      const nx = Math.max(0, Math.min(window.innerWidth - 60, start.current.ox + dx))
      const ny = Math.max(0, Math.min(window.innerHeight - 60, start.current.oy + dy))
      onMove(nx, ny)
    }
    const up = () => {
      start.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onMove])

  return { onPointerDown }
}
