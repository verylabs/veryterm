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
      {updateStatus && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-accent-emphasis/15 border-b border-accent-fg/20 text-[12px] shrink-0">
          <span className="text-fg-default">
            {updateStatus.state === 'downloaded'
              ? `v${updateStatus.version} 업데이트가 준비되었습니다. 앱을 재시작하면 적용됩니다.`
              : `v${updateStatus.version} 업데이트를 다운로드 중입니다...`}
          </span>
          <div className="flex items-center gap-2">
            {updateStatus.state === 'downloaded' && (
              <button
                onClick={() => window.api.updater.install()}
                className="px-3 py-0.5 rounded bg-accent-emphasis text-white hover:bg-accent-fg transition-colors text-[11px] font-medium"
              >
                지금 재시작
              </button>
            )}
            <button
              onClick={() => setUpdateStatus(null)}
              className="text-fg-subtle hover:text-fg-default transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <MainArea />
      </div>
    </div>
  )
}
