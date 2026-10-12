import { expect, test } from '@playwright/test';
import { join } from 'node:path';

const BASE = '/tomori-manabu-011/';

test.beforeEach(async ({ page }) => {
  // 同じサイト以外へ通信しないことを確認するため、すべてのリクエストを記録する
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url());
  });
  (page as unknown as { external: string[] }).external = external;
});

test('スマホ幅で横スクロールせず、ホームのボタンが十分大きい', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByText('TOMORI MANABU').first()).toBeVisible();
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW).toBeLessThanOrEqual(390);
  for (const name of [/しゅくだいを とる/, /おためしで あそぶ/]) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
  }
});

test('おためしで最後まで遊べる (音声なしでも操作可能)', async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole('button', { name: /おためしで あそぶ/ }).click();
  await expect(page.getByTestId('problem')).toHaveText('9 + 5 = ?');
  await page.getByRole('button', { name: /ヒントを きく/ }).click();
  await page.getByRole('button', { name: /こたえを いれる/ }).click();
  const input = page.getByLabel(/こたえを いれてね/);
  await expect(input).toHaveAttribute('inputmode', 'numeric');
  await input.fill('10');
  await page.getByRole('button', { name: /たしかめる/ }).click();
  await expect(page.getByTestId('message')).toContainText('おしいね');
  await input.fill('14');
  await page.getByRole('button', { name: /たしかめる/ }).click();
  await expect(page.getByTestId('message')).toContainText('やったね');
  await page.screenshot({ path: 'test-results/study.png' });
  await page.getByRole('button', { name: /きょうは ここまで/ }).click();
  await expect(page.getByText(/よく がんばったね/)).toBeVisible();
});

test('印刷された問題の写真を端末内でOCRし、確認してから学習できる。外部通信はしない', async ({ page }) => {
  await page.goto(BASE);
  await page.getByRole('button', { name: /しゅくだいを とる/ }).click();
  await page.getByTestId('library-input').setInputFiles(join(process.cwd(), 'tests/fixtures/worksheet.png'));
  await page.getByRole('button', { name: /もんだいを よみとる/ }).click();
  await expect(page.getByText('もんだいの かくにん')).toBeVisible({ timeout: 100_000 });
  await page.screenshot({ path: 'test-results/review.png', fullPage: true });
  // 12+8, 25-7, 6x7 が見つかり、未確認のままでは始められない
  const lefts = await page.getByLabel(/ひだりの かず/).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(lefts).toEqual(expect.arrayContaining(['12', '25', '6']));
  await expect(page.getByRole('button', { name: /いっしょに はじめる/ })).toBeDisabled();
  // 「÷」を「＋」と読み違えやすいので、保護者が直す想定: 4番目を÷に直す
  const ops = page.getByLabel(/けいさんの しるし/);
  const n = await ops.count();
  if (n >= 4) await ops.nth(3).selectOption('÷');
  const checks = page.getByRole('checkbox');
  for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).check();
  await expect(page.getByRole('button', { name: /いっしょに はじめる/ })).toBeEnabled();
  await page.getByRole('button', { name: /いっしょに はじめる/ }).click();
  await expect(page.getByTestId('problem')).toHaveText('12 + 8 = ?');
  expect((page as unknown as { external: string[] }).external).toEqual([]);
});

test('OCR用ファイルが同じサイトから配信されている', async ({ request }) => {
  for (const f of ['worker.min.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'eng.traineddata.gz']) {
    const r = await request.get(`${BASE}ocr/${f}`);
    expect(r.status(), f).toBe(200);
  }
});
