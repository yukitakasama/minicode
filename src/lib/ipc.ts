import type { Session, Message, ClaudeEvent, CCSwitchProfile, UsageStats } from './types'

const api = (window as any).api

export const ipc = {
  // Window
  minimize: () => api.windowMinimize(),
  maximize: () => api.windowMaximize(),
  close: () => api.windowClose(),
  isMaximized: () => api.windowIsMaximized() as Promise<boolean>,

  // Claude CLI
  claudeStart: (sessionId: string, cwd: string) =>
    api.claudeStart(sessionId, cwd) as Promise<boolean>,
  claudeSend: (sessionId: string, message: string) =>
    api.claudeSend(sessionId, message) as Promise<boolean>,
  claudeApprove: (sessionId: string, toolUseId: string) =>
    api.claudeApprove(sessionId, toolUseId) as Promise<boolean>,
  claudeDeny: (sessionId: string, toolUseId: string) =>
    api.claudeDeny(sessionId, toolUseId) as Promise<boolean>,
  claudeStop: (sessionId: string) =>
    api.claudeStop(sessionId) as Promise<boolean>,
  claudeOnEvent: (callback: (event: ClaudeEvent) => void) =>
    api.claudeOnEvent(callback) as () => void,

  // Sessions
  sessionList: () => api.sessionList() as Promise<Session[]>,
  sessionGet: (id: string) => api.sessionGet(id) as Promise<Session>,
  sessionCreate: (data: Partial<Session>) =>
    api.sessionCreate(data) as Promise<Session>,
  sessionUpdate: (id: string, data: Partial<Session>) =>
    api.sessionUpdate(id, data) as Promise<void>,
  sessionDelete: (id: string) => api.sessionDelete(id) as Promise<void>,
  sessionSearch: (query: string) =>
    api.sessionSearch(query) as Promise<Session[]>,

  // Messages
  messageList: (sessionId: string) =>
    api.messageList(sessionId) as Promise<Message[]>,
  messageCreate: (data: Partial<Message>) =>
    api.messageCreate(data) as Promise<Message>,

  // CCSwitch
  ccswitchProfiles: () =>
    api.ccswitchProfiles() as Promise<CCSwitchProfile[]>,
  ccswitchCurrentProfile: () =>
    api.ccswitchCurrentProfile() as Promise<CCSwitchProfile | null>,
  ccswitchSetProfile: (providerId: string) =>
    api.ccswitchSetProfile(providerId) as Promise<Record<string, string>>,
  ccswitchUsage: (dateRange?: { start: string; end: string }) =>
    api.ccswitchUsage(dateRange) as Promise<UsageStats[]>,

  // Settings
  settingsGet: (key: string) => api.settingsGet(key) as Promise<any>,
  settingsSet: (key: string, value: any) =>
    api.settingsSet(key, value) as Promise<void>,

  // Shell
  openExternal: (url: string) => api.openExternal(url),
  showItemInFolder: (filePath: string) => api.showItemInFolder(filePath),
}
