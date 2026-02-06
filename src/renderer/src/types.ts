export interface Category {
  id: string
  name: string
  collapsed: boolean
}

export interface Project {
  id: string
  name: string
  path: string
  color?: string
  icon?: string
  category?: string
  cliCommand?: string
  serverCommand?: string
  projectType?: string
  autoStartClaude?: boolean
  hasCLAUDEmd?: boolean
  createdAt: string
  updatedAt: string
}

export interface PromptHistory {
  id: string
  projectId: string
  prompt: string
  timestamp: string
  pinned: boolean
}
