import { create } from 'zustand'

type FocusedPanel = 'main' | 'server' | 'prompts'
export type LayoutMode = 'rows' | 'right-split' | 'bottom-split'

interface LayoutData {
  layoutMode: LayoutMode
  panelSizes: [number, number, number]
  splitRatio: number
  secondarySplit: number
  notificationsEnabled?: boolean
}

interface UIState {
  sidebarCollapsed: boolean
  focusedPanel: FocusedPanel
  searchFocused: boolean
  settingsOpen: boolean
  serverRunning: Record<string, boolean> // projectId -> running
  cliWorking: Record<string, boolean> // projectId -> working (CLI outputting)
  notificationsEnabled: boolean

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
  setCLIWorking: (projectId: string, working: boolean) => void
  toggleNotifications: () => void
  setLayoutMode: (mode: LayoutMode) => void
  setSplitRatio: (ratio: number) => void
  setSecondarySplit: (ratio: number) => void
  loadLayout: () => Promise<void>
}

const PANEL_ORDER: FocusedPanel[] = ['main', 'server', 'prompts']
const LAYOUT_FILE = 'layout.json'

function saveLayout(state: { layoutMode: LayoutMode; panelSizes: [number, number, number]; splitRatio: number; secondarySplit: number; notificationsEnabled: boolean }): void {
  const data: LayoutData = {
    layoutMode: state.layoutMode,
    panelSizes: state.panelSizes,
    splitRatio: state.splitRatio,
    secondarySplit: state.secondarySplit,
    notificationsEnabled: state.notificationsEnabled
  }
  window.api.data.save(LAYOUT_FILE, data)
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  focusedPanel: 'main',
  searchFocused: false,
  settingsOpen: false,
  serverRunning: {},
  cliWorking: {},
  notificationsEnabled: true,
  panelSizes: [40, 30, 30],
  layoutMode: 'right-split',
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
  setPanelSizes: (sizes) => {
    set({ panelSizes: sizes })
    saveLayout({ ...get(), panelSizes: sizes })
  },
  setServerRunning: (projectId, running) =>
    set((s) => ({ serverRunning: { ...s.serverRunning, [projectId]: running } })),
  clearServerRunning: (projectId) =>
    set((s) => {
      const { [projectId]: _, ...rest } = s.serverRunning
      return { serverRunning: rest }
    }),
  setCLIWorking: (projectId, working) =>
    set((s) => ({ cliWorking: { ...s.cliWorking, [projectId]: working } })),
  toggleNotifications: () => {
    const next = !get().notificationsEnabled
    set({ notificationsEnabled: next })
    saveLayout({ ...get(), notificationsEnabled: next })
  },
  setLayoutMode: (mode) => {
    set({ layoutMode: mode })
    saveLayout({ ...get(), layoutMode: mode })
  },
  setSplitRatio: (ratio) => {
    const clamped = Math.max(20, Math.min(80, ratio))
    set({ splitRatio: clamped })
    saveLayout({ ...get(), splitRatio: clamped })
  },
  setSecondarySplit: (ratio) => {
    const clamped = Math.max(20, Math.min(80, ratio))
    set({ secondarySplit: clamped })
    saveLayout({ ...get(), secondarySplit: clamped })
  },

  loadLayout: async () => {
    const data = await window.api.data.load(LAYOUT_FILE) as LayoutData | null
    if (!data) return
    const updates: Partial<UIState> = {}
    if (data.layoutMode && ['rows', 'right-split', 'bottom-split'].includes(data.layoutMode)) {
      updates.layoutMode = data.layoutMode
    }
    if (Array.isArray(data.panelSizes) && data.panelSizes.length === 3) {
      updates.panelSizes = data.panelSizes
    }
    if (typeof data.splitRatio === 'number') {
      updates.splitRatio = Math.max(20, Math.min(80, data.splitRatio))
    }
    if (typeof data.secondarySplit === 'number') {
      updates.secondarySplit = Math.max(20, Math.min(80, data.secondarySplit))
    }
    if (typeof data.notificationsEnabled === 'boolean') {
      updates.notificationsEnabled = data.notificationsEnabled
    }
    set(updates)
  }
}))
