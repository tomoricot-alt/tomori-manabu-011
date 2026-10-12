// app-info.json の検証 (依存ライブラリなし)。
// ★ このファイルは templates/app-template/scripts/lib/app-info.mjs と同一内容に保つこと
//   (scripts/__tests__/template.test.mjs が差異を検出します)。
// 一覧サイト側の自動登録 (scripts/sync-apps.mjs) と、各アプリのCIの両方で使います。

export const OWNER = 'tomoricot-alt';
export const REPO_NAME_PATTERN = /^tomori-([a-z0-9]+)-(\d{3})$/;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isStrArray = (v) => Array.isArray(v) && v.every(isStr);

/**
 * @param {unknown} info  app-info.json をparseした値
 * @param {{ repo?: string, owner?: string }} [opts]  repo を渡すと id・URLがリポジトリ名と一致するかも検証
 * @returns {string[]} エラーメッセージ (空配列なら問題なし)
 */
export function validateAppInfo(info, opts = {}) {
  const owner = opts.owner ?? OWNER;
  const errors = [];
  if (info === null || typeof info !== 'object' || Array.isArray(info)) {
    return ['app-info.json の中身がオブジェクト ({ ... }) になっていません'];
  }
  const o = /** @type {Record<string, any>} */ (info);

  const text = (key, max) => {
    if (!isStr(o[key])) errors.push(`${key}: 文字列で入力してください (空欄不可)`);
    else if (o[key].length > max) errors.push(`${key}: ${max}文字以内にしてください`);
  };
  const list = (key, min, max, itemMax) => {
    if (!Array.isArray(o[key]) || !isStrArray(o[key])) {
      errors.push(`${key}: 文字列の配列にしてください (空欄の項目は不可)`);
      return;
    }
    if (o[key].length < min || o[key].length > max) errors.push(`${key}: ${min}〜${max}個にしてください (現在${o[key].length}個)`);
    if (o[key].some((s) => s.length > itemMax)) errors.push(`${key}: 1項目は${itemMax}文字以内にしてください`);
    if (new Set(o[key]).size !== o[key].length) errors.push(`${key}: 同じ内容の項目が重複しています`);
  };

  if (typeof o.id !== 'string' || !/^\d{3}$/.test(o.id)) errors.push('id: 3桁の数字の文字列にしてください (例: "007")');
  text('name', 40);
  text('category', 20);
  text('description', 150);
  text('tagline', 100);
  text('overview', 800);
  list('capabilities', 1, 8, 200);
  list('features', 1, 12, 200);
  list('usageSteps', 3, 5, 200);
  list('notes', 1, 8, 300);
  if (!isStr(o.icon) || [...o.icon].length > 4) errors.push('icon: 絵文字などを1〜4文字で入力してください');

  if (!isStr(o.appUrl)) {
    errors.push('appUrl: アプリのURLを入力してください');
  } else {
    if (opts.repo) {
      const expected = `https://${owner}.github.io/${opts.repo}/`;
      if (o.appUrl !== expected) errors.push(`appUrl: ${expected} と一致させてください`);
    } else if (!/^https:\/\//.test(o.appUrl)) {
      errors.push('appUrl: https:// で始めてください');
    }
  }
  if (o.userGuideUrl !== undefined) {
    const okPrefixes = opts.repo
      ? [`https://github.com/${owner}/${opts.repo}/`, `https://${owner}.github.io/${opts.repo}/`]
      : ['https://'];
    if (!isStr(o.userGuideUrl) || !okPrefixes.some((p) => o.userGuideUrl.startsWith(p))) {
      errors.push(`userGuideUrl: ${okPrefixes[0]} などのこのアプリのURLにしてください (省略も可)`);
    }
  }
  if (o.faq !== undefined) {
    if (!Array.isArray(o.faq) || o.faq.length > 10 || !o.faq.every((f) => f && isStr(f.q) && isStr(f.a) && f.q.length <= 150 && f.a.length <= 500)) {
      errors.push('faq: { "q": "質問", "a": "答え" } の配列 (10個まで) にしてください (省略も可)');
    }
  }
  if (opts.repo) {
    const m = REPO_NAME_PATTERN.exec(opts.repo);
    if (!m) errors.push(`リポジトリ名 ${opts.repo} が tomori-<アプリ名>-<3桁の番号> の形式ではありません`);
    else if (o.id !== m[2]) errors.push(`id: リポジトリ名の番号 "${m[2]}" と一致させてください (現在 ${JSON.stringify(o.id)})`);
  }
  return errors;
}

/** app-info.json の文字列を検証して、一覧サイト用の項目だけを取り出す */
export function parseAppInfo(jsonText, opts = {}) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, errors: [`JSONとして読めません: ${e.message}`] };
  }
  const errors = validateAppInfo(data, opts);
  if (errors.length) return { ok: false, errors };
  const pick = ['id', 'name', 'category', 'description', 'tagline', 'overview', 'capabilities', 'features', 'usageSteps', 'notes', 'appUrl', 'icon'];
  const info = Object.fromEntries(pick.map((k) => [k, data[k]]));
  if (data.userGuideUrl !== undefined) info.userGuideUrl = data.userGuideUrl;
  if (data.faq !== undefined) info.faq = data.faq.map(({ q, a }) => ({ q, a }));
  return { ok: true, info };
}
