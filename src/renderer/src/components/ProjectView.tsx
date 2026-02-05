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
  const { panelSizes, setPanelSizes, focusedPanel, setFocusedPanel, setServerRunning } = useUIStore()
  const serverRunning = useUIStore((s) => s.serverRunning[project.id])

  const containerRef = useRef<HTMLDivElement>(null)
  const [mainSessionId, setMainSessionId] = useState<string | null>(null)
  const [serverSessionId, setServerSessionId] = useState<string | null>(null)
  const inputBufferRef = useRef('')
  const sessionsRef = useRef<{ main: string | null; server: string | null }>({
    main: null,
    server: null
  })

  // Create sessions on mount, kill on unmount
  useEffect(() => {
    const setup = async () => {
      const mainSid = await window.api.terminal.create(project.id, 'main', project.path)
      const serverSid = await window.api.terminal.create(project.id, 'server', project.path)
      sessionsRef.current = { main: mainSid, server: serverSid }
      setMainSessionId(mainSid)
      setServerSessionId(serverSid)
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
        window.api.notify('VTerm', `서버가 종료되었습니다 (${project.name})`)
      }
    })
    return cleanup
  }, [serverSessionId, project.id, project.name, setServerRunning])

  const handleMainInput = useCallback(
    (data: string) => {
      if (data === '\r' || data === '\n') {
        const trimmed = inputBufferRef.current.trim()
        if (trimmed.length > 0) addPrompt(project.id, trimmed)
        inputBufferRef.current = ''
        return
      }
      if (data === '\x7f') { inputBufferRef.current = inputBufferRef.current.slice(0, -1); return }
      if (data === '\x03' || data === '\x04') { inputBufferRef.current = ''; return }
      if (data.length === 1 && data.charCodeAt(0) >= 32) inputBufferRef.current += data
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

  const handleResize1 = useCallback(
    (delta: number) => {
      if (!containerRef.current) return
      const pctDelta = (delta / containerRef.current.clientHeight) * 100
      const [a, b, c] = panelSizes
      const newA = Math.max(15, Math.min(70, a + pctDelta))
      const newB = Math.max(10, b - pctDelta)
      if (newB < 10) return
      setPanelSizes([newA, newB, c])
    },
    [panelSizes, setPanelSizes]
  )

  const handleResize2 = useCallback(
    (delta: number) => {
      if (!containerRef.current) return
      const pctDelta = (delta / containerRef.current.clientHeight) * 100
      const [a, b, c] = panelSizes
      const newB = Math.max(10, Math.min(60, b + pctDelta))
      const newC = Math.max(10, c - pctDelta)
      if (newC < 10) return
      setPanelSizes([a, newB, newC])
    },
    [panelSizes, setPanelSizes]
  )

  const panelHeaderClass = 'px-3 py-1.5 text-[11px] font-medium text-fg-subtle uppercase tracking-wider border-b border-border-muted bg-bg-canvas shrink-0 flex items-center justify-between'
  const focusRing = 'ring-1 ring-inset ring-accent-fg/25'

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col min-h-0 ${active ? '' : 'hidden'}`}
    >
      {/* Main terminal */}
      <div
        className={`min-h-0 flex flex-col ${focusedPanel === 'main' ? focusRing : ''}`}
        style={{ height: `${panelSizes[0]}%` }}
        onClick={() => setFocusedPanel('main')}
      >
        <div className={panelHeaderClass}>
          <span>Claude CLI</span>
        </div>
        <div className="flex-1 min-h-0">
          <Terminal sessionId={mainSessionId} onInput={handleMainInput} />
        </div>
      </div>

      <ResizeHandle onResize={handleResize1} />

      {/* Server terminal */}
      <div
        className={`min-h-0 flex flex-col ${focusedPanel === 'server' ? focusRing : ''}`}
        style={{ height: `${panelSizes[1]}%` }}
        onClick={() => setFocusedPanel('server')}
      >
        <div className={panelHeaderClass}>
          <div className="flex items-center gap-2">
            <span>Server</span>
            {serverRunning && <span className="w-1.5 h-1.5 rounded-full bg-success-fg animate-pulse" />}
          </div>
          {project.serverCommand && (
            <span className="text-fg-subtle font-mono normal-case">{project.serverCommand}</span>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <Terminal sessionId={serverSessionId} onInput={handleServerInput} />
        </div>
      </div>

      <ResizeHandle onResize={handleResize2} />

      {/* Prompt history */}
      <div
        className={`min-h-0 ${focusedPanel === 'prompts' ? focusRing : ''}`}
        style={{ height: `${panelSizes[2]}%` }}
        onClick={() => setFocusedPanel('prompts')}
      >
        <PromptPanel projectId={project.id} onSelectPrompt={handleSelectPrompt} />
      </div>
    </div>
  )
}
