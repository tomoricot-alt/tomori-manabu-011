import { describe, expect, it } from 'vitest';
import { checkAnswer, normalizeExpression, parseProblem } from './math';

const ok = (s: string) => {
  const r = parseProblem(s);
  if (!r.ok) throw new Error(`parse failed: ${s} (${r.reason})`);
  return r.problem;
};

describe('四則計算の解析', () => {
  it.each([
    ['12 + 8', 12, '+', 8, 20],
    ['25 - 7', 25, '-', 7, 18],
    ['6 × 7', 6, '×', 7, 42],
    ['24 ÷ 4', 24, '÷', 4, 6],
    ['0 + 0', 0, '+', 0, 0],
    ['0 ÷ 5', 0, '÷', 5, 0],
  ])('%s を読める', (text, l, op, r, ans) => {
    const p = ok(text);
    expect([p.left, p.op, p.right, p.answer]).toEqual([l, op, r, ans]);
  });
});

describe('全角・半角と記号の正規化', () => {
  it('全角数字・全角記号を半角にそろえる', () => {
    const p = ok('１２＋８＝');
    expect([p.left, p.op, p.right, p.answer]).toEqual([12, '+', 8, 20]);
  });
  it.each(['6x7', '6X7', '6*7', '6＊7', '6 ✕ 7', '６×７'])('かけ算の表記 %s', (s) => {
    expect(ok(s).op).toBe('×');
    expect(ok(s).answer).toBe(42);
  });
  it.each(['24/4', '24／4', '24:4', '24÷4', '２４÷４'])('わり算の表記 %s', (s) => {
    expect(ok(s).op).toBe('÷');
    expect(ok(s).answer).toBe(6);
  });
  it.each(['25-7', '25−7', '25－7', '25ー7', '25–7'])('ひき算の表記 %s', (s) => {
    expect(ok(s).op).toBe('-');
    expect(ok(s).answer).toBe(18);
  });
  it('空白を取り除く', () => {
    expect(normalizeExpression(' 1 2 + 3 ')).toBe('12+3');
  });
});

describe('不正な式・未対応の式を拒否する', () => {
  it.each(['', '   ', 'abc', '12', '12 +', '+ 5', '1.5 + 2', '12 + 8 + 3', '3 + ? ', '１２＋あ'])('「%s」は式として読まない', (s) => {
    const r = parseProblem(s);
    expect(r.ok).toBe(false);
  });
  it('0による除算を拒否する', () => {
    const r = parseProblem('8 ÷ 0');
    expect(r).toEqual({ ok: false, reason: 'divide-by-zero' });
  });
  it('余りのあるわり算は自動採点しない', () => {
    expect(parseProblem('7 ÷ 2')).toEqual({ ok: false, reason: 'remainder' });
  });
  it('答えがマイナスになるひき算は対象外', () => {
    expect(parseProblem('3 - 5')).toEqual({ ok: false, reason: 'negative' });
  });
  it('大きすぎる数は対象外', () => {
    expect(parseProblem('12345 + 1')).toEqual({ ok: false, reason: 'too-big' });
  });
});

describe('正答判定', () => {
  const p = ok('12 + 8');
  it('正解を判定する', () => {
    expect(checkAnswer(p, '20')).toBe('correct');
    expect(checkAnswer(p, ' ２０ ')).toBe('correct');
  });
  it('誤答を判定する', () => {
    expect(checkAnswer(p, '19')).toBe('wrong');
    expect(checkAnswer(p, '0')).toBe('wrong');
  });
  it('数字でない入力・空欄は採点しない', () => {
    expect(checkAnswer(p, '')).toBe('invalid');
    expect(checkAnswer(p, 'にじゅう')).toBe('invalid');
    expect(checkAnswer(p, '2 0')).toBe('invalid');
    expect(checkAnswer(p, '-20')).toBe('invalid');
  });
  it('答えが0の問題を判定できる', () => {
    const z = ok('5 - 5');
    expect(checkAnswer(z, '0')).toBe('correct');
    expect(checkAnswer(z, '5')).toBe('wrong');
  });
});
