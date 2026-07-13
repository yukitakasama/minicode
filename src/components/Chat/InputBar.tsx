import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chatStore'

interface Props {
  sessionId: string
  disabled?: boolean
}

export function InputBar({ sessionId, disabled }: Props) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, stopGeneration, isStreaming } = useChatStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    sendMessage(sessionId, trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="px-6 pb-4 pt-2">
      <div className="glass-surface rounded-2xl p-3 glow-border">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? '连接中...' : '输入消息... (Shift+Enter 换行)'}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none max-h-[200px] placeholder-slate-500 disabled:opacity-50"
          />
          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <button
                onClick={() => stopGeneration(sessionId)}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
                title="停止生成"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || disabled}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="发送"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l10-5-5 10-2-5z" fill="currentColor" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
