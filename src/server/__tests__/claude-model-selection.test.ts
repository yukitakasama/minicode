import { describe, expect, test } from 'bun:test'

import {
  buildClaudeRoleRoutingProviderConfig,
  buildClaudeRoleRoutingRuntimeEnv,
  buildClaudeRoleUpstreamModelMap,
  collectClaudeRoleModelEntries,
  hasClaudeRoleModelEnv,
  hasClaudeRoleRoutingEnv,
  inferApiFormatForModelIds,
  inferApiFormatForModelsAndBaseUrl,
  inferApiFormatFromBaseUrl,
  isClaudeRoleRoutingModel,
  looksLikeOpenAICompatibleChatModelId,
  looksLikeOpenAIModelId,
  readSettingsEnv,
  resolveClaudeRoleModel,
  resolveClaudeRoleRoutingModelSetting,
  resolveClaudeRoleRoutingSettings,
  resolveUpstreamModelForClaudeRoleRouting,
} from '../services/claudeModelSelection.js'

const CC_SWITCH_SETTINGS = {
  env: {
    ANTHROPIC_AUTH_TOKEN: 'PROXY_MANAGED',
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:15721',
    ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5',
    ANTHROPIC_DEFAULT_FABLE_MODEL_NAME: 'gpt-5.6-sol',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
    ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME: 'gpt-5.4',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-8',
    ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: 'gpt-5.6-terra',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
    ANTHROPIC_DEFAULT_SONNET_MODEL_NAME: 'gpt-5.6-luna',
    CLAUDE_CODE_SUBAGENT_MODEL: 'gpt-5.6-sol',
  },
  model: 'claude-opus-4-7',
}

describe('claudeModelSelection', () => {
  test('accepts only non-empty string role model settings', () => {
    expect(hasClaudeRoleModelEnv({ ANTHROPIC_DEFAULT_FABLE_MODEL: ' claude-fable-5 ' })).toBe(true)
    expect(hasClaudeRoleModelEnv({ ANTHROPIC_DEFAULT_FABLE_MODEL: '   ' })).toBe(false)
    expect(readSettingsEnv({ env: ['not', 'an', 'object'] })).toEqual({})
    expect(readSettingsEnv({
      env: {
        ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5',
        INVALID_NUMBER: 42,
      },
    })).toEqual({ ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5' })
  })

  test('requires both role mappings and provider transport for external routing', () => {
    expect(hasClaudeRoleRoutingEnv({
      ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5',
    })).toBe(false)
    expect(hasClaudeRoleRoutingEnv({
      ANTHROPIC_AUTH_TOKEN: 'PROXY_MANAGED',
    })).toBe(false)
    expect(hasClaudeRoleRoutingEnv({
      ANTHROPIC_AUTH_TOKEN: 'PROXY_MANAGED',
      ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5',
    })).toBe(true)
  })

  test('prefers managed routing settings and falls back to user settings', () => {
    const managed = { env: {
      ANTHROPIC_BASE_URL: 'https://managed.example.com',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'managed-opus',
    } }
    const user = { env: {
      ANTHROPIC_AUTH_TOKEN: 'user-token',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'user-opus',
    } }

    expect(resolveClaudeRoleRoutingSettings(managed, user)).toEqual({
      settings: managed,
      source: 'managed',
    })
    expect(resolveClaudeRoleRoutingSettings({}, user)).toEqual({
      settings: user,
      source: 'user',
    })
    expect(resolveClaudeRoleRoutingSettings({
      env: { ANTHROPIC_DEFAULT_OPUS_MODEL: 'role-only' },
    }, user)).toEqual({
      settings: user,
      source: 'user',
    })
    expect(resolveClaudeRoleRoutingSettings({}, {})).toBeNull()
  })

  test('resolves role aliases without treating arbitrary model ids as aliases', () => {
    const settings = {
      env: { ANTHROPIC_DEFAULT_FABLE_MODEL: ' claude-fable-5[1M] ' },
    }

    expect(resolveClaudeRoleModel('fable', settings)).toBe('claude-fable-5[1M]')
    expect(resolveClaudeRoleModel('custom-model', settings)).toBeUndefined()
  })

  test('accepts only models owned by the external routing catalog', () => {
    const settings = {
      model: 'routed-extra',
      env: {
        ANTHROPIC_MODEL: 'routed-main',
        ANTHROPIC_DEFAULT_FABLE_MODEL: 'routed-fable',
        CLAUDE_CODE_MODEL_CONTEXT_WINDOWS: JSON.stringify({
          'routed-extra': 128_000,
        }),
      },
    }

    expect(isClaudeRoleRoutingModel('fable', settings)).toBe(true)
    expect(isClaudeRoleRoutingModel('routed-main', settings)).toBe(true)
    expect(isClaudeRoleRoutingModel('routed-extra', settings)).toBe(true)
    expect(isClaudeRoleRoutingModel('gpt-stale', settings)).toBe(false)
    expect(resolveClaudeRoleRoutingModelSetting(settings)).toBe('routed-extra')
    expect(resolveClaudeRoleRoutingModelSetting({ ...settings, model: 'gpt-stale' })).toBeUndefined()
  })

  test('detects OpenAI-like model ids and infers api formats', () => {
    expect(looksLikeOpenAIModelId('gpt-5.6-sol')).toBe(true)
    expect(looksLikeOpenAIModelId('claude-opus-4-8')).toBe(false)
    expect(looksLikeOpenAIModelId('anthropic/claude-sonnet-4.6')).toBe(false)
    expect(inferApiFormatForModelIds(['claude-sonnet-4-6'])).toBe('anthropic')
    expect(inferApiFormatForModelIds(['gpt-5.6-sol', 'claude-fable-5'])).toBe('openai_responses')
    expect(inferApiFormatForModelIds(['gpt-4o-mini'])).toBe('openai_chat')
    expect(inferApiFormatForModelIds(['gpt-5.3-codex'])).toBe('openai_responses')
  })

  test('detects DeepSeek / MIMO / Qwen style models and baseUrl protocols', () => {
    expect(looksLikeOpenAICompatibleChatModelId('deepseek-chat')).toBe(true)
    expect(looksLikeOpenAICompatibleChatModelId('deepseek-v4-pro')).toBe(true)
    expect(looksLikeOpenAICompatibleChatModelId('mimo-v2-flash')).toBe(true)
    expect(looksLikeOpenAICompatibleChatModelId('qwen3.6:27b')).toBe(true)
    expect(looksLikeOpenAICompatibleChatModelId('glm-5.2')).toBe(true)
    expect(looksLikeOpenAICompatibleChatModelId('claude-sonnet-4-6')).toBe(false)

    // baseUrl 含 /anthropic → 绝不路由，即使模型名是 deepseek
    expect(inferApiFormatFromBaseUrl('https://api.deepseek.com/anthropic')).toBe('anthropic')
    expect(inferApiFormatForModelsAndBaseUrl(
      ['deepseek-v4-pro'],
      'https://api.deepseek.com/anthropic',
    )).toBe('anthropic')

    // DeepSeek OpenAI 兼容端（无 /anthropic）→ openai_chat
    expect(inferApiFormatFromBaseUrl('https://api.deepseek.com/v1')).toBe('openai_chat')
    expect(inferApiFormatForModelsAndBaseUrl(
      ['deepseek-chat'],
      'https://api.deepseek.com/v1',
    )).toBe('openai_chat')

    // MIMO
    expect(inferApiFormatForModelsAndBaseUrl(
      ['mimo-v2-flash'],
      'https://api.xiaomimimo.com/v1',
    )).toBe('openai_chat')

    // 仅模型名、无 anthropic URL → chat
    expect(inferApiFormatForModelsAndBaseUrl(['deepseek-reasoner', 'mimo-v2'])).toBe('openai_chat')

    // GLM 官方 anthropic 端
    expect(inferApiFormatForModelsAndBaseUrl(
      ['glm-5.2'],
      'https://open.bigmodel.cn/api/anthropic',
    )).toBe('anthropic')
  })

  test('routes DeepSeek OpenAI-compatible configs through Minicode chat proxy', () => {
    const settings = {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-deepseek-key',
        ANTHROPIC_BASE_URL: 'https://api.deepseek.com/v1',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-reasoner',
        ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: 'deepseek-reasoner',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-chat',
        ANTHROPIC_DEFAULT_SONNET_MODEL_NAME: 'deepseek-chat',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-chat',
        ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME: 'deepseek-chat',
      },
    }
    const config = buildClaudeRoleRoutingProviderConfig(settings, 'user')
    expect(config).not.toBeNull()
    expect(config!.apiFormat).toBe('openai_chat')

    const env = buildClaudeRoleRoutingRuntimeEnv(config!, { serverPort: 3456, model: 'sonnet' })
    expect(env.ANTHROPIC_BASE_URL).toBe(
      'http://127.0.0.1:3456/proxy/providers/claude-role-routing',
    )
    expect(env.ANTHROPIC_API_KEY).toBe('proxy-managed')
    expect(env.ANTHROPIC_MODEL).toBe('deepseek-chat')
  })

  test('keeps DeepSeek anthropic endpoint unrouted', () => {
    const settings = {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-deepseek-key',
        ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-v4-pro',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-v4-pro',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-v4-flash',
      },
    }
    const config = buildClaudeRoleRoutingProviderConfig(settings, 'user')
    expect(config).not.toBeNull()
    expect(config!.apiFormat).toBe('anthropic')
    const env = buildClaudeRoleRoutingRuntimeEnv(config!, { serverPort: 3456 })
    expect(env.ANTHROPIC_BASE_URL).toBe('https://api.deepseek.com/anthropic')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('sk-deepseek-key')
  })

  test('routes MIMO OpenAI-compatible configs and maps display names', () => {
    const settings = {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-mimo',
        ANTHROPIC_BASE_URL: 'https://api.xiaomimimo.com/v1',
        ANTHROPIC_DEFAULT_FABLE_MODEL: 'claude-fable-5',
        ANTHROPIC_DEFAULT_FABLE_MODEL_NAME: 'mimo-v2-pro',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
        ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME: 'mimo-v2-flash',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_SONNET_MODEL_NAME: 'mimo-v2-pro',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-8',
        ANTHROPIC_DEFAULT_OPUS_MODEL_NAME: 'mimo-v2-pro',
      },
    }
    const config = buildClaudeRoleRoutingProviderConfig(settings, 'user')
    expect(config).not.toBeNull()
    expect(config!.apiFormat).toBe('openai_chat')
    expect(resolveUpstreamModelForClaudeRoleRouting('claude-fable-5', config!)).toBe('mimo-v2-pro')
    expect(resolveUpstreamModelForClaudeRoleRouting('haiku', config!)).toBe('mimo-v2-flash')
  })

  test('builds cc-switch style role catalog with GPT upstream map', () => {
    const entries = collectClaudeRoleModelEntries(CC_SWITCH_SETTINGS)
    expect(entries.map((entry) => entry.roleId)).toEqual(['fable', 'opus', 'sonnet', 'haiku'])
    expect(entries.find((entry) => entry.roleId === 'fable')).toMatchObject({
      modelId: 'claude-fable-5',
      displayName: 'gpt-5.6-sol',
      upstreamModelId: 'gpt-5.6-sol',
    })

    const map = buildClaudeRoleUpstreamModelMap(CC_SWITCH_SETTINGS)
    expect(map['claude-fable-5']).toBe('gpt-5.6-sol')
    expect(map.fable).toBe('gpt-5.6-sol')
    expect(map['claude-haiku-4-5']).toBe('gpt-5.4')

    // 本地代理占位：仍识别全部角色模型，但不伪造 openai 上游
    const localConfig = buildClaudeRoleRoutingProviderConfig(CC_SWITCH_SETTINGS, 'user')
    expect(localConfig).not.toBeNull()
    expect(localConfig!.apiFormat).toBe('anthropic')
    expect(localConfig!.models.fable).toBe('claude-fable-5')
    expect(localConfig!.models.haiku).toBe('claude-haiku-4-5')
    expect(localConfig!.models.sonnet).toBe('claude-sonnet-4-6')
    expect(localConfig!.models.opus).toBe('claude-opus-4-8')

    // 真实上游 + 真实密钥 + GPT 显示名：无需 cc-switch 路由开关，Minicode 自动 openai 路由
    const remoteSettings = {
      env: {
        ...CC_SWITCH_SETTINGS.env,
        ANTHROPIC_BASE_URL: 'https://api.openai-proxy.example/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-real-key',
      },
    }
    const config = buildClaudeRoleRoutingProviderConfig(remoteSettings, 'user')
    expect(config).not.toBeNull()
    expect(config!.apiFormat).toBe('openai_responses')
    expect(resolveUpstreamModelForClaudeRoleRouting('claude-opus-4-8', config!)).toBe('gpt-5.6-terra')
    expect(resolveUpstreamModelForClaudeRoleRouting('fable', config!)).toBe('gpt-5.6-sol')
  })

  test('keeps anthropic apiFormat when all role models are Claude-native', () => {
    const settings = {
      env: {
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        ANTHROPIC_API_KEY: 'sk-ant-test',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
      },
    }
    const config = buildClaudeRoleRoutingProviderConfig(settings, 'user')
    expect(config).not.toBeNull()
    expect(config!.apiFormat).toBe('anthropic')

    const env = buildClaudeRoleRoutingRuntimeEnv(config!, { serverPort: 3456 })
    expect(env.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com')
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('sk-ant-test')
    expect(env.ANTHROPIC_API_KEY).toBe('')
  })

  test('routes GPT role configs through Minicode proxy without requiring cc-switch proxy toggle', () => {
    const remoteSettings = {
      env: {
        ...CC_SWITCH_SETTINGS.env,
        ANTHROPIC_BASE_URL: 'https://api.openai-proxy.example/v1',
        ANTHROPIC_AUTH_TOKEN: 'sk-real-key',
      },
    }
    const config = buildClaudeRoleRoutingProviderConfig(remoteSettings, 'user')
    expect(config).not.toBeNull()
    expect(config!.apiFormat).toBe('openai_responses')

    const env = buildClaudeRoleRoutingRuntimeEnv(config!, {
      serverPort: 3456,
      model: 'fable',
    })

    expect(env.ANTHROPIC_BASE_URL).toBe(
      'http://127.0.0.1:3456/proxy/providers/claude-role-routing',
    )
    expect(env.ANTHROPIC_API_KEY).toBe('proxy-managed')
    expect(env.ANTHROPIC_MODEL).toBe('claude-fable-5')
    expect(env.ANTHROPIC_DEFAULT_FABLE_MODEL).toBe('claude-fable-5')
    expect(env.ANTHROPIC_DEFAULT_FABLE_MODEL_NAME).toBe('gpt-5.6-sol')
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('claude-haiku-4-5')
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('claude-sonnet-4-6')
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('claude-opus-4-8')
  })

  test('exposes fable–haiku role env when using local cc-switch proxy endpoint as-is', () => {
    const config = buildClaudeRoleRoutingProviderConfig(CC_SWITCH_SETTINGS, 'user')
    expect(config).not.toBeNull()
    expect(config!.apiFormat).toBe('anthropic')

    const env = buildClaudeRoleRoutingRuntimeEnv(config!, {
      serverPort: 3456,
      model: 'haiku',
    })
    expect(env.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:15721')
    expect(env.ANTHROPIC_MODEL).toBe('claude-haiku-4-5')
    expect(env.ANTHROPIC_DEFAULT_FABLE_MODEL).toBe('claude-fable-5')
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME).toBe('gpt-5.4')
  })
})
