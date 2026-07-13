import { ipcMain, BrowserWindow, shell } from 'electron'
import { CLIBridge } from './cli-bridge'
import { Database } from './database'
import { CCSwitchIntegration } from './ccswitch'

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  cliBridge: CLIBridge,
  database: Database,
  ccswitch: CCSwitchIntegration
) {
  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow.close())
  ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized())

  // Claude CLI events
  cliBridge.on('event', (event) => {
    mainWindow.webContents.send('claude:event', event)
  })

  // Claude CLI controls
  ipcMain.handle('claude:start', (_e, sessionId: string, cwd: string) => {
    const profile = ccswitch.getCurrentProfile()
    const envVars = profile ? ccswitch.getProfileEnvVars(profile.id) : {}
    return cliBridge.start(sessionId, cwd, envVars)
  })

  ipcMain.handle('claude:send', (_e, sessionId: string, message: string) => {
    database.createMessage({ session_id: sessionId, role: 'user', content: message })
    return cliBridge.send(sessionId, message)
  })

  ipcMain.handle('claude:approve', (_e, sessionId: string, toolUseId: string) => {
    return cliBridge.approve(sessionId, toolUseId)
  })

  ipcMain.handle('claude:deny', (_e, sessionId: string, toolUseId: string) => {
    return cliBridge.deny(sessionId, toolUseId)
  })

  ipcMain.handle('claude:stop', (_e, sessionId: string) => {
    return cliBridge.stop(sessionId)
  })

  // Sessions
  ipcMain.handle('session:list', () => database.listSessions())
  ipcMain.handle('session:get', (_e, id: string) => database.getSession(id))
  ipcMain.handle('session:create', (_e, data: any) => database.createSession(data))
  ipcMain.handle('session:update', (_e, id: string, data: any) => database.updateSession(id, data))
  ipcMain.handle('session:delete', (_e, id: string) => database.deleteSession(id))
  ipcMain.handle('session:search', (_e, query: string) => database.searchSessions(query))

  // Messages
  ipcMain.handle('message:list', (_e, sessionId: string) => database.listMessages(sessionId))
  ipcMain.handle('message:create', (_e, data: any) => database.createMessage(data))

  // CCSwitch
  ipcMain.handle('ccswitch:profiles', (_e, appType?: string) => ccswitch.getProfiles(appType))
  ipcMain.handle('ccswitch:currentProfile', (_e, appType?: string) => ccswitch.getCurrentProfile(appType))
  ipcMain.handle('ccswitch:setProfile', (_e, providerId: string) => {
    // This would need to update the cc-switch.db
    // For now, we read the env vars and pass them to CLI
    return ccswitch.getProfileEnvVars(providerId)
  })
  ipcMain.handle('ccswitch:usage', (_e, dateRange?: { start: string; end: string }) => {
    if (dateRange) return ccswitch.getUsageByDate(dateRange.start, dateRange.end)
    const end = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    return ccswitch.getUsageByDate(start, end)
  })

  // Settings
  ipcMain.handle('settings:get', (_e, key: string) => database.getSetting(key))
  ipcMain.handle('settings:set', (_e, key: string, value: any) => database.setSetting(key, value))

  // Shell
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))
  ipcMain.handle('shell:showItemInFolder', (_e, p: string) => shell.showItemInFolder(p))
}
