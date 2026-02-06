import { useState, useCallback, useRef, useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { usePromptStore } from '../stores/promptStore'
import { useUIStore } from '../stores/uiStore'
import ProjectSettingsModal from './ProjectSettingsModal'
import type { Project, Category } from '../types'

const DRAG_TYPE_PROJECT = 'application/x-vterm-project'

export default function Sidebar() {
  const {
    projects, categories, activeProjectId,
    setActiveProject, addProject, removeProject,
    addCategory, removeCategory, renameCategory,
    toggleCategoryCollapse, moveProjectToCategory, reorderProject
  } = useProjectStore()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const cliWorking = useUIStore((s) => s.cliWorking)

  const [settingsProject, setSettingsProject] = useState<Project | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null)
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null)
  const [folderDragOver, setFolderDragOver] = useState(false)
  const [dropTargetId, setDropTargetId] = useState<string | null | undefined>(undefined)
  const [dropIndicator, setDropIndicator] = useState<{ projectId: string; position: 'before' | 'after' } | null>(null)
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

  const { removeProjectPrompts } = usePromptStore()

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeProject(id)
  }

  const handleSettings = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setSettingsProject(project)
  }

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, project })
  }

  const handleDuplicate = (project: Project) => {
    addProject(project.path)
    setContextMenu(null)
  }

  const handleRemoveFromList = (project: Project) => {
    setDeleteConfirmProject(project)
    setContextMenu(null)
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

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

  // Project drag-drop (categorize + reorder)
  const handleProjectDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData(DRAG_TYPE_PROJECT, projectId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleProjectDragOver = (e: React.DragEvent, targetProjectId: string) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE_PROJECT)) return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = e.clientY < midY ? 'before' : 'after'
    setDropIndicator({ projectId: targetProjectId, position })
    setDropTargetId(undefined)
  }

  const handleProjectDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE_PROJECT)) return
    e.preventDefault()
    e.stopPropagation()
    setDropIndicator(null)
  }

  const handleProjectDrop = (e: React.DragEvent, targetProjectId: string) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE_PROJECT)) return
    e.preventDefault()
    e.stopPropagation()
    const projectId = e.dataTransfer.getData(DRAG_TYPE_PROJECT)
    if (projectId && projectId !== targetProjectId) {
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const position = e.clientY < midY ? 'before' : 'after'
      reorderProject(projectId, targetProjectId, position)
    }
    setDropIndicator(null)
    setDropTargetId(undefined)
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
    setDropIndicator(null)
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
      className="relative"
      onDragOver={(e) => handleProjectDragOver(e, project.id)}
      onDragLeave={handleProjectDragLeave}
      onDrop={(e) => handleProjectDrop(e, project.id)}
    >
      {dropIndicator?.projectId === project.id && dropIndicator.position === 'before' && (
        <div className="absolute top-0 left-2 right-2 h-[2px] bg-accent-fg rounded-full z-10" />
      )}
    <div
      draggable
      onDragStart={(e) => handleProjectDragStart(e, project.id)}
      onClick={() => setActiveProject(project.id)}
      onContextMenu={(e) => handleContextMenu(e, project)}
      className={`group flex items-center gap-2.5 pl-3 pr-0.5 py-2 mx-1 rounded-md cursor-pointer transition-colors ${
        activeProjectId === project.id
          ? 'bg-bg-subtle text-fg-default'
          : 'text-fg-default hover:bg-bg-subtle/60 hover:text-fg-default'
      }`}
    >
      <div className="relative w-7 h-7 shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm overflow-hidden"
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
        {cliWorking[project.id] !== undefined && (
          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-default ${
            cliWorking[project.id] ? 'bg-success-fg animate-pulse' : 'bg-danger-fg'
          }`} />
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
          <span className="flex items-center text-fg-subtle font-mono">
            <span className="text-[15px] leading-none">⌘</span><span className="text-[11px] leading-none">{idx + 1}</span>
          </span>
        )}
        <button
          onClick={(e) => handleSettings(e, project)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-fg-subtle hover:text-fg-default hover:bg-bg-subtle/80 text-[16px] leading-none -translate-y-[1px] transition-colors"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </div>
      {dropIndicator?.projectId === project.id && dropIndicator.position === 'after' && (
        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent-fg rounded-full z-10" />
      )}
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
            title="Expand sidebar (⌘B)"
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
              <div className="relative">
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
                {cliWorking[project.id] !== undefined && (
                  <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-default ${
                    cliWorking[project.id] ? 'bg-success-fg animate-pulse' : 'bg-danger-fg'
                  }`} />
                )}
              </div>
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
              title="Add project (⌘N)"
            >
              +
            </button>
          </div>
          <button
            onClick={toggleSidebar}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-bg-subtle text-fg-subtle hover:text-fg-muted transition-colors text-[10px]"
            title="Collapse sidebar (⌘B)"
          >
            ◀
          </button>
        </div>

        {/* Drop zone hint for folder drag */}
        {folderDragOver && (
          <div className="px-4 py-3 text-center text-[12px] text-accent-fg bg-accent-emphasis/10 border-b border-accent-fg/20">
            Drop folder here
          </div>
        )}

        {/* Project List with Categories */}
        <div className="flex-1 overflow-y-auto py-1">
          {projects.length === 0 && categories.length === 0 && (
            <div className="px-4 py-10 text-center text-fg-subtle text-[12px] leading-relaxed">
              Drop folder here<br />to add project
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
                      {cat.name}<span className="text-[10px] text-fg-subtle font-normal ml-1">({catProjects.length})</span>
                    </span>
                  )}

                  <button
                    onClick={(e) => handleRemoveCategory(e, cat.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-fg-subtle hover:text-danger-fg hover:bg-danger-subtle/30 transition-colors text-[11px] opacity-0 group-hover/cat:opacity-100"
                    title="Delete category"
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
                        Drag projects here
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
                placeholder="Category name"
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
            <span>Add Category</span>
          </button>

          {/* Drop hint in empty space */}
          {projects.length > 0 && (
            <div className="flex-1 min-h-[60px] flex items-end justify-center pb-3">
              <span className="text-[11px] text-fg-subtle">Drop folder here to add project</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-8 border-t border-border-muted px-3 flex items-center shrink-0">
          <div className="flex items-center justify-between w-full text-fg-subtle">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.api.shell.openExternal('https://www.verylabs.io') }}
              className="text-[10px] text-fg-subtle hover:text-fg-muted transition-colors cursor-pointer"
            >
              Powered by VeryLabs
            </a>
            <div className="flex items-center gap-2 font-mono">
              <span className="flex items-center"><span className="text-[15px] leading-none">⌘</span><span className="text-[11px] leading-none">1-9</span></span>
              <span className="flex items-center"><span className="text-[15px] leading-none">⌘</span><span className="text-[11px] leading-none">B</span></span>
            </div>
          </div>
        </div>
      </div>

      {settingsProject && (
        <ProjectSettingsModal
          project={settingsProject}
          onClose={() => setSettingsProject(null)}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-bg-overlay border border-border-default rounded-lg shadow-2xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleDuplicate(contextMenu.project)}
            className="w-full px-3 py-1.5 text-left text-xs text-fg-default hover:bg-bg-subtle transition-colors"
          >
            Duplicate
          </button>
          <div className="my-1 border-t border-border-muted" />
          <button
            onClick={() => handleRemoveFromList(contextMenu.project)}
            className="w-full px-3 py-1.5 text-left text-xs text-danger-fg hover:bg-danger-subtle/20 transition-colors"
          >
            Remove from List
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onMouseDown={() => setDeleteConfirmProject(null)}
        >
          <div
            className="bg-bg-overlay border border-border-default rounded-xl w-[360px] shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border-muted">
              <h3 className="text-sm font-medium text-fg-default">Remove Project</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-fg-muted leading-relaxed">
                The actual folder will not be deleted. Only the project will be removed from VTerm.
              </p>
              <p className="text-xs text-danger-fg leading-relaxed">
                All saved prompts for this project will be permanently deleted.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-muted">
              <button
                onClick={() => setDeleteConfirmProject(null)}
                className="px-4 py-1.5 text-xs text-fg-muted hover:text-fg-default rounded-lg hover:bg-bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  removeProjectPrompts(deleteConfirmProject.id)
                  removeProject(deleteConfirmProject.id)
                  setDeleteConfirmProject(null)
                }}
                className="px-4 py-1.5 text-xs bg-danger-emphasis text-white rounded-lg hover:bg-danger-fg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
