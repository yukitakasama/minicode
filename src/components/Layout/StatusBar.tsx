import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'

export function StatusBar() {
  const { status, isStreaming } = useChatStore()
  const { currentProfile, activeSessionId } = useSessionStore()

  const statusColors: Record<string, string> = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  }

  const statusLabels: Record<string, string> = {
    disconnected: '未连接',
    connecting: '连接中...',
    connected: '已连接',
    error: '连接错误',
  }

  return (
    <div className="h-6 flex items-center justify-between px-4 glass-panel border-t border-white/5 text-[11px] text-slate-400">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${statusColors[status] || 'bg-gray-500'} ${isStreaming ? 'animate-pulse' : ''}`} />
          <span>{statusLabels[status] || status}</span>
        </div>
        {activeSessionId && (
          <span className="text-slate-500">Session: {activeSessionId.slice(0, 8)}...</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {currentProfile && (
          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px]">
            {currentProfile.name}
          </span>
        )}
        {currentProfile?.model && (
          <span className="text-slate-500">{currentProfile.model}</span>
        )}
      </div>
    </div>
  )
}
