import standards from '@/data/fertilizer-standards.json'

export function fertilizerStandard(code?: string | null) {
  const entry = code && Object.hasOwn(standards, code) ? standards[code as keyof typeof standards] : null
  if (entry && !entry.fallbackReason) return { title: entry.title, url: entry.url, fallback: false }
  return {
    title: '都道府県施肥基準等（農林水産省）',
    url: 'https://www.maff.go.jp/j/seisan/kankyo/hozen_type/h_sehi_kizyun/index.html',
    fallback: true,
  }
}
