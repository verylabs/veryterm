import { useProjectStore } from '../stores/projectStore'
import { useUIStore, type LayoutMode } from '../stores/uiStore'

function LayoutIcon({ mode, active }: { mode: LayoutMode; active: boolean }) {
  const color = active ? 'text-accent-fg' : 'text-fg-subtle'

  if (mode === 'rows') {
    // Three horizontal rows
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className={color}>
        <rect x="1" y="1" width="12" height="3" rx="0.5" fill="currentColor" />
        <rect x="1" y="5.5" width="12" height="3" rx="0.5" fill="currentColor" />
        <rect x="1" y="10" width="12" height="3" rx="0.5" fill="currentColor" />
      </svg>
    )
  }

  if (mode === 'right-split') {
    // Left panel | Right top + Right bottom (ㅏ shape)
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className={color}>
        <rect x="1" y="1" width="5.5" height="12" rx="0.5" fill="currentColor" />
        <rect x="7.5" y="1" width="5.5" height="5.5" rx="0.5" fill="currentColor" />
        <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="0.5" fill="currentColor" />
      </svg>
    )
  }

  // bottom-split: Top panel / Bottom left + Bottom right (ㅜ shape)
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className={color}>
      <rect x="1" y="1" width="12" height="5.5" rx="0.5" fill="currentColor" />
      <rect x="1" y="7.5" width="5.5" height="5.5" rx="0.5" fill="currentColor" />
      <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="0.5" fill="currentColor" />
    </svg>
  )
}

export default function Titlebar() {
  const { projects, activeProjectId } = useProjectStore()
  const serverRunning = useUIStore((s) => activeProjectId ? s.serverRunning[activeProjectId] : false)
  const layoutMode = useUIStore((s) => s.layoutMode)
  const setLayoutMode = useUIStore((s) => s.setLayoutMode)
  const activeProject = projects.find((p) => p.id === activeProjectId)

  const layouts: LayoutMode[] = ['rows', 'right-split', 'bottom-split']

  return (
    <div className="titlebar-drag h-[38px] bg-bg-inset border-b border-border-default flex items-center shrink-0">
      {/* macOS traffic lights */}
      <div className="w-[78px] shrink-0" />

      {/* Project name */}
      <span className="titlebar-no-drag text-[13px] font-semibold text-fg-muted">
        {activeProject?.name || 'No Project'}
      </span>

      {/* Path */}
      {activeProject && (
        <span className="titlebar-no-drag text-[11px] text-fg-subtle ml-2 truncate max-w-[400px]">
          {activeProject.path}
        </span>
      )}

      {/* Project type */}
      {activeProject?.projectType && (
        <span className="titlebar-no-drag text-[11px] text-fg-muted ml-3 px-1.5 py-0.5 rounded bg-bg-subtle">
          {activeProject.projectType}
        </span>
      )}

      {/* Server status */}
      {activeProject && serverRunning && (
        <span className="titlebar-no-drag flex items-center gap-1.5 ml-3 text-[11px] text-success-fg">
          <span className="w-1.5 h-1.5 rounded-full bg-success-fg animate-pulse" />
          Server
        </span>
      )}

      <div className="flex-1" />

      {/* Layout switch buttons */}
      <div className="titlebar-no-drag flex items-center gap-1 mr-4">
        {layouts.map((mode) => (
          <button
            key={mode}
            onClick={() => setLayoutMode(mode)}
            className="p-1 rounded hover:bg-bg-subtle transition-colors"
            title={mode}
          >
            <LayoutIcon mode={mode} active={layoutMode === mode} />
          </button>
        ))}
      </div>
    </div>
  )
}
