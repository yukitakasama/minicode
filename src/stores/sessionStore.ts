import { create } from 'zustand'
import type { Session, CCSwitchProfile } from '../lib/types'
import { ipc } from '../lib/ipc'

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null
  profiles: CCSwitchProfile[]
  currentProfile: CCSwitchProfile | null

  loadSessions: () => Promise<void>
  createSession: (cwd: string, title?: string) => Promise<Session>
  selectSession: (id: string) => void
  deleteSession: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  loadProfiles: () => Promise<void>
  switchProfile: (providerId: string) => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  profiles: [],
  currentProfile: null,

  loadSessions: async () => {
    const sessions = await ipc.sessionList()
    set({ sessions })
  },

  createSession: async (cwd: string, title?: string) => {
    const { currentProfile } = get()
    const session = await ipc.sessionCreate({
      title: title || null,
      cwd,
      model: currentProfile?.model || null,
      ccswitch_profile: currentProfile?.id || null,
    })
    const { sessions } = get()
    set({ sessions: [session, ...sessions], activeSessionId: session.id })
    return session
  },

  selectSession: (id: string) => set({ activeSessionId: id }),

  deleteSession: async (id: string) => {
    await ipc.sessionDelete(id)
    const { sessions, activeSessionId } = get()
    set({
      sessions: sessions.filter(s => s.id !== id),
      activeSessionId: activeSessionId === id ? null : activeSessionId,
    })
  },

  togglePin: async (id: string) => {
    const session = get().sessions.find(s => s.id === id)
    if (!session) return
    const newPinned = session.is_pinned ? 0 : 1
    await ipc.sessionUpdate(id, { is_pinned: newPinned } as any)
    set({
      sessions: get().sessions.map(s =>
        s.id === id ? { ...s, is_pinned: newPinned } : s
      ),
    })
  },

  renameSession: async (id: string, title: string) => {
    await ipc.sessionUpdate(id, { title } as any)
    set({
      sessions: get().sessions.map(s =>
        s.id === id ? { ...s, title } : s
      ),
    })
  },

  loadProfiles: async () => {
    const profiles = await ipc.ccswitchProfiles()
    const currentProfile = await ipc.ccswitchCurrentProfile()
    set({ profiles, currentProfile })
  },

  switchProfile: async (providerId: string) => {
    await ipc.ccswitchSetProfile(providerId)
    const profiles = get().profiles.map(p => ({
      ...p,
      is_current: p.id === providerId,
    }))
    const currentProfile = profiles.find(p => p.is_current) || null
    set({ profiles, currentProfile })
  },
}))
