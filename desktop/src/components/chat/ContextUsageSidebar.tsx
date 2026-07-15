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

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat().format(value ?? 0)
}

function formatPercent(value: number | undefined) {
  const percent = Math.max(0, Math.min(100, value ?? 0))
  return `${percent.toFixed(percent >= 10 || Number.isInteger(percent) ? 0 : 1)}%`
}

function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('system') || lower.includes('prompt')) return 'settings'
  if (lower.includes('file') || lower.includes('project')) return 'description'
  if (lower.includes('search') || lower.includes('web')) return 'travel_explore'
  if (lower.includes('skill')) return 'auto_awesome'
  if (lower.includes('memory')) return 'memory'
  if (lower.includes('tool')) return 'build'
  if (lower.includes('message') || lower.includes('chat')) return 'chat'
  if (lower.includes('mcp')) return 'extension'
  return 'code'
}

export function ContextUsageSidebar({
  sessionId,
  chatState,
  messageCount,
  runtimeSelectionKey = '',
  draft = false,
}: Props) {
  const [context, setContext] = useState<SessionContextSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)
  const contextIdentityRef = useRef('')

  const refresh = useCallback(async () => {
    if (!sessionId || draft) return
    if (typeof sessionsApi.getInspection !== 'function') return

    const activeContextIdentity = `${sessionId}:${runtimeSelectionKey}`
    const seq = ++requestSeq.current
    contextIdentityRef.current = activeContextIdentity

    setLoading(true)
    setError(null)

    try {
      const inspection = await sessionsApi.getInspection(sessionId, {
        includeContext: true,
        contextOnly: true,
        timeout: 15000,
      })
      if (seq !== requestSeq.current) return
      const nextContext = inspection.context ?? inspection.contextEstimate ?? null
      setContext(nextContext)
      setError(nextContext ? null : (inspection.errors?.context ?? null))
    } catch (err) {
      if (seq !== requestSeq.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [draft, runtimeSelectionKey, sessionId])

  useEffect(() => {
    const contextIdentity = `${sessionId}:${runtimeSelectionKey}`
    if (contextIdentityRef.current !== contextIdentity) {
      contextIdentityRef.current = contextIdentity
      setContext(null)
      setError(null)
    }
    void refresh()
  }, [messageCount, refresh, runtimeSelectionKey, sessionId])

  useEffect(() => {
    if (chatState === 'idle') return
    const timer = setInterval(() => { void refresh() }, 30000)
    return () => clearInterval(timer)
  }, [chatState, refresh])

  const percentage = context ? Math.min(100, Math.max(0, context.percentage)) : 0
  const usedTokens = context?.totalTokens ?? 0
  const maxTokens = context?.rawMaxTokens ?? 0
  const freeTokens = Math.max(0, maxTokens - usedTokens)
  const strokeColor = percentage >= 90 ? 'var(--color-error)' : percentage >= 75 ? 'var(--color-warning)' : 'var(--color-secondary)'

  // Top categories for the bar chart
  const topCategories = useMemo(() => {
    if (!context) return []
    const ignored = new Set(['free space', 'autocompact buffer'])
    return context.categories
      .filter(c => c.tokens > 0 && !c.isDeferred && !ignored.has(c.name.toLowerCase()))
      .sort((a, b) => b.tokens - a.tokens)
  }, [context])

  return (
    <div
      data-testid="context-usage-sidebar"
      className="flex h-full w-full shrink-0 flex-col overflow-y-auto"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Context Usage
          </h2>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[14px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
        {context?.model && (
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] truncate" title={context.model}>
            {context.model}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">

        {/* Large percentage display */}
        <div className="flex flex-col items-center py-2">
          <div
            className="relative grid h-20 w-20 place-items-center rounded-full"
            style={{
              background: context
                ? `conic-gradient(${strokeColor} ${percentage * 3.6}deg, var(--color-surface-container-high) 0deg)`
                : 'var(--color-surface-container-high)',
            }}
          >
            <span className="absolute inset-[4px] rounded-full bg-[var(--color-surface)]" />
            <span className="relative font-mono text-2xl font-bold text-[var(--color-text-primary)]">
              {context ? formatPercent(percentage) : '--'}
            </span>
          </div>
          <div className="mt-3 text-center">
            <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
              {formatNumber(usedTokens)}
            </div>
            <div className="text-[11px] text-[var(--color-text-tertiary)]">
              of {maxTokens > 0 ? formatNumber(maxTokens) : '--'} tokens
            </div>
          </div>
        </div>

        {/* Usage bar */}
        {context && (
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-container)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${percentage}%`, backgroundColor: strokeColor }}
            />
          </div>
        )}

        {/* Free / Used stats */}
        {context && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[var(--color-surface-container)] p-2.5">
              <div className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wide">Used</div>
              <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{formatNumber(usedTokens)}</div>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-container)] p-2.5">
              <div className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wide">Free</div>
              <div className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{formatNumber(freeTokens)}</div>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[var(--color-border)]" />

        {/* Category breakdown */}
        {topCategories.length > 0 && (
          <div>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Breakdown
            </h3>
            <div className="space-y-3">
              {topCategories.map((cat) => {
                const barPercent = maxTokens > 0
                  ? Math.max(1, Math.min(100, (cat.tokens / maxTokens) * 100))
                  : 0
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="material-symbols-outlined text-[14px] shrink-0"
                          style={{ color: cat.color || 'var(--color-text-tertiary)' }}
                        >
                          {getCategoryIcon(cat.name)}
                        </span>
                        <span className="text-xs text-[var(--color-text-secondary)] truncate">
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[11px] text-[var(--color-text-primary)]">
                          {formatNumber(cat.tokens)}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                          ({formatPercent(maxTokens > 0 ? (cat.tokens / maxTokens) * 100 : 0)})
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-container)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barPercent}%`, backgroundColor: cat.color || 'var(--color-secondary)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* System Prompt Sections */}
        {context?.systemPromptSections && context.systemPromptSections.length > 0 && (
          <>
            <div className="border-t border-[var(--color-border)]" />
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                System Prompt
              </h3>
              <div className="space-y-2">
                {context.systemPromptSections.map((section) => (
                  <div key={section.name} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)] truncate">
                      {section.name}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--color-text-tertiary)] shrink-0">
                      {formatNumber(section.tokens)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Skills */}
        {context?.skills && context.skills.tokens > 0 && (
          <>
            <div className="border-t border-[var(--color-border)]" />
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                Skills ({context.skills.includedSkills}/{context.skills.totalSkills})
              </h3>
              <div className="space-y-2">
                {context.skills.skillFrontmatter.slice(0, 8).map((skill) => (
                  <div key={skill.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="material-symbols-outlined text-[12px] text-[var(--color-text-tertiary)]">auto_awesome</span>
                      <span className="text-xs text-[var(--color-text-secondary)] truncate">{skill.name}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[var(--color-text-tertiary)] shrink-0">
                      {formatNumber(skill.tokens)}
                    </span>
                  </div>
                ))}
                {context.skills.skillFrontmatter.length > 8 && (
                  <div className="text-[10px] text-[var(--color-text-tertiary)] text-center">
                    +{context.skills.skillFrontmatter.length - 8} more
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Message breakdown */}
        {context?.messageBreakdown && (
          <>
            <div className="border-t border-[var(--color-border)]" />
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                Messages
              </h3>
              <div className="space-y-2">
                {context.messageBreakdown.toolCallTokens > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">Tool Calls</span>
                    <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">{formatNumber(context.messageBreakdown.toolCallTokens)}</span>
                  </div>
                )}
                {context.messageBreakdown.toolResultTokens > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">Tool Results</span>
                    <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">{formatNumber(context.messageBreakdown.toolResultTokens)}</span>
                  </div>
                )}
                {context.messageBreakdown.assistantMessageTokens > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">Assistant</span>
                    <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">{formatNumber(context.messageBreakdown.assistantMessageTokens)}</span>
                  </div>
                )}
                {context.messageBreakdown.userMessageTokens > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">User</span>
                    <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">{formatNumber(context.messageBreakdown.userMessageTokens)}</span>
                  </div>
                )}
                {context.messageBreakdown.attachmentTokens > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)]">Attachments</span>
                    <span className="font-mono text-[11px] text-[var(--color-text-tertiary)]">{formatNumber(context.messageBreakdown.attachmentTokens)}</span>
                  </div>
                )}
                {/* Tool calls by type */}
                {context.messageBreakdown.toolCallsByType.length > 0 && (
                  <div className="mt-2 pl-2 border-l-2 border-[var(--color-border)] space-y-1">
                    {context.messageBreakdown.toolCallsByType.map((tc) => (
                      <div key={tc.name} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--color-text-tertiary)] truncate">{tc.name}</span>
                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{formatNumber(tc.callTokens + tc.resultTokens)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Loading / Error states */}
        {loading && !context && (
          <div className="flex items-center justify-center py-8">
            <span className="material-symbols-outlined animate-spin text-[var(--color-text-tertiary)]">progress_activity</span>
          </div>
        )}
        {error && !context && (
          <div className="rounded-lg bg-[var(--color-error)]/8 p-3 text-[11px] text-[var(--color-error)]">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
