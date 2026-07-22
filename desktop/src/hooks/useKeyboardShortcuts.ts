import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useChatStore } from '../stores/chatStore'
import { useTabStore } from '../stores/tabStore'
import { useUIStore } from '../stores/uiStore'
import {
  getAppZoomKeyboardAction,
  nextAppZoomLevel,
} from '../lib/appZoom'
import { useSettingsStore } from '../stores/settingsStore'

const KEYBOARD_SHORTCUT_EVENT = 'minicode:keyboard-shortcut'

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  return element?.isContentEditable === true ||
    element?.tagName === 'INPUT' ||
    element?.tagName === 'TEXTAREA' ||
    element?.tagName === 'SELECT'
}

function dispatchKeyboardShortcut(name: string): void {
  window.dispatchEvent(new CustomEvent(KEYBOARD_SHORTCUT_EVENT, { detail: name }))
}

export { KEYBOARD_SHORTCUT_EVENT }

export function useKeyboardShortcuts() {
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const openModal = useUIStore((s) => s.openModal)
  const closeModal = useUIStore((s) => s.closeModal)
  const activeModal = useUIStore((s) => s.activeModal)
  const stopGeneration = useChatStore((s) => s.stopGeneration)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const chatState = useChatStore((s) => activeTabId ? s.sessions[activeTabId]?.chatState ?? 'idle' : 'idle')
  const uiZoom = useSettingsStore((s) => s.uiZoom)
  const setUiZoom = useSettingsStore((s) => s.setUiZoom)

  const activeModalRef = useRef(activeModal)
  activeModalRef.current = activeModal
  const chatStateRef = useRef(chatState)
  chatStateRef.current = chatState
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId
  const appZoomLevelRef = useRef(uiZoom)
  appZoomLevelRef.current = uiZoom

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const zoomAction = getAppZoomKeyboardAction(e)
      if (zoomAction) {
        e.preventDefault()
        const nextZoom = nextAppZoomLevel(appZoomLevelRef.current, zoomAction)
        appZoomLevelRef.current = nextZoom
        setUiZoom(nextZoom)
        return
      }

      const meta = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const editable = isEditableTarget(e.target)

      if (meta && !editable && key === 'b') {
        e.preventDefault()
        dispatchKeyboardShortcut('toggle-sidebar')
        return
      }

      if (meta && !editable && key === 'l') {
        e.preventDefault()
        dispatchKeyboardShortcut('focus-composer')
        return
      }

      if (meta && !editable && key === 'w') {
        e.preventDefault()
        dispatchKeyboardShortcut('close-tab')
        return
      }

      if (meta && !editable && e.shiftKey && key === 'e') {
        e.preventDefault()
        dispatchKeyboardShortcut('toggle-workspace')
        return
      }

      if (meta && !editable && e.shiftKey && key === 'a') {
        e.preventDefault()
        dispatchKeyboardShortcut('toggle-activity')
        return
      }

      if (meta && !editable && key === 'j') {
        e.preventDefault()
        dispatchKeyboardShortcut('toggle-terminal')
        return
      }

      if (meta && !editable && key === 'tab') {
        e.preventDefault()
        dispatchKeyboardShortcut(e.shiftKey ? 'previous-tab' : 'next-tab')
        return
      }

      if (meta && !editable && /^[1-9]$/.test(key)) {
        e.preventDefault()
        dispatchKeyboardShortcut(`tab-${key}`)
        return
      }

      // Cmd+N — New session
      if (meta && key === 'n') {
        e.preventDefault()
        setActiveSession(null)
        setActiveView('code')
        return
      }

      // Cmd+K — Open global session search
      if (meta && e.key === 'k') {
        e.preventDefault()
        openModal('globalSearch')
      }

      // Ctrl+F — Open find-in-page bar
      if (meta && key === 'f') {
        e.preventDefault()
        openModal('findInPage')
        return
      }

      if (meta && !editable && key === ',') {
        e.preventDefault()
        setActiveView('settings')
        return
      }

      // Escape — Close modal or clear state
      if (e.key === 'Escape') {
        if (activeModalRef.current) {
          closeModal()
        }
      }

      // Cmd+. — Stop generation
      if (meta && key === '.') {
        if (chatStateRef.current !== 'idle' && activeTabIdRef.current) {
          e.preventDefault()
          stopGeneration(activeTabIdRef.current)
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeModal, openModal, setActiveSession, setActiveView, setUiZoom, stopGeneration])
}
