import { useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { ToolUseCard } from './ToolUseCard'

export function ChatView() {
  const { messages, status, isStreaming, currentAssistantContent, currentThinking, pendingToolUse } = useChatStore()
  const { activeSessionId } = useSessionStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentAssistantContent])

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M8 12h24M8 20h16M8 28h20" stroke="url(#g)" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="g" x1="8" y1="12" x2="32" y2="28">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
            MiniCode
          </h2>
          <p className="text-sm text-slate-500 max-w-xs">
            Claude Code 的图形化界面。点击左侧「新建对话」开始。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-slate-500 text-sm py-12">
            输入消息开始对话...
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming assistant response */}
        {isStreaming && currentAssistantContent && (
          <MessageBubble
            message={{
              id: 'streaming',
              session_id: activeSessionId,
              role: 'assistant',
              content: currentAssistantContent,
              thinking: currentThinking || null,
              tool_use: null,
              tool_result: null,
              cost_usd: null,
              tokens_in: null,
              tokens_out: null,
              duration_ms: null,
              created_at: Date.now(),
            }}
            isStreaming
          />
        )}

        {/* Pending tool use */}
        {pendingToolUse && (
          <ToolUseCard
            toolUseId={pendingToolUse.id}
            toolName={pendingToolUse.name}
            input={pendingToolUse.input}
            sessionId={activeSessionId}
          />
        )}

        {/* Thinking indicator */}
        {isStreaming && !currentAssistantContent && (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-3 animate-pulse">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>思考中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <InputBar sessionId={activeSessionId} disabled={status === 'connecting'} />
    </div>
  )
}
