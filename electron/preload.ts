import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Claude CLI
  claudeStart: (sessionId: string, cwd: string) =>
    ipcRenderer.invoke('claude:start', sessionId, cwd),
  claudeSend: (sessionId: string, message: string) =>
    ipcRenderer.invoke('claude:send', sessionId, message),
  claudeApprove: (sessionId: string, toolUseId: string) =>
    ipcRenderer.invoke('claude:approve', sessionId, toolUseId),
  claudeDeny: (sessionId: string, toolUseId: string) =>
    ipcRenderer.invoke('claude:deny', sessionId, toolUseId),
  claudeStop: (sessionId: string) =>
    ipcRenderer.invoke('claude:stop', sessionId),
  claudeOnEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('claude:event', handler)
    return () => ipcRenderer.removeListener('claude:event', handler)
  },

  // Sessions
  sessionList: () => ipcRenderer.invoke('session:list'),
  sessionGet: (id: string) => ipcRenderer.invoke('session:get', id),
  sessionCreate: (data: any) => ipcRenderer.invoke('session:create', data),
  sessionUpdate: (id: string, data: any) => ipcRenderer.invoke('session:update', id, data),
  sessionDelete: (id: string) => ipcRenderer.invoke('session:delete', id),
  sessionSearch: (query: string) => ipcRenderer.invoke('session:search', query),

  // Messages
  messageList: (sessionId: string) => ipcRenderer.invoke('message:list', sessionId),
  messageCreate: (data: any) => ipcRenderer.invoke('message:create', data),

  // CCSwitch
  ccswitchProfiles: () => ipcRenderer.invoke('ccswitch:profiles'),
  ccswitchCurrentProfile: () => ipcRenderer.invoke('ccswitch:currentProfile'),
  ccswitchSetProfile: (providerId: string) => ipcRenderer.invoke('ccswitch:setProfile', providerId),
  ccswitchUsage: (dateRange?: { start: string; end: string }) =>
    ipcRenderer.invoke('ccswitch:usage', dateRange),

  // Settings
  settingsGet: (key: string) => ipcRenderer.invoke('settings:get', key),
  settingsSet: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
})
