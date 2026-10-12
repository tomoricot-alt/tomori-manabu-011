// ルールベースのヒント生成 (外部AIは使わない)。1問につき最大3だんかい。
// 1: 考え方への誘導 / 2: 数え方・分け方 / 3: さらに小さな手順。答えそのものは出さない。
import type { Problem } from './math';

export const MAX_HINTS = 3;

const FALLBACK: [string, string, string] = [
  'もんだいを ゆっくり もういちど よんでみよう。なにを きかれているかな？',
  'えや ブロックを かいて、じぶんの ことばで せつめいしてみよう。',
  'ちいさい かずに おきかえて ためしてみよう。ゆびや ノートを つかっても いいよ。',
];

const tens = (n: number) => Math.floor(n / 10) * 10;
const ones = (n: number) => n % 10;

function addHints(a: number, b: number): [string, string, string] {
  const [big, small] = a >= b ? [a, b] : [b, a];
  const first = `たしざんは、ふたつの かずを あわせて いくつに なるかを きく もんだいだよ。${a}と ${b}を あわせた おおきさを おもいうかべてみよう。`;
  if (small < 10 && big + small < 20 && big % 10 + small < 10) {
    return [
      first,
      `${big}を ゆびや あたまの なかに おいて、そこから ${small}こ ぶん、ひとつずつ かぞえあげてみよう。`,
      `${big}の つぎは ${big + 1}、そのつぎは…と、${small}かい かぞえるよ。さいごに いった かずが こたえだよ。`,
    ];
  }
  const nextTen = tens(big) + 10;
  const toTen = nextTen - big;
  if (big % 10 + small % 10 >= 10 && small >= toTen) {
    const rest = small - toTen;
    return [
      first,
      `${big}に あと いくつ たすと ${nextTen}に なるかな？ きりの いい かずを つくると かんがえやすいよ。`,
      `${big}に ${toTen}を たすと ${nextTen}。${small}の うち ${toTen}を つかったから、のこりは ${rest}。${nextTen}に ${rest}を たしてみよう。`,
    ];
  }
  const st = tens(small);
  const so = ones(small);
  if (st === 0) {
    return [first, `${big}に ${small}を たす。ひとつずつ かぞえあげても いいよ。`, `${big}から ${small}かい かぞえあげてみよう。`];
  }
  return [
    first,
    `${small}を ${st}と ${so}に わけて、ひとつずつ たしていこう。`,
    `まず ${big}に ${st}を たすと ${big + st}。つぎに ${big + st}に ${so}を たしてみよう。`,
  ];
}

function subHints(a: number, b: number): [string, string, string] {
  const first = `ひきざんは、${a}から ${b}を とった のこりを きく もんだいだよ。${a}こ から ${b}こ とると いくつ のこるかな？`;
  if (b <= 10 && a <= 20) {
    return [
      first,
      `${a}から うしろへ ${b}かい かぞえて もどってみよう。ゆびを おりながら やると わかりやすいよ。`,
      `${a}の ひとつ まえは ${a - 1}。そこから また ひとつ まえへ…と ${b}かい くりかえすよ。`,
    ];
  }
  if (a - b <= 10) {
    return [
      first,
      `${b}から ${a}まで あと いくつ すすむと たどりつくかな？ そのかずが こたえだよ。`,
      `${b}から ひとつずつ かぞえあげて、${a}に ぴったり なるまで なんかい かぞえたか かぞえてみよう。`,
    ];
  }
  const bt = tens(b);
  const bo = ones(b);
  if (bt === 0) {
    return [first, `${a}から ${b}を、ひとつずつ ひいてみよう。`, `${a}から ${b}かい、ひとつずつ もどって かぞえてみよう。`];
  }
  const afterTens = a - bt;
  return [
    first,
    `${b}を ${bt}と ${bo}に わけて、${bt}を ひいてから ${bo}を ひいてみよう。`,
    bo === 0
      ? `${a}から ${bt}を ひいてみよう。じゅうの くらいを ${bt / 10}つ へらすんだよ。`
      : `まず ${a}から ${bt}を ひくと ${afterTens}。つぎに ${afterTens}から ${bo}を ひいてみよう。くらいを かりる ときは ゆっくり ね。`,
  ];
}

function mulHints(a: number, b: number): [string, string, string] {
  const first = `かけざんは、おなじ かずを なんかいも たす ことだよ。${a}ずつ ${b}こ あつまる ようすを おもいうかべてみよう。`;
  if (a >= 10 && b >= 10) {
    return [
      first,
      `${b}を ${tens(b)}と ${ones(b)}に わけて、${a}の ${tens(b) / 10}ばいと ${a}の ${ones(b)}ばいを べつべつに かんがえてみよう。`,
      `${a}×${tens(b) / 10}は ${a}を ${tens(b) / 10}かい たしたもの。10ばいに することも わすれずに。さいごに 2つを たすよ。`,
    ];
  }
  const [x, y] = a >= b ? [a, b] : [b, a]; // x が大きい方、y 回たす
  if (x >= 10) {
    const xt = tens(x);
    const xo = ones(x);
    return [
      first,
      `${x}を ${xt}と ${xo}に わけて、それぞれ ${y}ばいしてから あわせてみよう。`,
      xo === 0
        ? `${x / 10}×${y}を まず かんがえて、そのあと 10ばいに してみよう。`
        : `${xt}の ${y}ばいと、${xo}の ${y}ばいを べつべつに もとめて、さいごに たそう。`,
    ];
  }
  const steps = Array.from({ length: Math.min(3, y - 1) }, (_, i) => x * (i + 1)).join('、');
  return [
    first,
    `${x}を ${y}かい たしてみよう。ゆびで かぞえながら ${x}ずつ ふやしていくよ。`,
    steps
      ? `${steps}…と ${x}ずつ ふえていくよ。${y}かいめには いくつに なるかな？`
      : `${x}を ${y}かい たすよ。ひとつずつ かくにんしてみよう。`,
  ];
}

function divHints(a: number, b: number): [string, string, string] {
  const q = a / b;
  const first = `わりざんは、${a}を おなじ かずずつ わける もんだいだよ。${a}こを ${b}つに わけたら、ひとつぶんは いくつかな？ えを かいて かんがえてみよう。`;
  const steps = Array.from({ length: Math.min(3, q - 1) }, (_, i) => b * (i + 1)).join('、');
  return [
    first,
    `かけざんを つかってみよう。${b}に なにを かけると ${a}に なるかな？ ${b}の だんを いってみよう。`,
    steps
      ? `${b}の だんを じゅんばんに いうよ：${steps}…。どこで ${a}に ぴったり なるかな？`
      : `${b}に 1、2、3…と かけていって、${a}に なる ところを さがしてみよう。`,
  ];
}

function containsNumber(text: string, n: number): boolean {
  return new RegExp(`(?<![\\d])${n}(?![\\d])`).test(text);
}

/** 3だんかいのヒントを返す。答えがそのまま出てしまうものは、やさしい問いかけに置きかえる */
export function generateHints(p: Problem): [string, string, string] {
  let hints: [string, string, string];
  if (p.left === 0 || p.right === 0 || p.left === 1 || p.right === 1 || p.answer === p.left || p.answer === p.right) {
    hints = [...FALLBACK];
  } else {
    switch (p.op) {
      case '+':
        hints = addHints(p.left, p.right);
        break;
      case '-':
        hints = subHints(p.left, p.right);
        break;
      case '×':
        hints = mulHints(p.left, p.right);
        break;
      case '÷':
        hints = divHints(p.left, p.right);
        break;
    }
  }
  // 安全装置: こたえの数字がそのまま入っているヒントは、一般的な問いかけに置きかえる
  return hints.map((h, i) => (containsNumber(h, p.answer) ? FALLBACK[i] : h)) as [string, string, string];
}
