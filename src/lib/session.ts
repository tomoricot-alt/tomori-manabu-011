// 学習セッションの進行 (1問ずつ / ヒント3だんかい / 途中で終了できる)
import { MAX_HINTS, generateHints } from './hints';
import { checkAnswer, type Problem } from './math';

export type Feedback = 'none' | 'wrong' | 'correct' | 'need-number';

export interface StudyState {
  problems: Problem[];
  index: number;
  /** いま出しているヒントの数 (0〜3) */
  hintCount: number;
  feedback: Feedback;
  /** まちがえた回数 (この問題) */
  wrongCount: number;
  /** ヒントを聞いた/答えを確かめた問題の数 */
  engaged: number;
  engagedIds: string[];
  /** 終了のしかた */
  ended: null | 'finished' | 'quit';
}

export type StudyAction =
  | { type: 'hint' }
  | { type: 'submit'; value: string }
  | { type: 'next' }
  | { type: 'quit' };

export function startSession(problems: Problem[]): StudyState {
  return { problems, index: 0, hintCount: 0, feedback: 'none', wrongCount: 0, engaged: 0, engagedIds: [], ended: null };
}

export function currentProblem(s: StudyState): Problem {
  return s.problems[s.index];
}

export function isLast(s: StudyState): boolean {
  return s.index >= s.problems.length - 1;
}

export function currentHints(s: StudyState): string[] {
  return generateHints(currentProblem(s)).slice(0, s.hintCount);
}

function engage(s: StudyState): StudyState {
  const id = currentProblem(s).id;
  if (s.engagedIds.includes(id)) return s;
  return { ...s, engagedIds: [...s.engagedIds, id], engaged: s.engaged + 1 };
}

export function studyReducer(s: StudyState, a: StudyAction): StudyState {
  if (s.ended) return s;
  switch (a.type) {
    case 'hint': {
      const e = engage(s);
      return { ...e, hintCount: Math.min(MAX_HINTS, e.hintCount + 1), feedback: e.feedback === 'correct' ? 'correct' : 'none' };
    }
    case 'submit': {
      if (s.feedback === 'correct') return s;
      const r = checkAnswer(currentProblem(s), a.value);
      if (r === 'invalid') return { ...s, feedback: 'need-number' };
      const e = engage(s);
      return r === 'correct'
        ? { ...e, feedback: 'correct' }
        : { ...e, feedback: 'wrong', wrongCount: e.wrongCount + 1 };
    }
    case 'next':
      if (isLast(s)) return { ...s, ended: 'finished' };
      return { ...s, index: s.index + 1, hintCount: 0, feedback: 'none', wrongCount: 0 };
    case 'quit':
      return { ...s, ended: 'quit' };
  }
}
