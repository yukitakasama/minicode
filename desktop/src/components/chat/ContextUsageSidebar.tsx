import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sessionsApi, type SessionContextSnapshot } from '../../api/sessions'
import type { ChatState } from '../../types/chat'

type Props = {
  sessionId?: string
  chatState: ChatState
  messageCount: number
  runtimeSelectionKey?: string
  draft?: boolean
}

function fmt(n: number | undefined) {
  return new Intl.NumberFormat().format(n ?? 0)
}

function pct(value: number | undefined, total: number): string {
  if (!total || !value) return '0%'
  const v = Math.max(0, Math.min(100, Math.round((value / total) * 100)))
  return `${v}%`
}

function icon(name: string): string {
  const l = name.toLowerCase()
  if (l.includes('system') || l.includes('prompt')) return 'settings'
  if (l.includes('file') || l.includes('project') || l.includes('code')) return 'description'
  if (l.includes('search') || l.includes('web')) return 'travel_explore'
  if (l.includes('skill')) return 'auto_awesome'
  if (l.includes('memory')) return 'memory'
  if (l.includes('tool') || l.includes('bash') || l.includes('edit')) return 'build'
  if (l.includes('message') || l.includes('chat')) return 'chat'
  if (l.includes('mcp')) return 'extension'
  return 'code'
}

export function ContextUsageSidebar({ sessionId, chatState, messageCount, runtimeSelectionKey = '', draft = false }: Props) {
  const [ctx, setCtx] = useState<SessionContextSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const seq = useRef(0)
  const idRef = useRef('')

  const refresh = useCallback(async () => {
    if (!sessionId || draft) return
    if (typeof sessionsApi.getInspection !== 'function') return
    const curId = `${sessionId}:${runtimeSelectionKey}`
    const s = ++seq.current
    idRef.current = curId
    setLoading(true)
    setErr(null)
    try {
      const insp = await sessionsApi.getInspection(sessionId, { includeContext: true, contextOnly: true, timeout: 15000 })
      if (s !== seq.current) return
      const c = insp.context ?? insp.contextEstimate ?? null
      setCtx(c)
      setErr(c ? null : (insp.errors?.context ?? null))
    } catch (e) {
      if (s !== seq.current) return
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      if (s === seq.current) setLoading(false)
    }
  }, [draft, runtimeSelectionKey, sessionId])

  useEffect(() => {
    const cid = `${sessionId}:${runtimeSelectionKey}`
    if (idRef.current !== cid) { idRef.current = cid; setCtx(null); setErr(null) }
    void refresh()
  }, [messageCount, refresh, runtimeSelectionKey, sessionId])

  useEffect(() => {
    if (chatState === 'idle') return
    const t = setInterval(() => void refresh(), 30000)
    return () => clearInterval(t)
  }, [chatState, refresh])

  const pctUsed = ctx ? Math.min(100, Math.max(0, ctx.percentage)) : 0
  const used = ctx?.totalTokens ?? 0
  const max = ctx?.rawMaxTokens ?? 0
  const free = Math.max(0, max - used)
  const barColor = pctUsed >= 90 ? 'var(--color-error)' : pctUsed >= 75 ? 'var(--color-warning)' : 'var(--color-secondary)'

  const cats = useMemo(() => {
    if (!ctx) return []
    const skip = new Set(['free space', 'autocompact buffer'])
    return ctx.categories.filter(c => c.tokens > 0 && !c.isDeferred && !skip.has(c.name.toLowerCase())).sort((a, b) => b.tokens - a.tokens)
  }, [ctx])

  // Flatten all files from memoryFiles + tool-based categories
  const files = useMemo(() => {
    if (!ctx) return []
    const seen = new Set<string>()
    const all: { path: string; type: string; tokens: number }[] = []

    // From memoryFiles
    for (const f of ctx.memoryFiles ?? []) {
      if (!seen.has(f.path)) { seen.add(f.path); all.push(f) }
    }

    return all.sort((a, b) => b.tokens - a.tokens).slice(0, 30)
  }, [ctx])

  return (
    <div data-testid="ctx-sidebar" className="flex h-full w-full shrink-0 flex-col overflow-y-auto">
      {/* 标题 */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-[var(--color-text-tertiary)]">上下文用量</h2>
          <button onClick={() => void refresh()} disabled={loading} className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50">
            <span className={`material-symbols-outlined text-[14px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
        {ctx?.model && <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] truncate" title={ctx.model}>{ctx.model}</div>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* 环形百分比 */}
        <div className="flex flex-col items-center py-1">
          <div className="relative grid h-[72px] w-[72px] place-items-center rounded-full" style={{ background: ctx ? `conic-gradient(${barColor} ${pctUsed * 3.6}deg, var(--color-surface-container-high) 0deg)` : 'var(--color-surface-container-high)' }}>
            <span className="absolute inset-[4px] rounded-full bg-[var(--color-surface)]" />
            <span className="relative font-mono text-xl font-bold text-[var(--color-text-primary)]">{ctx ? `${pctUsed}%` : '--'}</span>
          </div>
          <div className="mt-2 text-center">
            <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{fmt(used)}</div>
            <div className="text-[11px] text-[var(--color-text-tertiary)]">/ {max > 0 ? fmt(max) : '--'} tokens</div>
          </div>
        </div>

        {/* 进度条 */}
        {ctx && <div className="h-2 rounded-full bg-[var(--color-surface-container)] overflow-hidden"><div className="h-full rounded-full transition-all duration-300" style={{ width: `${pctUsed}%`, backgroundColor: barColor }} /></div>}

        {/* 已用/剩余 */}
        {ctx && <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[var(--color-surface-container)] p-2.5">
            <div className="text-[10px] text-[var(--color-text-tertiary)]">已用</div>
            <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{fmt(used)}</div>
          </div>
          <div className="rounded-lg bg-[var(--color-surface-container)] p-2.5">
            <div className="text-[10px] text-[var(--color-text-tertiary)]">剩余</div>
            <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{fmt(free)}</div>
          </div>
        </div>}

        <div className="border-t border-[var(--color-border)]" />

        {/* 分类明细 */}
        {cats.length > 0 && <div>
          <h3 className="mb-2 text-[10px] font-semibold tracking-wider text-[var(--color-text-tertiary)]">分类明细</h3>
          <div className="space-y-2.5">
            {cats.map(c => {
              const w = max > 0 ? Math.max(1, Math.min(100, (c.tokens / max) * 100)) : 0
              return <div key={c.name}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-[13px] shrink-0" style={{ color: c.color || 'var(--color-text-tertiary)' }}>{icon(c.name)}</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-[11px] text-[var(--color-text-primary)]">{fmt(c.tokens)}</span>
                    <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">({pct(c.tokens, max)})</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-surface-container)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: c.color || 'var(--color-secondary)' }} />
                </div>
              </div>
            })}
          </div>
        </div>}

        {/* 占用文件列表 */}
        {files.length > 0 && <>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-2 text-[10px] font-semibold tracking-wider text-[var(--color-text-tertiary)]">占用文件</h3>
            <div className="space-y-1.5">
              {files.map(f => {
                const ext = f.path.split('.').pop()?.toLowerCase() ?? ''
                const fileIcon = ['ts', 'tsx', 'js', 'jsx'].includes(ext) ? 'javascript' : ['json'].includes(ext) ? 'data_object' : ['md', 'txt'].includes(ext) ? 'article' : ['png', 'jpg', 'svg'].includes(ext) ? 'image' : ['css', 'scss'].includes(ext) ? 'css' : ['yaml', 'yml', 'toml'].includes(ext) ? 'settings' : 'insert_drive_file'
                return <div key={f.path} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-[12px] text-[var(--color-text-tertiary)] shrink-0">{fileIcon}</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] truncate" title={f.path}>{f.path}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] shrink-0">{fmt(f.tokens)}</span>
                </div>
              })}
            </div>
          </div>
        </>}

        {/* MCP 工具 */}
        {ctx?.mcpTools && ctx.mcpTools.length > 0 && <>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-2 text-[10px] font-semibold tracking-wider text-[var(--color-text-tertiary)]">MCP 工具</h3>
            <div className="space-y-1.5">
              {ctx.mcpTools.slice(0, 15).map(m => (
                <div key={m.serverName + m.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-[12px] text-[var(--color-text-tertiary)] shrink-0">extension</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] truncate" title={`${m.serverName}/${m.name}`}>{m.serverName}/{m.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] shrink-0">{fmt(m.tokens)}</span>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* Skills */}
        {ctx?.skills && ctx.skills.tokens > 0 && <>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-2 text-[10px] font-semibold tracking-wider text-[var(--color-text-tertiary)]">Skills（{ctx.skills.includedSkills}/{ctx.skills.totalSkills}）</h3>
            <div className="space-y-1.5">
              {ctx.skills.skillFrontmatter.slice(0, 10).map(s => (
                <div key={s.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-[12px] text-[var(--color-text-tertiary)] shrink-0">auto_awesome</span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] truncate">{s.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] shrink-0">{fmt(s.tokens)}</span>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* 系统提示词 */}
        {ctx?.systemPromptSections && ctx.systemPromptSections.length > 0 && <>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-2 text-[10px] font-semibold tracking-wider text-[var(--color-text-tertiary)]">系统提示词</h3>
            <div className="space-y-1.5">
              {ctx.systemPromptSections.map(s => (
                <div key={s.name} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--color-text-secondary)] truncate">{s.name}</span>
                  <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] shrink-0">{fmt(s.tokens)}</span>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* 消息明细 */}
        {ctx?.messageBreakdown && <>
          <div className="border-t border-[var(--color-border)]" />
          <div>
            <h3 className="mb-2 text-[10px] font-semibold tracking-wider text-[var(--color-text-tertiary)]">消息组成</h3>
            <div className="space-y-1.5">
              {[
                { label: '工具调用', v: ctx.messageBreakdown.toolCallTokens },
                { label: '工具结果', v: ctx.messageBreakdown.toolResultTokens },
                { label: '助手回复', v: ctx.messageBreakdown.assistantMessageTokens },
                { label: '用户消息', v: ctx.messageBreakdown.userMessageTokens },
                { label: '附件', v: ctx.messageBreakdown.attachmentTokens },
              ].filter(x => x.v > 0).map(x => (
                <div key={x.label} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--color-text-secondary)]">{x.label}</span>
                  <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{fmt(x.v)}</span>
                </div>
              ))}
            </div>
            {ctx.messageBreakdown.toolCallsByType.length > 0 && <div className="mt-1.5 pl-2 border-l-2 border-[var(--color-border)] space-y-1">
              {ctx.messageBreakdown.toolCallsByType.map(tc => {
                const sum = tc.callTokens + tc.resultTokens
                if (!sum) return null
                return <div key={tc.name} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[var(--color-text-tertiary)] truncate">{tc.name}</span>
                  <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{fmt(sum)}</span>
                </div>
              })}
            </div>}
          </div>
        </>}

        {/* 加载/错误 */}
        {loading && !ctx && <div className="flex items-center justify-center py-8"><span className="material-symbols-outlined animate-spin text-[var(--color-text-tertiary)]">progress_activity</span></div>}
        {err && !ctx && <div className="rounded-lg bg-[var(--color-error)]/8 p-3 text-[11px] text-[var(--color-error)]">{err}</div>}
      </div>
    </div>
  )
}
