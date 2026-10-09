import { normalizeCropNameForMatch } from '@/lib/benchmarks/crops'

export type CropPoint = {
  text: string
  source: string
}

type PointRow = {
  keywords: readonly string[]
  points: readonly CropPoint[]
}

/** 節目のカードで出している作業は重ねない。出典の無い古い generalTips は使わない。 */
const ROWS: readonly PointRow[] = [
  {
    keywords: ['トマト', 'とまと'],
    points: [
      {
        text: 'わき芽は小さいうちにかきます。',
        source: '宮城県・秋田県・熊本県野菜振興協会',
      },
    ],
  },
  {
    keywords: ['キュウリ', 'きゅうり'],
    points: [
      {
        text: '秋田県の資料では、実の太りが早い盛夏は朝夕2回収穫します。',
        source: '秋田県「野菜栽培技術指針」キュウリ p.58',
      },
    ],
  },
  {
    keywords: ['ピーマン', 'パプリカ'],
    points: [
      {
        text: '秋田県の資料では、咲いている花の上に葉が4〜5枚なら健全、1〜2枚なら草勢が落ちています。',
        source: '秋田県「野菜栽培技術指針」ピーマン p.138',
      },
    ],
  },
  {
    keywords: ['さつまいも', 'サツマイモ'],
    points: [
      {
        text: '霜が降りる前に掘り終えます。',
        source: '千葉県・秋田県・宮城県。いも類振興会『サツマイモ事典』p.80',
      },
    ],
  },
  {
    keywords: ['イチゴ', 'いちご'],
    points: [
      {
        text: '一季成りの品種は、日が短く気温が低いと花芽ができます。',
        source: '宮城県・栃木県農業試験場・農研機構',
      },
      {
        text: '定植の前に、検鏡で花芽ができているかを確かめます。',
        source: '熊本県・農研機構',
      },
    ],
  },
  {
    keywords: ['スイートコーン', 'とうもろこし', 'トウモロコシ'],
    points: [
      {
        text: '秋田県の資料では、絹糸が出てから20〜25日で収穫し、適期の幅が短いです。',
        source: '秋田県「野菜栽培技術指針」スイートコーン p.160',
      },
      {
        text: '秋田県の資料では、わき芽はとりません。',
        source: '秋田県「野菜栽培技術指針」スイートコーン p.160',
      },
    ],
  },
  {
    keywords: ['エダマメ', 'えだまめ', '枝豆'],
    points: [
      {
        text: '秋田県の資料では、収穫適期の幅が極めて狭いので、播く時期と面積をずらします。',
        source: '秋田県「野菜栽培技術指針」エダマメ p.161',
      },
      {
        text: '秋田県の資料では、開花期以降は追肥しません。',
        source: '秋田県「野菜栽培技術指針」エダマメ p.163',
      },
    ],
  },
  {
    keywords: ['ホウレンソウ', 'ほうれんそう', 'ほうれん草'],
    points: [
      {
        text: '秋田県・宮城県の資料では、晩春から夏まきはとう立ちしにくい品種を選びます。',
        source: '秋田県 p.197、宮城県 p.123',
      },
      {
        text: '宮城県の資料では、夜の弱い光でもとう立ちすることがあります。',
        source: '宮城県「みやぎの野菜指導指針」ほうれんそう p.121',
      },
    ],
  },
  {
    keywords: ['レタス'],
    points: [
      {
        text: '秋田県の資料では、夏まきは寒冷紗で温度を下げます。',
        source: '秋田県「野菜栽培技術指針」レタス p.191',
      },
    ],
  },
  {
    keywords: ['タマネギ', 'たまねぎ', '玉ねぎ'],
    points: [
      {
        text: '宮城県の資料では、葉鞘の径が10mm以上の大きな苗や、早い植え付けはとう立ちしやすいです。',
        source: '宮城県「みやぎの野菜指導指針」たまねぎ p.263',
      },
    ],
  },
  {
    keywords: ['ダイコン', 'だいこん'],
    points: [
      {
        text: '秋田県の資料では、最後の追肥は播種後25日までに終えます。',
        source: '秋田県「野菜栽培技術指針」ダイコン p.281',
      },
    ],
  },
  {
    keywords: ['キャベツ', 'きゃべつ'],
    points: [
      {
        text: '宮城県の資料では、茎の径が6mm以上の苗が10℃以下に1か月以上あうと花芽ができます。',
        source: '宮城県「みやぎの野菜指導指針」きゃべつ p.196',
      },
    ],
  },
]

export function cropPoints(cropName: string, variety?: string | null): CropPoint[] {
  const hay = normalizeCropNameForMatch(`${cropName}${variety ?? ''}`)
  let best: { row: PointRow; score: number } | null = null
  for (const row of ROWS) {
    for (const keyword of row.keywords) {
      const needle = normalizeCropNameForMatch(keyword)
      if (needle.length < 2 || !hay.includes(needle)) continue
      if (!best || needle.length > best.score) best = { row, score: needle.length }
    }
  }
  return best ? [...best.row.points] : []
}
