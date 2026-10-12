# TOMORI MANABU（APP 011）

> 宿題を、ひとりじゃなく、一緒に。

小学3・4年生が、紙の宿題（算数の計算問題）に自分で取り組むのを支える、無料の学習サポートアプリです。
TOMORI APP LAB のアプリ 011 です。

- 公開予定URL: https://tomoricot-alt.github.io/tomori-manabu-011/
- 使い方（保護者向け）: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- 開発レポート: [docs/DEV_REPORT.md](docs/DEV_REPORT.md)

## できること

- 宿題の写真を撮る／選ぶ → ブラウザ内で文字を読み取る（Tesseract.js）→ 保護者が確認・修正
- 写真なしの「手入力」と、「おためしで あそぶ」（サンプル4問）
- 対応する問題: 非負整数のたし算・ひき算・かけ算と、あまりのないわり算（1回に最大5問）
- 1問ずつ表示し、答えはすぐ教えず、ルールベースの3段階ヒントで手助け
- 声かけの音声読み上げ（Web Speech API / ja-JP）。使えない端末では文字だけで利用可能
- 学習の回数・問題数だけを `localStorage` に保存（削除可能）

## しないこと

ログイン・氏名や学校名の収集・マイク/音声認識・広告・分析・外部API・サーバー・データベース・写真の外部送信。
外部CDNにも依存しません（OCRのWorker/WASM/言語データは同じサイトから配信）。

## 技術構成

React 19 / TypeScript / Vite 8 / Tesseract.js **7.0.0（固定）** / Web Speech API / localStorage / GitHub Actions / GitHub Pages

- OCRは `tesseract.js@7.0.0`（Apache-2.0）と、同梱の英語(best_int)言語データ `@tesseract.js-data/eng@1.0.0` を使用。
  `npm run prepare:ocr` が `public/ocr/` にコピーします（`build:web` / `dev` で自動実行。Git管理外）。
- iPhone Safariでの安定性を優先し、React Native / Expo は使っていません。
- GitHub Pages のサブパス `/tomori-manabu-011/` は `vite.config.ts` の `base` で設定。

## 開発

```bash
npm ci
npm run dev            # 開発サーバー
npm run typecheck      # 型チェック
npm test               # 自動テスト (Vitest)
npm run validate:app-info
npm run build:web      # 本番ビルド → dist/
npm run test:e2e       # スマホ幅のブラウザテスト (Playwright / Chromium)
```

`test:e2e` は Chromium が必要です（`PW_CHROMIUM_PATH` で実行ファイルを指定可）。実機のiPhone Safariでの確認ではありません。

## 公開（GitHub Pages）

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする（初回のみ）
2. PRを確認して `main` にマージ → `.github/workflows/deploy.yml` が自動で公開
3. PRの段階では公開されません（型チェック・テスト・ビルドのみ）

## 構成

```
src/lib/      math(解析・採点) / extract(OCR結果の抽出) / hints / session / speech / storage / ocr / image
src/App.tsx   画面(ホーム・撮影・読み取り中・確認・学習・終了)
tests, e2e    結合テスト(OCR) / スマホ幅ブラウザテスト
scripts/      app-info検証(APP LAB共通) / OCR資材コピー / テスト画像生成
```
