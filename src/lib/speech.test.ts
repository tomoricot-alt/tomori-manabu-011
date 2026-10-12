import { describe, expect, it, vi } from 'vitest';
import { createSpeech, pickJapaneseVoice } from './speech';

class FakeUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  constructor(public text: string) {}
}
const voice = (lang: string, local = true) => ({ lang, localService: local, name: lang }) as SpeechSynthesisVoice;

describe('音声読み上げ', () => {
  it('日本語(ja-JP)で読み、前の読み上げを止めてから再生する', () => {
    const spoken: FakeUtterance[] = [];
    const synth = { speak: vi.fn((u: FakeUtterance) => spoken.push(u)), cancel: vi.fn(), getVoices: () => [voice('en-US'), voice('ja-JP')] };
    const s = createSpeech(synth, FakeUtterance as unknown as typeof SpeechSynthesisUtterance);
    s.speak('こんにちは');
    s.speak('もういちど');
    expect(synth.cancel).toHaveBeenCalledTimes(2);
    expect(spoken).toHaveLength(2);
    expect(spoken[0].lang).toBe('ja-JP');
    expect((spoken[0].voice as SpeechSynthesisVoice).lang).toBe('ja-JP');
    expect(s.lastText).toBe('もういちど');
  });
  it('stop で読み上げを止める', () => {
    const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] };
    createSpeech(synth, FakeUtterance as unknown as typeof SpeechSynthesisUtterance).stop();
    expect(synth.cancel).toHaveBeenCalled();
  });
  it('音声機能がない端末では何も起きず、エラーにならない', () => {
    const s = createSpeech(undefined, undefined);
    expect(s.supported).toBe(false);
    expect(() => s.speak('だいじょうぶ')).not.toThrow();
    expect(() => s.stop()).not.toThrow();
    expect(s.lastText).toBe('だいじょうぶ'); // 文字表示のために保持する
  });
  it('再生に失敗しても止まらない', () => {
    const synth = {
      speak: () => {
        throw new Error('not-allowed');
      },
      cancel: vi.fn(),
      getVoices: () => [],
    };
    const s = createSpeech(synth, FakeUtterance as unknown as typeof SpeechSynthesisUtterance);
    expect(() => s.speak('あ')).not.toThrow();
  });
  it('日本語の音声を選ぶ (なければ未指定)', () => {
    expect(pickJapaneseVoice([voice('en-US'), voice('ja_JP', false), voice('ja-JP', true)])?.localService).toBe(true);
    expect(pickJapaneseVoice([voice('en-US')])).toBeUndefined();
  });
});
