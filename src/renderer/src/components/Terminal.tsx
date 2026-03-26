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

// How many lines from the bottom counts as "near bottom" for snap-back
const RESUME_FOLLOW_LINES = 2

export default function Terminal({ sessionId, onInput, onTab, focused }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const lastSizeRef = useRef({ width: 0, height: 0 })
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userScrolledUpRef = useRef(false)
  const scrollGapRef = useRef(0)

  // Use refs to avoid stale closures in xterm callbacks
  const sessionIdRef = useRef(sessionId)
  const onInputRef = useRef(onInput)
  const onTabRef = useRef(onTab)

  // Keep refs in sync with props
  sessionIdRef.current = sessionId
  onInputRef.current = onInput
  onTabRef.current = onTab

  // Compute gap between viewport and bottom; update scrollGapRef and auto-clear flag
  const syncGap = useCallback((term: XTerm) => {
    scrollGapRef.current = term.buffer.active.baseY - term.buffer.active.viewportY
    if (scrollGapRef.current === 0) {
      userScrolledUpRef.current = false
    }
  }, [])

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current) {
      try {
        const term = xtermRef.current
        const wasScrolledUp = userScrolledUpRef.current
        const savedY = term.buffer.active.viewportY

        fitAddonRef.current.fit()

        // After fit(), wait for xterm Viewport._sync() (RAF-based) then restore
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!xtermRef.current) return

            if (!wasScrolledUp || !userScrolledUpRef.current) {
              term.scrollToBottom()
            } else {
              term.scrollToLine(Math.min(savedY, term.buffer.active.baseY))
            }

            syncGap(term)
          })
        })

        if (sessionIdRef.current) {
          window.api.terminal.resize(
            sessionIdRef.current,
            term.cols,
            term.rows
          )
        }
      } catch {
        // ignore resize errors during cleanup
      }
    }
  }, [syncGap])

  // Debounced resize — batches rapid resize events into single fit() call
  const debouncedResize = useCallback(() => {
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
    resizeTimerRef.current = setTimeout(handleResize, 50)
  }, [handleResize])

  // Initialize xterm once
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
        fontFamily: "'NanumGothicCoding', 'Symbols Nerd Font Mono', 'JetBrains Mono', 'Fira Code', Menlo, monospace",
        cursorBlink: true,
        scrollback: 5000,
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

      // Track user scroll intent via actual viewport gap (not raw wheel direction)
      const wheelHandler = (e: WheelEvent): void => {
        if (e.deltaY === 0) return

        requestAnimationFrame(() => {
          const t = xtermRef.current
          if (!t) return

          syncGap(t)

          if (e.deltaY < 0) {
            // Only mark as scrolled-up if viewport actually left the bottom
            if (scrollGapRef.current > 0) {
              userScrolledUpRef.current = true
            }
          } else {
            // Scrolling down — snap back to follow if near bottom
            if (scrollGapRef.current <= RESUME_FOLLOW_LINES) {
              userScrolledUpRef.current = false
              t.scrollToBottom()
              syncGap(t)
            }
          }
        })
      }
      container.addEventListener('wheel', wheelHandler, { passive: true })

      // Sync gap on any scroll event (keyboard scroll, programmatic, etc.)
      const scrollDisposable = term.onScroll(() => {
        syncGap(term)
      })

      // Auto-follow on parser batch completion (not per-IPC-chunk)
      const writeParsedDisposable = term.onWriteParsed(() => {
        if (!userScrolledUpRef.current) {
          term.scrollToBottom()
        }
      })

      // Shift+Enter detection: flag set at Enter keydown, consumed in onData
      let nextEnterIsShifted = false

      // Intercept Tab to toggle CLI ↔ Server, let ⌘ shortcuts bubble
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== 'keydown') return true
        // Shift+Enter: check e.shiftKey at exact keydown moment (no stale state)
        if (e.key === 'Enter' && e.shiftKey) {
          nextEnterIsShifted = true
        }
        // Tab (without Shift): toggle CLI ↔ Server
        // Shift+Tab passes through to terminal (e.g. Claude CLI mode switch)
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

      // Use refs so callbacks always see latest values
      // Shift+Enter: intercept \r at onData level, replace with CSI u
      // This avoids all IME composition timing issues
      const inputDisposable = term.onData((data) => {
        if (data === '\r' && nextEnterIsShifted) {
          nextEnterIsShifted = false
          userScrolledUpRef.current = false
          if (sessionIdRef.current) {
            window.api.terminal.write(sessionIdRef.current, '\x1b[13;2u')
          }
          return
        }
        nextEnterIsShifted = false
        // Enter/Return → user expects to see output, resume auto-scroll
        if (data === '\r') {
          userScrolledUpRef.current = false
        }
        if (sessionIdRef.current) {
          window.api.terminal.write(sessionIdRef.current, data)
        }
        onInputRef.current?.(data)
      })

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return
        const { width, height } = entry.contentRect
        // Skip zero-size (hidden) containers
        if (width === 0 || height === 0) return
        // Skip if size hasn't actually changed
        const last = lastSizeRef.current
        if (Math.abs(width - last.width) < 1 && Math.abs(height - last.height) < 1) return
        last.width = width
        last.height = height
        debouncedResize()
      })
      observer.observe(container)

      cleanupRef.current = () => {
        if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
        container.removeEventListener('wheel', wheelHandler)
        scrollDisposable.dispose()
        writeParsedDisposable.dispose()
        inputDisposable.dispose()
        observer.disconnect()
        term.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    }

    initTerminal()

    // After NanumGothicCoding loads, force xterm to remeasure character metrics.
    // Toggling fontSize forces CharSizeService cache invalidation.
    document.fonts.load('13px NanumGothicCoding').then(() => {
      const term = xtermRef.current
      if (!term || !container.isConnected) return
      term.options.fontSize = 14
      term.options.fontSize = 13
      handleResize()
    }).catch(() => {
      // Font not available — fit with fallback font
      handleResize()
    })

    return () => {
      cleanupRef.current()
    }
  }, [handleResize, debouncedResize, syncGap])

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
  // Use requestAnimationFrame to ensure DOM is fully visible after project switch
  useEffect(() => {
    if (focused && xtermRef.current) {
      requestAnimationFrame(() => {
        xtermRef.current?.focus()
      })
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
