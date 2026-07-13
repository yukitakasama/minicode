import DatabaseLib from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

export interface CCSwitchProfile {
  id: string
  name: string
  is_current: boolean
  env?: Record<string, string>
  model?: string
  effortLevel?: string
}

export class CCSwitchIntegration {
  private db: DatabaseLib.Database | null = null
  private configDir: string

  constructor() {
    this.configDir = path.join(os.homedir(), '.cc-switch')
  }

  init() {
    const dbPath = path.join(this.configDir, 'cc-switch.db')
    if (!fs.existsSync(dbPath)) {
      console.warn('cc-switch.db not found at', dbPath)
      return
    }
    try {
      this.db = new DatabaseLib(dbPath, { readonly: true })
    } catch (err) {
      console.error('Failed to open cc-switch.db:', err)
    }
  }

  close() {
    this.db?.close()
    this.db = null
  }

  getProfiles(appType: string = 'claude'): CCSwitchProfile[] {
    if (!this.db) return []

    const rows = this.db.prepare(
      'SELECT id, name, is_current, settings_config FROM providers WHERE app_type = ?'
    ).all(appType) as any[]

    return rows.map(row => {
      let env: Record<string, string> = {}
      let model: string | undefined
      let effortLevel: string | undefined

      try {
        const config = JSON.parse(row.settings_config || '{}')
        env = config.env || {}
        model = config.model
        effortLevel = config.effortLevel
      } catch {}

      return {
        id: row.id,
        name: row.name,
        is_current: !!row.is_current,
        env,
        model,
        effortLevel,
      }
    })
  }

  getCurrentProfile(appType: string = 'claude'): CCSwitchProfile | null {
    const profiles = this.getProfiles(appType)
    return profiles.find(p => p.is_current) || profiles[0] || null
  }

  getProfileEnvVars(providerId: string): Record<string, string> {
    if (!this.db) return {}

    const row = this.db.prepare(
      'SELECT settings_config FROM providers WHERE id = ?'
    ).get(providerId) as any

    if (!row) return {}

    try {
      const config = JSON.parse(row.settings_config || '{}')
      return config.env || {}
    } catch {
      return {}
    }
  }

  getUsageByDate(startDate: string, endDate: string) {
    if (!this.db) return []

    return this.db.prepare(`
      SELECT date, model, request_count, input_tokens, output_tokens, total_cost_usd
      FROM usage_daily_rollups
      WHERE app_type = 'claude' AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `).all(startDate, endDate)
  }

  getModelPricing() {
    if (!this.db) return []
    return this.db.prepare('SELECT * FROM model_pricing').all()
  }
}
