import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { usePromptStore } from '../stores/promptStore'
import { useUIStore } from '../stores/uiStore'

interface PromptPanelProps {
  projectId: string
  onSelectPrompt: (prompt: string) => void
}

export default function PromptPanel({ projectId, onSelectPrompt }: PromptPanelProps) {
  const { prompts, togglePin } = usePromptStore()
  const { searchFocused, setSearchFocused } = useUIStore()
  const [search, setSearch] = useState('')
  const [sortNewest, setSortNewest] = useState(true)
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
    const sorted = [...filtered].sort((a, b) => {
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      return sortNewest ? diff : -diff
    })
    return sorted
  }, [prompts, projectId, search, sortNewest])

  const pinned = projectPrompts.filter((p) => p.pinned)
  const unpinned = projectPrompts.filter((p) => !p.pinned)

  const formatTime = (ts: string) => {
    const date = new Date(ts)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = useCallback((e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [])

  const PromptItem = ({ prompt }: { prompt: typeof projectPrompts[0] }) => (
    <div className="px-3 py-1 mx-1">
      <div
        className="group relative min-w-0 bg-border-muted/20 border border-border-muted/60 rounded-lg px-3 py-2 cursor-pointer hover:border-border-default/80 transition-colors"
        onClick={() => onSelectPrompt(prompt.prompt)}
      >
        {/* Copy button */}
        <button
          onClick={(e) => handleCopy(e, prompt.id, prompt.prompt)}
          className="absolute top-1.5 right-1.5 text-[10px] px-1 py-0.5 rounded bg-bg-default/60 border border-border-muted text-fg-subtle hover:text-fg-default opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copiedId === prompt.id ? '✓' : '⧉'}
        </button>

        {/* Prompt text */}
        <div className="text-[12px] text-fg-default whitespace-pre-wrap break-words pr-5">{prompt.prompt}</div>

        {/* Bottom row: time + pin */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-fg-subtle">{formatTime(prompt.timestamp)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              togglePin(prompt.id)
            }}
            className={`text-[11px] transition-colors ${
              prompt.pinned ? 'text-attention-fg' : 'text-fg-subtle/40 hover:text-fg-subtle'
            }`}
            title={prompt.pinned ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            {prompt.pinned ? '★' : '☆'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-bg-inset">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 leading-none border-b border-border-muted bg-bg-default" style={{ height: 32, minHeight: 32, maxHeight: 32 }}>
        <span className="text-xs font-medium text-fg-subtle uppercase tracking-wider">Prompts</span>
        <button
          onClick={() => setSortNewest(!sortNewest)}
          className="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle border border-border-default text-fg-subtle hover:text-fg-default transition-colors"
          title={sortNewest ? '오래된 순' : '최신 순'}
        >
          {sortNewest ? '↓ 최신' : '↑ 과거'}
        </button>
        <div className="flex-1" />
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
          placeholder="⌘F 검색..."
          className="w-32 px-2 py-1 text-[11px] bg-bg-inset border border-border-default rounded-md text-fg-default placeholder-fg-subtle focus:outline-none focus:border-accent-fg/50"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {projectPrompts.length === 0 && (
          <div className="px-4 py-8 text-center text-fg-subtle text-[12px]">
            {search ? '검색 결과가 없습니다' : '아직 프롬프트가 없습니다'}
          </div>
        )}

        {pinned.length > 0 && (
          <>
            <div className="px-3 py-1 text-[10px] text-fg-subtle uppercase tracking-wider font-medium">
              Pinned
            </div>
            {pinned.map((p) => <PromptItem key={p.id} prompt={p} />)}
          </>
        )}

        {unpinned.length > 0 && (
          <>
            {pinned.length > 0 && (
              <div className="px-3 py-1 mt-1 text-[10px] text-fg-subtle uppercase tracking-wider font-medium">
                Recent
              </div>
            )}
            {unpinned.map((p) => <PromptItem key={p.id} prompt={p} />)}
          </>
        )}
      </div>
    </div>
  )
}
