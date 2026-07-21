export const MODEL_CONTEXT_WINDOWS_ENV_KEY = 'CLAUDE_CODE_MODEL_CONTEXT_WINDOWS'
export const MODEL_CONTEXT_WINDOW_MIN = 16_000
export const MODEL_CONTEXT_WINDOW_MAX = 10_000_000

const DIRECT_MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-7': 1_000_000,
  'claude-sonnet-4-6': 200_000,
  'claude-haiku-4-5': 200_000,
  'deepseek-v4-pro': 1_000_000,
  'deepseek-v4-flash': 1_000_000,
  'deepseek-chat': 1_000_000,
  'deepseek-reasoner': 1_000_000,
  'grok-4.5': 500_000,
  'grok-composer-2.5-fast': 200_000,
  'kimi-k2.7-code': 262_144,
  'kimi-k2.7-code-highspeed': 262_144,
  'kimi-k2.6': 262_144,
  'kimi-k2.5': 262_144,
  'kimi-k2-0905-preview': 262_144,
  'kimi-k2-turbo-preview': 262_144,
  'kimi-k2-thinking': 262_144,
  'kimi-k2-thinking-turbo': 262_144,
  'minimax-m3': 1_000_000,
  'minimax-m2.7': 204_800,
  'minimax-m2.7-highspeed': 204_800,
  'qwen/qwen3.6-27b': 262_144,
  'qwen3.6:27b': 262_144,
  'glm-5.2': 1_000_000,
  'glm-5.1': 200_000,
  'glm-5': 200_000,
  'glm-5-turbo': 200_000,
  'glm-4.7': 200_000,
  'glm-4.6': 200_000,
  'glm-4.5': 128_000,
  'glm-4.5-air': 128_000,
}

const PATTERN_MODEL_CONTEXT_WINDOWS: Array<[RegExp, number]> = [
  [/^anthropic\/claude-opus-4\.7\b/i, 1_000_000],
  [/^anthropic\/claude-sonnet-4\.6\b/i, 200_000],
  [/^anthropic\/claude-haiku-4\.5\b/i, 200_000],
  [/^openai\/gpt-4\.1\b/i, 1_047_576],
  [/^openai\/gpt-5(?:[.-]\d+)?\b/i, 400_000],
  [/^google\/gemini-(?:2\.0|2\.5|3)/i, 1_048_576],
  [/^gemini-(?:2\.0|2\.5|3)/i, 1_048_576],
  [/^zai-org\/glm-5\.2\b/i, 1_000_000],
  [/^(?:qwen\/)?qwen3\.7-(?:max|plus)(?:[-.][\w.-]+)?\b/i, 1_000_000],
  [/^(?:qwen\/)?qwen3\.6-(?:plus|flash)(?:[-.][\w.-]+)?\b/i, 1_000_000],
  [/^(?:qwen\/)?qwen3\.6-max-preview\b/i, 262_144],
  [/^(?:qwen\/)?qwen3\.5-(?:plus|flash)(?:[-.][\w.-]+)?\b/i, 1_000_000],
  [/^(?:qwen\/)?qwen3-max(?:[-.][\w.-]+)?\b/i, 262_144],
  [/^(?:qwen\/)?qwen3-coder-plus(?:[-.][\w.-]+)?\b/i, 1_000_000],
  [/^(?:qwen\/)?qwen3-coder-next(?:[-.][\w.-]+)?\b/i, 262_144],
  [/qwen-long/i, 10_000_000],
]

const CONTEXT_WINDOW_LABEL_RE = /^(\d+(?:_\d+)*)\s*([kKmM])?$/
const CONTEXT_WINDOW_BRACKET_SUFFIX_RE = /\[(\d+(?:_\d+)*)\s*([kKmM])?\]$/i
// Require a unit for colon form so model ids like "qwen3.6:27b" are preserved.
const CONTEXT_WINDOW_COLON_SUFFIX_RE = /:(\d+(?:_\d+)*)([kKmM])$/i

function normalizeWindow(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined
  }
  if (value < MODEL_CONTEXT_WINDOW_MIN || value > MODEL_CONTEXT_WINDOW_MAX) {
    return undefined
  }
  return value
}

/**
 * Parse a human/config context label into a token window.
 * Accepts: "500000", "500_000", "500k", "1m", "1M".
 */
export function parseContextWindowLabel(input: string): number | undefined {
  const trimmed = input.trim()
  if (!trimmed) {
    return undefined
  }

  const match = trimmed.match(CONTEXT_WINDOW_LABEL_RE)
  if (!match) {
    return undefined
  }

  const magnitude = Number(match[1]!.replaceAll('_', ''))
  if (!Number.isInteger(magnitude) || magnitude <= 0) {
    return undefined
  }

  const unit = match[2]?.toLowerCase()
  let value = magnitude
  if (unit === 'k') {
    value = magnitude * 1_000
  } else if (unit === 'm') {
    value = magnitude * 1_000_000
  }

  return normalizeWindow(value)
}

/**
 * Parse an explicit model-id context suffix: `model[500k]`, `model:128k`, `model[262144]`.
 */
export function parseModelContextWindowSuffix(model: string): number | undefined {
  const trimmed = model.trim()
  if (!trimmed) {
    return undefined
  }

  const bracket = trimmed.match(CONTEXT_WINDOW_BRACKET_SUFFIX_RE)
  if (bracket) {
    return parseContextWindowLabel(`${bracket[1]}${bracket[2] ?? ''}`)
  }

  const colon = trimmed.match(CONTEXT_WINDOW_COLON_SUFFIX_RE)
  if (colon) {
    return parseContextWindowLabel(`${colon[1]}${colon[2]}`)
  }

  return undefined
}

/** Strip client-side context window suffixes from a model id before upstream calls. */
export function stripModelContextWindowSuffix(model: string): string {
  return model
    .trim()
    .replace(CONTEXT_WINDOW_BRACKET_SUFFIX_RE, '')
    .replace(CONTEXT_WINDOW_COLON_SUFFIX_RE, '')
}

export function normalizeModelContextKey(model: string): string {
  return stripModelContextWindowSuffix(model).toLowerCase()
}

function normalizeConfiguredContextWindows(parsed: unknown): Record<string, number> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }

  const windows: Record<string, number> = {}
  for (const [model, value] of Object.entries(parsed)) {
    const normalized = normalizeWindow(value)
    if (normalized !== undefined) {
      windows[normalizeModelContextKey(model)] = normalized
    }
  }
  return windows
}

function findConfiguredModelContextWindow(
  model: string,
  configured: Record<string, number>,
): number | undefined {
  const normalizedModel = normalizeModelContextKey(model)
  const exact = configured[normalizedModel]
  if (exact !== undefined) {
    return exact
  }

  for (const [configuredModel, window] of Object.entries(configured)) {
    if (
      normalizedModel.endsWith(`/${configuredModel}`) ||
      normalizedModel.endsWith(`:${configuredModel}`)
    ) {
      return window
    }
  }
  return undefined
}

export function getModelContextWindowFromEnvValue(
  model: string,
  raw: string | undefined,
): number | undefined {
  if (!raw?.trim()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return findConfiguredModelContextWindow(
      model,
      normalizeConfiguredContextWindows(parsed),
    )
  } catch {
    return undefined
  }
}

function parseConfiguredContextWindows(): Record<string, number> {
  const raw = process.env[MODEL_CONTEXT_WINDOWS_ENV_KEY]
  if (!raw?.trim()) {
    return {}
  }

  try {
    return normalizeConfiguredContextWindows(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return {}
  }
}

function getConfiguredModelContextWindow(model: string): number | undefined {
  return findConfiguredModelContextWindow(model, parseConfiguredContextWindows())
}

function getBuiltInModelContextWindow(model: string): number | undefined {
  const normalizedModel = normalizeModelContextKey(model)
  const exact = DIRECT_MODEL_CONTEXT_WINDOWS[normalizedModel]
  if (exact !== undefined) {
    return exact
  }

  for (const [pattern, window] of PATTERN_MODEL_CONTEXT_WINDOWS) {
    if (pattern.test(normalizedModel)) {
      return window
    }
  }
  return undefined
}

export function getConfiguredOrBuiltInModelContextWindow(
  model: string,
): number | undefined {
  return (
    getConfiguredModelContextWindow(model) ??
    getBuiltInModelContextWindow(model)
  )
}
