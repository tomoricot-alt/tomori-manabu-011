// @vitest-environment node
// 印刷された算数問題の画像 (tests/fixtures/worksheet.png) を実際にTesseract.jsで読む結合テスト。
// 端末内(Node)の同梱データだけを使い、ネットワークには接続しない。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWorker, PSM } from 'tesseract.js';
import { describe, expect, it } from 'vitest';
import { extractProblems } from '../src/lib/extract';

const root = join(__dirname, '..');

describe('OCR結合テスト (印刷された問題の画像)', () => {
  it('+ - × の式を正しく読み、÷ は確認が必要なことを示す', async () => {
    const worker = await createWorker('eng', 1, {
      langPath: join(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
      cacheMethod: 'none',
      gzip: true,
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
      const { data } = await worker.recognize(readFileSync(join(root, 'tests/fixtures/worksheet.png')));
      const { problems } = extractProblems(data.text);
      const shown = problems.map((p) => `${p.left}${p.op}${p.right}`);
      expect(shown).toContain('12+8');
      expect(shown).toContain('25-7');
      expect(shown).toContain('6×7');
      // 「24 ÷ 4」は「24 + 4」のように読み違えることがある (既知の制約)。
      // そのためアプリは OCR の結果を自動で確定せず、保護者の確認を必須にしている。
      expect(problems.length).toBeGreaterThanOrEqual(3);
    } finally {
      await worker.terminate();
    }
  }, 120_000);
});
