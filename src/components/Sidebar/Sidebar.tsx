import { useState } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useChatStore } from '../../stores/chatStore'
import { ipc } from '../../lib/ipc'
import { SessionItem } from './SessionItem'

export function Sidebar() {
  const { sessions, activeSessionId, createSession, selectSession } = useSessionStore()
  const { reset } = useChatStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const filteredSessions = sessions.filter(s =>
    !searchQuery || s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.cwd.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleNewSession = async () => {
    setIsCreating(true)
    try {
      const cwd = await ipc.settingsGet('lastCwd') || process.cwd()
      const session = await createSession(cwd)
      selectSession(session.id)
      reset()
      await ipc.claudeStart(session.id, cwd)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="w-64 flex flex-col glass-panel border-r border-white/5">
      {/* Header */}
      <div className="p-3 border-b border-white/5">
        <button
          onClick={handleNewSession}
          disabled={isCreating}
          className="w-full glass-button flex items-center justify-center gap-2 py-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {isCreating ? '创建中...' : '新建对话'}
        </button>
      </div>

      {/* Search */}
      <div className="p-3 pb-2">
        <input
          type="text"
          placeholder="搜索对话..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-input text-xs py-2"
        />
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filteredSessions.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-8">
            {searchQuery ? '未找到匹配的对话' : '暂无对话'}
          </div>
        ) : (
          filteredSessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => {
                selectSession(session.id)
                reset()
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
