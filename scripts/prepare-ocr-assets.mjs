// OCR用のWorker・WASM・言語データを、固定バージョンのnpmパッケージから public/ocr/ にコピーします。
// 実行時に外部CDNへ接続しないため、すべて同じサイト(同一オリジン)から読み込みます。
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'ocr');
mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];
for (const [src, name] of files) {
  const from = join(root, src);
  if (!existsSync(from)) {
    console.error(`✗ ${src} が見つかりません。先に npm ci を実行してください。`);
    process.exit(1);
  }
  copyFileSync(from, join(out, name));
}
console.log(`✓ OCR用ファイル ${files.length} 個を public/ocr/ にコピーしました`);
