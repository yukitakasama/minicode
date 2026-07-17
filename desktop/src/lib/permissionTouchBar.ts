import { getDesktopHost } from './desktopHost'
import { useChatStore, listPendingPermissions } from '../stores/chatStore'

type TouchBarAction = { sessionId: string; requestId: string; action: 'allow' | 'deny' | 'allowAlways' }

let initialized = false

export function initPermissionTouchBar() {
  if (initialized) return
  initialized = true

  const host = getDesktopHost()
  if (host.kind !== 'electron') return

  host.events.listen('touchbar-action', (payload: unknown) => {
    const action = payload as TouchBarAction
    if (!action?.sessionId || !action?.requestId || !action?.action) return

    const store = useChatStore.getState()
    if (action.action === 'allow') {
      store.respondToPermission(action.sessionId, action.requestId, true)
    } else if (action.action === 'deny') {
      store.respondToPermission(action.sessionId, action.requestId, false)
    } else if (action.action === 'allowAlways') {
      store.respondToPermission(action.sessionId, action.requestId, true, { rule: 'always' })
    }
  }).catch(() => {})
}

export function syncTouchBarPermissions(sessionId: string) {
  const host = getDesktopHost()
  if (host.kind !== 'electron') return

  const session = useChatStore.getState().sessions[sessionId]
  if (!session) {
    host.commands.invoke('touchbar:update', { sessionId, permissions: [] }).catch(() => {})
    return
  }

  const permissions = listPendingPermissions(session).map((p) => ({
    requestId: p.requestId,
    toolName: p.toolName,
  }))

  host.commands.invoke('touchbar:update', { sessionId, permissions }).catch(() => {})
}
