import { useState, useCallback, useRef } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { useUIStore } from '../stores/uiStore'
import ProjectSettingsModal from './ProjectSettingsModal'
import type { Project, Category } from '../types'

const DRAG_TYPE_PROJECT = 'application/x-vterm-project'

export default function Sidebar() {
  const {
    projects, categories, activeProjectId,
    setActiveProject, addProject, removeProject,
    addCategory, removeCategory, renameCategory,
    toggleCategoryCollapse, moveProjectToCategory
  } = useProjectStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const [settingsProject, setSettingsProject] = useState<Project | null>(null)
  const [folderDragOver, setFolderDragOver] = useState(false)
  const [dropTargetId, setDropTargetId] = useState<string | null | undefined>(undefined)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const sidebarRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const newCategoryInputRef = useRef<HTMLInputElement>(null)

  const uncategorizedProjects = projects.filter((p) => !p.category)
  const getProjectsInCategory = (catId: string) => projects.filter((p) => p.category === catId)

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

  // Folder drag-drop (add project from Finder)
  const handleFolderDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_TYPE_PROJECT)) return
    e.preventDefault()
    e.stopPropagation()
    setFolderDragOver(true)
  }, [])

  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFolderDragOver(false)
  }, [])

  const handleFolderDrop = useCallback(
    async (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG_TYPE_PROJECT)) return
      e.preventDefault()
      e.stopPropagation()
      setFolderDragOver(false)
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

  // Project drag-drop (categorize)
  const handleProjectDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData(DRAG_TYPE_PROJECT, projectId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCategoryDragOver = (e: React.DragEvent, targetId: string | null) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE_PROJECT)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTargetId(targetId)
  }

  const handleCategoryDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE_PROJECT)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTargetId(undefined)
  }

  const handleCategoryDrop = (e: React.DragEvent, categoryId: string | null) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE_PROJECT)) return
    e.preventDefault()
    e.stopPropagation()
    const projectId = e.dataTransfer.getData(DRAG_TYPE_PROJECT)
    if (projectId) {
      moveProjectToCategory(projectId, categoryId)
    }
    setDropTargetId(undefined)
  }

  // Category rename
  const startRenaming = (cat: Category) => {
    setEditingCategoryId(cat.id)
    setEditingName(cat.name)
    setTimeout(() => editInputRef.current?.select(), 0)
  }

  const commitRename = () => {
    if (editingCategoryId && editingName.trim()) {
      renameCategory(editingCategoryId, editingName.trim())
    }
    setEditingCategoryId(null)
    setEditingName('')
  }

  // New category
  const handleAddCategory = () => {
    setShowNewCategory(true)
    setNewCategoryName('')
    setTimeout(() => newCategoryInputRef.current?.focus(), 0)
  }

  const commitNewCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim())
    }
    setShowNewCategory(false)
    setNewCategoryName('')
  }

  const handleRemoveCategory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeCategory(id)
  }

  const getStatusStyle = (project: Project) => {
    if (project.color) return { backgroundColor: project.color }
    return {}
  }

  const getStatusClass = (project: Project) => {
    if (project.color) return ''
    return 'bg-fg-subtle'
  }

  // Render a single project item
  const renderProject = (project: Project, idx: number) => (
    <div
      key={project.id}
      draggable
      onDragStart={(e) => handleProjectDragStart(e, project.id)}
      onClick={() => setActiveProject(project.id)}
      className={`group flex items-center gap-2.5 pl-3 pr-0.5 py-2 mx-1 rounded-md cursor-pointer transition-colors ${
        activeProjectId === project.id
          ? 'bg-bg-subtle text-fg-default'
          : 'text-fg-default hover:bg-bg-subtle/60 hover:text-fg-default'
      }`}
    >
      <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-sm overflow-hidden"
        style={project.color ? { backgroundColor: project.color + '22', color: project.color } : undefined}
      >
        {project.icon?.startsWith('data:') ? (
          <img src={project.icon} alt="" className="w-full h-full object-cover" />
        ) : project.icon ? (
          project.icon
        ) : (
          <div
            className={`w-2 h-2 rounded-full ${getStatusClass(project)}`}
            style={getStatusStyle(project)}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{project.name}</div>
        <div className="text-[11px] text-fg-subtle truncate font-mono">
          /{project.path.split('/').pop()}
        </div>
      </div>
      <div className="flex items-center shrink-0">
        {idx < 9 && (
          <span className="text-[13px] text-fg-subtle font-mono">
            ⌘{idx + 1}
          </span>
        )}
        <button
          onClick={(e) => handleSettings(e, project)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg-default hover:bg-bg-subtle/80 text-[20px] transition-colors"
          title="설정"
        >
          ⚙
        </button>
      </div>
    </div>
  )

  // Global shortcut index counter
  let globalIdx = 0

  // Collapsed sidebar — unchanged
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
              className={`w-full h-11 flex items-center justify-center transition-colors ${
                activeProjectId === project.id
                  ? 'bg-bg-subtle text-fg-default'
                  : 'text-fg-subtle hover:bg-bg-subtle/50 hover:text-fg-muted'
              }`}
              title={`${project.name} (⌘${idx + 1})`}
            >
              {project.icon?.startsWith('data:') ? (
                <img src={project.icon} alt="" className="w-7 h-7 rounded-lg object-cover" />
              ) : project.icon ? (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={project.color ? { backgroundColor: project.color + '22', color: project.color } : undefined}
                >
                  {project.icon}
                </div>
              ) : (
                <div
                  className={`w-2.5 h-2.5 rounded-full ${getStatusClass(project)}`}
                  style={getStatusStyle(project)}
                />
              )}
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
          folderDragOver ? 'bg-bg-subtle border-accent-fg/40' : ''
        }`}
        onDragOver={handleFolderDragOver}
        onDragLeave={handleFolderDragLeave}
        onDrop={handleFolderDrop}
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

        {/* Drop zone hint for folder drag */}
        {folderDragOver && (
          <div className="px-4 py-3 text-center text-[12px] text-accent-fg bg-accent-emphasis/10 border-b border-accent-fg/20">
            폴더를 여기에 놓으세요
          </div>
        )}

        {/* Project List with Categories */}
        <div className="flex-1 overflow-y-auto py-1">
          {projects.length === 0 && categories.length === 0 && (
            <div className="px-4 py-10 text-center text-fg-subtle text-[12px] leading-relaxed">
              프로젝트를 추가하거나<br />폴더를 드래그하세요
            </div>
          )}

          {/* Uncategorized projects */}
          {uncategorizedProjects.length > 0 && (
            <div
              onDragOver={(e) => handleCategoryDragOver(e, null)}
              onDragLeave={handleCategoryDragLeave}
              onDrop={(e) => handleCategoryDrop(e, null)}
            >
              {uncategorizedProjects.map((project) => {
                const idx = globalIdx++
                return renderProject(project, idx)
              })}
            </div>
          )}

          {/* Categories */}
          {categories.map((cat) => {
            const catProjects = getProjectsInCategory(cat.id)
            const isDropTarget = dropTargetId === cat.id

            return (
              <div key={cat.id} className="mt-1">
                {/* Category header */}
                <div
                  onDragOver={(e) => handleCategoryDragOver(e, cat.id)}
                  onDragLeave={handleCategoryDragLeave}
                  onDrop={(e) => handleCategoryDrop(e, cat.id)}
                  className={`group/cat flex items-center gap-1 px-2 py-1.5 mx-1 rounded-md cursor-pointer transition-colors ${
                    isDropTarget
                      ? 'bg-accent-emphasis/15 ring-1 ring-accent-fg/30'
                      : 'hover:bg-bg-subtle/40'
                  }`}
                  onClick={() => toggleCategoryCollapse(cat.id)}
                >
                  <span className="text-[10px] text-fg-subtle w-3 text-center shrink-0">
                    {cat.collapsed ? '▶' : '▼'}
                  </span>

                  {editingCategoryId === cat.id ? (
                    <input
                      ref={editInputRef}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') {
                          setEditingCategoryId(null)
                          setEditingName('')
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 text-[12px] font-semibold bg-bg-subtle border border-border-muted rounded px-1 py-0 text-fg-default outline-none focus:border-accent-fg"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 min-w-0 text-[12px] font-semibold text-fg-muted truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        startRenaming(cat)
                      }}
                    >
                      {cat.name}
                    </span>
                  )}

                  <span className="text-[10px] text-fg-subtle tabular-nums">{catProjects.length}</span>

                  <button
                    onClick={(e) => handleRemoveCategory(e, cat.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-fg-subtle hover:text-danger-fg hover:bg-danger-subtle/30 transition-colors text-[11px] opacity-0 group-hover/cat:opacity-100"
                    title="카테고리 삭제"
                  >
                    ✕
                  </button>
                </div>

                {/* Category projects */}
                {!cat.collapsed && (
                  <div
                    onDragOver={(e) => handleCategoryDragOver(e, cat.id)}
                    onDragLeave={handleCategoryDragLeave}
                    onDrop={(e) => handleCategoryDrop(e, cat.id)}
                    className={`${
                      isDropTarget && catProjects.length === 0
                        ? 'min-h-[36px] border border-dashed border-accent-fg/30 rounded-md mx-2 mb-1'
                        : ''
                    }`}
                  >
                    {catProjects.map((project) => {
                      const idx = globalIdx++
                      return renderProject(project, idx)
                    })}
                    {catProjects.length === 0 && !isDropTarget && (
                      <div className="px-4 py-2 text-[11px] text-fg-subtle italic">
                        프로젝트를 드래그하세요
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Uncategorized drop zone when all projects are categorized */}
          {uncategorizedProjects.length === 0 && categories.length > 0 && (
            <div
              onDragOver={(e) => handleCategoryDragOver(e, null)}
              onDragLeave={handleCategoryDragLeave}
              onDrop={(e) => handleCategoryDrop(e, null)}
              className={`mx-2 mt-1 rounded-md transition-colors ${
                dropTargetId === null
                  ? 'min-h-[36px] border border-dashed border-accent-fg/30 bg-accent-emphasis/5'
                  : 'min-h-[8px]'
              }`}
            />
          )}

          {/* New category input */}
          {showNewCategory && (
            <div className="flex items-center gap-1 px-2 py-1 mx-1 mt-1">
              <span className="text-[10px] text-fg-subtle w-3 text-center shrink-0">▼</span>
              <input
                ref={newCategoryInputRef}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onBlur={commitNewCategory}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitNewCategory()
                  if (e.key === 'Escape') {
                    setShowNewCategory(false)
                    setNewCategoryName('')
                  }
                }}
                placeholder="카테고리 이름"
                className="flex-1 min-w-0 text-[12px] font-semibold bg-bg-subtle border border-border-muted rounded px-1 py-0.5 text-fg-default outline-none focus:border-accent-fg placeholder:text-fg-subtle/50"
                autoFocus
              />
            </div>
          )}

          {/* Add category button */}
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-1 px-3 py-1.5 mx-1 mt-1 rounded-md text-[11px] text-fg-subtle hover:text-fg-muted hover:bg-bg-subtle/40 transition-colors w-[calc(100%-8px)]"
          >
            <span className="text-sm">+</span>
            <span>카테고리 추가</span>
          </button>
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
