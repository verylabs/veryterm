import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron'
import electron from 'electron'
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

  const ptyProcess = pty.spawn(shell, ['--login'], {
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

// Project: detect type from project files
ipcMain.handle('project:detectType', (_event, projectPath: string) => {
  const exists = (f: string) => fs.existsSync(path.join(projectPath, f))
  const readFile = (f: string) => {
    try { return fs.readFileSync(path.join(projectPath, f), 'utf-8') } catch { return '' }
  }

  try {
    // Node.js / package.json based
    if (exists('package.json')) {
      const pkg = JSON.parse(readFile('package.json'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      // Frameworks (specific first)
      if (deps['next']) return { type: 'next', serverCommand: 'npm run dev' }
      if (deps['@remix-run/react'] || deps['@remix-run/node']) return { type: 'remix', serverCommand: 'npm run dev' }
      if (deps['astro']) return { type: 'astro', serverCommand: 'npm run dev' }
      if (deps['gatsby']) return { type: 'gatsby', serverCommand: 'npm run develop' }
      if (deps['nuxt']) return { type: 'nuxt', serverCommand: 'npm run dev' }
      if (deps['@angular/core']) return { type: 'angular', serverCommand: 'ng serve' }
      if (deps['svelte'] || deps['@sveltejs/kit']) return { type: 'svelte', serverCommand: 'npm run dev' }
      if (deps['vite']) return { type: 'vite', serverCommand: 'npm run dev' }
      if (deps['react-scripts']) return { type: 'cra', serverCommand: 'npm start' }

      // Mobile
      if (deps['expo']) return { type: 'expo', serverCommand: 'npx expo start' }
      if (deps['react-native']) return { type: 'react-native', serverCommand: 'npm start' }

      // Electron
      if (deps['electron']) return { type: 'electron', serverCommand: pkg.scripts?.dev ? 'npm run dev' : null }

      // Server frameworks
      if (deps['@nestjs/core']) return { type: 'nestjs', serverCommand: 'npm run start:dev' }
      if (deps['fastify']) return { type: 'fastify', serverCommand: 'npm run dev' }
      if (deps['hono']) return { type: 'hono', serverCommand: 'npm run dev' }
      if (deps['express']) return { type: 'express', serverCommand: pkg.scripts?.dev ? 'npm run dev' : 'npm start' }
      if (deps['koa']) return { type: 'koa', serverCommand: pkg.scripts?.dev ? 'npm run dev' : 'npm start' }

      // Generic Node.js
      if (pkg.scripts?.dev) return { type: 'node', serverCommand: 'npm run dev' }
      if (pkg.scripts?.start) return { type: 'node', serverCommand: 'npm start' }

      return { type: 'node', serverCommand: null }
    }

    // Deno
    if (exists('deno.json') || exists('deno.jsonc')) {
      return { type: 'deno', serverCommand: 'deno task dev' }
    }

    // Bun
    if (exists('bunfig.toml') && !exists('package.json')) {
      return { type: 'bun', serverCommand: 'bun run dev' }
    }

    // Ruby / Rails
    if (exists('Gemfile')) {
      const gemfile = readFile('Gemfile')
      if (gemfile.includes('rails')) return { type: 'rails', serverCommand: 'bin/rails server' }
      if (gemfile.includes('sinatra')) return { type: 'sinatra', serverCommand: 'ruby app.rb' }
      if (gemfile.includes('jekyll')) return { type: 'jekyll', serverCommand: 'bundle exec jekyll serve' }
      return { type: 'ruby', serverCommand: null }
    }

    // Python
    if (exists('requirements.txt') || exists('pyproject.toml') || exists('Pipfile') || exists('setup.py')) {
      if (exists('manage.py')) return { type: 'django', serverCommand: 'python manage.py runserver' }

      // Detect framework from dependency files
      const reqs = readFile('requirements.txt') + readFile('pyproject.toml') + readFile('Pipfile')
      if (reqs.includes('fastapi')) return { type: 'fastapi', serverCommand: 'uvicorn main:app --reload' }
      if (reqs.includes('flask')) return { type: 'flask', serverCommand: 'flask run' }
      if (reqs.includes('streamlit')) return { type: 'streamlit', serverCommand: 'streamlit run app.py' }
      if (reqs.includes('gradio')) return { type: 'gradio', serverCommand: 'python app.py' }
      if (reqs.includes('celery')) return { type: 'celery', serverCommand: null }
      if (reqs.includes('scrapy')) return { type: 'scrapy', serverCommand: null }

      return { type: 'python', serverCommand: null }
    }

    // Go
    if (exists('go.mod')) return { type: 'go', serverCommand: 'go run .' }

    // Rust
    if (exists('Cargo.toml')) return { type: 'rust', serverCommand: 'cargo run' }

    // Java / Kotlin
    if (exists('pom.xml')) return { type: 'maven', serverCommand: 'mvn spring-boot:run' }
    if (exists('build.gradle') || exists('build.gradle.kts')) return { type: 'gradle', serverCommand: './gradlew bootRun' }

    // PHP
    if (exists('composer.json')) {
      const composer = readFile('composer.json')
      if (composer.includes('laravel/framework')) return { type: 'laravel', serverCommand: 'php artisan serve' }
      if (composer.includes('symfony/framework-bundle')) return { type: 'symfony', serverCommand: 'symfony serve' }
      if (exists('wp-config.php') || exists('wp-content')) return { type: 'wordpress', serverCommand: null }
      return { type: 'php', serverCommand: 'php -S localhost:8000' }
    }
    if (exists('wp-config.php')) return { type: 'wordpress', serverCommand: null }

    // .NET / C#
    if (fs.readdirSync(projectPath).some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) {
      return { type: 'dotnet', serverCommand: 'dotnet run' }
    }

    // Flutter / Dart
    if (exists('pubspec.yaml')) return { type: 'flutter', serverCommand: 'flutter run' }

    // Elixir / Phoenix
    if (exists('mix.exs')) {
      const mix = readFile('mix.exs')
      if (mix.includes('phoenix')) return { type: 'phoenix', serverCommand: 'mix phx.server' }
      return { type: 'elixir', serverCommand: 'mix run' }
    }

    // Swift
    if (exists('Package.swift')) return { type: 'swift', serverCommand: 'swift run' }

    // Zig
    if (exists('build.zig')) return { type: 'zig', serverCommand: 'zig build run' }

    // C/C++ (CMake, Makefile)
    if (exists('CMakeLists.txt')) return { type: 'cmake', serverCommand: null }
    if (exists('Makefile') || exists('makefile')) return { type: 'make', serverCommand: null }

    return { type: null, serverCommand: null }
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

// Dock bounce (macOS) — 3 times
ipcMain.on('dock:bounce', () => {
  let count = 0
  const interval = setInterval(() => {
    app.dock?.bounce('informational')
    count++
    if (count >= 3) clearInterval(interval)
  }, 1000)
})

ipcMain.on('shell:openExternal', (_event, url: string) => {
  electron.shell.openExternal(url)
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
