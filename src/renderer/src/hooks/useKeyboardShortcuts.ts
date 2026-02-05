import { useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { useUIStore } from '../stores/uiStore'

interface ShortcutActions {
  onAddProject: () => void
  onToggleSidebar: () => void
  onFocusSearch: () => void
  onTogglePanelFocus: () => void
}

const PANEL_MAP = ['main', 'server', 'prompts'] as const

export function useKeyboardShortcuts(actions: ShortcutActions) {
  const { projects, setActiveProject } = useProjectStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Option+1/2/3: Switch panel
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
          e.preventDefault()
          const idx = parseInt(e.code.replace('Digit', '')) - 1
          useUIStore.getState().setFocusedPanel(PANEL_MAP[idx])
          return
        }
      }

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
