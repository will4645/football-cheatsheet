/**
 * lib/store.ts
 * ─────────────
 * Unified key-value storage.
 * - Production (Vercel): reads/writes to Supabase `match_cache` table.
 * - Local dev: falls back to JSON files in data/live/ and data/fbref/.
 *
 * Supabase table (run once in SQL editor):
 *   CREATE TABLE match_cache (
 *     key TEXT PRIMARY KEY,
 *     value JSONB NOT NULL,
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Supabase client (lazy) ─────────────────────────────────────────────────
let _supabase: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null;

function supabase() {
  if (_supabase) return _supabase;
  const { createClient } = require('@supabase/supabase-js');
  _supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  return _supabase!;
}

// ── Generic KV ────────────────────────────────────────────────────────────
export async function kvGet<T>(key: string): Promise<T | null> {
  if (USE_SUPABASE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase() as any).from('match_cache').select('value').eq('key', key).single();
    return (data?.value as T) ?? null;
  }
  const file = localPath(key);
  if (!file || !existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf-8')) as T; } catch { return null; }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  if (USE_SUPABASE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase() as any)
      .from('match_cache')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(`Supabase upsert(${key}): ${error.message}`);
    return;
  }
  const file = localPath(key);
  if (!file) return;
  ensureDir(file);
  writeFileSync(file, JSON.stringify(value, null, 2));
}

export async function kvDelete(key: string): Promise<void> {
  if (USE_SUPABASE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase() as any).from('match_cache').delete().eq('key', key);
    return;
  }
  const file = localPath(key);
  if (file && existsSync(file)) unlinkSync(file);
}

export async function kvKeys(prefix: string): Promise<string[]> {
  if (USE_SUPABASE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase() as any).from('match_cache').select('key').like('key', `${prefix}%`);
    return (data ?? []).map((r: { key: string }) => r.key);
  }
  // Local: list files in data/live/
  const dir = join(process.cwd(), 'data', 'live');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json') && f !== 'matches.json' && f !== 'upcoming.json')
    .map(f => `match:${f.replace('.json', '')}`);
}

// ── Typed helpers ──────────────────────────────────────────────────────────
export async function getMatches()                { return kvGet<unknown[]>('matches')  ?? []; }
export async function setMatches(v: unknown[])    { return kvSet('matches', v); }
export async function getUpcoming()               { return kvGet<unknown[]>('upcoming') ?? []; }
export async function setUpcoming(v: unknown[])   { return kvSet('upcoming', v); }
export async function getMatch(id: string)        { return kvGet<unknown>(`match:${id}`); }
export async function setMatch(id: string, v: unknown) { return kvSet(`match:${id}`, v); }
export async function deleteMatch(id: string)     { return kvDelete(`match:${id}`); }
export async function getStatsCache()             { return kvGet<{ scraped: number; players: unknown[] }>('fbref_cache'); }
export async function setStatsCache(v: unknown)   { return kvSet('fbref_cache', v); }

// ── Local file path mapping ────────────────────────────────────────────────
function localPath(key: string): string | null {
  const base = join(process.cwd(), 'data');
  if (key === 'matches')     return join(base, 'live', 'matches.json');
  if (key === 'upcoming')    return join(base, 'live', 'upcoming.json');
  if (key === 'fbref_cache') return join(base, 'fbref', 'players.json');
  if (key.startsWith('match:')) return join(base, 'live', `${key.slice(6)}.json`);
  return null;
}

function ensureDir(filePath: string) {
  const dir = filePath.replace(/[/\\][^/\\]+$/, '');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
