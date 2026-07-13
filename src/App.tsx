import { useEffect } from 'react'
import { TitleBar } from './components/Layout/TitleBar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatView } from './components/Chat/ChatView'
import { StatusBar } from './components/Layout/StatusBar'
import { useSessionStore } from './stores/sessionStore'
import { useChatStore } from './stores/chatStore'
import { ipc } from './lib/ipc'

export default function App() {
  const { loadSessions, loadProfiles, activeSessionId } = useSessionStore()
  const { loadMessages, handleEvent } = useChatStore()

  useEffect(() => {
    loadSessions()
    loadProfiles()

    const unsubscribe = ipc.claudeOnEvent((event) => {
      handleEvent(event)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId)
    }
  }, [activeSessionId])

  return (
    <div className="h-screen flex flex-col bg-[#0a0a14] text-white overflow-hidden select-none">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <ChatView />
      </div>
      <StatusBar />
    </div>
  )
}
