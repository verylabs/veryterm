import { contextBridge, ipcRenderer, webUtils } from 'electron'

export type TerminalType = 'main' | 'server'

const api = {
  // Terminal
  terminal: {
    create: (projectId: string, type: TerminalType, cwd: string): Promise<string> =>
      ipcRenderer.invoke('terminal:create', projectId, type, cwd),
    write: (sessionId: string, data: string): void =>
      ipcRenderer.send('terminal:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number): void =>
      ipcRenderer.send('terminal:resize', sessionId, cols, rows),
    kill: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke('terminal:kill', sessionId),
    onData: (callback: (sessionId: string, data: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, data: string) =>
        callback(sessionId, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback: (sessionId: string, exitCode: number) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, exitCode: number) =>
        callback(sessionId, exitCode)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    }
  },

  // Dialog
  dialog: {
    selectFolder: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:selectFolder')
  },

  // Project
  project: {
    detectType: (path: string): Promise<{ type: string | null; serverCommand: string | null }> =>
      ipcRenderer.invoke('project:detectType', path),
    hasCLAUDEmd: (path: string): Promise<boolean> =>
      ipcRenderer.invoke('project:hasCLAUDEmd', path)
  },

  // Data persistence
  data: {
    load: (filename: string): Promise<unknown> =>
      ipcRenderer.invoke('data:load', filename),
    save: (filename: string, data: unknown): Promise<boolean> =>
      ipcRenderer.invoke('data:save', filename, data)
  },

  // File utils
  getPathForFile: (file: File): string =>
    webUtils.getPathForFile(file),

  // Notification
  notify: (title: string, body: string): void =>
    ipcRenderer.send('notify', title, body)
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
