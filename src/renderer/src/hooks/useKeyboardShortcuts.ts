import { useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { useUIStore } from '../stores/uiStore'

interface ShortcutActions {
  onAddProject: () => void
  onToggleSidebar: () => void
  onFocusSearch: () => void
  onTogglePanelFocus: () => void
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
      if (!e.altKey || e.metaKey || e.ctrlKey) return

      // ⌥1~9,0: Switch project by visual order (0 = 10th)
      if (/^Digit[0-9]$/.test(e.code)) {
        const digit = parseInt(e.code.replace('Digit', ''))
        const index = digit === 0 ? 9 : digit - 1
        if (index < visualOrder.length) {
          e.preventDefault()
          setActiveProject(visualOrder[index].id)
        }
        return
      }

      switch (e.code) {
        // ⌥N: Add project
        case 'KeyN':
          e.preventDefault()
          actions.onAddProject()
          break

        // ⌥B: Toggle sidebar
        case 'KeyB':
          e.preventDefault()
          actions.onToggleSidebar()
          break

        // ⌥F: Focus prompt search
        case 'KeyF':
          e.preventDefault()
          actions.onFocusSearch()
          break

        // ⌥`: Toggle panel focus (CLI ↔ Server)
        case 'Backquote':
          e.preventDefault()
          actions.onTogglePanelFocus()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [projects, categories, setActiveProject, actions])
}
