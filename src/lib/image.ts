// 撮影した写真を、OCRしやすく・メモリを使いすぎない大きさに縮小する (すべて端末内で処理)
export const MAX_EDGE = 1600;
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

export class ImageError extends Error {
  constructor(public code: 'too-big' | 'not-image' | 'decode-failed') {
    super(code);
    this.name = 'ImageError';
  }
}

export function scaledSize(w: number, h: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return { width: w, height: h };
  const r = maxEdge / longEdge;
  return { width: Math.max(1, Math.round(w * r)), height: Math.max(1, Math.round(h * r)) };
}

export interface PreparedImage {
  /** 画面表示用 (Object URL)。使い終わったら revokeObjectURL する */
  previewUrl: string;
  /** OCR用 */
  canvas: HTMLCanvasElement;
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* 下の <img> 方式にもどる */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } catch {
    throw new ImageError('decode-failed');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * RGBAピクセル配列に対して、スマホ撮影時の照明ムラ・影を除去し、
 * 文字と記号（特に「÷」の点など）のコントラストを高める適応的二値化・コントラスト強調を行う（端末内処理）。
 * 積分画像（Integral Image）を用いた局所平均比較により、照明の傾きに強く高速に処理する。
 */
export function enhanceRgbaForOcr(data: Uint8ClampedArray, width: number, height: number): void {
  const pixelCount = width * height;
  if (pixelCount <= 0 || data.length < pixelCount * 4) return;

  // 1. 輝度(グレースケール)変換と最小・最大輝度の取得
  const gray = new Uint8Array(pixelCount);
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    // 透明ピクセルは白背景として扱う
    const a = data[p + 3];
    const r = a < 128 ? 255 : data[p];
    const g = a < 128 ? 255 : data[p + 1];
    const b = a < 128 ? 255 : data[p + 2];
    const lum = (r * 77 + g * 150 + b * 29) >> 8;
    gray[i] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // 全体にほぼ単色の場合は変更しない
  const range = maxLum - minLum;
  if (range < 16) return;

  // 2. コントラストストレッチ（ダイナミックレンジを 0..255 に広げる）
  for (let i = 0; i < pixelCount; i++) {
    gray[i] = Math.min(255, Math.max(0, Math.round(((gray[i] - minLum) * 255) / range)));
  }

  // 3. 積分画像を作成し、局所領域の平均輝度から影・照明ムラを補正して二値化・強調する
  const integral = new Float64Array((width + 1) * (height + 1));
  const stride = width + 1;
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    const srcOffset = (y - 1) * width;
    const dstOffset = y * stride;
    const prevOffset = (y - 1) * stride;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[srcOffset + (x - 1)];
      integral[dstOffset + x] = integral[prevOffset + x] + rowSum;
    }
  }

  // ウィンドウ半径（画像長辺の約1/32、最小8px）
  const radius = Math.max(8, Math.round(Math.max(width, height) / 32));
  // 局所背景よりどれだけ暗ければ文字（黒）とみなすかのマージン
  const margin = 18;

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const count = (x1 - x0) * (y1 - y0);
      const sum =
        integral[y1 * stride + x1] -
        integral[y0 * stride + x1] -
        integral[y1 * stride + x0] +
        integral[y0 * stride + x0];
      const localMean = sum / count;
      const lum = gray[y * width + x];

      // 背景（紙や影）は完全な白(255)に飛ばし、文字の輪郭（「÷」の点や横棒）は自然な階調を保って濃くする
      let out: number;
      if (lum >= localMean - margin) {
        out = 255;
      } else {
        // 文字部分：コントラストを強めつつアンチエイリアス階調を残すソフト二値化
        const diff = localMean - margin - lum;
        out = diff > 28 ? 0 : Math.max(0, Math.round(255 - (diff / 28) * 255));
      }

      const p = (y * width + x) * 4;
      data[p] = out;
      data[p + 1] = out;
      data[p + 2] = out;
      data[p + 3] = 255;
    }
  }
}

/** Canvas上の画像をOCR向けに前処理する（非対応環境・テストモック環境では安全にスキップ） */
export function enhanceCanvasForOcr(canvas: HTMLCanvasElement): void {
  const { width, height } = canvas;
  if (width <= 0 || height <= 0) return;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.getImageData !== 'function' || typeof ctx.putImageData !== 'function') return;
    const imgData = ctx.getImageData(0, 0, width, height);
    if (!imgData?.data) return;
    enhanceRgbaForOcr(imgData.data, width, height);
    ctx.putImageData(imgData, 0, 0);
  } catch {
    /* jsdom等のCanvas未実装環境では元のCanvasのまま続行 */
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_FILE_BYTES) throw new ImageError('too-big');
  if (file.type && !file.type.startsWith('image/')) throw new ImageError('not-image');
  const d = await decode(file);
  try {
    const { width, height } = scaledSize(d.width, d.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('decode-failed');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(d.source, 0, 0, width, height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) throw new ImageError('decode-failed');
    // 保護者が見るプレビュー(blob)は自然な写真のままにし、OCRに渡すcanvasだけコントラスト・二値化前処理を行う
    enhanceCanvasForOcr(canvas);
    return { previewUrl: URL.createObjectURL(blob), canvas };
  } finally {
    d.close();
  }
}

export function releaseImage(img: PreparedImage | null): void {
  if (!img) return;
  URL.revokeObjectURL(img.previewUrl);
  img.canvas.width = 0; // メモリを早めに手放す
  img.canvas.height = 0;
}

