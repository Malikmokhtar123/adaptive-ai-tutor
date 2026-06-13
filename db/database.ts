import { createClient, Client } from '@libsql/client';

let _client: Client | null = null;
let _inited = false;

export async function getDb(): Promise<Client> {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL ?? 'file:data/tutor.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  if (!_inited) {
    await _client.batch(
      [
        `CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          topic TEXT NOT NULL,
          current_concept TEXT NOT NULL,
          current_difficulty INTEGER NOT NULL DEFAULT 3,
          current_style TEXT NOT NULL DEFAULT 'direct',
          current_question TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          ended_at TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS interactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          concept TEXT NOT NULL,
          question TEXT NOT NULL,
          student_answer TEXT NOT NULL,
          is_correct INTEGER NOT NULL,
          partial_credit REAL DEFAULT 0,
          error_type TEXT,
          hint_used INTEGER NOT NULL DEFAULT 0,
          hint_level INTEGER DEFAULT 0,
          confidence INTEGER DEFAULT 3,
          response_time_ms INTEGER NOT NULL,
          ai_feedback TEXT,
          difficulty_at_time INTEGER NOT NULL,
          style_at_time TEXT NOT NULL,
          timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS learner_state (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          concept TEXT NOT NULL,
          mastery_prob REAL NOT NULL DEFAULT 0.3,
          attempts INTEGER NOT NULL DEFAULT 0,
          correct_count INTEGER NOT NULL DEFAULT 0,
          hint_count INTEGER NOT NULL DEFAULT 0,
          avg_response_time_ms REAL DEFAULT 0,
          consecutive_correct INTEGER NOT NULL DEFAULT 0,
          consecutive_wrong INTEGER NOT NULL DEFAULT 0,
          error_pattern TEXT NOT NULL DEFAULT '{"conceptual":0,"procedural":0,"careless":0}',
          style_effectiveness TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(session_id, concept)
        )`,
      ],
      'write'
    );
    _inited = true;
  }
  return _client;
}

// Convert Row values — libsql may return bigint for INTEGER columns
export function toRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}
