import { ipc } from '../../lib/ipc'

export function TitleBar() {
  return (
    <div
      className="h-10 flex items-center justify-between px-4 glass-panel border-b border-white/5"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">M</span>
        </div>
        <span className="text-sm font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          MiniCode
        </span>
      </div>

      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          onClick={() => ipc.minimize()}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => ipc.maximize()}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          onClick={() => ipc.close()}
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
