import { useCallback, useRef } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  direction?: 'horizontal' | 'vertical'
}

export default function ResizeHandle({ onResize, direction = 'vertical' }: ResizeHandleProps) {
  const startPosRef = useRef(0)
  const isDraggingRef = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDraggingRef.current = true
      startPosRef.current = direction === 'vertical' ? e.clientY : e.clientX

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return
        const currentPos = direction === 'vertical' ? e.clientY : e.clientX
        const delta = currentPos - startPosRef.current
        startPosRef.current = currentPos
        onResize(delta)
      }

      const handleMouseUp = () => {
        isDraggingRef.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'vertical' ? 'row-resize' : 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [onResize, direction]
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`group relative shrink-0 ${
        direction === 'vertical'
          ? 'h-1.5 cursor-row-resize'
          : 'w-1.5 cursor-col-resize'
      }`}
    >
      {/* Visual indicator */}
      <div
        className={`absolute bg-border-default opacity-0 group-hover:opacity-100 transition-opacity rounded-full ${
          direction === 'vertical'
            ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-0.5'
            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-0.5'
        }`}
      />
      {/* Larger hit area */}
      <div
        className={`absolute ${
          direction === 'vertical'
            ? 'inset-x-0 -top-1 -bottom-1'
            : 'inset-y-0 -left-1 -right-1'
        }`}
      />
    </div>
  )
}
