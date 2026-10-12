import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mascot } from './components/Mascot';
import { ReviewList, readiness, type DraftItem } from './components/ReviewList';
import { extractProblems } from './lib/extract';
import { MAX_HINTS, generateHints } from './lib/hints';
import { ImageError, prepareImage, releaseImage, type PreparedImage } from './lib/image';
import { MAX_PROBLEMS, REASON_TEXT, formatProblem, newId, speakProblem, type Problem } from './lib/math';
import { OcrTimeoutError, recognizeImage, type OcrResult } from './lib/ocr';
import { currentProblem, isLast, startSession, studyReducer, type StudyAction, type StudyState } from './lib/session';
import { createSpeech, type SpeechEngine } from './lib/speech';
import { clearSummary, loadSummary, recordSession, storageAvailable, type Summary } from './lib/storage';

type Screen = 'home' | 'capture' | 'reading' | 'review' | 'study' | 'done';

export interface AppDeps {
  speech?: SpeechEngine;
  prepare?: (file: File) => Promise<PreparedImage>;
  ocr?: (image: PreparedImage, onProgress: (r: number) => void) => Promise<OcrResult>;
}

const SAMPLE: Problem[] = [
  { id: 's1', left: 9, op: '+', right: 5, answer: 14 },
  { id: 's2', left: 15, op: '-', right: 8, answer: 7 },
  { id: 's3', left: 4, op: '×', right: 6, answer: 24 },
  { id: 's4', left: 12, op: '÷', right: 3, answer: 4 },
];

const WRONG_LINES = ['おしいね。もういちど かんがえてみよう！', 'あとちょっと！ ゆっくり かんがえてみよう。', 'だいじょうぶ。まちがえても いいんだよ。もういちど やってみよう！'];
const CORRECT_LINE = 'やったね！じぶんで かんがえられたね！';

const newDraft = (patch: Partial<DraftItem> = {}): DraftItem => ({ key: newId(), left: '', op: '+', right: '', source: 'manual', confirmed: true, ...patch });

export function App({ speech: injected, prepare = prepareImage, ocr }: AppDeps = {}) {
  const speech = useMemo(() => injected ?? createSpeech(), [injected]);
  const [screen, setScreen] = useState<Screen>('home');
  const [summary, setSummary] = useState<Summary>(() => loadSummary());
  const canStore = useMemo(() => storageAvailable(), []);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [notice, setNotice] = useState<string>('');
  const [skippedNotes, setSkippedNotes] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [study, setStudy] = useState<StudyState | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [savedOk, setSavedOk] = useState<boolean | null>(null);
  const cancelRead = useRef(false);
  const imageRef = useRef<PreparedImage | null>(null);
  imageRef.current = image;

  // 画面を離れる・ページを閉じるときは読み上げを止め、画像を捨てる
  useEffect(() => {
    const stop = () => speech.stop();
    const onHide = () => {
      if (document.visibilityState === 'hidden') speech.stop();
    };
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', stop);
      document.removeEventListener('visibilitychange', onHide);
      speech.stop();
      releaseImage(imageRef.current);
    };
  }, [speech]);

  const dropImage = useCallback(() => {
    setImage((cur) => {
      releaseImage(cur);
      return null;
    });
  }, []);

  const goHome = () => {
    speech.stop();
    cancelRead.current = true;
    dropImage();
    setDrafts([]);
    setNotice('');
    setScreen('home');
  };

  // ---- 学習の開始 / 終了 ----
  const beginStudy = (problems: Problem[], sample: boolean) => {
    dropImage(); // 写真は学習を始めたら破棄する
    setIsSample(sample);
    setSavedOk(null);
    const s = startSession(problems);
    setStudy(s);
    setScreen('study');
    // ボタン操作の中で読み上げる (iPhone Safariは操作を起点にしないと音が出ない)
    speech.speak(`いっしょに やってみよう。${speakProblem(problems[0])}`);
  };

  const finish = (s: StudyState) => {
    speech.stop();
    dropImage();
    if (!isSample) {
      const next = recordSession(s.engaged);
      setSavedOk(next !== null);
      if (next) setSummary(next);
    }
    setStudy(s);
    setScreen('done');
  };

  // ---- 撮影・画像選択 ----
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setNotice('');
    try {
      const img = await prepare(file);
      setImage((cur) => {
        releaseImage(cur);
        return img;
      });
    } catch (e) {
      const code = e instanceof ImageError ? e.code : 'decode-failed';
      setNotice(
        code === 'too-big'
          ? 'しゃしんが おおきすぎます。ちいさい サイズで とりなおすか、てで いれてください。'
          : 'しゃしんを ひらけませんでした。べつの しゃしんを えらぶか、てで いれてください。',
      );
    }
  };

  const readImage = async () => {
    if (!image) return;
    cancelRead.current = false;
    setProgress(0);
    setNotice('');
    setScreen('reading');
    try {
      const run = ocr ?? ((img, p) => recognizeImage(img.canvas, { onProgress: p }));
      const r = await run(image, setProgress);
      if (cancelRead.current) return;
      const ex = extractProblems(r.text);
      const items = ex.problems.map((p) => newDraft({ left: String(p.left), op: p.op, right: String(p.right), source: 'ocr', confirmed: false }));
      setDrafts(items);
      setSkippedNotes(ex.skipped.map((s) => `${s.text}: ${REASON_TEXT[s.reason]}`));
      setNotice(
        items.length === 0
          ? 'もんだいを よみとれませんでした。てで いれて はじめられます。'
          : items.length > MAX_PROBLEMS
            ? `${items.length}もん みつかりました。1かいに できるのは ${MAX_PROBLEMS}もんまでです。いらないものを けしてください。`
            : r.confidence < 60
              ? 'あまり はっきり よめませんでした。ぜんぶ よく たしかめてください。'
              : '',
      );
      setScreen('review');
    } catch (e) {
      if (cancelRead.current) return;
      setDrafts([]);
      setSkippedNotes([]);
      setNotice(
        e instanceof OcrTimeoutError
          ? 'よみとりに じかんが かかりすぎました。てで いれて はじめられます。'
          : 'よみとりが できませんでした。てで いれて はじめられます。',
      );
      setScreen('review');
    }
  };

  // ---- 画面 ----
  return (
    <main className="app">
      {screen === 'home' && (
        <Home
          summary={summary}
          canStore={canStore}
          speechOk={speech.supported}
          onCapture={() => {
            cancelRead.current = false;
            setScreen('capture');
          }}
          onSample={() => beginStudy(SAMPLE, true)}
          onClear={() => {
            if (window.confirm('がくしゅうの きろくを ぜんぶ けしますか？')) {
              clearSummary();
              setSummary(loadSummary());
            }
          }}
        />
      )}
      {screen === 'capture' && (
        <Capture
          image={image}
          notice={notice}
          onFile={onFile}
          onRead={readImage}
          onManual={() => {
            dropImage();
            setDrafts([newDraft()]);
            setSkippedNotes([]);
            setNotice('');
            setScreen('review');
          }}
          onRetake={dropImage}
          onBack={goHome}
        />
      )}
      {screen === 'reading' && (
        <Reading
          progress={progress}
          onCancel={() => {
            cancelRead.current = true;
            setScreen('capture');
          }}
          onManual={() => {
            cancelRead.current = true;
            dropImage();
            setDrafts([newDraft()]);
            setScreen('review');
          }}
        />
      )}
      {screen === 'review' && (
        <Review
          image={image}
          items={drafts}
          notice={notice}
          skipped={skippedNotes}
          onChange={setDrafts}
          onAdd={() => setDrafts((d) => [...d, newDraft()])}
          onBack={() => setScreen('capture')}
          onStart={(p) => beginStudy(p, false)}
        />
      )}
      {screen === 'study' && study && <Study state={study} speech={speech} onState={setStudy} onFinish={finish} />}
      {screen === 'done' && study && <Done state={study} sample={isSample} savedOk={savedOk} canStore={canStore} onClose={goHome} />}
      <p className="footer">TOMORI APP LAB 011</p>
    </main>
  );
}

function Home(props: { summary: Summary; canStore: boolean; speechOk: boolean; onCapture: () => void; onSample: () => void; onClear: () => void }) {
  const { summary } = props;
  return (
    <>
      <header className="center stack">
        <Mascot />
        <h1>TOMORI MANABU</h1>
        <p>今日もいっしょにやってみよう</p>
      </header>
      <div className="stack">
        <button type="button" className="primary full" onClick={props.onCapture}>
          📷 しゅくだいを とる
        </button>
        <button type="button" className="accent full" onClick={props.onSample}>
          🎈 おためしで あそぶ
        </button>
      </div>
      <section className="card stack" aria-label="きろく">
        <h3>これまでの きろく</h3>
        {!props.canStore ? (
          <p className="soft">このブラウザでは きろくを のこせません。がくしゅうは ふつうに できます。</p>
        ) : summary.sessions === 0 ? (
          <p className="soft">まだ きろくは ありません。</p>
        ) : (
          <p>
            {summary.sessions}かい がんばりました（ぜんぶで {summary.problems}もん とりくみました）
          </p>
        )}
        <p className="soft">きろくは この端末の ブラウザの中だけに あります。ブラウザの「サイトデータ」を けすと きえます。</p>
        {props.canStore && summary.sessions > 0 && (
          <button type="button" className="danger small" onClick={props.onClear}>
            🗑 きろくを けす
          </button>
        )}
      </section>
      {!props.speechOk && <p className="bubble note">この端末では こえが つかえません。もじを みながら できます。</p>}
    </>
  );
}

function Capture(props: {
  image: PreparedImage | null;
  notice: string;
  onFile: (f: File | undefined) => void;
  onRead: () => void;
  onManual: () => void;
  onRetake: () => void;
  onBack: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    props.onFile(e.target.files?.[0]);
    e.target.value = ''; // 同じ写真をもういちど選べるように
  };
  return (
    <>
      <h2>しゅくだいを とる</h2>
      <p className="soft">もんだいが 大きく うつるように、あかるい ところで とってね。しゃしんは この端末の中だけで つかいます。</p>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} data-testid="camera-input" />
      <input ref={libraryRef} type="file" accept="image/*" hidden onChange={pick} data-testid="library-input" />
      {props.notice && (
        <p className="bubble" role="alert">
          {props.notice}
        </p>
      )}
      {props.image ? (
        <div className="stack">
          <img className="thumb" src={props.image.previewUrl} alt="とった しゅくだいの しゃしん" />
          <button type="button" className="primary full" onClick={props.onRead}>
            🔍 もんだいを よみとる
          </button>
          <button type="button" className="full" onClick={() => cameraRef.current?.click()}>
            🔄 とりなおす
          </button>
        </div>
      ) : (
        <div className="stack">
          <button type="button" className="primary full" onClick={() => cameraRef.current?.click()}>
            📷 カメラで とる
          </button>
          <button type="button" className="full" onClick={() => libraryRef.current?.click()}>
            🖼 しゃしんから えらぶ
          </button>
        </div>
      )}
      <button type="button" className="accent full" onClick={props.onManual}>
        ✏️ てで いれる（しゃしんなし）
      </button>
      <button type="button" className="ghost full" onClick={props.onBack}>
        ← もどる
      </button>
    </>
  );
}

function Reading(props: { progress: number; onCancel: () => void; onManual: () => void }) {
  const pct = Math.round(props.progress * 100);
  return (
    <section className="stack center" aria-live="polite">
      <Mascot label="よみとりちゅうの まなぶん" />
      <div className="spinner" aria-hidden="true" />
      <h2>よみとり ちゅう…</h2>
      <p className="soft">はじめては すこし じかんが かかります（{pct > 0 ? `${pct}%` : 'じゅんび ちゅう'}）</p>
      <button type="button" className="accent full" onClick={props.onManual}>
        ✏️ まてないときは てで いれる
      </button>
      <button type="button" className="ghost full" onClick={props.onCancel}>
        やめる
      </button>
    </section>
  );
}

function Review(props: {
  image: PreparedImage | null;
  items: DraftItem[];
  notice: string;
  skipped: string[];
  onChange: (i: DraftItem[]) => void;
  onAdd: () => void;
  onBack: () => void;
  onStart: (p: Problem[]) => void;
}) {
  const ready = readiness(props.items);
  const hasOcr = props.items.some((i) => i.source === 'ocr');
  return (
    <>
      <h2>もんだいの かくにん</h2>
      <p className="soft">おうちの かたが みて、まちがいが ないか たしかめてください。1かいに {MAX_PROBLEMS}もんまでです。</p>
      {hasOcr && (
        <p className="bubble note">
          しゃしんの よみとりは まちがえることが あります。とくに「÷」が「＋」に なりやすいので、しゃしんと くらべて ください。
        </p>
      )}
      {props.image && <img className="thumb" src={props.image.previewUrl} alt="とった しゅくだいの しゃしん" />}
      {props.notice && (
        <p className="bubble" role="status">
          {props.notice}
        </p>
      )}
      {props.skipped.length > 0 && (
        <div className="bubble note" role="status">
          <p>つかえない もんだい（じどう さいてんは しません）:</p>
          <ul>
            {props.skipped.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <ReviewList items={props.items} onChange={props.onChange} />
      <button type="button" className="full" onClick={props.onAdd} disabled={props.items.length >= MAX_PROBLEMS}>
        ＋ もんだいを ふやす
      </button>
      {!ready.ok && <p className="soft" role="status">{ready.why}</p>}
      <button type="button" className="primary full" disabled={!ready.ok} onClick={() => ready.ok && props.onStart(ready.problems)}>
        🌟 いっしょに はじめる
      </button>
      <button type="button" className="ghost full" onClick={props.onBack}>
        ← しゃしんに もどる
      </button>
    </>
  );
}

function Study(props: { state: StudyState; speech: SpeechEngine; onState: (s: StudyState) => void; onFinish: (s: StudyState) => void }) {
  const { state, speech } = props;
  const p = currentProblem(state);
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState('');
  const hints = generateHints(p).slice(0, state.hintCount);
  const [line, setLine] = useState(`いっしょに やってみよう。${speakProblem(p)}`);
  const last = isLast(state);

  const say = (text: string) => {
    setLine(text);
    speech.speak(text);
  };

  const apply = (a: StudyAction) => {
    const next = studyReducer(state, a);
    props.onState(next);
    if (next.ended) {
      props.onFinish(next);
      return next;
    }
    return next;
  };

  const onHint = () => {
    if (state.hintCount >= MAX_HINTS) return;
    const next = apply({ type: 'hint' });
    say(generateHints(p)[next.hintCount - 1]);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = apply({ type: 'submit', value });
    if (next.feedback === 'correct') say(CORRECT_LINE);
    else if (next.feedback === 'wrong') {
      const base = WRONG_LINES[(next.wrongCount - 1) % WRONG_LINES.length];
      say(next.wrongCount >= 2 && next.hintCount < MAX_HINTS ? `${base} ヒントも きいてみる？` : base);
    } else if (next.feedback === 'need-number') say('すうじを いれてね。');
    setValue('');
  };

  const onNext = () => {
    const next = apply({ type: 'next' });
    if (next.ended) return;
    setShowInput(false);
    setValue('');
    say(speakProblem(currentProblem(next)));
  };

  const feedbackClass = state.feedback === 'correct' ? 'bubble good' : 'bubble';
  return (
    <>
      <p className="progress" aria-label={`${state.problems.length}もん中 ${state.index + 1}もんめ`}>
        {state.index + 1} / {state.problems.length}
      </p>
      <section className="card" aria-label="いまの もんだい">
        <p className="problem" data-testid="problem">
          {formatProblem(p)} = ?
        </p>
      </section>
      <p className={feedbackClass} role="status" aria-live="polite" data-testid="message">
        {state.feedback === 'correct' && '⭕ '}
        {state.feedback === 'wrong' && '💭 '}
        {line}
      </p>
      {!speech.supported && <p className="soft center">この端末では こえが つかえません。もじで すすめます。</p>}
      {hints.length > 0 && (
        <ol className="stack" aria-label="ヒント" style={{ paddingLeft: 24, margin: 0 }}>
          {hints.map((h, i) => (
            <li key={i}>
              <span className="tag warn">ヒント {i + 1}</span> {h}
            </li>
          ))}
        </ol>
      )}
      {showInput && (
        <form className="stack" onSubmit={onSubmit}>
          <label className="soft" htmlFor="answer">
            ノートに かいた こたえを いれてね
          </label>
          <input
            id="answer"
            className="answer-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="primary full" disabled={state.feedback === 'correct'}>
            ✅ たしかめる
          </button>
        </form>
      )}
      <div className="stack">
        <button type="button" className="accent full" onClick={onHint} disabled={state.hintCount >= MAX_HINTS}>
          💡 {state.hintCount >= MAX_HINTS ? 'ヒントは ここまで' : 'ヒントを きく'}
        </button>
        {!showInput && (
          <button type="button" className="primary full" onClick={() => setShowInput(true)}>
            ✏️ こたえを いれる
          </button>
        )}
        <button type="button" className="full" onClick={() => say(line)}>
          🔊 もういちど きく
        </button>
        <button type="button" className="full" onClick={onNext}>
          {last ? '🏁 さいごまで やった' : '➡️ つぎの もんだい'}
        </button>
        <button type="button" className="ghost full" onClick={() => apply({ type: 'quit' })}>
          きょうは ここまで
        </button>
      </div>
    </>
  );
}

function Done(props: { state: StudyState; sample: boolean; savedOk: boolean | null; canStore: boolean; onClose: () => void }) {
  const n = props.state.engaged;
  const quit = props.state.ended === 'quit';
  return (
    <section className="stack center">
      <Mascot label="よろこぶ まなぶん" />
      <h2>{quit ? 'ここまで よく がんばったね！' : 'おつかれさま！ よく がんばったね！'}</h2>
      <div className="card">
        <p className="soft">きょう とりくんだ もんだい</p>
        <p className="problem" style={{ padding: '8px 0' }} data-testid="count">
          {n} もん
        </p>
      </div>
      <p className="bubble good">
        {n > 0 ? 'じぶんで かんがえた ことが すてきだよ。つぎも いっしょに やろうね。' : 'きょうは ゆっくり やすもう。また こんど いっしょに やろうね。'}
      </p>
      {props.sample && <p className="soft">おためしは きろくに のこりません。</p>}
      {!props.sample && props.savedOk === false && props.canStore === false && (
        <p className="soft">このブラウザでは きろくを のこせませんでした。</p>
      )}
      <button type="button" className="primary full" onClick={props.onClose}>
        おわる
      </button>
    </section>
  );
}
