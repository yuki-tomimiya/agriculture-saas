import catalog from '@/data/pest-checks.json'
import guides from '@/data/pest-defense-guides.json'

export type PestSource = { title: string; publisher: string; year: string; page: string; url: string }
export type PestSeason = { code: string; months: number[]; label: string; site?: string; source: PestSource }
export type PestMeasure = { scope: string; code?: string; text: string; site?: string; sources: PestSource[] }
export type Pest = {
  key: string
  cropKind: string
  name: string
  question: string
  marker: string
  appearance: PestSource | null
  searchCrop: string
  searchPest: string
  measures: PestMeasure[]
  seasons: PestSeason[]
}

export const pests: readonly Pest[] = catalog
export const pesticideSearchUrl = 'https://pesticide.maff.go.jp/agricultural-chemicals/various-search/'
export function pestGuide(code?: string | null) {
  if (!code || !Object.hasOwn(guides, code)) return null
  const guide = guides[code as keyof typeof guides]
  const title = guide.title.includes(guide.name) ? guide.title : `${guide.name}「${guide.title}」`
  return { ...guide, title }
}
export const findPest = (key: string) => pests.find(pest => pest.key === key)
export const pestTrigger = (key: string) => 'pest:' + key
export const isPestTrigger = (trigger?: string) => trigger?.startsWith('pest:') ?? false
