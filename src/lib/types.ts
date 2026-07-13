export interface Session {
  id: string
  title: string | null
  cwd: string
  model: string | null
  created_at: number
  updated_at: number
  ccswitch_profile: string | null
  is_pinned: number
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string | null
  thinking: string | null
  tool_use: string | null
  tool_result: string | null
  cost_usd: number | null
  tokens_in: number | null
  tokens_out: number | null
  duration_ms: number | null
  created_at: number
}

export interface ClaudeEvent {
  sessionId: string
  type: string
  subtype?: string
  message?: {
    role: string
    content: any[]
  }
  content?: string
  tool_use_id?: string
  tool_name?: string
  total_cost_usd?: number
  duration_ms?: number
  session_id?: string
  model?: string
  data?: string
  code?: number
  error?: string
}

export interface CCSwitchProfile {
  id: string
  name: string
  is_current: boolean
  env?: Record<string, string>
  model?: string
  effortLevel?: string
}

export interface UsageStats {
  date: string
  cost: number
  input_tokens: number
  output_tokens: number
  requests: number
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
