// localStorage には「学習のまとめ」だけを保存する。問題文・画像・名前は保存しない。
export const STORAGE_KEY = 'tomori-manabu-011:summary:v1';

export interface Summary {
  version: 1;
  /** がくしゅうした回数 */
  sessions: number;
  /** とりくんだ問題数 (ぜんぶの合計) */
  problems: number;
  /** さいごに がくしゅうした日 (YYYY-MM-DD) */
  lastDate: string | null;
}

export const EMPTY_SUMMARY: Summary = { version: 1, sessions: 0, problems: 0, lastDate: null };

type StoreLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStore(): StoreLike | null {
  try {
    const s = window.localStorage;
    const probe = `${STORAGE_KEY}:probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function storageAvailable(store: StoreLike | null = getStore()): boolean {
  return store !== null;
}

function sanitize(v: unknown): Summary {
  if (!v || typeof v !== 'object') return { ...EMPTY_SUMMARY };
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  const date = typeof o.lastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.lastDate) ? o.lastDate : null;
  return { version: 1, sessions: n(o.sessions), problems: n(o.problems), lastDate: date };
}

export function loadSummary(store: StoreLike | null = getStore()): Summary {
  if (!store) return { ...EMPTY_SUMMARY };
  try {
    const raw = store.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...EMPTY_SUMMARY };
  } catch {
    return { ...EMPTY_SUMMARY };
  }
}

function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 学習終了時に呼ぶ。保存できたら新しい集計を、できなければ null を返す */
export function recordSession(problemsTried: number, store: StoreLike | null = getStore(), now = new Date()): Summary | null {
  if (!store) return null;
  try {
    const cur = loadSummary(store);
    const next: Summary = {
      version: 1,
      sessions: cur.sessions + 1,
      problems: cur.problems + Math.max(0, Math.floor(problemsTried)),
      lastDate: today(now),
    };
    store.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function clearSummary(store: StoreLike | null = getStore()): boolean {
  if (!store) return false;
  try {
    store.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
