import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import type { ApiFormat } from '../types/provider.js'
import { ProviderService } from './providerService.js'

export const CLAUDE_DEFAULT_MODEL_SELECTION_ID = '__claude_default__'
export const CLAUDE_ROLE_ROUTING_PROVIDER_ID = 'claude-role-routing'

export const CLAUDE_ROLE_MODELS = [
  {
    id: 'fable',
    role: 'Fable',
    modelKey: 'ANTHROPIC_DEFAULT_FABLE_MODEL',
    nameKey: 'ANTHROPIC_DEFAULT_FABLE_MODEL_NAME',
    descriptionKey: 'ANTHROPIC_DEFAULT_FABLE_MODEL_DESCRIPTION',
  },
  {
    id: 'opus',
    role: 'Opus',
    modelKey: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
    nameKey: 'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
    descriptionKey: 'ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION',
  },
  {
    id: 'sonnet',
    role: 'Sonnet',
    modelKey: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    nameKey: 'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
    descriptionKey: 'ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION',
  },
  {
    id: 'haiku',
    role: 'Haiku',
    modelKey: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    nameKey: 'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
    descriptionKey: 'ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION',
  },
] as const

export type ClaudeRoleModelId = (typeof CLAUDE_ROLE_MODELS)[number]['id']

export const CLAUDE_ROLE_MODEL_KEYS = CLAUDE_ROLE_MODELS.map((entry) => entry.modelKey)

const CLAUDE_ROUTING_TRANSPORT_KEYS = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
] as const

export type ClaudeRoleRoutingSettings = {
  settings: Record<string, unknown>
  source: 'managed' | 'user'
}

export type ClaudeRoleModelEntry = {
  roleId: ClaudeRoleModelId
  role: string
  /** Claude Code 侧请求使用的模型 ID（ANTHROPIC_DEFAULT_*_MODEL） */
  modelId: string
  /** 展示名 / 上游真实模型（*_MODEL_NAME），缺省时等于 modelId */
  displayName: string
  description?: string
  /** 代理上游实际发送的模型 ID（优先 MODEL_NAME 中的 GPT 等） */
  upstreamModelId: string
}

export type ClaudeRoleRoutingProviderConfig = {
  id: typeof CLAUDE_ROLE_ROUTING_PROVIDER_ID
  name: string
  baseUrl: string
  apiKey: string
  apiFormat: ApiFormat
  models: {
    main: string
    fable: string
    haiku: string
    sonnet: string
    opus: string
  }
  modelEntries: ClaudeRoleModelEntry[]
  /** Claude 模型 ID → 上游模型 ID */
  upstreamModelMap: Record<string, string>
  source: 'managed' | 'user'
}

export function readSettingsEnv(
  settings: Record<string, unknown>,
): Record<string, string> {
  if (!settings.env || typeof settings.env !== 'object' || Array.isArray(settings.env)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(settings.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

export function hasClaudeRoleModelEnv(env: Record<string, string | undefined>): boolean {
  return CLAUDE_ROLE_MODEL_KEYS.some((key) => env[key]?.trim())
}

export function hasClaudeRoleRoutingEnv(env: Record<string, string | undefined>): boolean {
  return hasClaudeRoleModelEnv(env) && CLAUDE_ROUTING_TRANSPORT_KEYS.some(
    (key) => env[key]?.trim(),
  )
}

export function hasClaudeRoleRoutingSettings(settings: Record<string, unknown>): boolean {
  return hasClaudeRoleRoutingEnv(readSettingsEnv(settings))
}

export function resolveClaudeRoleRoutingSettings(
  managedSettings: Record<string, unknown>,
  userSettings: Record<string, unknown>,
): ClaudeRoleRoutingSettings | null {
  if (hasClaudeRoleRoutingSettings(managedSettings)) {
    return { settings: managedSettings, source: 'managed' }
  }
  if (hasClaudeRoleRoutingSettings(userSettings)) {
    return { settings: userSettings, source: 'user' }
  }
  return null
}

export function resolveClaudeRoleModel(
  modelId: string | undefined,
  settings: Record<string, unknown>,
): string | undefined {
  const roleModel = CLAUDE_ROLE_MODELS.find((entry) => entry.id === modelId)
  if (!roleModel) return undefined
  return readSettingsEnv(settings)[roleModel.modelKey]?.trim() || undefined
}

export function isClaudeRoleRoutingModel(
  modelId: string,
  settings: Record<string, unknown>,
): boolean {
  if (!modelId) return false
  if (modelId === CLAUDE_DEFAULT_MODEL_SELECTION_ID) return true

  const env = readSettingsEnv(settings)
  const roleModel = CLAUDE_ROLE_MODELS.find(({ id }) => id === modelId)
  if (roleModel) return !!env[roleModel.modelKey]?.trim()
  if (env.ANTHROPIC_MODEL?.trim() === modelId) return true

  for (const entry of CLAUDE_ROLE_MODELS) {
    if (env[entry.modelKey]?.trim() === modelId) return true
  }

  try {
    const contextWindows = JSON.parse(env.CLAUDE_CODE_MODEL_CONTEXT_WINDOWS ?? '') as unknown
    return !!contextWindows &&
      typeof contextWindows === 'object' &&
      !Array.isArray(contextWindows) &&
      Object.hasOwn(contextWindows, modelId) &&
      typeof (contextWindows as Record<string, unknown>)[modelId] === 'number' &&
      Number.isFinite((contextWindows as Record<string, number>)[modelId])
  } catch {
    return false
  }
}

export function resolveClaudeRoleRoutingModelSetting(
  settings: Record<string, unknown>,
): string | undefined {
  const modelId = typeof settings.model === 'string' ? settings.model.trim() : ''
  return isClaudeRoleRoutingModel(modelId, settings) ? modelId : undefined
}

/** Claude / Anthropic 原生模型 ID（含 anthropic/ 前缀中转） */
export function looksLikeClaudeNativeModelId(modelId: string | undefined): boolean {
  if (!modelId?.trim()) return false
  const value = modelId.trim().toLowerCase()
  if (value.startsWith('claude')) return true
  if (value.startsWith('anthropic/')) return true
  if (value.includes('/claude-') || value.includes('claude-')) return true
  return false
}

/** 判断字符串是否像 OpenAI / GPT 系列模型 */
export function looksLikeOpenAIModelId(modelId: string | undefined): boolean {
  if (!modelId?.trim()) return false
  const value = modelId.trim().toLowerCase()
  if (looksLikeClaudeNativeModelId(value)) return false
  return (
    value.startsWith('gpt-') ||
    value.startsWith('o1') ||
    value.startsWith('o3') ||
    value.startsWith('o4') ||
    value.includes('gpt-') ||
    value.includes('chatgpt') ||
    value.includes('codex') ||
    /^o[1-9]/.test(value)
  )
}

/**
 * 常见「OpenAI Chat Completions 兼容」第三方模型（DeepSeek / MIMO / 通义 / 智谱 OpenAI 端等）。
 * 这些模型走 openai_chat，不走 anthropic Messages。
 */
export function looksLikeOpenAICompatibleChatModelId(modelId: string | undefined): boolean {
  if (!modelId?.trim()) return false
  const value = modelId.trim().toLowerCase()
  if (looksLikeClaudeNativeModelId(value)) return false
  if (looksLikeOpenAIModelId(value)) return false

  // DeepSeek OpenAI 兼容端（非 /anthropic 路径时）
  if (
    value.startsWith('deepseek') ||
    value.includes('deepseek-chat') ||
    value.includes('deepseek-reasoner') ||
    value.includes('deepseek-v3') ||
    value.includes('deepseek-r1')
  ) {
    // deepseek 官方也有 anthropic 兼容端，模型名可能仍是 deepseek-*；
    // 是否走 anthropic 由 baseUrl 决定，这里仅标记「可兼容 chat」。
    return true
  }

  // 小米 MIMO
  if (/^mimo[-_v]/i.test(value) || value.includes('mimo-v') || value.includes('xiaomi')) {
    return true
  }

  // 通义 / Qwen（OpenAI 兼容部署常见）
  if (value.includes('qwen') || value.startsWith('qwen')) return true

  // 智谱 GLM（OpenAI 兼容端；官方 anthropic 端用 baseUrl 区分）
  if (/^glm[-_]?\d/i.test(value) || value.includes('glm-4') || value.includes('glm-5') || value.includes('chatglm')) {
    return true
  }

  // Kimi / Moonshot OpenAI 兼容
  if (value.startsWith('kimi') || value.includes('moonshot') || value.startsWith('moonshot')) {
    return true
  }

  // MiniMax OpenAI 兼容
  if (value.toLowerCase().includes('minimax') || value.startsWith('abab')) return true

  // Grok OpenAI chat
  if (value.startsWith('grok-')) return true

  // 通用 OpenAI 兼容命名
  if (
    value.includes('openai/') ||
    value.endsWith('-chat') ||
    value.includes('chat-completion')
  ) {
    return true
  }

  return false
}

/** 需要协议转换的非 Claude 上游模型（GPT 或 OpenAI 兼容 chat） */
export function looksLikeNonAnthropicUpstreamModelId(modelId: string | undefined): boolean {
  return looksLikeOpenAIModelId(modelId) || looksLikeOpenAICompatibleChatModelId(modelId)
}

/**
 * 从 baseUrl 推断协议：
 * - 路径含 /anthropic → anthropic
 * - 明确 openai / chatgpt / responses 主机或路径 → openai_*
 * - 常见厂商 anthropic 兼容主机（deepseek.com/anthropic、bigmodel.cn/api/anthropic 等）→ anthropic
 * - 常见 OpenAI 兼容主机（openai.com、grok、硅基流动 openai 路径等）→ openai_chat
 */
export function inferApiFormatFromBaseUrl(baseUrl: string | undefined): ApiFormat | null {
  if (!baseUrl?.trim()) return null
  let url: URL
  try {
    url = new URL(baseUrl.trim())
  } catch {
    const lower = baseUrl.toLowerCase()
    if (lower.includes('/anthropic')) return 'anthropic'
    if (lower.includes('/responses')) return 'openai_responses'
    if (lower.includes('/chat/completions') || lower.includes('/v1')) return 'openai_chat'
    return null
  }

  const host = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()
  const full = `${host}${path}`

  // 显式 Anthropic Messages 路径
  if (path.includes('/anthropic') || path.endsWith('/v1/messages')) {
    return 'anthropic'
  }

  // Responses API
  if (path.includes('/responses') || full.includes('codex')) {
    return 'openai_responses'
  }

  // 官方 / 常见 Anthropic 兼容中转（路径或主机特征）
  if (
    host === 'api.anthropic.com' ||
    host.endsWith('.anthropic.com') ||
    full.includes('deepseek.com/anthropic') ||
    full.includes('bigmodel.cn/api/anthropic') ||
    full.includes('moonshot.cn/anthropic') ||
    full.includes('moonshot.ai/anthropic') ||
    full.includes('minimaxi.com/anthropic') ||
    full.includes('minimax.chat/anthropic') ||
    full.includes('jiekou.ai/anthropic') ||
    full.includes('api.moonshot') && path.includes('anthropic')
  ) {
    return 'anthropic'
  }

  // 明确 OpenAI 官方 / Codex
  if (
    host.includes('api.openai.com') ||
    host.includes('chatgpt.com') ||
    full.includes('backend-api/codex')
  ) {
    return path.includes('response') || full.includes('codex')
      ? 'openai_responses'
      : 'openai_chat'
  }

  // 常见 OpenAI Chat 兼容网关
  if (
    host.includes('openrouter.ai') ||
    host.includes('together.xyz') ||
    host.includes('groq.com') ||
    host.includes('fireworks.ai') ||
    host.includes('siliconflow') ||
    host.includes('deepinfra') ||
    host.includes('xiaomimimo.com') ||
    host.includes('dashscope.aliyuncs.com') ||
    (host.includes('deepseek.com') && !path.includes('anthropic')) ||
    (host.includes('bigmodel.cn') && !path.includes('anthropic')) ||
    (host.includes('moonshot') && !path.includes('anthropic'))
  ) {
    return 'openai_chat'
  }

  // 路径形态：/v1 且无 anthropic → 倾向 chat
  if ((path === '/v1' || path.startsWith('/v1/') || path.endsWith('/v1')) && !path.includes('anthropic')) {
    return 'openai_chat'
  }

  return null
}

/**
 * 综合 baseUrl + 模型名推断 API 格式。
 *
 * 优先级：
 * 1. baseUrl 明确为 anthropic 兼容路径 → anthropic（即使模型名是 deepseek-*）
 * 2. baseUrl 明确为 openai / responses → 对应 openai_*
 * 3. 模型名为 GPT/Codex → openai_responses 或 openai_chat
 * 4. 模型名为 DeepSeek/MIMO/Qwen/GLM 等兼容 chat 名，且 baseUrl 非 anthropic → openai_chat
 * 5. 默认 anthropic（不路由）
 */
export function inferApiFormatForModelsAndBaseUrl(
  modelIds: Iterable<string>,
  baseUrl?: string,
): ApiFormat {
  const fromUrl = inferApiFormatFromBaseUrl(baseUrl)
  // URL 明确声明 anthropic 时，绝不做协议转换
  if (fromUrl === 'anthropic') return 'anthropic'

  let sawGpt = false
  let sawCompatChat = false
  let preferChat = false
  let preferResponses = false
  let sawOnlyClaude = true

  for (const raw of modelIds) {
    const modelId = raw.trim()
    if (!modelId) continue
    if (!looksLikeClaudeNativeModelId(modelId)) sawOnlyClaude = false

    if (looksLikeOpenAIModelId(modelId)) {
      sawGpt = true
      const lower = modelId.toLowerCase()
      if (
        lower.includes('codex') ||
        lower.includes('response') ||
        lower.includes('gpt-5') ||
        /^o[1-9]/.test(lower)
      ) {
        preferResponses = true
      }
      if (
        lower.includes('gpt-3.5') ||
        lower.includes('gpt-4o') ||
        lower.includes('gpt-4-turbo') ||
        lower.includes('gpt-4.1') ||
        (lower.includes('chat') && !lower.includes('chatgpt'))
      ) {
        preferChat = true
      }
    } else if (looksLikeOpenAICompatibleChatModelId(modelId)) {
      sawCompatChat = true
    }
  }

  if (fromUrl === 'openai_responses') return 'openai_responses'
  if (fromUrl === 'openai_chat') {
    // URL 已是 OpenAI 兼容：若模型是 GPT-5/codex 可升为 responses，否则 chat
    if (preferResponses) return 'openai_responses'
    return 'openai_chat'
  }

  if (sawGpt) {
    if (preferResponses) return 'openai_responses'
    if (preferChat) return 'openai_chat'
    return 'openai_responses'
  }

  // DeepSeek / MIMO / Qwen 等：无 anthropic URL 时走 chat 转换
  if (sawCompatChat) return 'openai_chat'

  if (sawOnlyClaude) return 'anthropic'
  return 'anthropic'
}

/** @deprecated 使用 inferApiFormatForModelsAndBaseUrl；保留兼容旧测试 */
export function inferApiFormatForModelIds(modelIds: Iterable<string>): ApiFormat {
  return inferApiFormatForModelsAndBaseUrl(modelIds)
}

/**
 * 上游真实模型 ID：优先 *_MODEL_NAME（若与 Claude 角色 ID 不同且像上游模型），
 * 否则用 ANTHROPIC_DEFAULT_*_MODEL 本身。
 */
export function resolveUpstreamModelId(modelId: string, displayName: string): string {
  if (!displayName || displayName === modelId) return modelId
  // 显示名是上游真实 ID（GPT / DeepSeek / MIMO 等），请求时需改写
  if (looksLikeNonAnthropicUpstreamModelId(displayName) || !looksLikeClaudeNativeModelId(displayName)) {
    // 显示名若只是友好标签（无版本号、无厂商特征）则不改写
    if (looksLikeNonAnthropicUpstreamModelId(displayName)) return displayName
    // 显示名与 modelId 都非 Claude 时，用显示名
    if (!looksLikeClaudeNativeModelId(modelId) && displayName.trim()) return displayName
  }
  return modelId
}

export function collectClaudeRoleModelEntries(
  settings: Record<string, unknown>,
): ClaudeRoleModelEntry[] {
  const env = readSettingsEnv(settings)
  const entries: ClaudeRoleModelEntry[] = []

  for (const role of CLAUDE_ROLE_MODELS) {
    const modelId = env[role.modelKey]?.trim()
    if (!modelId) continue
    const displayName = env[role.nameKey]?.trim() || modelId
    const description = env[role.descriptionKey]?.trim() || undefined
    const upstreamModelId = resolveUpstreamModelId(modelId, displayName)
    entries.push({
      roleId: role.id,
      role: role.role,
      modelId,
      displayName,
      ...(description ? { description } : {}),
      upstreamModelId,
    })
  }

  return entries
}

export function buildClaudeRoleUpstreamModelMap(
  settings: Record<string, unknown>,
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const entry of collectClaudeRoleModelEntries(settings)) {
    if (entry.upstreamModelId !== entry.modelId) {
      map[entry.modelId] = entry.upstreamModelId
    }
    map[entry.roleId] = entry.upstreamModelId
  }

  const env = readSettingsEnv(settings)
  const mainModel = env.ANTHROPIC_MODEL?.trim()
  if (mainModel && !map[mainModel]) {
    const upstreamName = CLAUDE_ROLE_MODELS
      .map((role) => env[role.nameKey]?.trim())
      .find((name) => name && looksLikeNonAnthropicUpstreamModelId(name))
    if (upstreamName) map[mainModel] = upstreamName
  }

  return map
}

function readAuthTokenFromEnv(env: Record<string, string>): string {
  const token = env.ANTHROPIC_AUTH_TOKEN?.trim() || env.ANTHROPIC_API_KEY?.trim() || ''
  if (!token || token.toLowerCase() === 'proxy_managed' || token.toLowerCase() === 'proxy-managed') {
    return token
  }
  return token
}

function isLocalProxyBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl)
    return (
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1') &&
      (url.port === '15721' || url.pathname.includes('proxy'))
    )
  } catch {
    return false
  }
}

function isProxyManagedToken(token: string): boolean {
  const normalized = token.trim().toLowerCase()
  return !normalized || normalized === 'proxy_managed' || normalized === 'proxy-managed'
}

/**
 * 从 Claude Code / cc-switch 配置构建角色路由 provider。
 *
 * 路由策略（不影响 anthropic Messages 原生接口）：
 * 1. baseUrl 为 /anthropic 或模型全是 Claude → apiFormat=anthropic，直连
 * 2. DeepSeek/MIMO/Qwen/GPT 等 + 真实上游密钥 → openai_chat 或 openai_responses，
 *    由 Minicode 内置 proxy 转换，无需开 cc-switch 路由开关
 * 3. 本地代理占位（PROXY_MANAGED + 127.0.0.1:15721）→ anthropic 直连该代理
 */
export function buildClaudeRoleRoutingProviderConfig(
  settings: Record<string, unknown>,
  source: 'managed' | 'user' = 'user',
): ClaudeRoleRoutingProviderConfig | null {
  if (!hasClaudeRoleRoutingSettings(settings)) return null

  const env = readSettingsEnv(settings)
  const modelEntries = collectClaudeRoleModelEntries(settings)
  if (modelEntries.length === 0) return null

  const candidateModelIds = [
    ...modelEntries.map((entry) => entry.modelId),
    ...modelEntries.map((entry) => entry.displayName),
    ...modelEntries.map((entry) => entry.upstreamModelId),
    env.ANTHROPIC_MODEL?.trim() || '',
    env.CLAUDE_CODE_SUBAGENT_MODEL?.trim() || '',
  ].filter(Boolean)

  const baseUrl = env.ANTHROPIC_BASE_URL?.trim() || ''
  if (!baseUrl) return null

  const apiKey = readAuthTokenFromEnv(env)
  const inferredFormat = inferApiFormatForModelsAndBaseUrl(candidateModelIds, baseUrl)
  const canSelfRoute =
    inferredFormat !== 'anthropic' &&
    !isProxyManagedToken(apiKey) &&
    !isLocalProxyBaseUrl(baseUrl)

  // 有真实密钥 + 真实上游 + 需转换的模型 → Minicode 自动协议路由
  // 否则保持 anthropic（原生或经已有本地代理）
  const apiFormat: ApiFormat = canSelfRoute ? inferredFormat : 'anthropic'

  const byRole = Object.fromEntries(
    modelEntries.map((entry) => [entry.roleId, entry.modelId]),
  ) as Partial<Record<ClaudeRoleModelId, string>>

  const main =
    env.ANTHROPIC_MODEL?.trim() ||
    byRole.fable ||
    byRole.opus ||
    byRole.sonnet ||
    byRole.haiku ||
    modelEntries[0]!.modelId

  return {
    id: CLAUDE_ROLE_ROUTING_PROVIDER_ID,
    name: 'Claude Code / cc-switch',
    baseUrl,
    apiKey,
    apiFormat,
    models: {
      main,
      fable: byRole.fable || main,
      haiku: byRole.haiku || main,
      sonnet: byRole.sonnet || main,
      opus: byRole.opus || main,
    },
    modelEntries,
    upstreamModelMap: apiFormat === 'anthropic'
      ? {}
      : buildClaudeRoleUpstreamModelMap(settings),
    source,
  }
}

/**
 * 为会话子进程构建角色路由运行时 env。
 * - anthropic：直连配置中的 BASE_URL，不做协议转换
 * - openai_*：BASE_URL 指向 Minicode 本地 proxy，由 proxy 做 Anthropic↔OpenAI 转换
 */
function resolveSelectedClaudeRoleModelId(
  config: ClaudeRoleRoutingProviderConfig,
  selectedModel: string | undefined,
): string {
  const trimmed = selectedModel?.trim()
  if (!trimmed) return config.models.main

  const byRole = config.modelEntries.find((entry) => entry.roleId === trimmed)
  if (byRole) return byRole.modelId

  const byModelId = config.modelEntries.find((entry) => entry.modelId === trimmed)
  if (byModelId) return byModelId.modelId

  return trimmed
}

export function buildClaudeRoleRoutingRuntimeEnv(
  config: ClaudeRoleRoutingProviderConfig,
  options?: { serverPort?: number; model?: string },
): Record<string, string> {
  const serverPort = options?.serverPort ?? ProviderService.getServerPort()
  const useMinicodeProxy = config.apiFormat !== 'anthropic'
  const baseUrl = useMinicodeProxy
    ? `http://127.0.0.1:${serverPort}/proxy/providers/${CLAUDE_ROLE_ROUTING_PROVIDER_ID}`
    : config.baseUrl

  const resolvedMain = resolveSelectedClaudeRoleModelId(config, options?.model)

  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_MODEL: resolvedMain,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: config.models.haiku,
    ANTHROPIC_DEFAULT_SONNET_MODEL: config.models.sonnet,
    ANTHROPIC_DEFAULT_OPUS_MODEL: config.models.opus,
  }

  if (config.models.fable) {
    env.ANTHROPIC_DEFAULT_FABLE_MODEL = config.models.fable
  }

  for (const entry of config.modelEntries) {
    const role = CLAUDE_ROLE_MODELS.find((item) => item.id === entry.roleId)
    if (!role) continue
    env[role.modelKey] = entry.modelId
    if (entry.displayName && entry.displayName !== entry.modelId) {
      env[role.nameKey] = entry.displayName
    }
    if (entry.description) {
      env[role.descriptionKey] = entry.description
    }
  }

  if (useMinicodeProxy) {
    env.ANTHROPIC_API_KEY = 'proxy-managed'
  } else {
    const key = config.apiKey
    if (key && key.toLowerCase() !== 'proxy_managed' && key.toLowerCase() !== 'proxy-managed') {
      env.ANTHROPIC_API_KEY = ''
      env.ANTHROPIC_AUTH_TOKEN = key
    } else if (key) {
      env.ANTHROPIC_API_KEY = key
    }
  }

  return env
}

export function resolveUpstreamModelForClaudeRoleRouting(
  modelId: string,
  config: ClaudeRoleRoutingProviderConfig,
): string {
  const trimmed = modelId.trim()
  if (!trimmed) return trimmed
  return (
    config.upstreamModelMap[trimmed] ||
    config.upstreamModelMap[trimmed.toLowerCase()] ||
    trimmed
  )
}

export function claudeRoleRoutingNeedsProxy(
  config: ClaudeRoleRoutingProviderConfig | null | undefined,
): boolean {
  return !!config && config.apiFormat !== 'anthropic'
}

/** 供测试与调试：判断 base URL 是否为常见本地代理 */
export function isClaudeRoleLocalProxyBaseUrl(baseUrl: string): boolean {
  return isLocalProxyBaseUrl(baseUrl)
}

function readJsonSettingsFile(filePath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * 读取 Claude 官方 / cc-switch 角色路由配置。
 * 优先 managed（cc-haha/settings.json），否则用户级 ~/.claude/settings.json。
 * 有激活的 Minicode 自定义 provider 时不应调用此函数（由调用方保证）。
 */
export function loadClaudeRoleRoutingProviderConfig(
  configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
): ClaudeRoleRoutingProviderConfig | null {
  const managed = readJsonSettingsFile(path.join(configDir, 'cc-haha', 'settings.json'))
  const user = readJsonSettingsFile(path.join(configDir, 'settings.json'))
  const resolved = resolveClaudeRoleRoutingSettings(managed, user)
  if (!resolved) return null
  return buildClaudeRoleRoutingProviderConfig(resolved.settings, resolved.source)
}
