import { prisma } from '@/lib/prisma'
import { getRegionalMonthlyLine } from '@/lib/insights/regional-context'
import { formatMilestoneGeneral } from '@/lib/proposals/milestones'
import { formatStageGeneralLine, resolveCropStage, type StageProgress } from '@/lib/proposals/stages'
import { getForecastDays, hasWeatherCoordinates } from '@/lib/weather-forecast'

export type ProposalLayers = {
  personal: string | null
  regional: string | null
  general: string | null
  conclusion: string
}

export type LastYearSameDaySummary = {
  labels: string[]
  /** 【あなた】層向けの一文。該当なしは null */
  summaryLine: string | null
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

/**
 * カレンダーの「昨年」オーバーレイと同じ軸：前年の同月同日（±windowDays）。
 * 植付日ベースの「前回作付け」とは別概念。
 */
export async function getLastYearSameDayWorkSummary(
  userId: string,
  options?: {
    farmId?: string | null
    cropId?: string | null
    /** 前年同日の前後何日を含めるか（デフォルト 2） */
    windowDays?: number
  }
): Promise<LastYearSameDaySummary> {
  const windowDays = options?.windowDays ?? 2
  const today = getTodayStart()
  const lastYearAnchor = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
  // 2/29 → 非うるう年はスキップ（カレンダーと同趣旨）
  if (lastYearAnchor.getMonth() !== today.getMonth()) {
    return { labels: [], summaryLine: null }
  }
  lastYearAnchor.setHours(0, 0, 0, 0)
  const rangeStart = addDays(lastYearAnchor, -windowDays)
  const rangeEnd = addDays(lastYearAnchor, windowDays)
  rangeEnd.setHours(23, 59, 59, 999)

  const workWhere: {
    farm: { userId: string; id?: string }
    date: { gte: Date; lte: Date }
    cropId?: string
  } = {
    farm: { userId },
    date: { gte: rangeStart, lte: rangeEnd },
  }
  if (options?.farmId) {
    workWhere.farm = { userId, id: options.farmId }
  }
  if (options?.cropId) {
    workWhere.cropId = options.cropId
  }

  const fertilizerWhere: {
    userId: string
    appliedAt: { gte: Date; lte: Date }
    farmId?: string
  } = {
    userId,
    appliedAt: { gte: rangeStart, lte: rangeEnd },
  }
  if (options?.farmId) {
    fertilizerWhere.farmId = options.farmId
  }

  const [works, fertilizers] = await Promise.all([
    prisma.workRecord.findMany({
      where: workWhere,
      include: { crop: true },
      orderBy: { date: 'asc' },
      take: 8,
    }),
    // 作物指定時は施肥を省略（crop紐付けが弱い）
    options?.cropId
      ? Promise.resolve([])
      : prisma.fertilizerRecord.findMany({
          where: fertilizerWhere,
          orderBy: { appliedAt: 'asc' },
          take: 5,
        }),
  ])

  let workRows = works
  if (workRows.length === 0 && options?.cropId && options?.farmId) {
    workRows = await prisma.workRecord.findMany({
      where: {
        farm: { userId, id: options.farmId },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      include: { crop: true },
      orderBy: { date: 'asc' },
      take: 8,
    })
  }

  const labels: string[] = []
  for (const w of workRows) {
    const crop = w.crop?.name ? `（${w.crop.name}）` : ''
    const label = `${w.taskType}${crop}`
    if (!labels.includes(label)) labels.push(label)
  }
  for (const f of fertilizers) {
    const label = `施肥：${f.productName}`
    if (!labels.includes(label)) labels.push(label)
  }

  if (labels.length === 0) {
    return { labels: [], summaryLine: null }
  }

  const shown = labels.slice(0, 4)
  const more = labels.length > shown.length ? `ほか${labels.length - shown.length}件` : ''
  const joined = shown.join('・') + (more ? `・${more}` : '')
  const windowNote = windowDays > 0 ? `（前後${windowDays}日含む）` : ''
  return {
    labels,
    summaryLine: `昨年同日${windowNote}は「${joined}」を実施しています。`,
  }
}

export function buildGeneralLayer(
  cropName: string | null | undefined,
  variety?: string | null,
  progress?: StageProgress
): string | null {
  if (!cropName) return null

  if (!progress) return null

  const fromMilestone = formatMilestoneGeneral({
    cropName,
    variety,
    daysSincePlanting: progress.daysSincePlanting,
    gddRatio: progress.gddRatio,
    hasHarvest: progress.hasHarvest,
    records: progress.milestones ?? [],
    today: progress.today,
  })
  if (fromMilestone) return fromMilestone
  const stage = resolveCropStage(cropName, variety, progress)
  if (stage) return formatStageGeneralLine(stage)
  return null
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

  let phenologyLabels: string[] = []
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
      phenologyLabels = [...new Set(prevWorks.map((w) => w.taskType))]
      parts.push(
        `前回作付けの同時期（植付から約${days}日前後）に${phenologyLabels.join('・')}を実施しています。`
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
  }

  // カレンダー軸：昨年同日の作業（植付日ベースとは別）
  const lastYear = await getLastYearSameDayWorkSummary(args.userId, {
    farmId: args.farmId,
    cropId: args.cropId,
  })
  if (lastYear.summaryLine) {
    const phenologySet = new Set(phenologyLabels)
    const calendarOnly = lastYear.labels.filter((label) => {
      const taskType = label.replace(/（.+）$/, '').replace(/^施肥：/, '')
      return !phenologySet.has(taskType)
    })
    if (calendarOnly.length > 0 || phenologyLabels.length === 0) {
      parts.push(lastYear.summaryLine)
    } else {
      parts.push('カレンダー上の昨年同日にも、上記と同種の作業記録があります。')
    }
  }

  return parts.length > 0 ? parts.join(' ') : null
}

export async function buildPersonalLayerForTask(args: {
  userId: string
  title: string
  farmName: string
  farmId?: string | null
  cropName?: string | null
  cropId?: string | null
  isOverdue: boolean
}): Promise<string> {
  const cropPart = args.cropName ? ` / ${args.cropName}` : ''
  const base = args.isOverdue
    ? `「${args.title}」（${args.farmName}${cropPart}）の期限を過ぎています。`
    : `「${args.title}」（${args.farmName}${cropPart}）が今日が期限です。`

  const lastYear = await getLastYearSameDayWorkSummary(args.userId, {
    farmId: args.farmId,
    cropId: args.cropId,
  })
  if (lastYear.summaryLine) {
    return `${base} ${lastYear.summaryLine}`
  }
  return base
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
