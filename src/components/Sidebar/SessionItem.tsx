import { useState } from 'react'
import type { Session } from '../../lib/types'
import { useSessionStore } from '../../stores/sessionStore'

interface Props {
  session: Session
  isActive: boolean
  onClick: () => void
}

export function SessionItem({ session, isActive, onClick }: Props) {
  const { deleteSession, togglePin, renameSession } = useSessionStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(session.title || '')

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  const handleRename = () => {
    if (editTitle.trim()) {
      renameSession(session.id, editTitle.trim())
    }
    setIsEditing(false)
  }

  return (
    <div
      className={`group relative px-3 py-2.5 rounded-lg mb-0.5 cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-indigo-500/15 border border-indigo-500/30'
          : 'hover:bg-white/5 border border-transparent'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setIsEditing(false)
              }}
              className="w-full bg-transparent border-b border-indigo-500/50 text-sm outline-none py-0.5"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="text-sm font-medium truncate">
              {session.is_pinned ? '📌 ' : ''}
              {session.title || session.cwd.split(/[/\\]/).pop() || '新对话'}
            </div>
          )}
          <div className="text-[11px] text-slate-500 truncate mt-0.5">
            {session.cwd}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-slate-500">
            {formatDate(session.updated_at)}
          </span>
        </div>
      </div>

      {/* Hover actions */}
      <div
        className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsEditing(true)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white text-[10px]"
          title="重命名"
        >
          ✏️
        </button>
        <button
          onClick={() => togglePin(session.id)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white text-[10px]"
          title={session.is_pinned ? '取消置顶' : '置顶'}
        >
          📌
        </button>
        <button
          onClick={() => {
            if (confirm('确定删除此对话？')) deleteSession(session.id)
          }}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-[10px]"
          title="删除"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
