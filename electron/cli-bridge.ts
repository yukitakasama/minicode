import { ChildProcess, spawn, execSync } from 'child_process'
import { EventEmitter } from 'events'
import path from 'path'

interface ClaudeProcess {
  process: ChildProcess
  sessionId: string
  cwd: string
  buffer: string
}

export class CLIBridge extends EventEmitter {
  private processes: Map<string, ClaudeProcess> = new Map()
  private claudePath: string | null = null

  constructor() {
    super()
    this.claudePath = this.findClaudePath()
  }

  private findClaudePath(): string | null {
    try {
      const result = execSync('where claude', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
      return result.trim().split('\n')[0].trim()
    } catch {
      return null
    }
  }

  isAvailable(): boolean {
    return this.claudePath !== null
  }

  getClaudeVersion(): string | null {
    if (!this.claudePath) return null
    try {
      const result = execSync('claude --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
      return result.trim()
    } catch {
      return null
    }
  }

  start(sessionId: string, cwd: string, envVars?: Record<string, string>): boolean {
    if (this.processes.has(sessionId)) {
      return false
    }

    const claudePath = this.claudePath || 'claude'
    const args = [
      '-p',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--session-id', sessionId,
    ]

    const env = { ...process.env, ...envVars }

    const proc = spawn(claudePath, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      shell: process.platform === 'win32',
    })

    const entry: ClaudeProcess = {
      process: proc,
      sessionId,
      cwd,
      buffer: '',
    }

    this.processes.set(sessionId, entry)

    proc.stdout?.on('data', (data: Buffer) => {
      entry.buffer += data.toString()
      const lines = entry.buffer.split('\n')
      entry.buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const event = JSON.parse(trimmed)
          this.emit('event', { sessionId, ...event })
        } catch {
          this.emit('event', { sessionId, type: 'raw', data: trimmed })
        }
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      this.emit('event', { sessionId, type: 'stderr', data: data.toString() })
    })

    proc.on('close', (code) => {
      this.processes.delete(sessionId)
      this.emit('event', { sessionId, type: 'process_exit', code })
    })

    proc.on('error', (err) => {
      this.processes.delete(sessionId)
      this.emit('event', { sessionId, type: 'process_error', error: err.message })
    })

    return true
  }

  send(sessionId: string, message: string): boolean {
    const entry = this.processes.get(sessionId)
    if (!entry || !entry.process.stdin) {
      return false
    }

    const msg = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: message },
      parent_tool_use_id: null,
    })

    entry.process.stdin.write(msg + '\n')
    return true
  }

  approve(sessionId: string, toolUseId: string): boolean {
    const entry = this.processes.get(sessionId)
    if (!entry || !entry.process.stdin) return false

    const msg = JSON.stringify({ type: 'approve', tool_use_id: toolUseId })
    entry.process.stdin.write(msg + '\n')
    return true
  }

  deny(sessionId: string, toolUseId: string): boolean {
    const entry = this.processes.get(sessionId)
    if (!entry || !entry.process.stdin) return false

    const msg = JSON.stringify({ type: 'deny', tool_use_id: toolUseId })
    entry.process.stdin.write(msg + '\n')
    return true
  }

  stop(sessionId: string): boolean {
    const entry = this.processes.get(sessionId)
    if (!entry) return false

    entry.process.kill('SIGTERM')
    this.processes.delete(sessionId)
    return true
  }

  killAll(): void {
    for (const [sessionId] of this.processes) {
      this.stop(sessionId)
    }
  }

  isRunning(sessionId: string): boolean {
    return this.processes.has(sessionId)
  }
}
