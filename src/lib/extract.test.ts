import { describe, expect, it } from 'vitest';
import { extractProblems } from './extract';

const show = (t: string) => extractProblems(t).problems.map((p) => `${p.left}${p.op}${p.right}=${p.answer}`);

describe('OCR結果から計算問題を取り出す', () => {
  it('問題番号つきの4つの式を取り出す', () => {
    expect(show('(1) 12 + 8 =\n(2) 25 - 7 =\n(3) 6 x 7 =\n(4) 24 ÷ 4 =\n')).toEqual(['12+8=20', '25-7=18', '6×7=42', '24÷4=6']);
  });
  it('番号の書き方がちがっても読める', () => {
    expect(show('1. 3+4\n２）５＋６\n① 7×8')).toEqual(['3+4=7', '5+6=11', '7×8=56']);
  });
  it('1行に複数の式があっても分けて読む', () => {
    expect(show('12 + 8 =    25 - 7 =')).toEqual(['12+8=20', '25-7=18']);
  });
  it('計算でない文章は無視する', () => {
    expect(show('Keisan\nなまえ\n2026-10-12\n3.5 + 1')).toEqual([]);
  });
  it('連続計算は部分的に読まない', () => {
    expect(show('1 + 2 + 3 =')).toEqual([]);
  });
  it('未対応の式は問題にせず、理由つきで分ける', () => {
    const r = extractProblems('7 ÷ 2 =\n5 ÷ 0 =\n3 - 9 =\n10 + 1');
    expect(r.problems.map((p) => p.answer)).toEqual([11]);
    expect(r.skipped.map((s) => s.reason)).toEqual(['remainder', 'divide-by-zero', 'negative']);
  });
  it('空の結果でも止まらない', () => {
    expect(extractProblems('')).toEqual({ problems: [], skipped: [] });
  });
});
