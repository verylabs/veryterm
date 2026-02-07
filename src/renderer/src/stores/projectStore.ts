import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Project, Category } from '../types'

interface ProjectState {
  projects: Project[]
  categories: Category[]
  activeProjectId: string | null
  loaded: boolean

  loadProjects: () => Promise<void>
  saveProjects: () => Promise<void>
  addProject: (path: string) => Promise<Project>
  removeProject: (id: string) => void
  setActiveProject: (id: string) => void
  updateProject: (id: string, updates: Partial<Project>) => void

  addCategory: (name: string) => void
  removeCategory: (id: string) => void
  renameCategory: (id: string, name: string) => void
  toggleCategoryCollapse: (id: string) => void
  moveProjectToCategory: (projectId: string, categoryId: string | null) => void
  reorderProject: (projectId: string, targetProjectId: string, position: 'before' | 'after') => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  categories: [],
  activeProjectId: null,
  loaded: false,

  loadProjects: async () => {
    const data = await window.api.data.load('projects.json') as {
      projects: Project[]
      categories?: Category[]
      activeProjectId: string | null
    } | null
    if (data) {
      // Re-detect project types and favicons for projects missing info
      const projects = await Promise.all(
        data.projects.map(async (p) => {
          let updated = { ...p }
          let changed = false
          if (!p.projectType) {
            try {
              const detected = await window.api.project.detectType(p.path)
              if (detected.type) {
                updated.projectType = detected.type
                updated.serverCommand = p.serverCommand || detected.serverCommand || undefined
                changed = true
              }
            } catch { /* ignore detection failures */ }
          }
          if (!p.icon) {
            try {
              const favicon = await window.api.project.detectFavicon(p.path)
              if (favicon) {
                updated.icon = favicon
                changed = true
              }
            } catch { /* ignore detection failures */ }
          }
          return changed ? updated : p
        })
      )
      set({
        projects,
        categories: data.categories || [],
        activeProjectId: data.activeProjectId,
        loaded: true
      })
      // Save if anything was updated
      const state = get()
      if (projects.some((p, i) => p !== data.projects[i])) {
        state.saveProjects()
      }
    } else {
      set({ loaded: true })
    }
  },

  saveProjects: async () => {
    const { projects, categories, activeProjectId } = get()
    await window.api.data.save('projects.json', { projects, categories, activeProjectId })
  },

  addProject: async (projectPath: string) => {
    const name = projectPath.split('/').pop() || 'Untitled'
    const detected = await window.api.project.detectType(projectPath)
    const hasCLAUDEmd = await window.api.project.hasCLAUDEmd(projectPath)
    const favicon = await window.api.project.detectFavicon(projectPath)

    const project: Project = {
      id: uuidv4(),
      name,
      path: projectPath,
      icon: favicon || undefined,
      serverCommand: detected.serverCommand || undefined,
      projectType: detected.type || undefined,
      hasCLAUDEmd,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: project.id
    }))

    await get().saveProjects()
    return project
  },

  removeProject: (id: string) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id
        ? state.projects[0]?.id || null
        : state.activeProjectId
    }))
    get().saveProjects()
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id })
    get().saveProjects()
  },

  updateProject: (id: string, updates: Partial<Project>) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      )
    }))
    get().saveProjects()
  },

  addCategory: (name: string) => {
    const category: Category = {
      id: uuidv4(),
      name,
      collapsed: false
    }
    set((state) => ({ categories: [...state.categories, category] }))
    get().saveProjects()
  },

  removeCategory: (id: string) => {
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      projects: state.projects.map((p) =>
        p.category === id ? { ...p, category: undefined } : p
      )
    }))
    get().saveProjects()
  },

  renameCategory: (id: string, name: string) => {
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, name } : c
      )
    }))
    get().saveProjects()
  },

  toggleCategoryCollapse: (id: string) => {
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, collapsed: !c.collapsed } : c
      )
    }))
    get().saveProjects()
  },

  moveProjectToCategory: (projectId: string, categoryId: string | null) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, category: categoryId || undefined } : p
      )
    }))
    get().saveProjects()
  },

  reorderProject: (projectId: string, targetProjectId: string, position: 'before' | 'after') => {
    if (projectId === targetProjectId) return
    set((state) => {
      const projects = [...state.projects]
      const fromIdx = projects.findIndex((p) => p.id === projectId)
      if (fromIdx === -1) return state

      const [project] = projects.splice(fromIdx, 1)
      const target = projects.find((p) => p.id === targetProjectId)
      if (!target) return { projects: [project, ...projects] }

      // Match target's category
      project.category = target.category

      let toIdx = projects.findIndex((p) => p.id === targetProjectId)
      if (position === 'after') toIdx++
      projects.splice(toIdx, 0, project)
      return { projects }
    })
    get().saveProjects()
  }
}))
