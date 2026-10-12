import { describe, expect, it } from 'vitest';
import { solve, type Problem } from './math';
import { currentHints, currentProblem, startSession, studyReducer } from './session';

const P = (l: number, r: number): Problem => {
  const s = solve(l, '+', r);
  return { id: `p${l}${r}`, left: l, op: '+', right: r, answer: s.ok ? s.answer : 0 };
};
const three = [P(1, 2), P(3, 4), P(5, 6)];

describe('学習の進行', () => {
  it('1問ずつ進む', () => {
    let s = startSession(three);
    expect(currentProblem(s).left).toBe(1);
    s = studyReducer(s, { type: 'next' });
    expect(currentProblem(s).left).toBe(3);
    expect(s.hintCount).toBe(0);
    expect(s.feedback).toBe('none');
  });
  it('最後の問題でつぎへ進むと終了する', () => {
    let s = startSession([P(1, 2)]);
    s = studyReducer(s, { type: 'next' });
    expect(s.ended).toBe('finished');
  });
  it('ヒントは最大3段階まで', () => {
    let s = startSession(three);
    for (let i = 0; i < 6; i++) s = studyReducer(s, { type: 'hint' });
    expect(s.hintCount).toBe(3);
    expect(currentHints(s)).toHaveLength(3);
  });
  it('ヒントを出しただけでは正解にならない', () => {
    const s = studyReducer(startSession(three), { type: 'hint' });
    expect(s.feedback).toBe('none');
  });
  it('正解と誤答を判定し、誤答では答えを出さない', () => {
    let s = startSession(three);
    s = studyReducer(s, { type: 'submit', value: '4' });
    expect(s.feedback).toBe('wrong');
    expect(s.wrongCount).toBe(1);
    s = studyReducer(s, { type: 'submit', value: '3' });
    expect(s.feedback).toBe('correct');
  });
  it('数字でない入力は採点せず、取り組み数にも数えない', () => {
    const s = studyReducer(startSession(three), { type: 'submit', value: '' });
    expect(s.feedback).toBe('need-number');
    expect(s.engaged).toBe(0);
  });
  it('途中で終了できて、取り組んだ数は残る', () => {
    let s = startSession(three);
    s = studyReducer(s, { type: 'hint' });
    s = studyReducer(s, { type: 'next' });
    s = studyReducer(s, { type: 'submit', value: '1' });
    s = studyReducer(s, { type: 'quit' });
    expect(s.ended).toBe('quit');
    expect(s.engaged).toBe(2);
    // 終了後は何も変わらない
    expect(studyReducer(s, { type: 'next' })).toBe(s);
  });
  it('同じ問題で何度答えても取り組み数は1', () => {
    let s = startSession(three);
    s = studyReducer(s, { type: 'submit', value: '1' });
    s = studyReducer(s, { type: 'submit', value: '2' });
    s = studyReducer(s, { type: 'hint' });
    expect(s.engaged).toBe(1);
  });
});
