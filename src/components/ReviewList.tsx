// 問題の確認・編集 (保護者が見て、確認してから学習を始める)
import { MAX_PROBLEMS, REASON_TEXT, parseProblem, type Op, type Problem } from '../lib/math';

export interface DraftItem {
  key: string;
  left: string;
  op: Op;
  right: string;
  source: 'ocr' | 'manual';
  /** 保護者が写真と見くらべて確認したか (OCRで読んだものは必須) */
  confirmed: boolean;
}

export const OPS: { value: Op; label: string; name: string }[] = [
  { value: '+', label: '＋', name: 'たし算' },
  { value: '-', label: '－', name: 'ひき算' },
  { value: '×', label: '×', name: 'かけ算' },
  { value: '÷', label: '÷', name: 'わり算' },
];

export function parseDraft(d: DraftItem) {
  return parseProblem(`${d.left}${d.op}${d.right}`);
}

/** 学習を始められるか。始められないときは理由を返す */
export function readiness(items: DraftItem[]): { ok: true; problems: Problem[] } | { ok: false; why: string } {
  if (items.length === 0) return { ok: false, why: 'もんだいを 1つ いれてください' };
  if (items.length > MAX_PROBLEMS) return { ok: false, why: `もんだいは ${MAX_PROBLEMS}つまでです` };
  const problems: Problem[] = [];
  for (const it of items) {
    const r = parseDraft(it);
    if (!r.ok) return { ok: false, why: 'つかえない もんだいが あります。なおすか、けしてください' };
    problems.push(r.problem);
  }
  if (items.some((i) => !i.confirmed)) return { ok: false, why: 'ぜんぶの もんだいに「かくにんした」を つけてください' };
  return { ok: true, problems };
}

interface Props {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
}

export function ReviewList({ items, onChange }: Props) {
  const update = (key: string, patch: Partial<DraftItem>) =>
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch, confirmed: patch.confirmed ?? true } : i)));

  return (
    <ul className="plain" aria-label="もんだいの いちらん">
      {items.map((it, idx) => {
        const r = parseDraft(it);
        return (
          <li key={it.key} className="card item">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{idx + 1}ばんめ</strong>
              {it.source === 'ocr' ? <span className="tag warn">しゃしんから よみとり</span> : <span className="tag">てで いれた</span>}
            </div>
            <div className="eq">
              <input
                className="field"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                aria-label={`${idx + 1}ばんめ ひだりの かず`}
                value={it.left}
                onChange={(e) => update(it.key, { left: e.target.value.replace(/\D/g, '') })}
              />
              <select
                className="field"
                aria-label={`${idx + 1}ばんめ けいさんの しるし`}
                value={it.op}
                onChange={(e) => update(it.key, { op: e.target.value as Op })}
              >
                {OPS.map((o) => (
                  <option key={o.value} value={o.value} aria-label={o.name}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                className="field"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                aria-label={`${idx + 1}ばんめ みぎの かず`}
                value={it.right}
                onChange={(e) => update(it.key, { right: e.target.value.replace(/\D/g, '') })}
              />
            </div>
            <div className="op-pills" role="group" aria-label={`${idx + 1}ばんめ しるしを ワンタップで えらぶ`}>
              {OPS.map((o) => {
                const active = it.op === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`op-pill ${active ? 'active' : ''}`}
                    aria-pressed={active}
                    aria-label={`${idx + 1}ばんめを ${o.name}（${o.label}）にする`}
                    onClick={() => update(it.key, { op: o.value })}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {r.ok ? (
              <p className="soft">✓ つかえます</p>
            ) : (
              <p className="err" role="alert">
                ✗ つかえません: {REASON_TEXT[r.reason]}
              </p>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={it.confirmed}
                onChange={(e) => onChange(items.map((i) => (i.key === it.key ? { ...i, confirmed: e.target.checked } : i)))}
              />
              しゃしんと くらべて かくにんした
            </label>
            <button type="button" className="danger small" onClick={() => onChange(items.filter((i) => i.key !== it.key))} aria-label={`${idx + 1}ばんめを けす`}>
              🗑 この もんだいを けす
            </button>
          </li>
        );
      })}
    </ul>
  );
}
