import { describe, expect, test } from 'bun:test'
import {
  BACKGROUND_AGENT_WAIT_TIMEOUT_MS,
  hasBackgroundAgentWaitTimedOut,
} from './backgroundWait.js'

describe('background agent wait watchdog', () => {
  test('does not time out before the grace period', () => {
    expect(
      hasBackgroundAgentWaitTimedOut(
        1000,
        1000 + BACKGROUND_AGENT_WAIT_TIMEOUT_MS - 1,
      ),
    ).toBe(false)
  })

  test('times out at the grace period', () => {
    expect(
      hasBackgroundAgentWaitTimedOut(
        1000,
        1000 + BACKGROUND_AGENT_WAIT_TIMEOUT_MS,
      ),
    ).toBe(true)
  })
})
