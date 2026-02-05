import { useProjectStore } from '../stores/projectStore'
import { useUIStore } from '../stores/uiStore'

export default function Titlebar() {
  const { projects, activeProjectId } = useProjectStore()
  const serverRunning = useUIStore((s) => activeProjectId ? s.serverRunning[activeProjectId] : false)
  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <div className="titlebar-drag h-[38px] bg-bg-default border-b border-border-default flex items-center shrink-0">
      {/* macOS 트래픽 라이트 공간 */}
      <div className="w-[78px] shrink-0" />

      {/* 프로젝트 이름 */}
      <span className="titlebar-no-drag text-[13px] font-semibold text-fg-default">
        {activeProject?.name || 'No Project'}
      </span>

      {/* 프로젝트 타입 */}
      {activeProject?.projectType && (
        <span className="titlebar-no-drag text-[11px] text-fg-subtle ml-3 px-1.5 py-0.5 rounded bg-bg-subtle">
          {activeProject.projectType}
        </span>
      )}

      {/* 서버 상태 */}
      {activeProject && serverRunning && (
        <span className="titlebar-no-drag flex items-center gap-1.5 ml-3 text-[11px] text-success-fg">
          <span className="w-1.5 h-1.5 rounded-full bg-success-fg animate-pulse" />
          Server
        </span>
      )}

      <div className="flex-1" />

      {/* 경로 */}
      {activeProject && (
        <span className="titlebar-no-drag text-[11px] text-fg-subtle truncate max-w-[400px] mr-4">
          {activeProject.path}
        </span>
      )}
    </div>
  )
}
