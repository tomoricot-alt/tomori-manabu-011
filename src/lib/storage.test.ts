import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, clearSummary, loadSummary, recordSession, storageAvailable } from './storage';

function memoryStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
const brokenStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('localStorage の集計', () => {
  it('はじめは空', () => {
    expect(loadSummary(memoryStore())).toEqual({ version: 1, sessions: 0, problems: 0, lastDate: null });
  });
  it('学習ごとに回数と問題数を足して保存・読み込みできる', () => {
    const st = memoryStore();
    recordSession(3, st, new Date(2026, 9, 12));
    const s = recordSession(2, st, new Date(2026, 9, 13));
    expect(s).toEqual({ version: 1, sessions: 2, problems: 5, lastDate: '2026-10-13' });
    expect(loadSummary(st)).toEqual(s);
  });
  it('問題文・画像・名前など集計以外は保存しない', () => {
    const st = memoryStore();
    recordSession(4, st);
    const keys = Object.keys(st.dump());
    expect(keys).toEqual([STORAGE_KEY]);
    expect(Object.keys(JSON.parse(st.dump()[STORAGE_KEY])).sort()).toEqual(['lastDate', 'problems', 'sessions', 'version']);
  });
  it('削除できる', () => {
    const st = memoryStore();
    recordSession(1, st);
    expect(clearSummary(st)).toBe(true);
    expect(loadSummary(st).sessions).toBe(0);
    expect(st.dump()).toEqual({});
  });
  it('壊れたデータは無視して空として扱う', () => {
    expect(loadSummary(memoryStore({ [STORAGE_KEY]: '{oops' })).sessions).toBe(0);
    expect(loadSummary(memoryStore({ [STORAGE_KEY]: '{"sessions":-5,"problems":"x","lastDate":"???"}' }))).toEqual({
      version: 1,
      sessions: 0,
      problems: 0,
      lastDate: null,
    });
  });
  it('localStorageが使えなくても止まらない', () => {
    expect(storageAvailable(brokenStore)).toBe(true); // 渡されたストアは使える前提 (検出は getStore 側)
    expect(loadSummary(brokenStore).sessions).toBe(0);
    expect(recordSession(1, brokenStore)).toBeNull();
    expect(clearSummary(brokenStore)).toBe(false);
    expect(recordSession(1, null)).toBeNull();
    expect(storageAvailable(null)).toBe(false);
  });
});
