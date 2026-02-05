import { useCallback, useRef } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  direction?: 'horizontal' | 'vertical'
}

export default function ResizeHandle({ onResize, direction = 'vertical' }: ResizeHandleProps) {
  const startPosRef = useRef(0)
  const isDraggingRef = useRef(false)
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize

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
        onResizeRef.current(delta)
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
    [direction]
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`group relative shrink-0 ${
        direction === 'vertical'
          ? 'h-px bg-border-muted cursor-row-resize hover:bg-blue-500'
          : 'w-px bg-border-muted cursor-col-resize hover:bg-blue-500'
      } transition-colors duration-150`}
    >
      {/* Larger hit area */}
      <div
        className={`absolute z-10 ${
          direction === 'vertical'
            ? 'inset-x-0 -top-1.5 -bottom-1.5'
            : 'inset-y-0 -left-1.5 -right-1.5'
        }`}
      />
    </div>
  )
}
