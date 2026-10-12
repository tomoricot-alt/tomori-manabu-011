// OCRで読み取った文章から、対応できる計算問題だけを取り出す
import { MAX_DIGITS, type Problem, type UnsupportedReason, newId, normalizeExpression, solve, type Op } from './math';

export interface Skipped {
  text: string;
  reason: UnsupportedReason;
}

export interface Extraction {
  problems: Problem[];
  skipped: Skipped[];
}

// 数字 演算子 数字。前後に数字・演算子・小数点が続く式 (日付や連続計算) は対象外にする
const EXPR = /(?<![\d.])(?<![+\-×÷][ \t]*)(\d+)[ \t]*([+\-×÷])[ \t]*(\d+)(?![\d.])(?![ \t]*[+\-×÷][ \t]*\d)/g;

// 問題番号 「(1)」「1.」「①」などを取り除く
const NUMBERING = /^\s*(?:[(（]\d{1,2}[)）]|\d{1,2}[).．、](?!\d)|[①-⑳])\s*/u;

export function extractProblems(ocrText: string): Extraction {
  const problems: Problem[] = [];
  const skipped: Skipped[] = [];
  for (const rawLine of ocrText.split(/\r?\n/)) {
    const line = rawLine.normalize('NFKC').replace(NUMBERING, '');
    const norm = normalizeExpression(line, true);
    for (const m of norm.matchAll(EXPR)) {
      const [, a, op, b] = m;
      const text = `${a}${op}${b}`;
      if (a.length > MAX_DIGITS || b.length > MAX_DIGITS) {
        skipped.push({ text, reason: 'too-big' });
        continue;
      }
      const left = Number(a);
      const right = Number(b);
      const r = solve(left, op as Op, right);
      if (r.ok) problems.push({ id: newId(), left, op: op as Op, right, answer: r.answer });
      else skipped.push({ text, reason: r.reason });
    }
  }
  return { problems, skipped };
}
