import { describe, expect, test } from 'bun:test'

import {
  getConfiguredOrBuiltInModelContextWindow,
  getModelContextWindowFromEnvValue,
  parseContextWindowLabel,
  parseModelContextWindowSuffix,
  stripModelContextWindowSuffix,
} from './modelContextWindows.js'

describe('model context windows', () => {
  test('recognizes updated domestic coding model context windows', () => {
    expect(getConfiguredOrBuiltInModelContextWindow('kimi-k2.7-code')).toBe(262_144)
    expect(getConfiguredOrBuiltInModelContextWindow('kimi-k2.7-code-highspeed')).toBe(262_144)
    expect(getConfiguredOrBuiltInModelContextWindow('glm-5.2')).toBe(1_000_000)
    expect(getConfiguredOrBuiltInModelContextWindow('glm-4.7')).toBe(200_000)
    expect(getConfiguredOrBuiltInModelContextWindow('qwen/qwen3.6-27b')).toBe(262_144)
    expect(getConfiguredOrBuiltInModelContextWindow('qwen3.6:27b')).toBe(262_144)
    expect(getConfiguredOrBuiltInModelContextWindow('qwen3.7-plus-2026-02-15')).toBe(1_000_000)
    expect(getConfiguredOrBuiltInModelContextWindow('qwen3-coder-plus')).toBe(1_000_000)
    expect(getConfiguredOrBuiltInModelContextWindow('qwen3-coder-next')).toBe(262_144)
  })

  test('recognizes Grok official catalog windows in the built-in table', () => {
    expect(getConfiguredOrBuiltInModelContextWindow('grok-4.5')).toBe(500_000)
    expect(getConfiguredOrBuiltInModelContextWindow('grok-composer-2.5-fast')).toBe(200_000)
  })

  test('matches configured base model windows for Claude Code 1m aliases', () => {
    expect(getModelContextWindowFromEnvValue(
      'MiniMax-M3[1m]',
      JSON.stringify({ 'MiniMax-M3': 1_000_000 }),
    )).toBe(1_000_000)
    expect(getModelContextWindowFromEnvValue(
      'glm-5.2[1m]',
      JSON.stringify({ 'glm-5.2': 1_000_000 }),
    )).toBe(1_000_000)
  })

  test('parses context window labels and model-id suffixes', () => {
    expect(parseContextWindowLabel('500k')).toBe(500_000)
    expect(parseContextWindowLabel('1m')).toBe(1_000_000)
    expect(parseContextWindowLabel('262_144')).toBe(262_144)
    expect(parseContextWindowLabel('0k')).toBeUndefined()
    expect(parseContextWindowLabel('99999m')).toBeUndefined()

    expect(parseModelContextWindowSuffix('any-model[500k]')).toBe(500_000)
    expect(parseModelContextWindowSuffix('any-model:128k')).toBe(128_000)
    expect(parseModelContextWindowSuffix('any-model[262144]')).toBe(262_144)
    expect(parseModelContextWindowSuffix('any-model[1m]')).toBe(1_000_000)
    // Colon without unit must not rewrite real model ids like qwen3.6:27b
    expect(parseModelContextWindowSuffix('qwen3.6:27b')).toBeUndefined()
    expect(parseModelContextWindowSuffix('model[0k]')).toBeUndefined()

    expect(stripModelContextWindowSuffix('foo[500k]')).toBe('foo')
    expect(stripModelContextWindowSuffix('foo:128k')).toBe('foo')
    expect(stripModelContextWindowSuffix('qwen3.6:27b')).toBe('qwen3.6:27b')
  })
})
