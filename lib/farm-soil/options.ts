/** 農林水産省「地力増進基本指針」（平成20年10月16日）PDF4ページ
 * 第2 普通畑・1 基本的な改善目標の表。区分への当てはめは後続で行う。
 */
export const SOIL_OPTIONS_SOURCE = {
  publisher: '農林水産省', name: '地力増進基本指針', date: '2008-10-16', pdfPage: 4,
  url: 'https://www.maff.go.jp/j/seisan/kankyo/page/attach/pdf/260217_1-7.pdf',
} as const
export const MANUAL_SOIL_OPTIONS = [
  { key: 'brown-forest', label: '褐色森林土' },
  { key: 'brown-lowland', label: '褐色低地土' },
  { key: 'yellow', label: '黄色土' },
  { key: 'gray-lowland', label: '灰色低地土' },
  { key: 'gray-upland', label: '灰色台地土' },
  { key: 'peat', label: '泥炭土' },
  { key: 'dark-red', label: '暗赤色土' },
  { key: 'red', label: '赤色土' },
  { key: 'gley', label: 'グライ土' },
  { key: 'andosol', label: '黒ボク土' },
  { key: 'wet-andosol', label: '多湿黒ボク土' },
  { key: 'lithosol', label: '岩屑土' },
  { key: 'dune-regosol', label: '砂丘未熟土' },
  { key: 'unknown', label: '分からない／一覧にない' },
] as const
export type ManualSoilKey = typeof MANUAL_SOIL_OPTIONS[number]['key']
export function manualSoilOption(key: unknown) {
  return MANUAL_SOIL_OPTIONS.find(option => option.key === key) ?? null
}
