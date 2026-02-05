import { useEffect, useRef, useState, useCallback } from 'react'
import Terminal from './Terminal'
import PromptPanel from './PromptPanel'
import ResizeHandle from './ResizeHandle'
import { usePromptStore } from '../stores/promptStore'
import { useUIStore } from '../stores/uiStore'
import type { Project } from '../types'

interface ProjectViewProps {
  project: Project
  active: boolean
}

export default function ProjectView({ project, active }: ProjectViewProps) {
  const { addPrompt } = usePromptStore()
  const {
    panelSizes, setPanelSizes,
    focusedPanel, setFocusedPanel, setServerRunning,
    layoutMode, splitRatio, setSplitRatio, secondarySplit, setSecondarySplit
  } = useUIStore()
  const serverRunning = useUIStore((s) => s.serverRunning[project.id])
  const cliWorking = useUIStore((s) => s.cliWorking[project.id])

  const containerRef = useRef<HTMLDivElement>(null)
  const [mainSessionId, setMainSessionId] = useState<string | null>(null)
  const [serverSessionId, setServerSessionId] = useState<string | null>(null)
  const inputBufferRef = useRef('')
  const sessionsRef = useRef<{ main: string | null; server: string | null }>({
    main: null,
    server: null
  })
  const lastDataRef = useRef(0)
  const wasWorkingRef = useRef(false)
  const escapeRef = useRef(false)

  // Create sessions on mount, kill on unmount
  useEffect(() => {
    const setup = async () => {
      const mainSid = await window.api.terminal.create(project.id, 'main', project.path)
      const serverSid = await window.api.terminal.create(project.id, 'server', project.path)
      sessionsRef.current = { main: mainSid, server: serverSid }
      setMainSessionId(mainSid)
      setServerSessionId(serverSid)

      // Auto start CLI
      if (project.autoStartClaude && mainSid) {
        const cmd = project.cliCommand || 'claude'
        setTimeout(() => {
          window.api.terminal.write(mainSid, cmd + '\n')
        }, 300)
      }
    }
    setup()
    return () => {
      if (sessionsRef.current.main) window.api.terminal.kill(sessionsRef.current.main)
      if (sessionsRef.current.server) window.api.terminal.kill(sessionsRef.current.server)
      sessionsRef.current = { main: null, server: null }
    }
  }, [project.id, project.path])

  // Server exit handler
  useEffect(() => {
    if (!serverSessionId) return
    const cleanup = window.api.terminal.onExit((sid, _code) => {
      if (sid === serverSessionId) {
        setServerRunning(project.id, false)
        window.api.notify('VTerm', `Server stopped (${project.name})`)
      }
    })
    return cleanup
  }, [serverSessionId, project.id, project.name, setServerRunning])

  // CLI activity tracking: listen to terminal:data for the main session
  useEffect(() => {
    if (!mainSessionId) return
    const cleanup = window.api.terminal.onData((sid, _data) => {
      if (sid === mainSessionId) {
        lastDataRef.current = Date.now()
        if (!wasWorkingRef.current) {
          wasWorkingRef.current = true
          useUIStore.getState().setCLIWorking(project.id, true)
        }
      }
    })
    const interval = setInterval(() => {
      if (lastDataRef.current === 0) return
      const idle = Date.now() - lastDataRef.current > 3000
      if (idle && wasWorkingRef.current) {
        wasWorkingRef.current = false
        useUIStore.getState().setCLIWorking(project.id, false)
        if (useUIStore.getState().notificationsEnabled) {
          window.api.notify('VTerm', `CLI finished (${project.name})`)
          window.api.dock.bounce()
        }
      }
    }, 1000)
    return () => {
      cleanup()
      clearInterval(interval)
    }
  }, [mainSessionId, project.id, project.name])

  const handleMainInput = useCallback(
    (data: string) => {
      if (data === '\r' || data === '\n') {
        const trimmed = inputBufferRef.current.trim()
        if (trimmed.length > 0) addPrompt(project.id, trimmed)
        inputBufferRef.current = ''
        return
      }
      if (data === '\x03' || data === '\x04') { inputBufferRef.current = ''; return }
      // Skip ANSI escape sequences (arrow keys, focus events, etc.)
      // ESC may arrive alone (split) or as complete sequence (\x1b[A)
      // Only flag next-chunk skip when ESC arrives alone
      if (data.includes('\x1b')) { escapeRef.current = data === '\x1b'; return }
      if (escapeRef.current) {
        escapeRef.current = false
        return
      }
      // Process each character — handles Korean IME multi-char data (e.g. \x08+composed char)
      for (const ch of data) {
        if (ch === '\x7f' || ch === '\x08') {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1)
        } else if (ch.charCodeAt(0) >= 32) {
          inputBufferRef.current += ch
        }
      }
    },
    [project.id, addPrompt]
  )

  const handleServerInput = useCallback(
    (data: string) => {
      if (data === '\r' || data === '\n') setServerRunning(project.id, true)
    },
    [project.id, setServerRunning]
  )

  const handleSelectPrompt = useCallback(
    (prompt: string) => {
      if (mainSessionId) window.api.terminal.write(mainSessionId, prompt)
    },
    [mainSessionId]
  )

  // Rows layout resize handlers (existing)
  const handleResize1 = useCallback(
    (delta: number) => {
      if (!containerRef.current) return
      const pctDelta = (delta / containerRef.current.clientHeight) * 100
      const [a, b, c] = useUIStore.getState().panelSizes
      const newA = Math.max(15, Math.min(70, a + pctDelta))
      const newB = Math.max(10, b - pctDelta)
      if (newB < 10) return
      setPanelSizes([newA, newB, c])
    },
    [setPanelSizes]
  )

  const handleResize2 = useCallback(
    (delta: number) => {
      if (!containerRef.current) return
      const pctDelta = (delta / containerRef.current.clientHeight) * 100
      const [a, b, c] = useUIStore.getState().panelSizes
      const newB = Math.max(10, Math.min(60, b + pctDelta))
      const newC = Math.max(10, c - pctDelta)
      if (newC < 10) return
      setPanelSizes([a, newB, newC])
    },
    [setPanelSizes]
  )

  // Right-split: horizontal resize (left/right split)
  const handleRightSplitPrimary = useCallback(
    (delta: number) => {
      if (!containerRef.current) return
      const pctDelta = (delta / containerRef.current.clientWidth) * 100
      setSplitRatio(useUIStore.getState().splitRatio + pctDelta)
    },
    [setSplitRatio]
  )

  // Right-split: vertical resize (right top/bottom split)
  const handleRightSplitSecondary = useCallback(
    (delta: number) => {
      if (!containerRef.current) return
      const pctDelta = (delta / containerRef.current.clientHeight) * 100
      setSecondarySplit(useUIStore.getState().secondarySplit + pctDelta)
    },
    [setSecondarySplit]
  )

  // Bottom-split: vertical resize (top/bottom split)
  const handleBottomSplitPrimary = useCallback(
    (delta: number) => {
      if (!containerRef.current) return
      const pctDelta = (delta / containerRef.current.clientHeight) * 100
      setSplitRatio(useUIStore.getState().splitRatio + pctDelta)
    },
    [setSplitRatio]
  )

  // Bottom-split: horizontal resize (bottom left/right split)
  const handleBottomSplitSecondary = useCallback(
    (delta: number) => {
      if (!containerRef.current) return
      const pctDelta = (delta / containerRef.current.clientWidth) * 100
      setSecondarySplit(useUIStore.getState().secondarySplit + pctDelta)
    },
    [setSecondarySplit]
  )

  const panelHeaderStyle = { height: 32, minHeight: 32, maxHeight: 32 } as const
  const panelHeaderClass = 'px-3 text-xs leading-none font-medium text-fg-subtle uppercase tracking-wider border-b border-border-muted bg-bg-default flex items-center justify-between'
  const focusRing = 'ring-1 ring-inset ring-accent-fg/25'

  // Panel render helpers
  const renderCLI = (style?: React.CSSProperties) => (
    <div
      className={`min-h-0 flex flex-col ${focusedPanel === 'main' ? focusRing : ''}`}
      style={style}
      onClick={() => setFocusedPanel('main')}
    >
      <div className={panelHeaderClass} style={panelHeaderStyle}>
        <div className="flex items-center gap-2">
          <span>CLI</span>
          {cliWorking && <span className="w-1.5 h-1.5 rounded-full bg-success-fg animate-pulse" />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-fg-subtle font-mono normal-case text-[10px]">{project.cliCommand || 'claude'}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (mainSessionId) {
                const cmd = project.cliCommand || 'claude'
                window.api.terminal.write(mainSessionId, cmd + '\n')
              }
            }}
            className="px-2 py-0.5 text-[10px] font-semibold rounded bg-accent-emphasis/80 text-white hover:bg-accent-emphasis transition-colors normal-case tracking-normal"
          >
            RUN
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Terminal sessionId={mainSessionId} onInput={handleMainInput} />
      </div>
    </div>
  )

  const renderServer = (style?: React.CSSProperties) => (
    <div
      className={`min-h-0 flex flex-col ${focusedPanel === 'server' ? focusRing : ''}`}
      style={style}
      onClick={() => setFocusedPanel('server')}
    >
      <div className={panelHeaderClass} style={panelHeaderStyle}>
        <div className="flex items-center gap-2">
          <span>Server</span>
          {serverRunning && <span className="w-1.5 h-1.5 rounded-full bg-success-fg animate-pulse" />}
        </div>
        <div className="flex items-center gap-1.5">
          {project.serverCommand && (
            <span className="text-fg-subtle font-mono normal-case text-[10px]">{project.serverCommand}</span>
          )}
          {serverRunning ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (serverSessionId) {
                  window.api.terminal.write(serverSessionId, '\x03')
                  setServerRunning(project.id, false)
                }
              }}
              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-danger-fg/80 text-white hover:bg-danger-fg transition-colors normal-case tracking-normal"
            >
              STOP
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (serverSessionId && project.serverCommand) {
                  window.api.terminal.write(serverSessionId, project.serverCommand + '\n')
                  setServerRunning(project.id, true)
                }
              }}
              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-success-fg/80 text-white hover:bg-success-fg transition-colors normal-case tracking-normal"
            >
              RUN
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Terminal sessionId={serverSessionId} onInput={handleServerInput} />
      </div>
    </div>
  )

  const renderPrompts = (style?: React.CSSProperties) => (
    <div
      className={`min-h-0 ${focusedPanel === 'prompts' ? focusRing : ''}`}
      style={style}
      onClick={() => setFocusedPanel('prompts')}
    >
      <PromptPanel projectId={project.id} onSelectPrompt={handleSelectPrompt} />
    </div>
  )

  const renderRows = () => (
    <>
      {renderCLI({ height: `${panelSizes[0]}%` })}
      <ResizeHandle onResize={handleResize1} />
      {renderServer({ height: `${panelSizes[1]}%` })}
      <ResizeHandle onResize={handleResize2} />
      {renderPrompts({ height: `${panelSizes[2]}%` })}
    </>
  )

  const renderRightSplit = () => (
    <div className="flex-1 flex flex-row min-h-0">
      {/* Left: CLI */}
      {renderCLI({ width: `${splitRatio}%` })}
      <ResizeHandle direction="horizontal" onResize={handleRightSplitPrimary} />
      {/* Right: Server (top) + Prompts (bottom) */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {renderServer({ height: `${secondarySplit}%` })}
        <ResizeHandle onResize={handleRightSplitSecondary} />
        {renderPrompts({ flex: 1 })}
      </div>
    </div>
  )

  const renderBottomSplit = () => (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top: CLI */}
      {renderCLI({ height: `${splitRatio}%` })}
      <ResizeHandle onResize={handleBottomSplitPrimary} />
      {/* Bottom: Server (left) + Prompts (right) */}
      <div className="flex-1 flex flex-row min-h-0 min-w-0">
        {renderServer({ width: `${secondarySplit}%` })}
        <ResizeHandle direction="horizontal" onResize={handleBottomSplitSecondary} />
        {renderPrompts({ flex: 1 })}
      </div>
    </div>
  )

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col min-h-0 ${active ? '' : 'hidden'}`}
    >
      {layoutMode === 'rows' && renderRows()}
      {layoutMode === 'right-split' && renderRightSplit()}
      {layoutMode === 'bottom-split' && renderBottomSplit()}
    </div>
  )
}
