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
        fitAddonRef.current.fit()
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
        background: '#191d21',
        foreground: '#e1e4e8',
        cursor: '#c8e1ff',
        cursorAccent: '#191d21',
        selectionBackground: '#444d56',
        black: '#1d2125',
        red: '#f97583',
        green: '#85e89d',
        yellow: '#ffea7f',
        blue: '#79b8ff',
        magenta: '#b392f0',
        cyan: '#73e3ff',
        white: '#e1e4e8',
        brightBlack: '#6a737d',
        brightRed: '#fdaeb7',
        brightGreen: '#bef5cb',
        brightYellow: '#fff5b1',
        brightBlue: '#c8e1ff',
        brightMagenta: '#d1bcf9',
        brightCyan: '#b3f0ff',
        brightWhite: '#fafbfc'
      },
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      cursorBlink: true,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    // Force xterm viewport background to match theme
    const viewport = containerRef.current.querySelector('.xterm-viewport') as HTMLElement
    if (viewport) viewport.style.backgroundColor = '#191d21'
    const screen = containerRef.current.querySelector('.xterm-screen') as HTMLElement
    if (screen) screen.style.backgroundColor = '#191d21'

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

  return (
    <div className="w-full h-full bg-bg-inset p-2 pr-1">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
