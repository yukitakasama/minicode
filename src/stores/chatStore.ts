import { create } from 'zustand'
import type { Message, ConnectionStatus } from '../lib/types'
import { ipc } from '../lib/ipc'

interface ChatState {
  messages: Message[]
  status: ConnectionStatus
  isStreaming: boolean
  currentAssistantContent: string
  currentThinking: string
  pendingToolUse: { id: string; name: string; input: string } | null

  loadMessages: (sessionId: string) => Promise<void>
  sendMessage: (sessionId: string, content: string) => Promise<void>
  approveTool: (sessionId: string, toolUseId: string) => Promise<void>
  denyTool: (sessionId: string, toolUseId: string) => Promise<void>
  stopGeneration: (sessionId: string) => Promise<void>
  handleEvent: (event: any) => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  status: 'disconnected',
  isStreaming: false,
  currentAssistantContent: '',
  currentThinking: '',
  pendingToolUse: null,

  loadMessages: async (sessionId: string) => {
    const messages = await ipc.messageList(sessionId)
    set({ messages })
  },

  sendMessage: async (sessionId: string, content: string) => {
    const { messages } = get()
    const userMsg: Message = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: 'user',
      content,
      thinking: null,
      tool_use: null,
      tool_result: null,
      cost_usd: null,
      tokens_in: null,
      tokens_out: null,
      duration_ms: null,
      created_at: Date.now(),
    }
    set({ messages: [...messages, userMsg], isStreaming: true, status: 'connecting' })

    await ipc.claudeSend(sessionId, content)
    set({ status: 'connected' })
  },

  approveTool: async (sessionId: string, toolUseId: string) => {
    set({ pendingToolUse: null })
    await ipc.claudeApprove(sessionId, toolUseId)
  },

  denyTool: async (sessionId: string, toolUseId: string) => {
    set({ pendingToolUse: null })
    await ipc.claudeDeny(sessionId, toolUseId)
  },

  stopGeneration: async (sessionId: string) => {
    await ipc.claudeStop(sessionId)
    set({ isStreaming: false, status: 'disconnected' })
  },

  handleEvent: (event: any) => {
    if (event.type === 'system' && event.subtype === 'init') {
      set({ status: 'connected' })
      return
    }

    if (event.type === 'assistant') {
      const content = event.message?.content || []
      let text = ''
      let thinking = ''
      let toolUse: any = null

      for (const block of content) {
        if (block.type === 'text') text += block.text || ''
        if (block.type === 'thinking') thinking += block.thinking || ''
        if (block.type === 'tool_use') {
          toolUse = { id: block.id, name: block.name, input: JSON.stringify(block.input, null, 2) }
        }
      }

      set({
        currentAssistantContent: text,
        currentThinking: thinking,
        pendingToolUse: toolUse,
      })
      return
    }

    if (event.type === 'result') {
      const { currentAssistantContent, currentThinking, messages } = get()
      if (currentAssistantContent || currentThinking) {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          session_id: '',
          role: 'assistant',
          content: currentAssistantContent || null,
          thinking: currentThinking || null,
          tool_use: null,
          tool_result: null,
          cost_usd: event.total_cost_usd || null,
          tokens_in: null,
          tokens_out: null,
          duration_ms: event.duration_ms || null,
          created_at: Date.now(),
        }
        set({
          messages: [...messages, assistantMsg],
          isStreaming: false,
          currentAssistantContent: '',
          currentThinking: '',
          status: 'disconnected',
        })
      }
      return
    }

    if (event.type === 'process_exit' || event.type === 'process_error') {
      set({ isStreaming: false, status: 'disconnected' })
    }
  },

  reset: () => set({
    messages: [],
    status: 'disconnected',
    isStreaming: false,
    currentAssistantContent: '',
    currentThinking: '',
    pendingToolUse: null,
  }),
}))
