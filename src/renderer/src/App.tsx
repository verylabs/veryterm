import { useEffect, useCallback, useState } from 'react'
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
  const { toggleSidebar, setSearchFocused, loadLayout } = useUIStore()
  const [updateStatus, setUpdateStatus] = useState<{ state: 'available' | 'downloaded'; version: string } | null>(null)

  useEffect(() => {
    loadProjects()
    loadPrompts()
    loadLayout()
  }, [loadProjects, loadPrompts, loadLayout])

  // Auto-updater notifications
  useEffect(() => {
    const offAvailable = window.api.updater.onUpdateAvailable((version) => {
      setUpdateStatus({ state: 'available', version })
    })
    const offDownloaded = window.api.updater.onUpdateDownloaded((version) => {
      setUpdateStatus({ state: 'downloaded', version })
    })
    return () => { offAvailable(); offDownloaded() }
  }, [])

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

  useKeyboardShortcuts({
    onAddProject: handleAddProject,
    onToggleSidebar: toggleSidebar,
    onFocusSearch: handleFocusSearch
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
      {/* Update toast — top center */}
      {updateStatus && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-bg-default border border-border-muted rounded-full shadow-lg px-5 py-2 flex items-center gap-3">
          <span className="text-[12px] text-fg-default whitespace-nowrap">
            {updateStatus.state === 'downloaded'
              ? `v${updateStatus.version} 업데이트 준비 완료`
              : `v${updateStatus.version} 다운로드 중...`}
          </span>
          {updateStatus.state === 'downloaded' && (
            <button
              onClick={() => window.api.updater.install()}
              className="px-3 py-0.5 rounded-full bg-accent-emphasis text-white hover:bg-accent-fg transition-colors text-[11px] font-medium whitespace-nowrap"
            >
              재시작
            </button>
          )}
          <button
            onClick={() => setUpdateStatus(null)}
            className="text-fg-subtle hover:text-fg-default transition-colors text-[11px] shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
