import { useChatStore } from '../../stores/chatStore'

interface Props {
  toolUseId: string
  toolName: string
  input: string
  sessionId: string
}

const toolIcons: Record<string, string> = {
  Bash: '💻',
  Read: '📖',
  Write: '✏️',
  Edit: '🔧',
  Glob: '🔍',
  Grep: '🔎',
  WebFetch: '🌐',
  WebSearch: '🔍',
}

export function ToolUseCard({ toolUseId, toolName, input, sessionId }: Props) {
  const { approveTool, denyTool } = useChatStore()

  return (
    <div className="mb-4 animate-slide-up max-w-[85%]">
      <div className="glass-surface rounded-2xl p-4 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{toolIcons[toolName] || '⚙️'}</span>
          <span className="text-sm font-medium text-amber-300">{toolName}</span>
          <span className="text-[10px] text-slate-500">需要授权</span>
        </div>

        <pre className="text-xs text-slate-400 bg-black/30 rounded-lg p-3 overflow-x-auto mb-3 max-h-40 overflow-y-auto">
          {input}
        </pre>

        <div className="flex items-center gap-2">
          <button
            onClick={() => approveTool(sessionId, toolUseId)}
            className="glass-button text-xs bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25"
          >
            ✓ 允许
          </button>
          <button
            onClick={() => denyTool(sessionId, toolUseId)}
            className="glass-button text-xs bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
          >
            ✕ 拒绝
          </button>
        </div>
      </div>
    </div>
  )
}
