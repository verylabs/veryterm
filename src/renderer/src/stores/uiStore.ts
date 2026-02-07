import { create } from 'zustand'

type FocusedPanel = 'main' | 'server' | 'prompts'
export type LayoutMode = 'rows' | 'right-split' | 'bottom-split'
export type ThemeId = 'gray' | 'blue' | 'green' | 'purple'

interface ThemePalette {
  label: string
  dot: string
  vars: Record<string, string>
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  gray: {
    label: 'Deep Gray',
    dot: '#8B949E',
    vars: {
      '--color-bg-canvas': '#1d2125',
      '--color-bg-default': '#24292e',
      '--color-bg-subtle': '#2f363d',
      '--color-bg-inset': '#191d21',
      '--color-bg-overlay': '#2f363d',
      '--color-border-default': '#444d56',
      '--color-border-muted': '#363b42',
      '--color-border-subtle': '#2f363d',
      '--color-fg-default': '#e1e4e8',
      '--color-fg-muted': '#959da5',
      '--color-fg-subtle': '#6a737d',
      '--color-terminal-bg': '#1f2529'
    }
  },
  blue: {
    label: 'Deep Blue',
    dot: '#4A9EFF',
    vars: {
      '--color-bg-canvas': '#17212b',
      '--color-bg-default': '#1e2c3a',
      '--color-bg-subtle': '#253545',
      '--color-bg-inset': '#19222D',
      '--color-bg-overlay': '#253545',
      '--color-border-default': '#344558',
      '--color-border-muted': '#2b3a4a',
      '--color-border-subtle': '#253545',
      '--color-fg-default': '#e1e4e8',
      '--color-fg-muted': '#8b9bab',
      '--color-fg-subtle': '#5d7189',
      '--color-terminal-bg': '#19222D'
    }
  },
  green: {
    label: 'Deep Green',
    dot: '#3FB950',
    vars: {
      '--color-bg-canvas': '#1a2320',
      '--color-bg-default': '#212e28',
      '--color-bg-subtle': '#2a3b33',
      '--color-bg-inset': '#151e1a',
      '--color-bg-overlay': '#2a3b33',
      '--color-border-default': '#3d5247',
      '--color-border-muted': '#33483f',
      '--color-border-subtle': '#2a3b33',
      '--color-fg-default': '#e1e4e8',
      '--color-fg-muted': '#8da89a',
      '--color-fg-subtle': '#5c7d6c',
      '--color-terminal-bg': '#1a2620'
    }
  },
  purple: {
    label: 'Deep Purple',
    dot: '#9C86FF',
    vars: {
      '--color-bg-canvas': '#1e1d26',
      '--color-bg-default': '#26242f',
      '--color-bg-subtle': '#322f3e',
      '--color-bg-inset': '#18171f',
      '--color-bg-overlay': '#322f3e',
      '--color-border-default': '#4a4557',
      '--color-border-muted': '#3e3a4b',
      '--color-border-subtle': '#322f3e',
      '--color-fg-default': '#e1e4e8',
      '--color-fg-muted': '#9b95aa',
      '--color-fg-subtle': '#6e6881',
      '--color-terminal-bg': '#1e1d27'
    }
  }
}

const FRAME_BG: Record<ThemeId, string> = {
  gray: '#0a0a0a',
  blue: '#0a1018',
  green: '#0a120e',
  purple: '#0e0d14'
}

function applyTheme(id: ThemeId): void {
  const palette = THEMES[id]
  const root = document.documentElement
  for (const [key, value] of Object.entries(palette.vars)) {
    root.style.setProperty(key, value)
  }
  window.api.theme.setFrameBg(FRAME_BG[id])
}

interface LayoutData {
  layoutMode: LayoutMode
  panelSizes: [number, number, number]
  splitRatio: number
  secondarySplit: number
  secondaryCollapsed?: boolean
  savedSplitRatio?: number
  notificationsEnabled?: boolean
  theme?: ThemeId
}

interface UIState {
  sidebarCollapsed: boolean
  focusedPanel: FocusedPanel
  searchFocused: boolean
  serverRunning: Record<string, number> // projectId -> running server count
  cliWorking: Record<string, boolean> // projectId -> working (CLI outputting)
  notificationsEnabled: boolean

  // Panel heights as percentages (must sum to 100)
  panelSizes: [number, number, number] // [main, server, prompts]

  // Layout mode
  layoutMode: LayoutMode
  splitRatio: number // primary split ratio (%), default 50
  secondarySplit: number // secondary area split ratio (%), default 50

  // Secondary panel collapsed (CLI widened)
  secondaryCollapsed: boolean
  savedSplitRatio: number // splitRatio before collapse

  // Theme
  theme: ThemeId

  toggleSidebar: () => void
  setFocusedPanel: (panel: FocusedPanel) => void
  setSearchFocused: (focused: boolean) => void
  setPanelSizes: (sizes: [number, number, number]) => void
  setServerRunning: (projectId: string, count: number) => void
  setCLIWorking: (projectId: string, working: boolean) => void
  toggleNotifications: () => void
  setLayoutMode: (mode: LayoutMode) => void
  setSplitRatio: (ratio: number) => void
  setSecondarySplit: (ratio: number) => void
  toggleSecondaryCollapsed: () => void
  setTheme: (id: ThemeId) => void
  loadLayout: () => Promise<void>
}

const LAYOUT_FILE = 'layout.json'

function saveLayout(state: { layoutMode: LayoutMode; panelSizes: [number, number, number]; splitRatio: number; secondarySplit: number; secondaryCollapsed: boolean; savedSplitRatio: number; notificationsEnabled: boolean; theme: ThemeId }): void {
  const data: LayoutData = {
    layoutMode: state.layoutMode,
    panelSizes: state.panelSizes,
    splitRatio: state.splitRatio,
    secondarySplit: state.secondarySplit,
    secondaryCollapsed: state.secondaryCollapsed,
    savedSplitRatio: state.savedSplitRatio,
    notificationsEnabled: state.notificationsEnabled,
    theme: state.theme
  }
  window.api.data.save(LAYOUT_FILE, data)
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: false,
  focusedPanel: 'main',
  searchFocused: false,
  serverRunning: {},
  cliWorking: {},
  notificationsEnabled: true,
  panelSizes: [40, 30, 30],
  layoutMode: 'right-split',
  splitRatio: 50,
  secondarySplit: 50,
  secondaryCollapsed: false,
  savedSplitRatio: 50,
  theme: 'gray' as ThemeId,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setFocusedPanel: (panel) => set({ focusedPanel: panel }),

  setSearchFocused: (focused) => set({ searchFocused: focused }),
  setPanelSizes: (sizes) => {
    set({ panelSizes: sizes })
    saveLayout({ ...get(), panelSizes: sizes })
  },
  setServerRunning: (projectId, count) =>
    set((s) => ({ serverRunning: { ...s.serverRunning, [projectId]: count } })),
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
    const max = get().secondaryCollapsed ? 97 : 80
    const clamped = Math.max(20, Math.min(max, ratio))
    set({ splitRatio: clamped })
    saveLayout({ ...get(), splitRatio: clamped })
  },
  setSecondarySplit: (ratio) => {
    const clamped = Math.max(20, Math.min(80, ratio))
    set({ secondarySplit: clamped })
    saveLayout({ ...get(), secondarySplit: clamped })
  },
  toggleSecondaryCollapsed: () => {
    const { secondaryCollapsed, splitRatio, savedSplitRatio } = get()
    if (secondaryCollapsed) {
      // Restore
      set({ secondaryCollapsed: false, splitRatio: savedSplitRatio })
      saveLayout({ ...get(), secondaryCollapsed: false, splitRatio: savedSplitRatio })
    } else {
      // Collapse: save current ratio, widen CLI to 97%
      set({ secondaryCollapsed: true, savedSplitRatio: splitRatio, splitRatio: 97 })
      saveLayout({ ...get(), secondaryCollapsed: true, savedSplitRatio: splitRatio, splitRatio: 97 })
    }
  },

  setTheme: (id) => {
    applyTheme(id)
    set({ theme: id })
    saveLayout({ ...get(), theme: id })
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
      const max = data.secondaryCollapsed ? 97 : 80
      updates.splitRatio = Math.max(20, Math.min(max, data.splitRatio))
    }
    if (typeof data.secondarySplit === 'number') {
      updates.secondarySplit = Math.max(20, Math.min(80, data.secondarySplit))
    }
    if (typeof data.secondaryCollapsed === 'boolean') {
      updates.secondaryCollapsed = data.secondaryCollapsed
    }
    if (typeof data.savedSplitRatio === 'number') {
      updates.savedSplitRatio = Math.max(20, Math.min(80, data.savedSplitRatio))
    }
    if (typeof data.notificationsEnabled === 'boolean') {
      updates.notificationsEnabled = data.notificationsEnabled
    }
    const themeId = data.theme && ['gray', 'blue', 'green', 'purple'].includes(data.theme) ? data.theme : 'gray'
    updates.theme = themeId
    set(updates)
    applyTheme(themeId)
  }
}))
