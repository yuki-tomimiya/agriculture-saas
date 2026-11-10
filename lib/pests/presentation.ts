import { siteLabel } from '@/lib/crops/conditions'
import type { PestMeasure } from '@/lib/pests/catalog'

export function groupPestQuestions<T extends { pest: { key: string } }>(questions: T[]): T[][] {
  const groups = new Map<string, T[]>()
  for (const question of questions) {
    const group = groups.get(question.pest.key)
    if (group) group.push(question)
    else groups.set(question.pest.key, [question])
  }
  return [...groups.values()]
}

export function pestMeasuresForSite(measures: PestMeasure[], growingSite?: string | null) {
  const site = growingSite || 'open'
  const matching = measures.filter(item => !item.site || item.site === site)
  if (!measures.length) return { matching, emptyMessage: '出典のある対策は見つかっていません。' }
  if (matching.length) return { matching, emptyMessage: null }
  const alternative = [...new Set(measures.map(item => siteLabel(item.site)))].join('・')
  return {
    matching,
    emptyMessage: `この育て方（${siteLabel(site)}）に合う、出典のある対策は見つかっていません。${alternative}向けの対策は資料にあります。`,
  }
}
