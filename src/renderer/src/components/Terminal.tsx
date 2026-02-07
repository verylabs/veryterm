import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useUIStore, THEMES } from '../stores/uiStore'

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
        // Restore scroll after fit() — must retry because xterm's internal
        // resize handler can reset scrollTop after our restore
        if (viewport) {
          const restore = () => {
            if (isAtBottom) {
              viewport.scrollTop = viewport.scrollHeight
            } else {
              viewport.scrollTop = scrollTop
            }
          }
          restore()
          requestAnimationFrame(restore)
          setTimeout(restore, 50)
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
      const currentTheme = useUIStore.getState().theme
      const termBg = THEMES[currentTheme].vars['--color-terminal-bg']

      const term = new XTerm({
        theme: {
          background: termBg,
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

      // Force all xterm background elements to theme color via CSS !important
      const bgStyle = document.createElement('style')
      bgStyle.textContent = `.xterm, .xterm-viewport, .xterm-screen, .xterm-rows { background-color: var(--color-terminal-bg) !important; }`
      container.appendChild(bgStyle)

      // Intercept Tab to toggle CLI ↔ Server, let ⌘ shortcuts bubble
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== 'keydown') return true
        // Tab: toggle CLI ↔ Server
        if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          onTabRef.current?.()
          return false
        }
        // ⌘1~9, ⌘N, ⌘B, ⌘F : let bubble to useKeyboardShortcuts
        if (e.metaKey && /^(Digit[1-9]|Key[NBF])$/.test(e.code)) {
          return false
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

    // After NanumGothicCoding loads, force xterm to remeasure character metrics.
    // Just calling fit() is not enough — xterm's CharSizeService caches measurements
    // from the fallback font. Toggling fontSize forces a full remeasurement.
    document.fonts.load('13px NanumGothicCoding').then(() => {
      const term = xtermRef.current
      const fit = fitAddonRef.current
      if (!term || !fit || !container.isConnected) return
      term.options.fontSize = 14
      term.options.fontSize = 13
      fit.fit()
    }).catch(() => {
      fitAddonRef.current?.fit()
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

    // Resize PTY to match actual xterm dimensions, then Ctrl+L to clear
    // screen and redraw prompt. Fixes blank line caused by zsh PROMPT_EOL_MARK
    // padding (80-col spaces) wrapping when actual terminal width differs
    // from the hardcoded 80-col PTY default.
    setTimeout(() => handleResize(), 100)
    setTimeout(() => {
      if (sessionIdRef.current) {
        window.api.terminal.write(sessionIdRef.current, '\x0c')
      }
    }, 200)

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

  // Subscribe to theme changes and update xterm background
  useEffect(() => {
    let prevTheme = useUIStore.getState().theme
    return useUIStore.subscribe((state) => {
      if (state.theme !== prevTheme) {
        prevTheme = state.theme
        const bg = THEMES[state.theme].vars['--color-terminal-bg']
        if (xtermRef.current) {
          xtermRef.current.options.theme = {
            ...xtermRef.current.options.theme,
            background: bg
          }
        }
      }
    })
  }, [])

  return (
    <div
      className="w-full h-full p-2 pr-1"
      style={{ filter: 'brightness(0.8)', backgroundColor: 'var(--color-terminal-bg)' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
