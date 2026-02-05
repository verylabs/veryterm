export interface Project {
  id: string
  name: string
  path: string
  color?: string
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
  response?: string
  timestamp: string
  pinned: boolean
}
