import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Project } from '../types'

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  loaded: boolean

  loadProjects: () => Promise<void>
  saveProjects: () => Promise<void>
  addProject: (path: string) => Promise<Project>
  removeProject: (id: string) => void
  setActiveProject: (id: string) => void
  updateProject: (id: string, updates: Partial<Project>) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loaded: false,

  loadProjects: async () => {
    const data = await window.api.data.load('projects.json') as { projects: Project[]; activeProjectId: string | null } | null
    if (data) {
      set({ projects: data.projects, activeProjectId: data.activeProjectId, loaded: true })
    } else {
      set({ loaded: true })
    }
  },

  saveProjects: async () => {
    const { projects, activeProjectId } = get()
    await window.api.data.save('projects.json', { projects, activeProjectId })
  },

  addProject: async (projectPath: string) => {
    const name = projectPath.split('/').pop() || 'Untitled'
    const detected = await window.api.project.detectType(projectPath)
    const hasCLAUDEmd = await window.api.project.hasCLAUDEmd(projectPath)

    const project: Project = {
      id: uuidv4(),
      name,
      path: projectPath,
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
  }
}))
