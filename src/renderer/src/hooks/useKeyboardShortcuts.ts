import { useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'

interface ShortcutActions {
  onAddProject: () => void
  onToggleSidebar: () => void
  onFocusSearch: () => void
  onTogglePanelFocus: () => void
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  const { projects, setActiveProject } = useProjectStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      if (!isMeta) return

      // Cmd+1~9: Switch project by index
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1
        if (index < projects.length) {
          e.preventDefault()
          setActiveProject(projects[index].id)
        }
        return
      }

      switch (e.key) {
        // Cmd+N: Add project
        case 'n':
          e.preventDefault()
          actions.onAddProject()
          break

        // Cmd+B: Toggle sidebar
        case 'b':
          e.preventDefault()
          actions.onToggleSidebar()
          break

        // Cmd+F: Focus prompt search
        case 'f':
          e.preventDefault()
          actions.onFocusSearch()
          break

        // Cmd+`: Toggle panel focus
        case '`':
          e.preventDefault()
          actions.onTogglePanelFocus()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [projects, setActiveProject, actions])
}
