import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App, type AppDeps } from './App';
import type { PreparedImage } from './lib/image';
import { STORAGE_KEY } from './lib/storage';
import type { SpeechEngine } from './lib/speech';

function fakeSpeech(supported = true): SpeechEngine & { spoken: string[]; stops: number } {
  const o = {
    supported,
    spoken: [] as string[],
    stops: 0,
    lastText: '',
    speak(t: string) {
      o.lastText = t;
      o.spoken.push(t);
    },
    stop() {
      o.stops += 1;
    },
  };
  return o;
}
const fakeImage = (): PreparedImage => ({ previewUrl: 'blob:fake', canvas: document.createElement('canvas') });

async function setup(deps: AppDeps = {}) {
  const user = userEvent.setup();
  const speech = (deps.speech ?? fakeSpeech()) as ReturnType<typeof fakeSpeech>;
  render(<App {...deps} speech={speech} />);
  return { user, speech };
}
const btn = (name: RegExp | string) => screen.getByRole('button', { name });

describe('ホーム', () => {
  it('必要な表示とボタンがある。ログインや名前入力はない', async () => {
    await setup();
    expect(screen.getByText('TOMORI MANABU')).toBeTruthy();
    expect(screen.getByText('今日もいっしょにやってみよう')).toBeTruthy();
    expect(btn(/しゅくだいを とる/)).toBeTruthy();
    expect(btn(/おためしで あそぶ/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/サイトデータ/)).toBeTruthy(); // 記録が消えることの説明
  });
});

describe('学習 (おためし)', () => {
  it('写真なしで始まり、1問だけを大きく表示し、ヒントは3段階で答えを出さない', async () => {
    const { user } = await setup();
    await user.click(btn(/おためしで あそぶ/));
    expect(screen.getByTestId('problem').textContent).toBe('9 + 5 = ?');
    expect(screen.queryByText(/15 - 8/)).toBeNull(); // 次の問題は見えない
    const hintBtn = () => screen.getByRole('button', { name: /ヒント/ });
    await user.click(hintBtn());
    expect(screen.getAllByText(/^ヒント \d$/)).toHaveLength(1);
    await user.click(hintBtn());
    await user.click(hintBtn());
    expect(screen.getAllByText(/^ヒント \d$/)).toHaveLength(3);
    expect((hintBtn() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/^14$/)).toBeNull();
  });

  it('答えを未確認のまま褒めない。誤答はやさしく促し、正解で褒める', async () => {
    const { user, speech } = await setup();
    await user.click(btn(/おためしで あそぶ/));
    expect(screen.getByTestId('message').textContent).not.toContain('やったね');
    await user.click(btn(/こたえを いれる/));
    const input = screen.getByLabelText(/こたえを いれてね/);
    await user.type(input, '13');
    await user.click(btn(/たしかめる/));
    expect(screen.getByTestId('message').textContent).toContain('おしいね。もういちど かんがえてみよう！');
    expect(screen.getByTestId('message').textContent).not.toContain('14');
    await user.type(input, '14');
    await user.click(btn(/たしかめる/));
    expect(screen.getByTestId('message').textContent).toContain('やったね！じぶんで かんがえられたね！');
    expect(speech.spoken.at(-1)).toContain('やったね');
  });

  it('空欄では採点しない', async () => {
    const { user } = await setup();
    await user.click(btn(/おためしで あそぶ/));
    await user.click(btn(/こたえを いれる/));
    await user.click(btn(/たしかめる/));
    expect(screen.getByTestId('message').textContent).toContain('すうじを いれてね');
  });

  it('「もういちど きく」で同じ文を読み直す', async () => {
    const { user, speech } = await setup();
    await user.click(btn(/おためしで あそぶ/));
    const before = speech.spoken.length;
    await user.click(btn(/もういちど きく/));
    expect(speech.spoken.length).toBe(before + 1);
    expect(speech.spoken.at(-1)).toBe(screen.getByTestId('message').textContent);
  });

  it('1問ずつ進み、最後まで行くと終了画面になる', async () => {
    const { user } = await setup();
    await user.click(btn(/おためしで あそぶ/));
    for (const expected of ['15 - 8 = ?', '4 × 6 = ?', '12 ÷ 3 = ?']) {
      await user.click(btn(/つぎの もんだい/));
      expect(screen.getByTestId('problem').textContent).toBe(expected);
    }
    await user.click(btn(/さいごまで やった/));
    expect(screen.getByText(/おつかれさま/)).toBeTruthy();
    expect(btn('おわる')).toBeTruthy();
  });

  it('途中で終了でき、取り組んだ数と努力を認める言葉が出て、読み上げが止まる', async () => {
    const { user, speech } = await setup();
    await user.click(btn(/おためしで あそぶ/));
    await user.click(btn(/ヒントを きく/));
    const stopsBefore = speech.stops;
    await user.click(btn(/きょうは ここまで/));
    expect(screen.getByText(/よく がんばったね/)).toBeTruthy();
    expect(screen.getByTestId('count').textContent).toContain('1');
    expect(speech.stops).toBeGreaterThan(stopsBefore);
    await user.click(btn('おわる'));
    expect(screen.getByText('TOMORI MANABU')).toBeTruthy();
  });

  it('おためしは記録を残さない', async () => {
    const { user } = await setup();
    await user.click(btn(/おためしで あそぶ/));
    await user.click(btn(/ヒントを きく/));
    await user.click(btn(/きょうは ここまで/));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('音声が使えない端末', () => {
  it('文字表示だけで最後まで操作できる', async () => {
    const speech = fakeSpeech(false);
    const { user } = await setup({ speech });
    expect(screen.getByText(/こえが つかえません/)).toBeTruthy();
    await user.click(btn(/おためしで あそぶ/));
    expect(screen.getByText(/この端末では こえが つかえません/)).toBeTruthy();
    expect(screen.getByTestId('message').textContent).toContain('9 たす 5 は いくつかな？');
    await user.click(btn(/こたえを いれる/));
    await user.type(screen.getByLabelText(/こたえを いれてね/), '14');
    await user.click(btn(/たしかめる/));
    expect(screen.getByTestId('message').textContent).toContain('やったね');
  });
});

describe('手入力・確認・記録', () => {
  async function toManual(user: ReturnType<typeof userEvent.setup>) {
    await user.click(btn(/しゅくだいを とる/));
    await user.click(btn(/てで いれる/));
  }

  it('手入力で問題を作り、確認してから学習を始め、終了時に集計だけ保存する', async () => {
    const { user } = await setup();
    await toManual(user);
    expect((btn(/いっしょに はじめる/) as HTMLButtonElement).disabled).toBe(true); // 空では始められない
    await user.type(screen.getByLabelText('1ばんめ ひだりの かず'), '24');
    await user.selectOptions(screen.getByLabelText('1ばんめ けいさんの しるし'), '÷');
    await user.type(screen.getByLabelText('1ばんめ みぎの かず'), '4');
    await user.click(btn(/いっしょに はじめる/));
    expect(screen.getByTestId('problem').textContent).toBe('24 ÷ 4 = ?');
    await user.click(btn(/こたえを いれる/));
    await user.type(screen.getByLabelText(/こたえを いれてね/), '6');
    await user.click(btn(/たしかめる/));
    await user.click(btn(/さいごまで やった/));
    expect(screen.getByTestId('count').textContent).toContain('1');
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(saved).toMatchObject({ sessions: 1, problems: 1 });
    expect(Object.keys(saved).sort()).toEqual(['lastDate', 'problems', 'sessions', 'version']);
    expect(JSON.stringify(window.localStorage)).not.toContain('24');
    await user.click(btn('おわる'));
    expect(screen.getByText(/1かい がんばりました/)).toBeTruthy();
    // 記録を消せる
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(btn(/きろくを けす/));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByText(/まだ きろくは ありません/)).toBeTruthy();
  });

  it('未対応の問題(0でわる・あまり・マイナス)は始められない', async () => {
    const { user } = await setup();
    await toManual(user);
    const left = screen.getByLabelText('1ばんめ ひだりの かず');
    const op = screen.getByLabelText('1ばんめ けいさんの しるし');
    const right = screen.getByLabelText('1ばんめ みぎの かず');
    await user.type(left, '8');
    await user.selectOptions(op, '÷');
    await user.type(right, '0');
    expect(screen.getByRole('alert').textContent).toContain('0 では われません');
    expect((btn(/いっしょに はじめる/) as HTMLButtonElement).disabled).toBe(true);
    await user.clear(right);
    await user.type(right, '3');
    expect(screen.getByRole('alert').textContent).toContain('あまりが でる');
    expect((btn(/いっしょに はじめる/) as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(op, '-');
    expect(screen.getByText(/つかえます/)).toBeTruthy();
    expect((btn(/いっしょに はじめる/) as HTMLButtonElement).disabled).toBe(false);
  });

  it('1回に5問まで', async () => {
    const { user } = await setup();
    await toManual(user);
    for (let i = 0; i < 6; i++) {
      const add = btn(/もんだいを ふやす/) as HTMLButtonElement;
      if (!add.disabled) await user.click(add);
    }
    expect(screen.getAllByText(/ばんめ$/).length).toBe(5);
    expect((btn(/もんだいを ふやす/) as HTMLButtonElement).disabled).toBe(true);
  });

  it('問題を削除できる', async () => {
    const { user } = await setup();
    await toManual(user);
    await user.click(btn(/もんだいを ふやす/));
    expect(screen.getAllByRole('listitem').length).toBe(2);
    await user.click(screen.getByRole('button', { name: '1ばんめを けす' }));
    expect(screen.getAllByRole('listitem').length).toBe(1);
  });
});

describe('撮影とOCR', () => {
  const pickFile = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(btn(/しゅくだいを とる/));
    const input = screen.getByTestId('library-input') as HTMLInputElement;
    await user.upload(input, new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
  };

  it('カメラ入力は背面カメラ指定(capture)で、写真選択の代替も用意されている', async () => {
    const { user } = await setup();
    await user.click(btn(/しゅくだいを とる/));
    expect(screen.getByTestId('camera-input').getAttribute('capture')).toBe('environment');
    expect(screen.getByTestId('library-input').getAttribute('capture')).toBeNull();
    expect(btn(/しゃしんから えらぶ/)).toBeTruthy();
    expect(btn(/てで いれる/)).toBeTruthy();
  });

  it('OCRの結果は「未確認」で表示され、確認チェックがないと始められない', async () => {
    const prepare = vi.fn(async () => fakeImage());
    const ocr = vi.fn(async () => ({ text: '(1) 12 + 8 =\n(2) 6 x 7 =', confidence: 90 }));
    const { user } = await setup({ prepare, ocr });
    await pickFile(user);
    await user.click(await screen.findByRole('button', { name: /もんだいを よみとる/ }));
    await screen.findByText('もんだいの かくにん');
    expect(screen.getAllByText('しゃしんから よみとり')).toHaveLength(2);
    expect(screen.getByText(/÷」が「＋」に なりやすい/)).toBeTruthy();
    const start = btn(/いっしょに はじめる/) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    const checks = screen.getAllByRole('checkbox');
    await user.click(checks[0]);
    expect(start.disabled).toBe(true);
    await user.click(checks[1]);
    expect(start.disabled).toBe(false);
    await user.click(start);
    expect(screen.getByTestId('problem').textContent).toBe('12 + 8 = ?');
  });

  it('OCRで「÷」が「＋」に誤認識されたとき、確認画面のワンタップ演算子ボタンで「÷」に切り替えられる', async () => {
    const prepare = vi.fn(async () => fakeImage());
    const ocr = vi.fn(async () => ({ text: '(1) 24 + 4 =', confidence: 85 }));
    const { user } = await setup({ prepare, ocr });
    await pickFile(user);
    await user.click(await screen.findByRole('button', { name: /もんだいを よみとる/ }));
    await screen.findByText('もんだいの かくにん');

    const divBtn = screen.getByRole('button', { name: '1ばんめを わり算（÷）にする' });
    expect(divBtn.getAttribute('aria-pressed')).toBe('false');
    await user.click(divBtn);
    expect(divBtn.getAttribute('aria-pressed')).toBe('true');

    // ワンタップ切替で「確認した」が有効になり、そのまま24 ÷ 4として開始できる
    const start = btn(/いっしょに はじめる/) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    await user.click(start);
    expect(screen.getByTestId('problem').textContent).toBe('24 ÷ 4 = ?');
  });

  it('OCRが失敗しても止まらず、手入力で学習を始められる', async () => {
    const prepare = vi.fn(async () => fakeImage());
    const ocr = vi.fn(async () => {
      throw new Error('wasm failed');
    });
    const { user } = await setup({ prepare, ocr });
    await pickFile(user);
    await user.click(await screen.findByRole('button', { name: /もんだいを よみとる/ }));
    await screen.findByText(/よみとりが できませんでした/);
    await user.click(btn(/もんだいを ふやす/));
    await user.type(screen.getByLabelText('1ばんめ ひだりの かず'), '3');
    await user.type(screen.getByLabelText('1ばんめ みぎの かず'), '4');
    await user.click(btn(/いっしょに はじめる/));
    expect(screen.getByTestId('problem').textContent).toBe('3 + 4 = ?');
  });

  it('問題を認識できなかったときも手入力に進める', async () => {
    const prepare = vi.fn(async () => fakeImage());
    const ocr = vi.fn(async () => ({ text: 'ことば だけ', confidence: 80 }));
    const { user } = await setup({ prepare, ocr });
    await pickFile(user);
    await user.click(await screen.findByRole('button', { name: /もんだいを よみとる/ }));
    await screen.findByText(/もんだいを よみとれませんでした/);
    expect(btn(/もんだいを ふやす/)).toBeTruthy();
  });

  it('写真が大きすぎる・開けないときはメッセージを出し、手入力に進める', async () => {
    const { ImageError } = await import('./lib/image');
    const prepare = vi.fn(async () => {
      throw new ImageError('too-big');
    });
    const { user } = await setup({ prepare });
    await pickFile(user);
    expect((await screen.findByRole('alert')).textContent).toContain('おおきすぎます');
    expect(btn(/てで いれる/)).toBeTruthy();
  });

  it('学習を始めると写真を破棄する', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const prepare = vi.fn(async () => fakeImage());
    const ocr = vi.fn(async () => ({ text: '1 + 1 =', confidence: 90 }));
    const { user } = await setup({ prepare, ocr });
    await pickFile(user);
    await user.click(await screen.findByRole('button', { name: /もんだいを よみとる/ }));
    await screen.findByText('もんだいの かくにん');
    await user.click(screen.getByRole('checkbox'));
    await user.click(btn(/いっしょに はじめる/));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:fake'));
    const list = within(document.body);
    expect(list.queryByAltText(/しゃしん/)).toBeNull();
  });
});
