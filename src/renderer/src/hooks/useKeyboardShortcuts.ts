import { useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'

interface ShortcutActions {
  onAddProject: () => void
  onToggleSidebar: () => void
  onFocusSearch: () => void
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  const { projects, categories, setActiveProject } = useProjectStore()

  useEffect(() => {
    // Build visual order: uncategorized first, then each category's projects
    const uncategorized = projects.filter((p) => !p.category)
    const categorized = categories.flatMap((cat) =>
      projects.filter((p) => p.category === cat.id)
    )
    const visualOrder = [...uncategorized, ...categorized]

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (!isMeta) return

      // ⌘1~9: Switch project by visual order
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1
        if (index < visualOrder.length) {
          e.preventDefault()
          setActiveProject(visualOrder[index].id)
        }
        return
      }

      switch (e.key) {
        // ⌘N: Add project
        case 'n':
          e.preventDefault()
          actions.onAddProject()
          break

        // ⌘B: Toggle sidebar
        case 'b':
          e.preventDefault()
          actions.onToggleSidebar()
          break

        // ⌘F: Focus prompt search
        case 'f':
          e.preventDefault()
          actions.onFocusSearch()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [projects, categories, setActiveProject, actions])
}
