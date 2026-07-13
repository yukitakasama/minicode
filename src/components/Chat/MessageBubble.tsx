import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Message } from '../../lib/types'

interface Props {
  message: Message
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`mb-4 animate-fade-in ${isUser ? 'flex justify-end' : ''}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-50'
            : 'glass-surface'
        }`}
      >
        {/* Thinking block */}
        {message.thinking && (
          <details className="mb-3 group">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 transition-colors flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="transition-transform group-open:rotate-90">
                <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              思考过程
            </summary>
            <div className="mt-2 text-xs text-slate-400 whitespace-pre-wrap leading-relaxed border-l-2 border-slate-600 pl-3">
              {message.thinking}
            </div>
          </details>
        )}

        {/* Content */}
        <div className="prose prose-invert prose-sm max-w-none">
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const code = String(children).replace(/\n$/, '')
                  if (match) {
                    return (
                      <div className="relative group my-3">
                        <div className="absolute right-2 top-2 text-[10px] text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded">
                          {match[1]}
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          className="!rounded-xl !text-xs"
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    )
                  }
                  return (
                    <code className="bg-slate-800/50 px-1.5 py-0.5 rounded text-indigo-300 text-xs" {...props}>
                      {children}
                    </code>
                  )
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
                },
                ol({ children }) {
                  return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-2 border-indigo-500/50 pl-3 text-slate-400 italic my-2">
                      {children}
                    </blockquote>
                  )
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3">
                      <table className="w-full text-xs border-collapse">{children}</table>
                    </div>
                  )
                },
                th({ children }) {
                  return <th className="border border-slate-700 px-3 py-1.5 text-left bg-slate-800/50">{children}</th>
                },
                td({ children }) {
                  return <td className="border border-slate-700 px-3 py-1.5">{children}</td>
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : isStreaming ? (
            <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5" />
          ) : null}
        </div>

        {/* Cost badge */}
        {message.cost_usd && message.cost_usd > 0 && (
          <div className="mt-2 text-[10px] text-slate-500">
            ${message.cost_usd.toFixed(4)}
            {message.duration_ms && ` · ${(message.duration_ms / 1000).toFixed(1)}s`}
          </div>
        )}
      </div>
    </div>
  )
}
