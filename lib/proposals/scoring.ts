import { prisma } from '@/lib/prisma'
import { getTargetGDDForCrop } from '@/lib/gdd'
import {
  buildGeneralLayer,
  buildPersonalLayerForCrop,
  buildRegionalLayer,
  mergeLayers,
  type ProposalLayers,
} from '@/lib/ai-proposal-context'
import { isProposalDismissed } from '@/lib/proposals/dismissal'
import { resolveCropStage } from '@/lib/proposals/stages'
import { getAccumulatedGDDFromApi, hasWeatherCoordinates } from '@/lib/weather-forecast'

export type ProposalUrgency = 'today' | 'thisWeek' | 'watch'

export type ProposalCropLine = {
  cropId: string
  cropName: string
  variety: string | null
  farmId?: string
  farmName?: string
  daysSincePlanting?: number
  currentGDD: number | null
  targetGDD: number
  action?: { kind: 'work' | 'task' | 'sale'; taskType?: string; title?: string }
}

export type ScoredProposal = {
  id: string
  urgency: ProposalUrgency
  score: number
  trigger: string
  title: string
  cropId?: string
  cropName?: string
  farmId?: string
  farmName?: string
  daysSincePlanting?: number
  variety?: string | null
  currentGDD?: number | null
  targetGDD?: number
  /** 同じきっかけ・同じ品目・同じ農場を1枚にまとめたときの内訳 */
  lines?: ProposalCropLine[]
  layers: ProposalLayers
  conclusion: string
  action?: { kind: 'work' | 'task' | 'sale'; taskType?: string; title?: string }
}

type Hit = {
  trigger: string
  urgency: ProposalUrgency
  score: number
  title: string
  conclusion: string
  action?: ScoredProposal['action']
}

function daysSince(date: Date | null, today: Date): number | null {
  if (!date) return null
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return diff >= 0 ? diff : null
}

function matchKey(name: string, variety: string | null, farmId: string | null): string {
  return `${name.trim().toLowerCase()}|${(variety ?? '').trim().toLowerCase()}|${farmId ?? ''}`
}

function averageGapDays(dates: Date[]): number | null {
  if (dates.length < 2) return null
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  let sum = 0
  for (let i = 1; i < sorted.length; i++) {
    sum += (sorted[i].getTime() - sorted[i - 1].getTime()) / (24 * 60 * 60 * 1000)
  }
  return sum / (sorted.length - 1)
}

function workCovers(taskTypes: string[], expected: string, hasHarvest: boolean): boolean {
  if (expected === '収穫' && hasHarvest) return true
  return taskTypes.some((task) => task.includes(expected) || expected.includes(task))
}

function urgencyRank(urgency: ProposalUrgency): number {
  if (urgency === 'today') return 3
  if (urgency === 'thisWeek') return 2
  return 1
}

function groupTitle(name: string, count: number, title: string): string {
  const body = title.includes('：') ? title.split('：').slice(1).join('：') : title
  if (body.includes('収穫適期')) return `${name} ${count}作付けが収穫適期です`
  return `${name} ${count}作付け：${body}`
}

function groupSameSignal(cards: ScoredProposal[]): ScoredProposal[] {
  const alone: ScoredProposal[] = []
  const buckets = new Map<string, ScoredProposal[]>()
  for (const card of cards) {
    if (!card.cropId || !card.cropName) {
      alone.push(card)
      continue
    }
    const key = `${card.trigger}|${card.cropName.trim()}|${card.farmId ?? ''}`
    const list = buckets.get(key) ?? []
    list.push(card)
    buckets.set(key, list)
  }
  const grouped: ScoredProposal[] = []
  for (const list of buckets.values()) {
    if (list.length < 2) {
      grouped.push(list[0])
      continue
    }
    const head = [...list].sort((a, b) => b.score - a.score)[0]
    grouped.push({
      ...head,
      id: `group-${head.trigger}-${head.cropName}-${head.farmId ?? 'none'}`,
      title: groupTitle(head.cropName ?? '', list.length, head.title),
      lines: list.map((card) => ({
        cropId: card.cropId!,
        cropName: card.cropName!,
        variety: card.variety ?? null,
        farmId: card.farmId,
        farmName: card.farmName,
        daysSincePlanting: card.daysSincePlanting,
        currentGDD: card.currentGDD ?? null,
        targetGDD: card.targetGDD ?? 0,
        action: card.action,
      })),
    })
  }
  return [...grouped, ...alone].sort(
    (a, b) => b.score - a.score || urgencyRank(b.urgency) - urgencyRank(a.urgency)
  )
}

function pickHit(hits: Hit[]): Hit | null {
  if (hits.length === 0) return null
  return [...hits].sort((a, b) => b.score - a.score || urgencyRank(b.urgency) - urgencyRank(a.urgency))[0]
}

/**
 * 栽培中の作物を毎日採点する。1作物につき最も強いシグナルを1枚。
 * 「今はしない」の除外は getTodayProposals 側で行う。
 */
export async function scoreGrowingCrops(
  userId: string,
  today: Date,
  dismissed: { trigger: string; cropId: string | null }[] = []
): Promise<ScoredProposal[]> {
  const crops = await prisma.crop.findMany({
    where: {
      OR: [{ userId }, { farm: { userId } }],
      status: 'growing',
      plantingDate: { not: null },
    },
    include: {
      farm: true,
      workRecords: { select: { date: true, taskType: true } },
      harvests: { select: { id: true } },
      sales: { select: { id: true } },
    },
    orderBy: { plantingDate: 'desc' },
  })

  const previousPool = await prisma.crop.findMany({
    where: {
      OR: [{ userId }, { farm: { userId } }],
      plantingDate: { not: null },
    },
    include: { workRecords: { select: { date: true } } },
  })

  const farmsWithCoords = new Map<string, NonNullable<(typeof crops)[number]['farm']>>()
  for (const crop of crops) {
    if (crop.farm && hasWeatherCoordinates(crop.farm)) farmsWithCoords.set(crop.farm.id, crop.farm)
  }
  const farmList = [...farmsWithCoords.values()]
  const regionalEntries = await Promise.all(
    farmList.map(async (farm) => {
      const text = await buildRegionalLayer({
        latitude: farm.latitude,
        longitude: farm.longitude,
        farmName: farm.name,
      })
      return [farm.id, text] as const
    })
  )
  const regionalByFarm = new Map(regionalEntries)
  const needsFallback = crops.some((crop) => !crop.farm || !hasWeatherCoordinates(crop.farm))
  const fallbackRegional = needsFallback ? await buildRegionalLayer(undefined) : null
  const defaultFarm = farmList[0]
  const defaultRegional = defaultFarm ? (regionalByFarm.get(defaultFarm.id) ?? null) : fallbackRegional

  const measured = await Promise.all(
    crops.map(async (crop) => {
      if (!crop.plantingDate || !crop.farm || !hasWeatherCoordinates(crop.farm)) {
        return { crop, currentGDD: null as number | null }
      }
      const currentGDD = await getAccumulatedGDDFromApi({
        startDate: new Date(crop.plantingDate),
        endDate: today,
        baseTemp: crop.baseTemperature ?? 10,
        point: {
          latitude: Number(crop.farm.latitude),
          longitude: Number(crop.farm.longitude),
        },
      })
      return { crop, currentGDD }
    })
  )

  const cards: ScoredProposal[] = []

  for (const { crop, currentGDD } of measured) {
    const days = daysSince(crop.plantingDate, today)
    if (days === null) continue
    const hasHarvest = crop.harvests.length > 0
    const targetGDD = getTargetGDDForCrop(crop.name, crop.variety)
    const gddRatio = currentGDD != null && targetGDD > 0 ? currentGDD / targetGDD : null
    const stage = resolveCropStage(crop.name, crop.variety, {
      daysSincePlanting: days,
      gddRatio,
      hasHarvest,
    })
    const taskTypes = crop.workRecords.map((work) => work.taskType)
    const hits: Hit[] = []

    if (!hasHarvest && gddRatio != null && gddRatio >= 1) {
      hits.push({
        trigger: 'harvest-window',
        urgency: 'today',
        score: 100,
        title: '収穫適期に入っています',
        conclusion: '試し掘りや収穫を、雨の前に段取りしましょう。',
        action: { kind: 'work', taskType: '収穫準備', title: `${crop.name}の収穫` },
      })
    } else if (!hasHarvest && gddRatio != null && gddRatio >= 0.9) {
      hits.push({
        trigger: 'harvest-window',
        urgency: 'thisWeek',
        score: 80,
        title: '試し掘りの時期です',
        conclusion: '肥大を確認し、問題があれば収穫を前倒ししましょう。',
        action: { kind: 'work', taskType: '収穫準備', title: `${crop.name}の試し掘り` },
      })
    }

    if (stage && !stage.expectedWorkTypes.some((expected) => workCovers(taskTypes, expected, hasHarvest))) {
      const early = stage.key === 'rooting' || stage.key === 'harvest'
      hits.push({
        trigger: 'stage-work-gap',
        urgency: early ? 'today' : 'thisWeek',
        score: early ? 70 : 55,
        title: `${stage.label}の作業がまだ記録されていません`,
        conclusion: `想定される作業は${stage.expectedWorkTypes.join('・')}です。実施済みなら記録を残しましょう。`,
        action: { kind: 'work', taskType: stage.expectedWorkTypes[0], title: `${crop.name}の${stage.label}` },
      })
    }

    if (hasHarvest && crop.sales.length === 0) {
      hits.push({
        trigger: 'sale-missing',
        urgency: 'thisWeek',
        score: 72,
        title: '売上を記録しましょう',
        conclusion: '出荷や直売の金額を残すと、前回作付けとの比較ができます。',
        action: { kind: 'sale', title: `${crop.name}の売上を記録` },
      })
    }

    const lastWork = crop.workRecords.reduce<Date | null>((latest, work) => {
      if (!latest || work.date > latest) return work.date
      return latest
    }, null)
    const key = matchKey(crop.name, crop.variety, crop.farmId)
    const previous = previousPool
      .filter((other) => other.id !== crop.id && matchKey(other.name, other.variety, other.farmId) === key)
      .sort((a, b) => (b.plantingDate?.getTime() ?? 0) - (a.plantingDate?.getTime() ?? 0))
      .find((other) => (other.plantingDate?.getTime() ?? 0) < (crop.plantingDate?.getTime() ?? 0))
    const previousGap = previous ? averageGapDays(previous.workRecords.map((work) => work.date)) : null
    const sinceLastWork = lastWork ? daysSince(lastWork, today) : null
    if (previousGap != null && sinceLastWork != null && sinceLastWork > previousGap) {
      hits.push({
        trigger: 'work-interval',
        urgency: 'thisWeek',
        score: 42,
        title: '前回より作業の間隔が空いています',
        conclusion: `前回作付けの作業間隔はおおよそ${Math.round(previousGap)}日でした。最終作業から${sinceLastWork}日たっています。`,
        action: { kind: 'work', title: `${crop.name}の作業を記録` },
      })
    }

    if (!hasHarvest && crop.workRecords.length <= 2 && days >= 90) {
      const severe = days >= 140
      hits.push({
        trigger: 'neglected-crop',
        urgency: severe ? 'thisWeek' : 'watch',
        score: severe ? 60 : 20,
        title: '栽培中のまま記録が止まっています',
        conclusion: '終わっている作付けなら、状態を収穫済みにして振り返りを残しましょう。',
        action: { kind: 'task', title: `${crop.name}の作付けを終えるか確認` },
      })
    }

    const best = pickHit(
      hits.filter((hit) => !isProposalDismissed(dismissed, hit.trigger, crop.id))
    )
    if (!best) continue

    const farmName = crop.farm?.name ?? '農場未設定'
    const regional =
      (crop.farmId ? regionalByFarm.get(crop.farmId) : undefined) ?? fallbackRegional
    const [personal, general] = await Promise.all([
      buildPersonalLayerForCrop({
        userId,
        cropId: crop.id,
        cropName: crop.name,
        variety: crop.variety,
        farmId: crop.farmId,
        plantingDate: crop.plantingDate,
        farmName,
      }),
      Promise.resolve(
        buildGeneralLayer(crop.name, crop.variety, {
          daysSincePlanting: days,
          gddRatio,
          hasHarvest,
        })
      ),
    ])
    const measuredLine =
      currentGDD != null
        ? `${crop.name}の積算温度は ${currentGDD}℃日です（目標 ${targetGDD}℃日、植付から${days}日）。`
        : `${crop.name}は植付から${days}日目です（${farmName}）。`
    const personalText = personal ? `${personal} ${measuredLine}` : measuredLine

    cards.push({
      id: `${best.trigger}-${crop.id}`,
      urgency: best.urgency,
      score: best.score,
      trigger: best.trigger,
      title: `${crop.name}：${best.title}`,
      cropId: crop.id,
      cropName: crop.name,
      farmId: crop.farmId ?? undefined,
      farmName,
      daysSincePlanting: days,
      variety: crop.variety,
      currentGDD,
      targetGDD,
      conclusion: best.conclusion,
      action: best.action,
      layers: mergeLayers({
        personal: personalText,
        regional,
        general,
        conclusion: best.conclusion,
      }),
    })
  }

  if (
    defaultRegional &&
    (defaultRegional.includes('降水') || defaultRegional.includes('雨') || defaultRegional.includes('風')) &&
    !isProposalDismissed(dismissed, 'weather-pull-forward')
  ) {
    const severe = defaultRegional.includes('風速') || defaultRegional.includes('降水')
    cards.push({
      id: 'weather-pull-forward',
      urgency: 'today',
      score: severe ? 75 : 35,
      trigger: 'weather-pull-forward',
      title: '天候を見て屋外作業を前倒ししましょう',
      farmId: defaultFarm?.id,
      farmName: defaultFarm?.name,
      action: { kind: 'work', title: '屋外作業を前倒しする' },
      conclusion: severe
        ? '雨や風の前に、外でできる作業を済ませましょう。'
        : '今週の天候に合わせて、屋外作業の順番を決めましょう。',
      layers: mergeLayers({
        personal: null,
        regional: defaultRegional,
        general: null,
        conclusion: severe
          ? '雨や風の前に、外でできる作業を済ませましょう。'
          : '今週の天候に合わせて、屋外作業の順番を決めましょう。',
      }),
    })
  }

  return groupSameSignal(cards)
}
