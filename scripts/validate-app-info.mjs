// 使い方: node scripts/validate-app-info.mjs <app-info.json> [リポジトリ名]
// 例:     node scripts/validate-app-info.mjs ../tomori-cards-004/app-info.json tomori-cards-004
import { readFileSync } from 'node:fs';
import { parseAppInfo } from './lib/app-info.mjs';

const [file, repo] = process.argv.slice(2);
if (!file) {
  console.error('使い方: node scripts/validate-app-info.mjs <app-info.json> [リポジトリ名]');
  process.exit(2);
}
const r = parseAppInfo(readFileSync(file, 'utf8'), { repo });
if (!r.ok) {
  for (const e of r.errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log(`✓ ${file} は一覧サイトに登録できる形式です (id=${r.info.id}, ${r.info.name})`);
