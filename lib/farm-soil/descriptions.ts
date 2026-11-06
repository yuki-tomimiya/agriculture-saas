import type { ManualSoilKey } from './options'

/** 台帳 E12 に照合した、農研機構 日本土壌インベントリー「土壌分類」の引用。 */
const QUOTES = {
  D: '有機物が集積して黒い色をしていることが多く、黒くてホクホクしていることから黒ボク土と呼ばれる。',
  D3: '地下水の影響で湿っている黒ボク土。',
  D4: '森林下に出来る黒ボク土で、有機物含量は高いが、黒色味が弱く褐色の表層を持つ。',
  D6: '最も普通に見られる黒ボク土。',
  I: '火山灰の影響の少ない山地・丘陵地に分布する褐色あるいは黄褐色の次表層をもつ土壌。',
  F: '河川氾濫堆積物の度重なる付加により、土壌母材は常に新しい状態が保たれ、土壌養分などは豊富であることが多く、一般的には肥沃な土壌として知られる。',
  F2: '低地土大群の中で、最も地下水位が高く、年間を通じてほとんど水に飽和されたグライ層が50cm以内に出てくる土壌。',
  F3: '中間的な湿性状態の沖積地の土壌。日本の水田の代表的な土壌。',
  F4: '沖積低地の中では最も乾いた土地にある、黄褐色の次表層を持つ土壌。',
  G: '赤黄色土は、有機物の蓄積が少なく、塩基飽和度が低く、風化の進んだ赤色または黄色の土壌である。',
  J: '一般に腐植含量、粘土含量ともに低く、保肥力は低いが、排水性が良いため、メロンやラッキョウなどの栽培に適する。',
  J2: '砂丘地の未熟な土壌。',
  J3: '地表から30cm以内に固結した岩盤が現われる未熟土。',
  B: '湿生植物の遺体が、過湿のため分解を免れ厚く堆積した土壌。',
  E: '母岩となる塩基性の強い岩石（蛇紋岩、石灰岩など）に強く影響を受けた土壌。',
  H: '年間を通じてあるいは年間のある期間、停滞水または地下水による影響を受け、断面内に湿性の特徴を示す層をもつ台地、丘陵地、山地の土壌。',
}

type Page = keyof typeof QUOTES

const MANUAL_PAGES: Record<ManualSoilKey, Page | null> = {
  'brown-forest': 'I',
  'brown-lowland': 'F4',
  yellow: 'G',
  'gray-lowland': 'F3',
  'gray-upland': 'H',
  peat: 'B',
  'dark-red': 'E',
  red: 'G',
  gley: 'F2',
  andosol: 'D',
  'wet-andosol': 'D3',
  lithosol: 'J3',
  'dune-regosol': 'J2',
  unknown: null,
}

function description(page: Page, broad = false) {
  return {
    quote: QUOTES[page],
    url: `https://soil-inventory.rad.naro.go.jp/explain/${page}.html`,
    broad,
  }
}

export function manualSoilDescription(key: ManualSoilKey) {
  const page = MANUAL_PAGES[key]
  return page ? description(page) : null
}

function isPage(code: string): code is Page {
  return Object.hasOwn(QUOTES, code)
}

export function mapSoilDescription(subgroup: string | null | undefined) {
  const code = subgroup?.trim() ?? ''
  const specific = code.slice(0, 2)
  if (specific.length === 2 && isPage(specific)) return description(specific)
  const broad = code.slice(0, 1)
  return isPage(broad) ? description(broad, true) : null
}
