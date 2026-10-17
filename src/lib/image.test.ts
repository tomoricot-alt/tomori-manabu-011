import { describe, expect, it } from 'vitest';
import { enhanceCanvasForOcr, enhanceRgbaForOcr, scaledSize } from './image';

describe('scaledSize', () => {
  it('最大辺以下の画像はそのままのサイズを返す', () => {
    expect(scaledSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('最大辺を超える画像は縦横比を保って縮小する', () => {
    expect(scaledSize(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
  });
});

describe('enhanceRgbaForOcr (Canvas OCR前処理)', () => {
  it('照明の傾き(影)がある背景を白(255)に飛ばし、暗い文字・記号を濃く強調する', () => {
    const width = 40;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);

    // 左から右へ照明が暗くなるグラデーション背景 (220 -> 140)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bg = Math.round(220 - (x / width) * 80);
        const p = (y * width + x) * 4;
        data[p] = bg;
        data[p + 1] = bg;
        data[p + 2] = bg;
        data[p + 3] = 255;
      }
    }

    // 中央付近に「÷」を模した暗いピクセル（横棒と上下の点）を描く
    const darkPixels: [number, number][] = [
      [20, 16], // 上の点
      [18, 20],
      [19, 20],
      [20, 20],
      [21, 20],
      [22, 20], // 横棒
      [20, 24], // 下の点
    ];
    for (const [x, y] of darkPixels) {
      const p = (y * width + x) * 4;
      data[p] = 45;
      data[p + 1] = 45;
      data[p + 2] = 45;
      data[p + 3] = 255;
    }

    enhanceRgbaForOcr(data, width, height);

    // 四隅の背景（影のあった右端も含む）が白(255)に正規化されていること
    expect(data[0]).toBe(255);
    const topRightIdx = (width - 1) * 4;
    expect(data[topRightIdx]).toBe(255);

    // 「÷」の上下の点と横棒が黒く強調されていること
    for (const [x, y] of darkPixels) {
      const p = (y * width + x) * 4;
      expect(data[p]).toBeLessThan(60);
      expect(data[p]).toBe(data[p + 1]);
      expect(data[p + 1]).toBe(data[p + 2]);
    }
  });

  it('単色画像や空データではエラーを起こさず安全にスキップする', () => {
    const uniform = new Uint8ClampedArray(10 * 10 * 4).fill(200);
    enhanceRgbaForOcr(uniform, 10, 10);
    expect(uniform[0]).toBe(200);

    const canvas = document.createElement('canvas');
    expect(() => enhanceCanvasForOcr(canvas)).not.toThrow();
  });
});
