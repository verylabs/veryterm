import { useMemo, useState, useEffect, useRef, useCallback, type MouseEvent } from 'react'
import { usePromptStore } from '../stores/promptStore'
import { useProjectStore } from '../stores/projectStore'
import { useUIStore } from '../stores/uiStore'

interface PromptPanelProps {
  projectId: string
  onSelectPrompt: (prompt: string) => void
}

export default function PromptPanel({ projectId, onSelectPrompt }: PromptPanelProps) {
  const { prompts, togglePin, removePrompt, clearPrompts } = usePromptStore()
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId))
  const { searchFocused, setSearchFocused } = useUIStore()
  const [search, setSearch] = useState('')
  const [pinnedSortNewest, setPinnedSortNewest] = useState(true)
  const [recentSortNewest, setRecentSortNewest] = useState(true)
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchFocused && searchRef.current) {
      searchRef.current.focus()
      searchRef.current.select()
      setSearchFocused(false)
    }
  }, [searchFocused, setSearchFocused])

  const projectPrompts = useMemo(() => {
    let filtered = prompts.filter((p) => p.projectId === projectId)
    if (search) {
      filtered = filtered.filter((p) =>
        p.prompt.toLowerCase().includes(search.toLowerCase())
      )
    }
    return filtered
  }, [prompts, projectId, search])

  const sortFn = (newest: boolean) => (a: typeof prompts[0], b: typeof prompts[0]) => {
    const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    return newest ? diff : -diff
  }

  const pinned = [...projectPrompts.filter((p) => p.pinned)].sort(sortFn(pinnedSortNewest))
  const unpinned = [...projectPrompts.filter((p) => !p.pinned)].sort(sortFn(recentSortNewest))

  const formatTime = (ts: string) => {
    const date = new Date(ts)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [])

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDownload = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      if (projectPrompts.length === 0 || !project) return

      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`

      const fmtTs = (ts: string) => {
        const d = new Date(ts)
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      }

      const renderItems = (items: typeof projectPrompts) =>
        items.map((p) => `_${fmtTs(p.timestamp)}_\n${p.prompt}`).join('\n\n')

      let md = `# ${project.name} — Prompt History\n\n`
      md += `- **Project**: ${project.name}\n`
      md += `- **Path**: ${project.path}\n`
      if (project.projectType) md += `- **Type**: ${project.projectType}\n`
      md += `- **Exported**: ${dateStr} ${timeStr}\n`
      md += `- **Total**: ${projectPrompts.length} prompts\n`

      if (pinned.length > 0) {
        md += `\n## Pinned\n\n${renderItems(pinned)}\n`
      }
      if (unpinned.length > 0) {
        md += `\n## Recent\n\n${renderItems(unpinned)}\n`
      }

      const safeName = project.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName}-prompts-${dateStr}.md`
      a.click()
      URL.revokeObjectURL(url)
    },
    [projectPrompts, pinned, unpinned, project]
  )

  const PromptItem = ({ prompt }: { prompt: typeof projectPrompts[0] }) => {
    const isExpanded = expandedIds.has(prompt.id)
    return (
    <div className="px-1.5 py-1 mx-1">
      <div
        className="group relative min-w-0 bg-bg-default border border-border-muted/60 rounded-lg px-3 py-2 cursor-default hover:border-border-default/80 transition-colors"
      >
        {/* Delete button */}
        <button
          onClick={() => removePrompt(prompt.id)}
          className="absolute top-1.5 right-1.5 text-[10px] w-4 h-4 flex items-center justify-center rounded bg-bg-default/60 border border-border-muted text-fg-subtle hover:text-danger-fg opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete"
        >
          ✕
        </button>

        {/* Prompt text */}
        <div
          onClick={() => toggleExpand(prompt.id)}
          className={`text-[12px] text-fg-default break-words pr-5 select-text cursor-pointer ${
            isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
          }`}
        >
          {prompt.prompt}
        </div>

        {/* Bottom row: time + actions */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-fg-subtle">{formatTime(prompt.timestamp)}</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onSelectPrompt(prompt.prompt)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-subtle text-[13px] text-fg-muted hover:text-accent-fg transition-colors"
              title="Send to terminal"
            >
              ▶
            </button>
            <button
              onClick={() => handleCopy(prompt.id, prompt.prompt)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-subtle text-[13px] text-fg-muted hover:text-fg-default transition-colors"
              title="Copy"
            >
              {copiedId === prompt.id ? '✓' : '⧉'}
            </button>
            <button
              onClick={() => togglePin(prompt.id)}
              className={`w-6 h-6 flex items-center justify-center rounded hover:bg-bg-subtle text-[13px] transition-colors ${
                prompt.pinned ? 'text-attention-fg' : 'text-fg-muted hover:text-fg-default'
              }`}
              title={prompt.pinned ? 'Unpin' : 'Pin'}
            >
              {prompt.pinned ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>
    </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg-inset">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 leading-none border-b border-border-muted bg-bg-default" style={{ height: 32, minHeight: 32, maxHeight: 32 }}>
        <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Prompts</span>
        <div className="flex-1" />
        <button
          onClick={handleDownload}
          disabled={projectPrompts.length === 0}
          className="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle border border-border-default text-fg-subtle hover:text-fg-default transition-colors disabled:opacity-30 disabled:cursor-default disabled:hover:text-fg-subtle"
          title="Download as Markdown"
        >
          Download
        </button>
        <button
          onClick={() => {
            if (unpinned.length > 0) setShowClearConfirm(true)
          }}
          className="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle border border-border-default text-fg-subtle hover:text-danger-fg transition-colors"
          title="Clear all prompts"
        >
          Clear
        </button>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearch('')
              searchRef.current?.blur()
            }
          }}
          placeholder="⌘F Search..."
          className="w-32 px-2 py-1 text-[11px] bg-bg-inset border border-border-default rounded-md text-fg-default placeholder-fg-subtle focus:outline-none focus:border-accent-fg/50"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {projectPrompts.length === 0 && (
          <div className="px-4 py-8 text-center text-fg-subtle text-[12px]">
            {search ? 'No results found' : 'No prompts yet'}
          </div>
        )}

        {pinned.length > 0 && (
          <>
            <div
              className="flex items-center justify-between px-3 py-1 cursor-pointer"
              onClick={() => setPinnedCollapsed(!pinnedCollapsed)}
            >
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-fg-subtle">{pinnedCollapsed ? '▶' : '▼'}</span>
                <span className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium">Pinned</span>
                <span className="text-[10px] text-fg-subtle">{pinned.length}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPinnedSortNewest(!pinnedSortNewest)
                }}
                className="text-[10px] text-fg-subtle hover:text-fg-default transition-colors"
                title={pinnedSortNewest ? 'Sort oldest first' : 'Sort newest first'}
              >
                {pinnedSortNewest ? '↓ Newest' : '↑ Oldest'}
              </button>
            </div>
            {!pinnedCollapsed && pinned.map((p) => <PromptItem key={p.id} prompt={p} />)}
          </>
        )}

        {unpinned.length > 0 && (
          <>
            <div className="flex items-center justify-between px-3 py-1 mt-1">
              <span className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium">Recent</span>
              <button
                onClick={() => setRecentSortNewest(!recentSortNewest)}
                className="text-[10px] text-fg-subtle hover:text-fg-default transition-colors"
                title={recentSortNewest ? 'Sort oldest first' : 'Sort newest first'}
              >
                {recentSortNewest ? '↓ Newest' : '↑ Oldest'}
              </button>
            </div>
            {unpinned.map((p) => <PromptItem key={p.id} prompt={p} />)}
          </>
        )}
      </div>

      {/* Clear confirm modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={() => setShowClearConfirm(false)}>
          <div
            className="bg-bg-overlay border border-border-default rounded-xl w-[320px] shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <div className="text-sm font-medium text-fg-default mb-2">Clear Prompts</div>
              <div className="text-xs text-fg-muted leading-relaxed">
                All prompts except pinned will be deleted.
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border-muted">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-1.5 text-xs text-fg-muted hover:text-fg-default rounded-lg hover:bg-bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearPrompts(projectId)
                  setShowClearConfirm(false)
                }}
                className="px-4 py-1.5 text-xs bg-danger-fg text-white rounded-lg hover:bg-danger-emphasis transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
