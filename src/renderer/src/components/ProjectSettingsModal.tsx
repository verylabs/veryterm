import { useState } from 'react'
import { useProjectStore } from '../stores/projectStore'
import type { Project } from '../types'

interface ProjectSettingsModalProps {
  project: Project
  onClose: () => void
}

const COLOR_OPTIONS = [
  { value: undefined, label: '없음', className: 'bg-fg-subtle' },
  { value: '#f85149', label: '빨강', className: 'bg-[#f85149]' },
  { value: '#d29922', label: '주황', className: 'bg-[#d29922]' },
  { value: '#e3b341', label: '노랑', className: 'bg-[#e3b341]' },
  { value: '#3fb950', label: '초록', className: 'bg-[#3fb950]' },
  { value: '#58a6ff', label: '파랑', className: 'bg-[#58a6ff]' },
  { value: '#bc8cff', label: '보라', className: 'bg-[#bc8cff]' },
  { value: '#f778ba', label: '분홍', className: 'bg-[#f778ba]' }
]

export default function ProjectSettingsModal({ project, onClose }: ProjectSettingsModalProps) {
  const { updateProject } = useProjectStore()

  const [name, setName] = useState(project.name)
  const [serverCommand, setServerCommand] = useState(project.serverCommand || '')
  const [autoStartClaude, setAutoStartClaude] = useState(project.autoStartClaude || false)
  const [color, setColor] = useState(project.color)

  const handleSave = () => {
    updateProject(project.id, {
      name,
      serverCommand: serverCommand || undefined,
      autoStartClaude,
      color
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-bg-overlay border border-border-default rounded-xl w-[420px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-muted">
          <h2 className="text-sm font-medium text-fg-default">프로젝트 설정</h2>
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
            <label className="block text-xs text-fg-subtle mb-1.5">프로젝트 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-inset border border-border-default rounded-lg text-fg-default focus:outline-none focus:border-accent-fg/50"
            />
          </div>

          {/* Server Command */}
          <div>
            <label className="block text-xs text-fg-subtle mb-1.5">서버 실행 명령어</label>
            <input
              type="text"
              value={serverCommand}
              onChange={(e) => setServerCommand(e.target.value)}
              placeholder="npm run dev"
              className="w-full px-3 py-2 text-sm bg-bg-inset border border-border-default rounded-lg text-fg-default placeholder-fg-subtle focus:outline-none focus:border-accent-fg/50 font-mono"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs text-fg-subtle mb-1.5">컬러 태그</label>
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

          {/* Auto Start Claude */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-fg-subtle">프로젝트 열 때 Claude CLI 자동 시작</label>
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
            <label className="block text-xs text-fg-subtle mb-1.5">경로</label>
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
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-accent-emphasis text-white rounded-lg hover:bg-accent-fg transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
