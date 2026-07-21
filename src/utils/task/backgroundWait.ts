export const BACKGROUND_AGENT_WAIT_TIMEOUT_MS = 5 * 60 * 1000

export function hasBackgroundAgentWaitTimedOut(
  startedAt: number,
  now: number,
): boolean {
  return now - startedAt >= BACKGROUND_AGENT_WAIT_TIMEOUT_MS
}
