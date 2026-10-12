// Web Speech API (SpeechSynthesis) の読み上げ。使えない端末では文字表示だけで続けられるようにする
export interface SpeechEngine {
  readonly supported: boolean;
  /** 前の読み上げを止めてから読む。重複して再生しない */
  speak(text: string): void;
  stop(): void;
  /** 直近に読もうとした文 (「もういちど きく」用) */
  readonly lastText: string;
}

interface SynthLike {
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

export function pickJapaneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const ja = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ja'));
  return ja.find((v) => v.lang.toLowerCase().replace('_', '-') === 'ja-jp' && v.localService) ?? ja.find((v) => v.lang.toLowerCase().replace('_', '-') === 'ja-jp') ?? ja[0];
}

export function createSpeech(
  synth: SynthLike | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined,
  Utterance: typeof SpeechSynthesisUtterance | undefined = typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : undefined,
): SpeechEngine {
  let last = '';
  const supported = !!synth && !!Utterance;
  return {
    supported,
    get lastText() {
      return last;
    },
    speak(text: string) {
      last = text;
      if (!synth || !Utterance) return;
      try {
        synth.cancel(); // 重複再生を防ぐ
        const u = new Utterance(text);
        u.lang = 'ja-JP';
        u.rate = 0.9;
        u.pitch = 1.1;
        const v = pickJapaneseVoice(synth.getVoices());
        if (v) u.voice = v;
        synth.speak(u);
      } catch {
        // 音声に失敗しても、文字表示だけで続けられる
      }
    },
    stop() {
      if (!synth) return;
      try {
        synth.cancel();
      } catch {
        /* 何もしない */
      }
    },
  };
}
