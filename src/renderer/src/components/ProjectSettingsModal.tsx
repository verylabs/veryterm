import { useState, useRef, useCallback } from 'react'
import { useProjectStore } from '../stores/projectStore'
import type { Project } from '../types'

interface ProjectSettingsModalProps {
  project: Project
  onClose: () => void
}

const COLOR_OPTIONS = [
  { value: undefined, label: 'None', className: 'bg-fg-subtle' },
  { value: '#f85149', label: 'Red', className: 'bg-[#f85149]' },
  { value: '#d29922', label: 'Orange', className: 'bg-[#d29922]' },
  { value: '#e3b341', label: 'Yellow', className: 'bg-[#e3b341]' },
  { value: '#3fb950', label: 'Green', className: 'bg-[#3fb950]' },
  { value: '#58a6ff', label: 'Blue', className: 'bg-[#58a6ff]' },
  { value: '#bc8cff', label: 'Purple', className: 'bg-[#bc8cff]' },
  { value: '#f778ba', label: 'Pink', className: 'bg-[#f778ba]' }
]

const ICON_OPTIONS = [
  '', '🚀', '⚡', '🔥', '💻', '🌐', '📱', '🎮',
  '🛠️', '📦', '🎨', '🧪', '📊', '🔒', '🤖', '💡',
  '📝', '🏗️', '🎯', '🧩', '🌿', '💎', '🔔', '⭐'
]

export default function ProjectSettingsModal({ project, onClose }: ProjectSettingsModalProps) {
  const { updateProject } = useProjectStore()

  const [name, setName] = useState(project.name)
  const [cliCommand, setCliCommand] = useState(project.cliCommand || '')
  const [serverCommand, setServerCommand] = useState(project.serverCommand || '')
  const [autoStartClaude, setAutoStartClaude] = useState(project.autoStartClaude || false)
  const [color, setColor] = useState(project.color)
  const [icon, setIcon] = useState(project.icon || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 128
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        setIcon(canvas.toDataURL('image/png'))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const handleSave = () => {
    updateProject(project.id, {
      name,
      cliCommand: cliCommand || undefined,
      serverCommand: serverCommand || undefined,
      autoStartClaude,
      color,
      icon: icon || undefined
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={onClose}>
      <div
        className="bg-bg-overlay border border-border-default rounded-xl w-[420px] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-muted">
          <h2 className="text-sm font-medium text-fg-default">Project Settings</h2>
          <button
            onClick={onClose}
            className="text-fg-subtle hover:text-fg-muted transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-fg-subtle mb-1.5">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-inset border border-border-default rounded-lg text-fg-default focus:outline-none focus:border-accent-fg/50"
            />
          </div>

          {/* CLI Command */}
          <div>
            <label className="block text-xs text-fg-subtle mb-1.5">CLI Command</label>
            <input
              type="text"
              value={cliCommand}
              onChange={(e) => setCliCommand(e.target.value)}
              placeholder="claude"
              className="w-full px-3 py-2 text-sm bg-bg-inset border border-border-default rounded-lg text-fg-default placeholder-fg-subtle focus:outline-none focus:border-accent-fg/50 font-mono"
            />
          </div>

          {/* Server Command */}
          <div>
            <label className="block text-xs text-fg-subtle mb-1.5">Server Command</label>
            <input
              type="text"
              value={serverCommand}
              onChange={(e) => setServerCommand(e.target.value)}
              placeholder="npm run dev"
              className="w-full px-3 py-2 text-sm bg-bg-inset border border-border-default rounded-lg text-fg-default placeholder-fg-subtle focus:outline-none focus:border-accent-fg/50 font-mono"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs text-fg-subtle mb-1.5">Icon</label>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-bg-inset border border-border-default flex items-center justify-center text-2xl overflow-hidden shrink-0">
                {icon.startsWith('data:') ? (
                  <img src={icon} alt="icon" className="w-full h-full object-cover" />
                ) : icon ? (
                  icon
                ) : (
                  <span className="text-fg-subtle text-xs">None</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs bg-bg-inset border border-border-default rounded-lg text-fg-default hover:bg-bg-subtle transition-colors"
                >
                  Upload Image
                </button>
                {icon && (
                  <button
                    onClick={() => setIcon('')}
                    className="px-3 py-1.5 text-xs text-fg-subtle hover:text-danger-fg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <div className="grid grid-cols-8 gap-1">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic || '__none'}
                  onClick={() => setIcon(ic)}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors ${
                    icon === ic
                      ? 'bg-accent-emphasis/20 ring-1 ring-accent-fg'
                      : 'hover:bg-bg-subtle'
                  }`}
                >
                  {ic || <span className="text-[10px] text-fg-subtle">None</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs text-fg-subtle mb-1.5">Color Tag</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setColor(opt.value)}
                  className={`w-6 h-6 rounded-full ${opt.className} transition-transform ${
                    color === opt.value ? 'ring-2 ring-accent-fg ring-offset-2 ring-offset-bg-overlay scale-110' : 'hover:scale-110'
                  }`}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Auto Start CLI */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-fg-subtle">Auto-start CLI on project open</label>
            <button
              onClick={() => setAutoStartClaude(!autoStartClaude)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                autoStartClaude ? 'bg-accent-emphasis' : 'bg-border-default'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  autoStartClaude ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Path (read-only) */}
          <div>
            <label className="block text-xs text-fg-subtle mb-1.5">Path</label>
            <div className="px-3 py-2 text-xs bg-bg-inset/50 border border-border-muted rounded-lg text-fg-subtle font-mono truncate">
              {project.path}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-muted">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-fg-muted hover:text-fg-default rounded-lg hover:bg-bg-subtle transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-accent-emphasis text-white rounded-lg hover:bg-accent-fg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
