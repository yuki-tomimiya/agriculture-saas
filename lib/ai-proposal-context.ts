import { prisma } from '@/lib/prisma'
import { findCropBenchmark } from '@/lib/benchmarks/crops'
import { getRegionalMonthlyLine } from '@/lib/insights/regional-context'
import { getForecastDays, hasWeatherCoordinates } from '@/lib/weather-forecast'

export type ProposalLayers = {
  personal: string | null
  regional: string | null
  general: string | null
  conclusion: string
}

function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysSincePlanting(plantingDate: Date | null): number | null {
  if (!plantingDate) return null
  const start = new Date(plantingDate)
  start.setHours(0, 0, 0, 0)
  const today = getTodayStart()
  const diff = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return diff >= 0 ? diff : null
}

function matchKey(name: string, variety: string | null, farmId: string | null): string {
  return `${name.trim().toLowerCase()}|${(variety ?? '').trim().toLowerCase()}|${farmId ?? ''}`
}

export function buildGeneralLayer(
  cropName: string | null | undefined,
  variety?: string | null
): string {
  const month = new Date().getMonth() + 1
  if (!cropName) {
    return '記録が増えるほど、あなた専用のアドバイスが出やすくなります。'
  }
  const benchmark = findCropBenchmark(cropName, variety)
  if (!benchmark) {
    return `${cropName}の一般目安は準備中です。同時期の作業記録を残すと、次回から比較できます。`
  }
  const parts: string[] = []
  const monthly = benchmark.monthlyWorkHints[month]
  if (monthly) parts.push(`${benchmark.displayName}は${month}月、${monthly}`)
  if (benchmark.generalTips[0]) parts.push(benchmark.generalTips[0])
  if (parts.length === 0) {
    return `${benchmark.displayName}の一般目安：${benchmark.yieldHint}`
  }
  return parts.join('。') + '。'
}

export async function buildRegionalLayer(point?: {
  latitude?: number | null
  longitude?: number | null
  farmName?: string | null
}): Promise<string | null> {
  if (!hasWeatherCoordinates(point)) {
    return '農場に緯度・経度を登録すると、この地域の天候を根拠に提案できます。'
  }

  const [forecast, monthlyLine] = await Promise.all([
    getForecastDays({
      latitude: Number(point!.latitude),
      longitude: Number(point!.longitude),
    }),
    getRegionalMonthlyLine({
      latitude: point!.latitude,
      longitude: point!.longitude,
      farmName: point!.farmName,
    }),
  ])

  let forecastLine: string | null = null
  if (forecast.length > 0) {
    const near = forecast.slice(0, 5)
    const heavyRain = near.find((d) => d.precipitation >= 55)
    if (heavyRain) {
      forecastLine = `${heavyRain.dayLabel}は降水${heavyRain.precipitation}%の予報です。この地域では防除・収穫などは前日までに済ませると安心です。`
    } else {
      const strongWind = near.find((d) => d.wind >= 10)
      if (strongWind) {
        forecastLine = `${strongWind.dayLabel}は最大風速${strongWind.wind}m/sの予報です。ハウス・資材の固定を早めに確認しましょう。`
      } else {
        const rainyDays = near.filter((d) => d.precipitation >= 35).length
        if (rainyDays >= 2) {
          forecastLine =
            '今後数日、雨の日が続く見込みです。屋外作業は晴れ間を優先すると効率的です。'
        } else {
          const tomorrow = near[1]
          if (tomorrow && tomorrow.precipitation >= 40) {
            forecastLine = `${tomorrow.dayLabel}は降水${tomorrow.precipitation}%の予報です。今日中にできる屋外作業を先に。`
          } else {
            forecastLine =
              '今週の天候は大きな荒天予報は少なめです。屋外作業の計画を立てやすい時期です。'
          }
        }
      }
    }
  }

  if (forecastLine && monthlyLine) return `${monthlyLine} ${forecastLine}`
  return monthlyLine ?? forecastLine
}

export async function buildPersonalLayerForCrop(args: {
  userId: string
  cropId: string
  cropName: string
  variety: string | null
  farmId: string | null
  plantingDate: Date | null
  farmName: string
}): Promise<string | null> {
  const days = daysSincePlanting(args.plantingDate)
  const parts: string[] = []

  if (days !== null && args.plantingDate) {
    parts.push(`${args.cropName}（${args.farmName}）は植え付けから${days}日目です。`)
  }

  const siblings = await prisma.crop.findMany({
    where: {
      name: args.cropName,
      variety: args.variety ?? undefined,
      farmId: args.farmId ?? undefined,
    },
    orderBy: { plantingDate: 'desc' },
  })

  const group = siblings.filter(
    (c) => matchKey(c.name, c.variety, c.farmId) === matchKey(args.cropName, args.variety, args.farmId)
  )
  const idx = group.findIndex((c) => c.id === args.cropId)
  const previous = idx >= 0 ? group[idx + 1] : group[1]

  if (previous?.plantingDate && days !== null) {
    const windowStart = addDays(previous.plantingDate, Math.max(0, days - 7))
    const windowEnd = addDays(previous.plantingDate, days + 7)
    const prevWorks = await prisma.workRecord.findMany({
      where: {
        cropId: previous.id,
        date: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { date: 'asc' },
      take: 5,
    })
    if (prevWorks.length > 0) {
      const labels = [...new Set(prevWorks.map((w) => w.taskType))]
      parts.push(
        `前回作付けの同時期（植付から約${days}日前後）に${labels.join('・')}を実施しています。`
      )
    }

    const [curHarvest, prevHarvest] = await Promise.all([
      prisma.harvest.aggregate({
        where: { cropId: args.cropId },
        _sum: { quantity: true },
      }),
      prisma.harvest.aggregate({
        where: { cropId: previous.id },
        _sum: { quantity: true },
      }),
    ])
    const curQ = curHarvest._sum.quantity ?? 0
    const prevQ = prevHarvest._sum.quantity ?? 0
    if (prevQ > 0 && curQ > 0 && curQ !== prevQ) {
      const pct = Math.round(((curQ - prevQ) / prevQ) * 100)
      parts.push(`収量は前回作付け比${pct >= 0 ? '+' : ''}${pct}%（${curQ}kg / 前回${prevQ}kg）。`)
    } else if (prevQ > 0 && curQ === 0) {
      parts.push(`前回作付けの収量は${prevQ}kgでした。`)
    }
  } else if (days !== null) {
    parts.push('同名・同品種の前回作付けがまだないため、昨年との比較はこれから蓄積されます。')
  }

  return parts.length > 0 ? parts.join(' ') : null
}

export function buildPersonalLayerForTask(args: {
  title: string
  farmName: string
  cropName?: string | null
  isOverdue: boolean
}): string {
  const cropPart = args.cropName ? ` / ${args.cropName}` : ''
  if (args.isOverdue) {
    return `「${args.title}」（${args.farmName}${cropPart}）の期限を過ぎています。`
  }
  return `「${args.title}」（${args.farmName}${cropPart}）が今日が期限です。`
}

export function mergeLayers(
  partial: Partial<ProposalLayers> & { conclusion: string }
): ProposalLayers {
  return {
    personal: partial.personal ?? null,
    regional: partial.regional ?? null,
    general: partial.general ?? null,
    conclusion: partial.conclusion,
  }
}

export function layersToDescription(layers: ProposalLayers): string {
  return layers.conclusion
}
