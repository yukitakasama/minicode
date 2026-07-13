import DatabaseLib from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'

export class Database {
  private db: DatabaseLib.Database | null = null

  private getDbPath(): string {
    const userData = app.getPath('userData')
    return path.join(userData, 'minicode.db')
  }

  init() {
    const dbPath = this.getDbPath()
    this.db = new DatabaseLib(dbPath)

    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        cwd TEXT,
        model TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        ccswitch_profile TEXT,
        is_pinned INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        thinking TEXT,
        tool_use TEXT,
        tool_result TEXT,
        cost_usd REAL,
        tokens_in INTEGER,
        tokens_out INTEGER,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);
    `)
  }

  close() {
    this.db?.close()
    this.db = null
  }

  // Session operations
  createSession(data: { title?: string; cwd: string; model?: string; ccswitch_profile?: string }) {
    const id = randomUUID()
    const now = Date.now()
    this.db!.prepare(
      'INSERT INTO sessions (id, title, cwd, model, created_at, updated_at, ccswitch_profile) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, data.title || null, data.cwd, data.model || null, now, now, data.ccswitch_profile || null)
    return { id, ...data, created_at: now, updated_at: now }
  }

  getSession(id: string) {
    return this.db!.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  }

  listSessions() {
    return this.db!.prepare('SELECT * FROM sessions ORDER BY is_pinned DESC, updated_at DESC').all()
  }

  updateSession(id: string, data: Partial<{ title: string; model: string; is_pinned: number; ccswitch_profile: string }>) {
    const sets: string[] = []
    const values: any[] = []
    for (const [key, val] of Object.entries(data)) {
      sets.push(`${key} = ?`)
      values.push(val)
    }
    sets.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)
    this.db!.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  deleteSession(id: string) {
    this.db!.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  }

  searchSessions(query: string) {
    return this.db!.prepare(
      'SELECT * FROM sessions WHERE title LIKE ? OR cwd LIKE ? ORDER BY updated_at DESC'
    ).all(`%${query}%`, `%${query}%`)
  }

  // Message operations
  createMessage(data: {
    session_id: string
    role: string
    content?: string
    thinking?: string
    tool_use?: string
    tool_result?: string
    cost_usd?: number
    tokens_in?: number
    tokens_out?: number
    duration_ms?: number
  }) {
    const id = randomUUID()
    const now = Date.now()
    this.db!.prepare(
      `INSERT INTO messages (id, session_id, role, content, thinking, tool_use, tool_result, cost_usd, tokens_in, tokens_out, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, data.session_id, data.role, data.content || null,
      data.thinking || null, data.tool_use || null, data.tool_result || null,
      data.cost_usd || null, data.tokens_in || null, data.tokens_out || null,
      data.duration_ms || null, now
    )

    this.db!.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, data.session_id)
    return { id, ...data, created_at: now }
  }

  listMessages(sessionId: string) {
    return this.db!.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
    ).all(sessionId)
  }

  // Settings
  getSetting(key: string): any {
    const row = this.db!.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
    if (!row) return null
    try { return JSON.parse(row.value) } catch { return row.value }
  }

  setSetting(key: string, value: any) {
    const v = typeof value === 'string' ? value : JSON.stringify(value)
    this.db!.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, v)
  }

  // Usage stats
  getUsageStats(startDate?: string, endDate?: string) {
    if (startDate && endDate) {
      return this.db!.prepare(
        `SELECT date, SUM(total_cost_usd) as cost, SUM(input_tokens) as input_tokens,
                SUM(output_tokens) as output_tokens, SUM(request_count) as requests
         FROM usage_rollups WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`
      ).all(startDate, endDate)
    }
    return this.db!.prepare(
      `SELECT date, SUM(total_cost_usd) as cost, SUM(input_tokens) as input_tokens,
              SUM(output_tokens) as output_tokens, SUM(request_count) as requests
       FROM usage_rollups GROUP BY date ORDER BY date DESC LIMIT 30`
    ).all()
  }
}
