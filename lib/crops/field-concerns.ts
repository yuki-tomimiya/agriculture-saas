// 台帳 I27。見た日から数える。
export const firstFollowUpDay = 3
export const lastFollowUpDay = 7

export const concernSelection = 'concern'
export const concernLabel = '名前が分からない・気になること'
export const concernNotesLimit = 500
export const concernPhotoLimit = 4 * 1024 * 1024
export const concernPhotoTypes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const

export const concernLocations = {
  leaf: '葉',
  stem: '茎や株元',
  flowerFruit: '花や実',
  root: '根',
  whole: '株全体',
}

export const concernSymptoms = {
  color: '色が変わった',
  spots: '斑点がある',
  wilt: 'しおれた・枯れた',
  eaten: '穴があく・かじられた',
  insects: '虫や卵がいる',
  shape: '巻く・縮れる・割れる',
  rot: '腐る・においがする',
  other: 'その他',
}

export const concernExtents = {
  one: '1株だけ',
  several: 'いくつかの株',
  widespread: '畑の広い範囲',
}

export const concernFollowUpResults = {
  spread: '広がった',
  unchanged: '変わらない',
  improved: 'おさまった',
}

export function concernMonthDay(day: string) {
  const [, month, date] = day.split('-').map(Number)
  return `${month}月${date}日`
}

export function concernChoiceLabels(choices: Record<string, string>, keys: string) {
  return keys.split(',').flatMap(key => {
    const label = concernChoiceLabel(choices, key)
    return label ? [label] : []
  })
}

export function concernFormHref(cropId: string) {
  return '/records/field?' + new URLSearchParams({ cropId, observation: concernSelection })
}

export function concernApiHref(cropId: string, concernId?: string) {
  const base = '/api/crops/' + encodeURIComponent(cropId) + '/field-concerns'
  return concernId ? base + '/' + encodeURIComponent(concernId) : base
}

export function concernChoiceLabel(choices: Record<string, string>, key: string) {
  return Object.hasOwn(choices, key) ? choices[key] : undefined
}
