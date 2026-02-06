import { useEffect, useState } from 'react'
import ProjectView from './ProjectView'
import { useProjectStore } from '../stores/projectStore'

export default function MainArea() {
  const { projects, activeProjectId } = useProjectStore()
  const [openedIds, setOpenedIds] = useState<Set<string>>(() => {
    return activeProjectId ? new Set([activeProjectId]) : new Set()
  })

  // Add newly active project to opened set
  useEffect(() => {
    if (activeProjectId) {
      setOpenedIds((prev) => {
        if (prev.has(activeProjectId)) return prev
        return new Set(prev).add(activeProjectId)
      })
    }
  }, [activeProjectId])

  // Clean up removed projects
  useEffect(() => {
    const existingIds = new Set(projects.map((p) => p.id))
    setOpenedIds((prev) => {
      const filtered = new Set([...prev].filter((id) => existingIds.has(id)))
      return filtered.size !== prev.size ? filtered : prev
    })
  }, [projects])

  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-canvas">
        <div className="text-center">
          <div className="text-[22px] font-bold text-fg-subtle mb-2">VeryTerm</div>
          <div className="text-[13px] text-fg-subtle mb-6">
            Select or add a project from the sidebar
          </div>
          <div className="text-[12px] text-fg-subtle space-y-1.5 font-mono">
            <div className="flex items-center justify-center gap-3">
              <kbd className="px-1.5 py-0.5 rounded bg-bg-subtle border border-border-default text-fg-muted text-[11px]">⌘N</kbd>
              <span>Add Project</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <kbd className="px-1.5 py-0.5 rounded bg-bg-subtle border border-border-default text-fg-muted text-[11px]">⌘1-9</kbd>
              <span>Switch Project</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <kbd className="px-1.5 py-0.5 rounded bg-bg-subtle border border-border-default text-fg-muted text-[11px]">Tab</kbd>
              <span>Switch Panel</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-canvas min-w-0">
      {projects
        .filter((p) => openedIds.has(p.id))
        .map((project) => (
          <ProjectView
            key={project.id}
            project={project}
            active={project.id === activeProjectId}
          />
        ))}
    </div>
  )
}
