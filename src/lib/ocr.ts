// ブラウザ内OCR (Tesseract.js)。画像はこの端末の中だけで処理し、外部には送らない。
// Worker / WASM / 言語データは同じサイトの /ocr/ から読み込む (外部CDNは使わない)。
import { createWorker, PSM, type Worker } from 'tesseract.js';

export const OCR_TIMEOUT_MS = 60_000;

export interface OcrPaths {
  workerPath: string;
  corePath: string;
  langPath: string;
}

export function defaultOcrPaths(base: string = import.meta.env.BASE_URL): OcrPaths {
  const dir = new URL(`${base}ocr/`, window.location.href).href.replace(/\/$/, '');
  return { workerPath: `${dir}/worker.min.js`, corePath: dir, langPath: dir };
}

export class OcrTimeoutError extends Error {
  constructor() {
    super('ocr-timeout');
    this.name = 'OcrTimeoutError';
  }
}

export interface OcrResult {
  text: string;
  confidence: number;
}

export type OcrInput = Parameters<Worker['recognize']>[0];

/** 画像1枚を読み取る。時間がかかりすぎたら OcrTimeoutError。使い終わったら必ずWorkerを終了する */
export async function recognizeImage(
  image: OcrInput,
  opts: { paths?: OcrPaths; timeoutMs?: number; onProgress?: (ratio: number) => void } = {},
): Promise<OcrResult> {
  const paths = opts.paths ?? defaultOcrPaths();
  const timeoutMs = opts.timeoutMs ?? OCR_TIMEOUT_MS;
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = (async () => {
    worker = await createWorker('eng', 1, {
      ...paths,
      cacheMethod: 'none',
      gzip: true,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') opts.onProgress?.(m.progress);
      },
    });
    // 文字の制限(ホワイトリスト)は使わない: 試したところ、かえって「÷」「×」の読み間違いが増えた
    // それでも ÷ は + と読み違えやすいので、画面で必ず保護者が写真と見くらべて確認する
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
    });
    const r = await worker.recognize(image);
    return { text: r.data.text, confidence: r.data.confidence };
  })();
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OcrTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    // タイムアウト後も確実に止める
    const w = worker as Worker | null;
    if (w) void w.terminate().catch(() => undefined);
    else void work.then(() => (worker as Worker | null)?.terminate()).catch(() => undefined);
  }
}
