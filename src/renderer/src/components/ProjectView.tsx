import { useEffect, useRef, useState, useCallback } from 'react'
import Terminal from './Terminal'
import PromptPanel from './PromptPanel'
import ResizeHandle from './ResizeHandle'
import { usePromptStore } from '../stores/promptStore'
import { useUIStore } from '../stores/uiStore'
import type { Project } from '../types'

interface ServerTab {
  id: string
  sessionId: string | null
  name: string
  command: string
  running: boolean
}

interface ProjectViewProps {
  project: Project
  active: boolean
}

let tabCounter = 0

export default function ProjectView({ project, active }: ProjectViewProps) {
  const { addPrompt } = usePromptStore()

  // Individual selectors to avoid re-renders from unrelated state changes
  const panelSizes = useUIStore((s) => s.panelSizes)
  const setPanelSizes = useUIStore((s) => s.setPanelSizes)
  const focusedPanel = useUIStore((s) => s.focusedPanel)
  const setFocusedPanel = useUIStore((s) => s.setFocusedPanel)
  const setServerRunning = useUIStore((s) => s.setServerRunning)
  const layoutMode = useUIStore((s) => s.layoutMode)
  const splitRatio = useUIStore((s) => s.splitRatio)
  const setSplitRatio = useUIStore((s) => s.setSplitRatio)
  const secondarySplit = useUIStore((s) => s.secondarySplit)
  const setSecondarySplit = useUIStore((s) => s.setSecondarySplit)
  const secondaryCollapsed = useUIStore((s) => s.secondaryCollapsed)
  const toggleSecondaryCollapsed = useUIStore((s) => s.toggleSecondaryCollapsed)
  const narrowCollapsed = secondaryCollapsed && layoutMode === 'right-split'
  const serverRunning = useUIStore((s) => s.serverRunning[project.id])
  const cliWorking = useUIStore((s) => s.cliWorking[project.id])

  const containerRef = useRef<HTMLDivElement>(null)
  const [mainSessionId, setMainSessionId] = useState<string | null>(null)
  const [serverTabs, setServerTabs] = useState<ServerTab[]>([])
  const [activeServerTabId, setActiveServerTabId] = useState<string | null>(null)
  const serverTabsRef = useRef<ServerTab[]>([])
  const inputBufferRef = useRef('')
  const mainSessionRef = useRef<string | null>(null)
  const lastDataRef = useRef(0)
  const wasWorkingRef = useRef(false)
  const escapeRef = useRef(false)

  // Keep ref in sync for cleanup
  useEffect(() => {
    serverTabsRef.current = serverTabs
  }, [serverTabs])

  // Create sessions on mount, kill on unmount
  useEffect(() => {
    const setup = async () => {
      const mainSid = await window.api.terminal.create(project.id, 'main', project.path)
      mainSessionRef.current = mainSid
      setMainSessionId(mainSid)

      // Create initial server tab
      const serverSid = await window.api.terminal.create(project.id, 'server', project.path)
      const tabId = `srv-${++tabCounter}`
      const initialTab: ServerTab = { id: tabId, sessionId: serverSid, name: 'Server 1', command: project.serverCommand || '', running: false }
      setServerTabs([initialTab])
      setActiveServerTabId(tabId)

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
      if (mainSessionRef.current) window.api.terminal.kill(mainSessionRef.current)
      mainSessionRef.current = null
      for (const tab of serverTabsRef.current) {
        if (tab.sessionId) window.api.terminal.kill(tab.sessionId)
      }
      setServerTabs([])
      setActiveServerTabId(null)
    }
  }, [project.id, project.path])

  // Server exit handler — watch all server tab sessions
  useEffect(() => {
    const cleanup = window.api.terminal.onExit((sid, _code) => {
      setServerTabs((prev) => {
        const idx = prev.findIndex((t) => t.sessionId === sid)
        if (idx === -1) return prev
        const updated = prev.map((t) =>
          t.sessionId === sid ? { ...t, running: false } : t
        )
        const runCount = updated.filter((t) => t.running).length
        setServerRunning(project.id, runCount)
        window.api.notify('VeryTerm', `Server stopped (${project.name} - ${prev[idx].name})`)
        return updated
      })
    })
    return cleanup
  }, [project.id, project.name, setServerRunning])

  // Process status polling — main process detects child processes via pgrep
  useEffect(() => {
    const cleanup = window.api.terminal.onProcessStatus((sid, running) => {
      setServerTabs((prev) => {
        const idx = prev.findIndex((t) => t.sessionId === sid)
        if (idx === -1) return prev
        if (prev[idx].running === running) return prev
        const updated = prev.map((t) =>
          t.sessionId === sid ? { ...t, running } : t
        )
        const runCount = updated.filter((t) => t.running).length
        setServerRunning(project.id, runCount)
        if (!running) {
          window.api.notify('VeryTerm', `Server stopped (${project.name} - ${prev[idx].name})`)
        }
        return updated
      })
    })
    return cleanup
  }, [project.id, project.name, setServerRunning])

  // CLI activity tracking: listen to terminal:data for the main session
  useEffect(() => {
    if (!mainSessionId) return
    const cleanup = window.api.terminal.onData((sid, _data) => {
      if (sid === mainSessionId && wasWorkingRef.current) {
        lastDataRef.current = Date.now()
      }
    })
    const interval = setInterval(() => {
      if (lastDataRef.current === 0) return
      const idle = Date.now() - lastDataRef.current > 3000
      if (idle && wasWorkingRef.current) {
        wasWorkingRef.current = false
        useUIStore.getState().setCLIWorking(project.id, false)
        if (useUIStore.getState().notificationsEnabled) {
          window.api.notify('VeryTerm', `CLI finished (${project.name})`)
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
        // Start CLI working detection — only after user actually sends a command
        if (!wasWorkingRef.current) {
          wasWorkingRef.current = true
          lastDataRef.current = Date.now()
          useUIStore.getState().setCLIWorking(project.id, true)
        }
        return
      }
      if (data === '\x03' || data === '\x04') { inputBufferRef.current = ''; return }
      // Skip ANSI escape sequences (arrow keys, focus events, etc.)
      // ESC may arrive alone (split) or as complete sequence (\x1b[A)
      // Only flag next-chunk skip when ESC arrives alone
      if (data.includes('\x1b')) { escapeRef.current = data === '\x1b'; return }
      if (escapeRef.current) {
        escapeRef.current = false
        // Escape sequence continuations are always ASCII (e.g., [A for arrow keys)
        // Don't skip non-ASCII data (Korean, CJK) — it's real input, not a continuation
        if (data.charCodeAt(0) < 128) {
          return
        }
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

  // Server input — no manual running tracking; process poller handles it
  const handleServerInput = useCallback(
    (_data: string) => {},
    []
  )

  // Sync serverRunning count from tabs
  useEffect(() => {
    const runCount = serverTabs.filter((t) => t.running).length
    setServerRunning(project.id, runCount)
  }, [serverTabs, project.id, setServerRunning])

  // Trigger resize when active tab changes so xterm FitAddon recalculates
  useEffect(() => {
    if (!activeServerTabId) return
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  }, [activeServerTabId])

  const addServerTab = useCallback(async () => {
    const sid = await window.api.terminal.create(project.id, 'server', project.path)
    const tabId = `srv-${++tabCounter}`
    const tabNum = serverTabsRef.current.length + 1
    const newTab: ServerTab = { id: tabId, sessionId: sid, name: `Server ${tabNum}`, command: project.serverCommand || '', running: false }
    setServerTabs((prev) => [...prev, newTab])
    setActiveServerTabId(tabId)
  }, [project.id, project.path])

  const [closeConfirmTabId, setCloseConfirmTabId] = useState<string | null>(null)

  const requestCloseServerTab = useCallback(
    (tabId: string) => setCloseConfirmTabId(tabId),
    []
  )

  const confirmCloseServerTab = useCallback(() => {
    const tabId = closeConfirmTabId
    if (!tabId) return
    setCloseConfirmTabId(null)
    setServerTabs((prev) => {
      if (prev.length <= 1) return prev
      const target = prev.find((t) => t.id === tabId)
      if (target?.sessionId) window.api.terminal.kill(target.sessionId)
      const remaining = prev.filter((t) => t.id !== tabId)
      setActiveServerTabId((currentActive) =>
        currentActive === tabId ? remaining[0].id : currentActive
      )
      return remaining
    })
  }, [closeConfirmTabId])

  const cancelCloseServerTab = useCallback(() => setCloseConfirmTabId(null), [])

  const [settingsTabId, setSettingsTabId] = useState<string | null>(null)
  const [settingsName, setSettingsName] = useState('')
  const [settingsCommand, setSettingsCommand] = useState('')

  const openTabSettings = useCallback((tabId: string) => {
    const tab = serverTabsRef.current.find((t) => t.id === tabId)
    if (!tab) return
    setSettingsName(tab.name)
    setSettingsCommand(tab.command)
    setSettingsTabId(tabId)
  }, [])

  const saveTabSettings = useCallback(() => {
    if (!settingsTabId) return
    const name = settingsName.trim()
    if (!name) return
    setServerTabs((prev) =>
      prev.map((t) =>
        t.id === settingsTabId ? { ...t, name, command: settingsCommand.trim() } : t
      )
    )
    setSettingsTabId(null)
  }, [settingsTabId, settingsName, settingsCommand])

  const cancelTabSettings = useCallback(() => setSettingsTabId(null), [])

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

  const handleTabFromCLI = useCallback(() => setFocusedPanel('server'), [setFocusedPanel])
  const handleTabFromServer = useCallback(() => setFocusedPanel('main'), [setFocusedPanel])

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
          {layoutMode === 'right-split' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleSecondaryCollapsed()
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-fg-subtle hover:text-fg-default hover:bg-bg-subtle/80 transition-colors text-[11px] leading-none"
              title={secondaryCollapsed ? 'Expand panels' : 'Collapse panels'}
            >
              {secondaryCollapsed ? '◀' : '▶'}
            </button>
          )}
          {(layoutMode === 'bottom-split' || layoutMode === 'rows') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleSecondaryCollapsed()
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-fg-subtle hover:text-fg-default hover:bg-bg-subtle/80 transition-colors text-[11px] leading-none"
              title={secondaryCollapsed ? 'Expand panels' : 'Collapse panels'}
            >
              {secondaryCollapsed ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Terminal sessionId={mainSessionId} onInput={handleMainInput} onTab={handleTabFromCLI} focused={active && focusedPanel === 'main'} />
      </div>
    </div>
  )

  const activeTab = serverTabs.find((t) => t.id === activeServerTabId) ?? null
  const activeTabRunning = activeTab?.running ?? false

  const bottomCollapsed = secondaryCollapsed && layoutMode === 'bottom-split'
  const rowsCollapsed = secondaryCollapsed && layoutMode === 'rows'

  const renderServer = (style?: React.CSSProperties) => (
    <div
      className={`min-h-0 flex flex-col ${focusedPanel === 'server' ? focusRing : ''} ${bottomCollapsed ? 'border-r border-border-muted' : ''} ${rowsCollapsed ? 'border-t border-border-muted' : ''}`}
      style={style}
      onClick={() => setFocusedPanel('server')}
    >
      {/* Header — SERVER : tab name + settings + command + RUN/STOP + close */}
      <div className={panelHeaderClass} style={panelHeaderStyle}>
        <div className="flex items-center gap-2">
          <span>Server</span>
          {!narrowCollapsed && activeTab && (
            <>
              <span className="text-fg-subtle">:</span>
              <span className={`normal-case text-[11px] ${activeTabRunning ? 'text-success-fg' : 'text-fg-default'}`}>{activeTab.name}</span>
            </>
          )}
          {!narrowCollapsed && activeTab && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openTabSettings(activeTab.id)
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-fg-muted hover:text-fg-default hover:bg-bg-subtle/80 text-[14px] leading-none transition-colors"
              title="Tab settings"
            >
              ⚙
            </button>
          )}
        </div>
        <div className={`flex items-center gap-1.5 ${narrowCollapsed ? 'hidden' : ''}`}>
          {activeTab?.command && (
            <span className="text-fg-subtle font-mono normal-case text-[10px]">{activeTab.command}</span>
          )}
          {activeTabRunning ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (activeTab?.sessionId) {
                  window.api.terminal.write(activeTab.sessionId, '\x03')
                  setServerTabs((prev) =>
                    prev.map((t) => (t.id === activeTab.id ? { ...t, running: false } : t))
                  )
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
                if (activeTab?.sessionId && activeTab.command) {
                  window.api.terminal.write(activeTab.sessionId, activeTab.command + '\n')
                  setServerTabs((prev) =>
                    prev.map((t) => (t.id === activeTab.id ? { ...t, running: true } : t))
                  )
                }
              }}
              className="px-2 py-0.5 text-[10px] font-semibold rounded bg-success-fg/80 text-white hover:bg-success-fg transition-colors normal-case tracking-normal"
            >
              RUN
            </button>
          )}
          {serverTabs.length > 1 && activeTab && activeTab.id !== serverTabs[0]?.id && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                requestCloseServerTab(activeTab.id)
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-fg-subtle hover:bg-danger-fg/20 hover:text-danger-fg transition-colors"
              title={`Close ${activeTab.name}`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Terminal area — all tabs rendered, inactive ones hidden for state preservation */}
      <div className={`flex-1 min-h-0 relative ${secondaryCollapsed ? 'hidden' : ''}`}>
        {serverTabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.id === activeServerTabId ? '' : 'hidden'}`}
          >
            <Terminal
              sessionId={tab.sessionId}
              onInput={handleServerInput}
              onTab={handleTabFromServer}
              focused={active && focusedPanel === 'server' && tab.id === activeServerTabId}
            />
          </div>
        ))}

        {/* Close confirm dialog — centered overlay */}
        {closeConfirmTabId && (() => {
          const tab = serverTabs.find((t) => t.id === closeConfirmTabId)
          if (!tab) return null
          return (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
              <div className="bg-bg-default border border-border-muted rounded-lg px-7 py-6 shadow-lg flex flex-col items-center gap-4 max-w-[320px]">
                <p className="text-sm text-fg-default text-center leading-relaxed">
                  {tab.running
                    ? <><span className="font-semibold text-danger-fg">{tab.name}</span> is running.<br/>Close anyway?</>
                    : <>Close <span className="font-semibold">{tab.name}</span>?</>
                  }
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelCloseServerTab() }}
                    className="px-4 py-1.5 text-xs rounded bg-bg-subtle text-fg-default hover:bg-border-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); confirmCloseServerTab() }}
                    className="px-4 py-1.5 text-xs rounded bg-danger-fg/90 text-white hover:bg-danger-fg transition-colors font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Tab settings dialog — centered overlay */}
        {settingsTabId && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <div
              className="bg-bg-default border border-border-muted rounded-lg px-5 py-4 shadow-lg flex flex-col gap-3 w-[280px]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-semibold text-fg-default">Tab Settings</p>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-fg-subtle uppercase tracking-wider">Name</span>
                  <input
                    type="text"
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTabSettings(); if (e.key === 'Escape') cancelTabSettings() }}
                    className="px-2 py-1 text-xs bg-bg-subtle border border-border-muted rounded text-fg-default outline-none focus:border-accent-fg"
                    autoFocus
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-fg-subtle uppercase tracking-wider">Command</span>
                  <input
                    type="text"
                    value={settingsCommand}
                    onChange={(e) => setSettingsCommand(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTabSettings(); if (e.key === 'Escape') cancelTabSettings() }}
                    placeholder="e.g. npm run dev"
                    className="px-2 py-1 text-xs font-mono bg-bg-subtle border border-border-muted rounded text-fg-default outline-none focus:border-accent-fg"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={cancelTabSettings}
                  className="px-3 py-1 text-[11px] rounded bg-bg-subtle text-fg-default hover:bg-border-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTabSettings}
                  className="px-3 py-1 text-[11px] rounded bg-accent-emphasis/90 text-white hover:bg-accent-emphasis transition-colors font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar — bottom */}
      <div className={`flex items-center h-9 min-h-[36px] max-h-[36px] border-t border-border-muted bg-bg-inset px-1.5 gap-0.5 overflow-x-auto ${secondaryCollapsed ? 'hidden' : ''}`}>
        {serverTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={(e) => {
              e.stopPropagation()
              setActiveServerTabId(tab.id)
            }}
            className={`flex items-center gap-1 px-2 h-6 text-[12px] rounded transition-colors shrink-0 ${
              tab.id === activeServerTabId
                ? `bg-[#9C86FF]/10 font-semibold ${tab.running ? 'text-success-fg' : 'text-[#9C86FF]'}`
                : `hover:bg-bg-subtle ${tab.running ? 'text-success-fg font-semibold' : 'text-fg-subtle'}`
            }`}
          >
            <span>{tab.name}</span>
          </button>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation()
            addServerTab()
          }}
          className="flex items-center justify-center w-6 h-6 text-[12px] text-fg-subtle hover:bg-bg-subtle rounded shrink-0"
          title="Add server tab"
        >
          +
        </button>
      </div>
    </div>
  )

  const renderPrompts = (style?: React.CSSProperties) => (
    <div
      className={`min-h-0 ${focusedPanel === 'prompts' ? focusRing : ''} ${rowsCollapsed ? 'border-t border-border-muted' : ''}`}
      style={style}
      onClick={() => setFocusedPanel('prompts')}
    >
      <PromptPanel projectId={project.id} onSelectPrompt={handleSelectPrompt} collapsed={secondaryCollapsed} headerMinimal={narrowCollapsed} />
    </div>
  )

  const collapsedPanelStyle = { height: 32, minHeight: 32, maxHeight: 32 } as const

  const renderRows = () => (
    <>
      {renderCLI(secondaryCollapsed ? { flex: 1 } : { height: `${panelSizes[0]}%` })}
      {!secondaryCollapsed && <ResizeHandle onResize={handleResize1} />}
      {renderServer(secondaryCollapsed ? collapsedPanelStyle : { height: `${panelSizes[1]}%` })}
      {!secondaryCollapsed && <ResizeHandle onResize={handleResize2} />}
      {renderPrompts(secondaryCollapsed ? collapsedPanelStyle : { height: `${panelSizes[2]}%` })}
    </>
  )

  const renderRightSplit = () => (
    <div className="flex-1 flex flex-row min-h-0">
      {/* Left: CLI */}
      {renderCLI({ width: `${splitRatio}%` })}
      {!secondaryCollapsed && (
        <ResizeHandle direction="horizontal" onResize={handleRightSplitPrimary} />
      )}
      {/* Right: Server (top) + Prompts (bottom) */}
      <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${secondaryCollapsed ? 'border-l border-border-muted overflow-hidden' : ''}`}>
        {renderServer({ height: `${secondarySplit}%` })}
        {!secondaryCollapsed && (
          <ResizeHandle onResize={handleRightSplitSecondary} />
        )}
        {renderPrompts({ flex: 1 })}
      </div>
    </div>
  )

  const renderBottomSplit = () => (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top: CLI */}
      {renderCLI(secondaryCollapsed ? { flex: 1 } : { height: `${splitRatio}%` })}
      {!secondaryCollapsed && (
        <ResizeHandle onResize={handleBottomSplitPrimary} />
      )}
      {/* Bottom: Server (left) + Prompts (right) */}
      <div
        className={`flex flex-row min-w-0 ${secondaryCollapsed ? 'border-t border-border-muted' : 'flex-1 min-h-0'}`}
        style={secondaryCollapsed ? { height: 32, minHeight: 32, maxHeight: 32 } : undefined}
      >
        {renderServer({ width: `${secondarySplit}%` })}
        {!secondaryCollapsed && (
          <ResizeHandle direction="horizontal" onResize={handleBottomSplitSecondary} />
        )}
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
