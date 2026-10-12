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
