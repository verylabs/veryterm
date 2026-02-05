import { create } from 'zustand'

type FocusedPanel = 'main' | 'server' | 'prompts'
export type LayoutMode = 'rows' | 'right-split' | 'bottom-split'

interface UIState {
  sidebarCollapsed: boolean
  focusedPanel: FocusedPanel
  searchFocused: boolean
  settingsOpen: boolean
  serverRunning: Record<string, boolean> // projectId -> running

  // Panel heights as percentages (must sum to 100)
  panelSizes: [number, number, number] // [main, server, prompts]

  // Layout mode
  layoutMode: LayoutMode
  splitRatio: number // primary split ratio (%), default 50
  secondarySplit: number // secondary area split ratio (%), default 50

  toggleSidebar: () => void
  setFocusedPanel: (panel: FocusedPanel) => void
  cycleFocusedPanel: () => void
  setSearchFocused: (focused: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setPanelSizes: (sizes: [number, number, number]) => void
  setServerRunning: (projectId: string, running: boolean) => void
  clearServerRunning: (projectId: string) => void
  setLayoutMode: (mode: LayoutMode) => void
  setSplitRatio: (ratio: number) => void
  setSecondarySplit: (ratio: number) => void
}

const PANEL_ORDER: FocusedPanel[] = ['main', 'server', 'prompts']

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  focusedPanel: 'main',
  searchFocused: false,
  settingsOpen: false,
  serverRunning: {},
  panelSizes: [40, 30, 30],
  layoutMode: 'rows',
  splitRatio: 50,
  secondarySplit: 50,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setFocusedPanel: (panel) => set({ focusedPanel: panel }),

  cycleFocusedPanel: () => {
    const { focusedPanel } = get()
    const idx = PANEL_ORDER.indexOf(focusedPanel)
    const next = PANEL_ORDER[(idx + 1) % PANEL_ORDER.length]
    set({ focusedPanel: next })
  },

  setSearchFocused: (focused) => set({ searchFocused: focused }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setPanelSizes: (sizes) => set({ panelSizes: sizes }),
  setServerRunning: (projectId, running) =>
    set((s) => ({ serverRunning: { ...s.serverRunning, [projectId]: running } })),
  clearServerRunning: (projectId) =>
    set((s) => {
      const { [projectId]: _, ...rest } = s.serverRunning
      return { serverRunning: rest }
    }),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setSplitRatio: (ratio) => set({ splitRatio: Math.max(20, Math.min(80, ratio)) }),
  setSecondarySplit: (ratio) => set({ secondarySplit: Math.max(20, Math.min(80, ratio)) })
}))
