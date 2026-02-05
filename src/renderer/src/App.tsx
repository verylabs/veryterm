import { useEffect, useCallback } from 'react'
import Titlebar from './components/Titlebar'
import Sidebar from './components/Sidebar'
import MainArea from './components/MainArea'
import { useProjectStore } from './stores/projectStore'
import { usePromptStore } from './stores/promptStore'
import { useUIStore } from './stores/uiStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  const { loadProjects, loaded: projectsLoaded, addProject } = useProjectStore()
  const { loadPrompts, loaded: promptsLoaded } = usePromptStore()
  const { toggleSidebar, setSearchFocused, cycleFocusedPanel, loadLayout } = useUIStore()

  useEffect(() => {
    loadProjects()
    loadPrompts()
    loadLayout()
  }, [loadProjects, loadPrompts, loadLayout])

  // Prevent Electron from opening dropped files — let Sidebar handle drops
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault()
    }
    document.addEventListener('dragover', prevent)
    document.addEventListener('drop', prevent)
    return () => {
      document.removeEventListener('dragover', prevent)
      document.removeEventListener('drop', prevent)
    }
  }, [])

  const handleAddProject = useCallback(async () => {
    const folderPath = await window.api.dialog.selectFolder()
    if (folderPath) {
      await addProject(folderPath)
    }
  }, [addProject])

  const handleFocusSearch = useCallback(() => {
    setSearchFocused(true)
  }, [setSearchFocused])

  const handleTogglePanelFocus = useCallback(() => {
    cycleFocusedPanel()
  }, [cycleFocusedPanel])

  useKeyboardShortcuts({
    onAddProject: handleAddProject,
    onToggleSidebar: toggleSidebar,
    onFocusSearch: handleFocusSearch,
    onTogglePanelFocus: handleTogglePanelFocus
  })

  if (!projectsLoaded || !promptsLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-canvas">
        <div className="text-fg-subtle text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-bg-canvas">
      <Titlebar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <MainArea />
      </div>
    </div>
  )
}
