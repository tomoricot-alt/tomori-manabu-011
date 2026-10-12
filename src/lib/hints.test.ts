import { describe, expect, it } from 'vitest';
import { generateHints } from './hints';
import { solve, type Op, type Problem } from './math';

const mk = (left: number, op: Op, right: number): Problem => {
  const r = solve(left, op, right);
  if (!r.ok) throw new Error('bad problem');
  return { id: 't', left, op, right, answer: r.answer };
};
const hasNumber = (text: string, n: number) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(text);

describe('3段階のヒント', () => {
  it('どの問題でも3段階あり、空でない', () => {
    for (const p of [mk(12, '+', 8), mk(25, '-', 7), mk(6, '×', 7), mk(24, '÷', 4), mk(0, '+', 3), mk(7, '×', 1)]) {
      const h = generateHints(p);
      expect(h).toHaveLength(3);
      h.forEach((t) => expect(t.length).toBeGreaterThan(5));
    }
  });
  it('段階が上がると内容が変わる', () => {
    const h = generateHints(mk(27, '+', 15));
    expect(new Set(h).size).toBe(3);
  });
  it('くり上がりのたし算は10を作る手順に分ける', () => {
    const h = generateHints(mk(27, '+', 15));
    expect(h[1]).toContain('30');
    expect(h[2]).toContain('30');
  });
  it('九九の範囲のかけ算は、同じ数をたす考え方に導く', () => {
    const h = generateHints(mk(6, '×', 7));
    expect(h[0]).toContain('おなじ かず');
  });
  it('わり算はかけ算の九九に結びつける', () => {
    const h = generateHints(mk(24, '÷', 4));
    expect(h[1]).toContain('かけ');
  });
  it('0や1が出る問題は汎用のやさしい問いかけにする', () => {
    const h = generateHints(mk(7, '×', 1));
    expect(h[0]).toContain('もんだい');
  });
  it('どの問題の、どの段階にも答えの数字をそのまま出さない', () => {
    const ops: Op[] = ['+', '-', '×', '÷'];
    let checked = 0;
    for (const op of ops) {
      for (let a = 0; a <= 120; a += a < 30 ? 1 : 7) {
        for (let b = 0; b <= 40; b += b < 15 ? 1 : 5) {
          const r = solve(a, op, b);
          if (!r.ok) continue;
          const p = { id: 'x', left: a, op, right: b, answer: r.answer };
          generateHints(p).forEach((t) => {
            expect(hasNumber(t, p.answer), `${a}${op}${b}=${p.answer}: ${t}`).toBe(false);
          });
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(1500);
  });
});
