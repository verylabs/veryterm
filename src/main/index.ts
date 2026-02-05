import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import path from 'path'
import os from 'os'
import * as pty from 'node-pty'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'

const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'

interface PtySession {
  id: string
  projectId: string
  type: 'main' | 'server'
  process: pty.IPty
}

const ptySessions = new Map<string, PtySession>()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false // node-pty requires this
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

// --- IPC Handlers ---

// Terminal: create pty session
ipcMain.handle('terminal:create', (_event, projectId: string, type: 'main' | 'server', cwd: string) => {
  const sessionId = uuidv4()
  const cols = 80
  const rows = 24

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: { ...process.env } as Record<string, string>
  })

  const session: PtySession = {
    id: sessionId,
    projectId,
    type,
    process: ptyProcess
  }

  ptySessions.set(sessionId, session)

  ptyProcess.onData((data) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('terminal:data', sessionId, data)
    }
  })

  ptyProcess.onExit(({ exitCode }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('terminal:exit', sessionId, exitCode)
    }
    ptySessions.delete(sessionId)
  })

  return sessionId
})

// Terminal: write to pty
ipcMain.on('terminal:write', (_event, sessionId: string, data: string) => {
  const session = ptySessions.get(sessionId)
  if (session) {
    session.process.write(data)
  }
})

// Terminal: resize pty
ipcMain.on('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => {
  const session = ptySessions.get(sessionId)
  if (session) {
    session.process.resize(cols, rows)
  }
})

// Terminal: kill pty
ipcMain.handle('terminal:kill', (_event, sessionId: string) => {
  const session = ptySessions.get(sessionId)
  if (session) {
    session.process.kill()
    ptySessions.delete(sessionId)
  }
})

// Dialog: select folder
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// Project: detect type from package.json
ipcMain.handle('project:detectType', (_event, projectPath: string) => {
  try {
    const pkgPath = path.join(projectPath, 'package.json')
    if (!fs.existsSync(pkgPath)) return { type: null, serverCommand: null }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }

    if (deps['next']) return { type: 'next', serverCommand: 'npm run dev' }
    if (deps['vite']) return { type: 'vite', serverCommand: 'npm run dev' }
    if (deps['react-scripts']) return { type: 'cra', serverCommand: 'npm start' }
    if (deps['nuxt']) return { type: 'nuxt', serverCommand: 'npm run dev' }
    if (deps['@angular/core']) return { type: 'angular', serverCommand: 'ng serve' }
    if (deps['svelte'] || deps['@sveltejs/kit']) return { type: 'svelte', serverCommand: 'npm run dev' }

    if (pkg.scripts?.dev) return { type: 'node', serverCommand: 'npm run dev' }
    if (pkg.scripts?.start) return { type: 'node', serverCommand: 'npm start' }

    return { type: 'node', serverCommand: null }
  } catch {
    return { type: null, serverCommand: null }
  }
})

// Project: check if CLAUDE.md exists
ipcMain.handle('project:hasCLAUDEmd', (_event, projectPath: string) => {
  return fs.existsSync(path.join(projectPath, 'CLAUDE.md'))
})

// Data: load from file
ipcMain.handle('data:load', (_event, filename: string) => {
  try {
    const dataPath = path.join(app.getPath('userData'), filename)
    if (!fs.existsSync(dataPath)) return null
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  } catch {
    return null
  }
})

// Data: save to file
ipcMain.handle('data:save', (_event, filename: string, data: unknown) => {
  try {
    const dataPath = path.join(app.getPath('userData'), filename)
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
    return true
  } catch {
    return false
  }
})

// Notification
ipcMain.on('notify', (_event, title: string, body: string) => {
  new Notification({ title, body }).show()
})

// --- App Lifecycle ---

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Kill all pty sessions
  for (const session of ptySessions.values()) {
    session.process.kill()
  }
  ptySessions.clear()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
