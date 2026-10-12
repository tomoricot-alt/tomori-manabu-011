// 計算問題の正規化・解析・採点 (非負整数の四則計算 / 余りのないわり算のみ)

export type Op = '+' | '-' | '×' | '÷';

export interface Problem {
  id: string;
  left: number;
  op: Op;
  right: number;
  answer: number;
}

export type ParseResult =
  | { ok: true; problem: Problem }
  | { ok: false; reason: UnsupportedReason };

export type UnsupportedReason =
  | 'empty'
  | 'not-math'
  | 'divide-by-zero'
  | 'remainder'
  | 'negative'
  | 'too-big';

export const REASON_TEXT: Record<UnsupportedReason, string> = {
  empty: 'からっぽです',
  'not-math': 'けいさんの かたちでは ありません',
  'divide-by-zero': '0 では われません',
  remainder: 'あまりが でる わりざんは まだ つかえません',
  negative: 'こたえが マイナスに なる ひきざんは まだ つかえません',
  'too-big': 'おおきすぎる かずは まだ つかえません',
};

export const MAX_DIGITS = 4;
export const MAX_PROBLEMS = 5;

const MINUS_LIKE = /[−‐‑‒–—―ーｰ─－]/g;
const TIMES_LIKE = /[xX＊*✕✖⨯·・∗]/g;
const DIVIDE_LIKE = /[/／:：∶÷]/g;
const PLUS_LIKE = /[＋➕]/g;

/** 全角・半角や記号の表記ゆれをそろえる (空白は取り除く) */
export function normalizeExpression(raw: string, keepSpaces = false): string {
  const s = raw
    .normalize('NFKC')
    .replace(MINUS_LIKE, '-')
    .replace(PLUS_LIKE, '+')
    .replace(TIMES_LIKE, '×')
    .replace(DIVIDE_LIKE, '÷');
  return keepSpaces ? s : s.replace(/\s+/g, '');
}

let seq = 0;
export function newId(): string {
  seq += 1;
  return `p${Date.now().toString(36)}${seq}`;
}

/** 「=」「?」「□」などの末尾をはずす */
function stripTail(s: string): string {
  return s.replace(/[=＝?？□]+$/u, '').replace(/\(\)$|（）$/u, '');
}

export function solve(left: number, op: Op, right: number): { ok: true; answer: number } | { ok: false; reason: UnsupportedReason } {
  switch (op) {
    case '+':
      return { ok: true, answer: left + right };
    case '-':
      return left < right ? { ok: false, reason: 'negative' } : { ok: true, answer: left - right };
    case '×':
      return { ok: true, answer: left * right };
    case '÷':
      if (right === 0) return { ok: false, reason: 'divide-by-zero' };
      if (left % right !== 0) return { ok: false, reason: 'remainder' };
      return { ok: true, answer: left / right };
  }
}

/** 1つの式 (例: "12 + 8" "６×７＝") を解析する。確実に読めるものだけ受け付ける */
export function parseProblem(raw: string): ParseResult {
  const norm = stripTail(normalizeExpression(raw));
  if (norm === '') return { ok: false, reason: 'empty' };
  const m = /^(\d+)([+\-×÷])(\d+)$/.exec(norm);
  if (!m) return { ok: false, reason: 'not-math' };
  if (m[1].length > MAX_DIGITS || m[3].length > MAX_DIGITS) return { ok: false, reason: 'too-big' };
  const left = Number(m[1]);
  const right = Number(m[3]);
  const op = m[2] as Op;
  const r = solve(left, op, right);
  if (!r.ok) return r;
  return { ok: true, problem: { id: newId(), left, op, right, answer: r.answer } };
}

export function formatProblem(p: Pick<Problem, 'left' | 'op' | 'right'>): string {
  return `${p.left} ${p.op} ${p.right}`;
}

/** 読み上げ用 (「12 たす 8 は？」) */
export function speakProblem(p: Pick<Problem, 'left' | 'op' | 'right'>): string {
  const word = { '+': 'たす', '-': 'ひく', '×': 'かける', '÷': 'わる' }[p.op];
  return `${p.left} ${word} ${p.right} は いくつかな？`;
}

export type AnswerCheck = 'correct' | 'wrong' | 'invalid';

/** 入力された答え (文字列) を採点する。数字以外・空欄は採点しない */
export function checkAnswer(problem: Problem, input: string): AnswerCheck {
  const norm = input.normalize('NFKC').trim();
  if (!/^\d{1,6}$/.test(norm)) return 'invalid';
  return Number(norm) === problem.answer ? 'correct' : 'wrong';
}
