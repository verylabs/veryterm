import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { PromptHistory } from '../types'

interface PromptState {
  prompts: PromptHistory[]
  loaded: boolean

  loadPrompts: () => Promise<void>
  savePrompts: () => Promise<void>
  addPrompt: (projectId: string, prompt: string) => void
  togglePin: (id: string) => void
  getProjectPrompts: (projectId: string) => PromptHistory[]
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  loaded: false,

  loadPrompts: async () => {
    const data = await window.api.data.load('prompts.json') as PromptHistory[] | null
    if (data) {
      set({ prompts: data, loaded: true })
    } else {
      set({ loaded: true })
    }
  },

  savePrompts: async () => {
    await window.api.data.save('prompts.json', get().prompts)
  },

  addPrompt: (projectId: string, prompt: string) => {
    const entry: PromptHistory = {
      id: uuidv4(),
      projectId,
      prompt: prompt.trim(),
      timestamp: new Date().toISOString(),
      pinned: false
    }
    set((state) => ({ prompts: [entry, ...state.prompts] }))
    get().savePrompts()
  },

  togglePin: (id: string) => {
    set((state) => ({
      prompts: state.prompts.map((p) =>
        p.id === id ? { ...p, pinned: !p.pinned } : p
      )
    }))
    get().savePrompts()
  },

  getProjectPrompts: (projectId: string) => {
    return get().prompts.filter((p) => p.projectId === projectId)
  }
}))
