import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string | null
  onInput?: (data: string) => void
}

export default function Terminal({ sessionId, onInput }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Use refs to avoid stale closures in xterm callbacks
  const sessionIdRef = useRef(sessionId)
  const onInputRef = useRef(onInput)

  // Keep refs in sync with props
  sessionIdRef.current = sessionId
  onInputRef.current = onInput

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      try {
        // Preserve scroll position across fit()
        const viewport = containerRef.current?.querySelector('.xterm-viewport') as HTMLElement | null
        const scrollTop = viewport?.scrollTop ?? 0
        fitAddonRef.current.fit()
        if (viewport) viewport.scrollTop = scrollTop
        if (sessionIdRef.current) {
          window.api.terminal.resize(
            sessionIdRef.current,
            xtermRef.current.cols,
            xtermRef.current.rows
          )
        }
      } catch {
        // ignore resize errors during cleanup
      }
    }
  }, [])

  // Initialize xterm once
  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      theme: {
        background: '#21272c', // compensated for brightness(0.75) → appears as #191d21
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#363a43',
        selectionBackground: '#ffffff',
        selectionForeground: '#292c33',
        black: '#1d1f21',
        red: '#bf6b69',
        green: '#b7bd73',
        yellow: '#e9c880',
        blue: '#88a1bb',
        magenta: '#ad95b8',
        cyan: '#95bdb7',
        white: '#c5c8c6',
        brightBlack: '#666666',
        brightRed: '#c55757',
        brightGreen: '#bcc95f',
        brightYellow: '#e1c65e',
        brightBlue: '#83a5d6',
        brightMagenta: '#bc99d4',
        brightCyan: '#83beb1',
        brightWhite: '#eaeaea'
      },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      cursorBlink: true,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    // Force all xterm background elements to compensated color via CSS !important
    const bgStyle = document.createElement('style')
    bgStyle.textContent = `.xterm, .xterm-viewport, .xterm-screen, .xterm-rows { background-color: #21272c !important; }`
    containerRef.current.appendChild(bgStyle)

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    setTimeout(() => fitAddon.fit(), 50)

    // Use refs so callbacks always see latest values
    const inputDisposable = term.onData((data) => {
      if (sessionIdRef.current) {
        window.api.terminal.write(sessionIdRef.current, data)
      }
      onInputRef.current?.(data)
    })

    const observer = new ResizeObserver(() => handleResize())
    observer.observe(containerRef.current)

    return () => {
      inputDisposable.dispose()
      observer.disconnect()
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [handleResize])

  // Handle pty output → xterm
  useEffect(() => {
    if (!sessionId) return

    const cleanup = window.api.terminal.onData((sid, data) => {
      if (sid === sessionId && xtermRef.current) {
        xtermRef.current.write(data)
      }
    })

    setTimeout(() => handleResize(), 100)

    return cleanup
  }, [sessionId, handleResize])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!sessionIdRef.current) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    const paths = files.map((f) => window.api.getPathForFile(f))
    window.api.terminal.write(sessionIdRef.current, paths.join(' '))
  }, [])

  return (
    <div
      className="w-full h-full p-2 pr-1"
      style={{ filter: 'brightness(0.75)', backgroundColor: '#21272c' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
