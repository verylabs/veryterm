import { useState, useCallback, useRef } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { useUIStore } from '../stores/uiStore'
import ProjectSettingsModal from './ProjectSettingsModal'
import type { Project } from '../types'

export default function Sidebar() {
  const { projects, activeProjectId, setActiveProject, addProject, removeProject } = useProjectStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const [settingsProject, setSettingsProject] = useState<Project | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleAddProject = useCallback(async () => {
    const folderPath = await window.api.dialog.selectFolder()
    if (folderPath) {
      await addProject(folderPath)
    }
  }, [addProject])

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeProject(id)
  }

  const handleSettings = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setSettingsProject(project)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files)
      for (const file of files) {
        const filePath = window.api.getPathForFile(file)
        if (filePath) {
          await addProject(filePath)
        }
      }
    },
    [addProject]
  )

  const getStatusStyle = (project: Project) => {
    if (project.color) return { backgroundColor: project.color }
    return {}
  }

  const getStatusClass = (project: Project) => {
    if (project.color) return ''
    return 'bg-fg-subtle'
  }

  // Collapsed sidebar
  if (sidebarCollapsed) {
    return (
      <div className="w-[48px] h-full bg-bg-default border-r border-border-muted flex flex-col items-center">
        <div className="h-8 flex items-center justify-center shrink-0 border-b border-border-muted w-full">
          <button
            onClick={toggleSidebar}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-subtle text-fg-subtle hover:text-fg-muted transition-colors text-xs"
            title="사이드바 펼치기 (⌘B)"
          >
            ▶
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 w-full">
          {projects.map((project, idx) => (
            <button
              key={project.id}
              onClick={() => setActiveProject(project.id)}
              className={`w-full h-9 flex items-center justify-center transition-colors ${
                activeProjectId === project.id
                  ? 'bg-bg-subtle text-fg-default'
                  : 'text-fg-subtle hover:bg-bg-subtle/50 hover:text-fg-muted'
              }`}
              title={`${project.name} (⌘${idx + 1})`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${getStatusClass(project)}`}
                style={getStatusStyle(project)}
              />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        ref={sidebarRef}
        className={`w-[250px] h-full bg-bg-default border-r border-border-muted flex flex-col transition-colors ${
          dragOver ? 'bg-bg-subtle border-accent-fg/40' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="h-8 flex items-center justify-between px-3 border-b border-border-muted shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[12px] font-semibold text-fg-default">Projects</span>
            <button
              onClick={handleAddProject}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-subtle hover:text-fg-default transition-colors text-sm"
              title="프로젝트 추가 (⌘N)"
            >
              +
            </button>
          </div>
          <button
            onClick={toggleSidebar}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-subtle hover:text-fg-muted transition-colors text-[10px]"
            title="사이드바 접기 (⌘B)"
          >
            ◀
          </button>
        </div>

        {/* Drop zone */}
        {dragOver && (
          <div className="px-4 py-3 text-center text-[12px] text-accent-fg bg-accent-emphasis/10 border-b border-accent-fg/20">
            폴더를 여기에 놓으세요
          </div>
        )}

        {/* Project List */}
        <div className="flex-1 overflow-y-auto py-1">
          {projects.length === 0 && (
            <div className="px-4 py-10 text-center text-fg-subtle text-[12px] leading-relaxed">
              프로젝트를 추가하거나<br />폴더를 드래그하세요
            </div>
          )}
          {projects.map((project: Project, idx) => (
            <div
              key={project.id}
              onClick={() => setActiveProject(project.id)}
              className={`group flex items-center gap-2.5 px-3 py-2 mx-1 rounded-md cursor-pointer transition-colors ${
                activeProjectId === project.id
                  ? 'bg-bg-subtle text-fg-default'
                  : 'text-fg-default hover:bg-bg-subtle/60 hover:text-fg-default'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${getStatusClass(project)}`}
                style={getStatusStyle(project)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{project.name}</div>
                <div className="text-[11px] text-fg-subtle truncate">
                  {project.projectType || 'project'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {project.hasCLAUDEmd && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-bg-subtle text-fg-subtle font-mono" title="CLAUDE.md">C</span>
                )}
                {idx < 9 && (
                  <span className="text-[10px] text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                    ⌘{idx + 1}
                  </span>
                )}
                <button
                  onClick={(e) => handleSettings(e, project)}
                  className="opacity-0 group-hover:opacity-100 text-fg-subtle hover:text-fg-muted text-[11px] transition-opacity p-0.5"
                  title="설정"
                >
                  ⚙
                </button>
                <button
                  onClick={(e) => handleRemove(e, project.id)}
                  className="opacity-0 group-hover:opacity-100 text-fg-subtle hover:text-danger-fg text-[11px] transition-opacity p-0.5"
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="h-8 border-t border-border-muted px-3 flex items-center shrink-0">
          <div className="flex items-center justify-between w-full text-xs text-fg-muted">
            <span>{projects.length} projects</span>
            <span className="font-mono">⌘B</span>
          </div>
        </div>
      </div>

      {settingsProject && (
        <ProjectSettingsModal
          project={settingsProject}
          onClose={() => setSettingsProject(null)}
        />
      )}
    </>
  )
}
