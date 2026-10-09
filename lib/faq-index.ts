export const FAQ_SLUGS = [
  'gdd',
  'base-temp',
  'normals',
  'harvest-window',
  'radiation',
  'gdd-reference',
  'soil-ph',
  'stages',
  'frost',
  'pest-timing',
] as const

export type FaqSlug = (typeof FAQ_SLUGS)[number]

export type FaqEntry = {
  slug: FaqSlug
  title: string
  summary: string
  related: FaqSlug[]
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    slug: 'gdd',
    title: '積算温度（GDD）とは？',
    summary: 'その日の平均気温から基準温度を引いた値を、植え付け日から足し合わせたものです。',
    related: ['base-temp', 'harvest-window', 'normals'],
  },
  {
    slug: 'base-temp',
    title: '基準温度とは？',
    summary: 'その作物がほとんど生長しない気温の下限です。',
    related: ['gdd', 'gdd-reference'],
  },
  {
    slug: 'gdd-reference',
    title: '主な作物の収穫までに必要な積算温度の目安',
    summary: '主な作物の、定植から初収穫までの積算温度の目安です。',
    related: ['gdd', 'base-temp', 'harvest-window'],
  },
  {
    slug: 'harvest-window',
    title: '収穫の見込みの幅とは？',
    summary: '過去10年それぞれの気温で届く日を出し、早い年と遅い年を除いた範囲です。',
    related: ['gdd', 'normals', 'gdd-reference'],
  },
  {
    slug: 'normals',
    title: '10年平均（推計）とは？',
    summary: 'その農場の座標で、過去10年の同じ月日を平均した値です。',
    related: ['gdd', 'harvest-window', 'radiation'],
  },
  {
    slug: 'radiation',
    title: '日射量（MJ/㎡）とは？',
    summary: '1平方メートルあたりに届いた日射エネルギーの量です。',
    related: ['normals', 'gdd'],
  },
  {
    slug: 'frost',
    title: '霜の締切とは？',
    summary: 'さつまいもは、最低気温4℃以下を霜のおそれとして、その前に掘り上げます。',
    related: ['harvest-window', 'normals'],
  },
  {
    slug: 'soil-ph',
    title: '適正pHとは？',
    summary: 'その品目が育ちやすい土壌の酸性・アルカリ性の範囲です。',
    related: ['stages'],
  },
  {
    slug: 'stages',
    title: '生育ステージとは？',
    summary: '日数では段階を決めず、節目を本人に聞いて確かめます。',
    related: ['gdd', 'frost'],
  },
  {
    slug: 'pest-timing',
    title: '防除のタイミングは？',
    summary: '日数では示しません。発生予察、見回り、ラベル、ローテーションの順です。',
    related: ['stages'],
  },
]

export const FAQ_GROUPS: { heading: string; slugs: FaqSlug[] }[] = [
  {
    heading: '計算のしかた',
    slugs: ['gdd', 'base-temp', 'gdd-reference', 'harvest-window'],
  },
  {
    heading: '気象データ',
    slugs: ['normals', 'radiation', 'frost'],
  },
  {
    heading: '土と生育',
    slugs: ['soil-ph', 'stages', 'pest-timing'],
  },
]

export function isFaqSlug(value: string): value is FaqSlug {
  return (FAQ_SLUGS as readonly string[]).includes(value)
}

export function faqEntry(slug: FaqSlug): FaqEntry {
  const entry = FAQ_ENTRIES.find((row) => row.slug === slug)
  if (!entry) throw new Error(`unknown faq slug: ${slug}`)
  return entry
}
