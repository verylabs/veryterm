import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  sessionId: string | null
  onInput?: (data: string) => void
  onTab?: () => void
  focused?: boolean
}

export default function Terminal({ sessionId, onInput, onTab, focused }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Use refs to avoid stale closures in xterm callbacks
  const sessionIdRef = useRef(sessionId)
  const onInputRef = useRef(onInput)
  const onTabRef = useRef(onTab)

  // Keep refs in sync with props
  sessionIdRef.current = sessionId
  onInputRef.current = onInput
  onTabRef.current = onTab

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      try {
        const viewport = containerRef.current?.querySelector('.xterm-viewport') as HTMLElement | null
        // Detect if user is following output (scrolled to bottom) vs reading history (scrolled up)
        const isAtBottom = !viewport ||
          (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 5)
        const scrollTop = viewport?.scrollTop ?? 0
        fitAddonRef.current.fit()
        if (viewport) {
          if (isAtBottom) {
            // Was at bottom → stay at bottom (follow output)
            viewport.scrollTop = viewport.scrollHeight
          } else {
            // Was scrolled up → preserve reading position
            viewport.scrollTop = scrollTop
            requestAnimationFrame(() => {
              viewport.scrollTop = scrollTop
            })
          }
        }
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

  // Initialize xterm once (after font is loaded)
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const cleanupRef = { current: (): void => {} }

    const initTerminal = (): void => {
      const term = new XTerm({
        theme: {
          background: '#1f2529', // compensated for brightness(0.8) → appears as #191d21
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
        lineHeight: 1.4,
        fontWeight: '400',
        letterSpacing: 0,
        fontFamily: "'NanumGothicCoding', 'JetBrains Mono', 'Fira Code', Menlo, monospace",
        cursorBlink: true,
        allowProposedApi: true
      })

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()

      term.loadAddon(fitAddon)
      term.loadAddon(webLinksAddon)
      term.open(container)

      // Force all xterm background elements to compensated color via CSS !important
      const bgStyle = document.createElement('style')
      bgStyle.textContent = `.xterm, .xterm-viewport, .xterm-screen, .xterm-rows { background-color: #1f2529 !important; }`
      container.appendChild(bgStyle)

      // Let ⌥ shortcuts pass through to window listener instead of pty
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== 'keydown') return true
        if (e.altKey && !e.metaKey && !e.ctrlKey) {
          // ⌥` : toggle CLI ↔ Server
          if (e.code === 'Backquote') {
            e.preventDefault()
            e.stopPropagation()
            onTabRef.current?.()
            return false
          }
          // ⌥0~9, ⌥N, ⌥B, ⌥F : let bubble to useKeyboardShortcuts
          if (/^(Digit[0-9]|Key[NBF])$/.test(e.code)) {
            return false
          }
        }
        return true
      })

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
      observer.observe(container)

      cleanupRef.current = () => {
        inputDisposable.dispose()
        observer.disconnect()
        term.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    }

    initTerminal()

    // After font loads, re-fit to recalculate with correct font metrics
    document.fonts.ready.then(() => {
      if (fitAddonRef.current && container.isConnected) {
        fitAddonRef.current.fit()
      }
    })

    return () => {
      cleanupRef.current()
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

  // Focus terminal when focused prop becomes true
  useEffect(() => {
    if (focused && xtermRef.current) {
      xtermRef.current.focus()
    }
  }, [focused])

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
      style={{ filter: 'brightness(0.8)', backgroundColor: '#1f2529' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
