import { prisma } from '@/lib/prisma'
import { loadHarvestSamples, pickHarvestBasis } from '@/lib/insights/harvest-gdd-basis'
import {
  forecastAvgByYmd,
  formatHarvestWindow,
  projectHarvestWindow,
} from '@/lib/insights/harvest-date-window'
import {
  buildGeneralLayer,
  buildPersonalLayerForCrop,
  buildRegionalLayer,
  mergeLayers,
  type ProposalLayers,
} from '@/lib/ai-proposal-context'
import { isProposalDismissed } from '@/lib/proposals/dismissal'
import { isMilestoneTrigger, pickMilestoneAsk } from '@/lib/proposals/milestones'
import { assessSweetPotatoFrost, isSweetPotatoCrop, type SweetPotatoFrost } from '@/lib/proposals/frost'
import { resolveCropStage } from '@/lib/proposals/stages'
import { formatSoilPhRange, matchedSoilPh, soilPhSignal } from '@/lib/benchmarks/soil-ph'
import { soilNutrientHits } from '@/lib/benchmarks/soil-nutrients'
import { getAccumulatedGDDFromApi, getForecastDays, hasWeatherCoordinates } from '@/lib/weather-forecast'
import { loadLocationArchive, type LocationArchive } from '@/lib/weather-normals'
import { getLocationFirstFrost, type FirstFrostSummary } from '@/lib/weather-frost'
import {
  askSeasonFinish,
  cropHarvestKind,
  isTomatoCrop,
  TOMATO_NIGHT_SOURCE,
  TOMATO_POLLEN_MIN_C,
} from '@/lib/proposals/crop-kind'
import { firstMeanMinBelow, isOnOrAfterCoolNight } from '@/lib/weather-night'

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
  targetCaption?: string
  action?: { kind: 'work' | 'task' | 'sale' | 'finish' | 'pesticide'; taskType?: string; title?: string }
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
  targetCaption?: string
  /** 同じきっかけ・同じ品目を1枚にまとめたときの内訳 */
  lines?: ProposalCropLine[]
  layers: ProposalLayers
  conclusion: string
  action?: { kind: 'work' | 'task' | 'sale' | 'finish' | 'pesticide'; taskType?: string; title?: string }
  /** この作付けだけの霜の一文。農場が混ざるまとめカードには、全員同じときだけ載せる */
  frostNote?: string
  milestone?: {
    key: string
    question: string
    term: string
    ifYes: string
    sourceLabel: string
    howTo: string[]
    yesLabel: string
  }
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
  if (body.includes('終了しましたか')) return `${name} ${count}作付けは終了しましたか？`
  if (body.includes('収穫適期')) return `${name} ${count}作付けが収穫適期です`
  return `${name} ${count}作付け：${body}`
}

function formatMeasure(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function groupPersonalSummary(list: ScoredProposal[]): string {
  const count = list.length
  const days = list
    .map((card) => card.daysSincePlanting)
    .filter((day): day is number => day != null)
  const gdds = list
    .map((card) => card.currentGDD)
    .filter((value): value is number => value != null)
  const captions = [...new Set(list.map((card) => card.targetCaption).filter((value): value is string => !!value))]
  const targets = [...new Set(list.map((card) => card.targetGDD).filter((value): value is number => value != null))]
    .sort((a, b) => a - b)
  const parts: string[] = []
  if (days.length > 0) {
    const min = Math.min(...days)
    const max = Math.max(...days)
    parts.push(
      min === max
        ? `${count}作付けとも植え付けから${min}日目`
        : `${count}作付けは植え付けから${min}〜${max}日目`
    )
  }
  if (gdds.length > 0) {
    const min = Math.min(...gdds)
    const max = Math.max(...gdds)
    const targetText =
      captions.length > 0
        ? captions.join('、')
        : targets.length > 1
          ? `基準は品種により ${targets.map(formatMeasure).join(' / ')}℃日`
          : targets.length === 1
            ? `基準 ${formatMeasure(targets[0])}℃日`
            : null
    const same = min === max && gdds.length === count
    const both = count === 2 ? 'どちらも' : 'どれも'
    const valueText = same
      ? `積算温度は${both} ${formatMeasure(min)}℃日`
      : `積算温度は ${formatMeasure(min)}〜${formatMeasure(max)}℃日`
    parts.push(targetText ? `${valueText}（${targetText}）` : valueText)
  }
  if (list[0]?.title.includes('終了しましたか')) {
    parts.push('収穫の記録があるか、収穫予定日を過ぎています')
  }
  return `${parts.join('。')}。`
}

function groupRegionalText(head: ScoredProposal, list: ScoredProposal[]): string | null {
  const farms = [...new Set(list.map((card) => card.farmName).filter((name): name is string => !!name))]
  const base = head.layers.regional
  if (farms.length <= 1) return base
  const note = `農場が混ざっているため、上の天気は${head.farmName ?? farms[0]}のものです。農場ごとに異なります。`
  return base ? `${base} ${note}` : `農場ごとに異なります（${farms.join('、')}）。`
}

/** 節目は作物名が違っても、同じ質問なら1枚。1件のときはまとめない */
function groupMilestoneCards(cards: ScoredProposal[]): ScoredProposal[] {
  const buckets = new Map<string, ScoredProposal[]>()
  for (const card of cards) {
    const list = buckets.get(card.trigger) ?? []
    list.push(card)
    buckets.set(card.trigger, list)
  }
  const grouped: ScoredProposal[] = []
  for (const list of buckets.values()) {
    if (list.length < 2) {
      grouped.push(list[0])
      continue
    }
    const head = list[0]
    grouped.push({
      ...head,
      id: `group-${head.trigger}`,
      title: `${head.title}（${list.length}件）`,
      cropId: undefined,
      cropName: undefined,
      farmId: undefined,
      farmName: undefined,
      daysSincePlanting: undefined,
      lines: list.map((card) => ({
        cropId: card.cropId!,
        cropName: card.cropName!,
        variety: card.variety ?? null,
        farmId: card.farmId,
        farmName: card.farmName,
        daysSincePlanting: card.daysSincePlanting,
        currentGDD: card.currentGDD ?? null,
        targetGDD: card.targetGDD ?? 0,
        targetCaption: card.targetCaption,
        action: card.action,
      })),
    })
  }
  return grouped
}

function withFrostNote(card: ScoredProposal): ScoredProposal {
  if (!card.frostNote) return card
  return {
    ...card,
    frostNote: undefined,
    layers: {
      ...card.layers,
      general: appendFrostNote(card.layers.general, card.frostNote),
    },
  }
}

function appendFrostNote(general: string | null, note: string | undefined): string | null {
  if (!note) return general
  if (!general) return note
  const glue = general.endsWith('。') ? ' ' : '。'
  return `${general}${glue}${note}`
}

/** 同じ地点・同じ文言の霜は1枚。地点が違うと日付が違うので、文言が同じときだけまとめる */
function groupFrostCards(cards: ScoredProposal[]): ScoredProposal[] {
  const buckets = new Map<string, ScoredProposal[]>()
  for (const card of cards) {
    const key = `${card.trigger}|${card.title}|${card.conclusion}`
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
    const head = list.some((card) => card.urgency === 'today')
      ? list.find((card) => card.urgency === 'today')!
      : list[0]
    grouped.push({
      ...head,
      id: `group-${head.trigger}-${list.length}-${grouped.length}`,
      title: `${head.title}（${list.length}件）`,
      score: Math.max(...list.map((card) => card.score)),
      cropId: undefined,
      cropName: undefined,
      farmId: undefined,
      farmName: undefined,
      daysSincePlanting: undefined,
      layers: {
        ...head.layers,
        personal: null,
      },
      lines: list.map((card) => ({
        cropId: card.cropId!,
        cropName: card.cropName!,
        variety: card.variety ?? null,
        farmId: card.farmId,
        farmName: card.farmName,
        daysSincePlanting: card.daysSincePlanting,
        currentGDD: card.currentGDD ?? null,
        targetGDD: card.targetGDD ?? 0,
        targetCaption: card.targetCaption,
        action: card.action,
      })),
    })
  }
  return grouped
}

function groupSameSignal(cards: ScoredProposal[]): ScoredProposal[] {
  const alone: ScoredProposal[] = []
  const buckets = new Map<string, ScoredProposal[]>()
  for (const card of cards) {
    if (!card.cropId || !card.cropName) {
      alone.push(card)
      continue
    }
    const key = `${card.trigger}|${card.cropName.trim()}`
    const list = buckets.get(key) ?? []
    list.push(card)
    buckets.set(key, list)
  }
  const grouped: ScoredProposal[] = []
  for (const list of buckets.values()) {
    if (list.length < 2) {
      grouped.push(withFrostNote(list[0]))
      continue
    }
    const head = [...list].sort((a, b) => b.score - a.score)[0]
    const notes = new Set(list.map((card) => card.frostNote ?? ''))
    const sharedNote = notes.size === 1 ? list[0].frostNote : undefined
    grouped.push({
      ...head,
      frostNote: undefined,
      id: `group-${head.trigger}-${head.cropName}`,
      title: groupTitle(head.cropName ?? '', list.length, head.title),
      farmId: undefined,
      farmName: undefined,
      layers: mergeLayers({
        personal: groupPersonalSummary(list),
        regional: groupRegionalText(head, list),
        general: appendFrostNote(head.layers.general, sharedNote),
        conclusion: head.conclusion,
      }),
      lines: list.map((card) => ({
        cropId: card.cropId!,
        cropName: card.cropName!,
        variety: card.variety ?? null,
        farmId: card.farmId,
        farmName: card.farmName,
        daysSincePlanting: card.daysSincePlanting,
        currentGDD: card.currentGDD ?? null,
        targetGDD: card.targetGDD ?? 0,
        targetCaption: card.targetCaption,
        action: card.action,
      })),
    })
  }
  return [...grouped, ...alone.map(withFrostNote)].sort(
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
      milestones: { select: { key: true, observedAt: true } },
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
  const climateByFarm = new Map<
    string,
    {
      frost: FirstFrostSummary | null
      forecast: Awaited<ReturnType<typeof getForecastDays>>
      archive: LocationArchive | null
    }
  >()
  const regionalEntries = await Promise.all(
    farmList.map(async (farm) => {
      const point = {
        latitude: Number(farm.latitude),
        longitude: Number(farm.longitude),
      }
      const [text, frost, forecast, archive] = await Promise.all([
        buildRegionalLayer({
          latitude: farm.latitude,
          longitude: farm.longitude,
          farmName: farm.name,
        }),
        getLocationFirstFrost(point),
        getForecastDays(point),
        loadLocationArchive(point),
      ])
      climateByFarm.set(farm.id, { frost, forecast, archive })
      return [farm.id, text] as const
    })
  )
  const regionalByFarm = new Map(regionalEntries)
  const needsFallback = crops.some((crop) => !crop.farm || !hasWeatherCoordinates(crop.farm))
  const fallbackRegional = needsFallback ? await buildRegionalLayer(undefined) : null

  const harvestSamples = await loadHarvestSamples(userId)
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
  const milestoneCards: ScoredProposal[] = []
  const frostCards: ScoredProposal[] = []
  const frostNoteByCrop = new Map<string, string>()

  for (const { crop, currentGDD } of measured) {
    const days = daysSince(crop.plantingDate, today)
    if (days === null) continue
    const hasHarvest = crop.harvests.length > 0
    const basis = pickHarvestBasis(harvestSamples, crop.name, crop.variety)
    const targetGDD = basis.gdd
    const gddRatio = currentGDD != null && targetGDD > 0 ? currentGDD / targetGDD : null
    const climate = crop.farmId ? climateByFarm.get(crop.farmId) : undefined
    const harvestWindowReady = Boolean(climate?.archive && currentGDD != null && targetGDD > 0)
    const harvestWindow = harvestWindowReady
      ? projectHarvestWindow({
          today,
          currentGdd: currentGDD ?? 0,
          targetGdd: targetGDD,
          baseTemp: crop.baseTemperature ?? 10,
          archive: climate!.archive!,
          forecastByYmd: forecastAvgByYmd(climate!.forecast),
        })
      : null
    const windowSentence = harvestWindow
      ? `収穫の目安に届くのは${formatHarvestWindow(harvestWindow, {
          provisional: basis.source === 'provisional',
        })}。`
      : ''
    const stage = resolveCropStage(crop.name, crop.variety, {
      daysSincePlanting: days,
      gddRatio,
      hasHarvest,
    })
    const taskTypes = crop.workRecords.map((work) => work.taskType)
    const hits: Hit[] = []

    const harvestDatePast =
      crop.harvestDate != null && new Date(crop.harvestDate).setHours(0, 0, 0, 0) < today.getTime()
    const overTarget = gddRatio != null && gddRatio >= 1
    const kind = cropHarvestKind(crop.name, crop.variety)
    if (askSeasonFinish({ kind, hasHarvest, harvestDatePast, overTarget })) {
      hits.push({
        trigger: 'season-finish',
        urgency: 'today',
        score: 110,
        title: 'この作付けは終了しましたか？',
        conclusion: '終わっているなら、収穫済みにしましょう。',
        action: { kind: 'finish', title: `${crop.name}の作付けを終える` },
      })
    }

    const coolNight =
      isTomatoCrop(crop.name, crop.variety) && climate?.archive
        ? firstMeanMinBelow(climate.archive)
        : null
    if (coolNight && isOnOrAfterCoolNight(today, coolNight)) {
      hits.push({
        trigger: 'season-finish',
        urgency: 'today',
        score: 112,
        title: `夜の気温が${TOMATO_POLLEN_MIN_C}℃を下回る時期に入りました`,
        conclusion:
          '新しい花は実になりにくくなります。いまついている実の収穫が終わったら、作付けを終了してください。',
        action: { kind: 'finish', title: `${crop.name}の作付けを終える` },
      })
    }

    if (kind === 'continuous' && !hasHarvest && gddRatio != null && gddRatio >= 0.9) {
      hits.push({
        trigger: 'harvest-window',
        urgency: gddRatio >= 1 ? 'today' : 'thisWeek',
        score: gddRatio >= 1 ? 100 : 80,
        title: '収穫が始まるころです',
        conclusion: windowSentence
          ? `採り始めの準備をしましょう。${windowSentence}`
          : '採り始めの準備をしましょう。',
        action: { kind: 'work', taskType: '収穫', title: `${crop.name}の収穫` },
      })
    } else if (kind !== 'continuous' && !hasHarvest && gddRatio != null && gddRatio >= 1) {
      hits.push({
        trigger: 'harvest-window',
        urgency: 'today',
        score: 100,
        title: '収穫適期に入っています',
        conclusion: '積算温度が収穫の目安に達しています。',
        action: { kind: 'work', taskType: '収穫', title: `${crop.name}の収穫` },
      })
    } else if (kind !== 'continuous' && !hasHarvest && gddRatio != null && gddRatio >= 0.9) {
      const waitingForTestDig = crop.milestones.every((row) => row.key !== 'test-dig')
      const sweetPotatoAsk =
        waitingForTestDig &&
        pickMilestoneAsk({
          cropName: crop.name,
          variety: crop.variety,
          daysSincePlanting: days,
          gddRatio,
          hasHarvest,
          records: crop.milestones,
        })?.key === 'test-dig'
      if (!sweetPotatoAsk) {
        hits.push({
          trigger: 'harvest-window',
          urgency: 'thisWeek',
          score: 80,
          title: '収穫の目安に近づいています',
          conclusion: `試し掘りで太りを見て、問題があれば収穫を前倒ししましょう。${windowSentence}`,
          action: { kind: 'work', taskType: '試し掘り', title: `${crop.name}の試し掘り` },
        })
      }
    }

    if (
      stage &&
      stage.key !== 'harvest' &&
      !stage.windowOnly &&
      !stage.expectedWorkTypes.some((expected) => workCovers(taskTypes, expected, hasHarvest))
    ) {
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
    const farmName = crop.farm?.name ?? '農場未設定'
    const hiddenKeys = dismissed
      .filter((row) => row.cropId === crop.id && isMilestoneTrigger(row.trigger))
      .map((row) => row.trigger.slice('milestone:'.length))
    const ask = pickMilestoneAsk({
      cropName: crop.name,
      variety: crop.variety,
      daysSincePlanting: days,
      gddRatio,
      hasHarvest,
      records: crop.milestones,
      hiddenKeys,
    })
    const hasSeenRoots = hasHarvest || crop.milestones.some((row) => row.key === 'test-dig')
    const frost: SweetPotatoFrost | null =
      climate && isSweetPotatoCrop(crop.name, crop.variety)
        ? assessSweetPotatoFrost({
            today,
            forecast: climate.forecast,
            firstFrost: climate.frost,
            currentGdd: currentGDD,
            targetGdd: targetGDD,
            hasSeenRoots,
            harvestWindow,
            harvestWindowReady,
          })
        : null
    if (frost && !isProposalDismissed(dismissed, frost.trigger, crop.id)) {
      const mentionsTarget = frost.conclusion.includes('収穫の目安') || frost.title.includes('届かない')
      const provisionalNote =
        basis.source === 'provisional' && mentionsTarget
          ? '目安が暫定のため、これより大きくずれることがあります。'
          : ''
      const frostConclusion = `${frost.conclusion}${provisionalNote}`
      frostNoteByCrop.set(crop.id, `${frost.generalLine}${provisionalNote}`)
      const withinWeek = frost.urgency === 'today'
      frostCards.push({
        id: `${frost.trigger}-${crop.id}`,
        urgency: frost.urgency,
        score: withinWeek ? 96 : frost.trigger === 'frost-forecast' ? 88 : 84,
        trigger: frost.trigger,
        title: frost.title,
        cropId: crop.id,
        cropName: crop.name,
        farmId: crop.farmId ?? undefined,
        farmName,
        daysSincePlanting: days,
        variety: crop.variety,
        currentGDD,
        targetGDD,
        targetCaption: basis.summary,
        conclusion: frostConclusion,
        action: { kind: 'work', taskType: '収穫', title: `${crop.name}を霜の前に掘り上げる` },
        layers: mergeLayers({
          personal: `${crop.name}は栽培中です（${farmName}）。`,
          regional: null,
          general: frost.sourceLine,
          conclusion: frostConclusion,
        }),
      })
    }
    if (ask && !isProposalDismissed(dismissed, ask.trigger, crop.id)) {
      milestoneCards.push({
        id: `${ask.trigger}-${crop.id}`,
        urgency: 'today',
        score: 1,
        trigger: ask.trigger,
        title: ask.question,
        cropId: crop.id,
        cropName: crop.name,
        farmId: crop.farmId ?? undefined,
        farmName,
        daysSincePlanting: days,
        variety: crop.variety,
        conclusion: ask.ifYes,
        milestone: {
          key: ask.key,
          question: ask.question,
          term: ask.term,
          ifYes: ask.ifYes,
          sourceLabel: ask.sourceLabel,
          howTo: ask.howTo,
          yesLabel: ask.yesLabel,
        },
        layers: mergeLayers({
          personal: null,
          regional: null,
          general: ask.ifYes,
          conclusion: ask.ifYes,
        }),
      })
    }
    if (!best) continue

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
          milestones: crop.milestones,
          today,
        })
      ),
    ])
    const measuredLine =
      currentGDD != null
        ? `${crop.name}の積算温度は ${currentGDD}℃日です（${basis.summary}、植付から${days}日）。`
        : `${crop.name}は植付から${days}日目です（${farmName}）。`
    const coolFinish = best.title.includes('下回る時期')
    const finishReason = coolFinish
      ? ''
      : hasHarvest
        ? `収穫を${crop.harvests.length}回記録しています。`
        : harvestDatePast && crop.harvestDate
          ? `収穫予定日 ${new Date(crop.harvestDate).toLocaleDateString('ja-JP')} を過ぎています。`
          : ''
    const personalText =
      best.trigger === 'sale-missing'
        ? personal
        : best.trigger === 'season-finish'
          ? `${personal ? `${personal} ` : ''}${measuredLine}${finishReason ? ` ${finishReason}` : ''}`
          : personal
            ? `${personal} ${measuredLine}`
            : measuredLine

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
      targetCaption: basis.summary,
      conclusion: best.conclusion,
      action: best.action,
      frostNote: frostNoteByCrop.get(crop.id),
      layers: mergeLayers({
        personal: personalText,
        regional,
        general: coolFinish ? TOMATO_NIGHT_SOURCE : general,
        conclusion: best.conclusion,
      }),
    })
  }

  const diagnoses = await prisma.soilDiagnosis.findMany({
    where: { userId },
    orderBy: { diagnosedAt: 'desc' },
    include: { farm: { select: { name: true } } },
  })
  const latestByFarm = new Map<string, (typeof diagnoses)[number]>()
  for (const row of diagnoses) {
    if (!latestByFarm.has(row.farmId)) latestByFarm.set(row.farmId, row)
  }
  const soilByFarm = new Map<
    string,
    {
      farmName: string
      ph: number
      dateLabel: string
      kind: 'correct' | 'high-caution'
      crops: { id: string; name: string; variety: string | null; rangeName: string; min: number; max: number; highCaution?: string }[]
    }
  >()
  for (const crop of crops) {
    if (!crop.farmId || !crop.farm) continue
    if (isProposalDismissed(dismissed, 'soil-ph', crop.id)) continue
    const diagnosis = latestByFarm.get(crop.farmId)
    if (!diagnosis || diagnosis.ph == null) continue
    const range = matchedSoilPh(crop.name, crop.variety)
    if (!range) continue
    const signal = soilPhSignal(diagnosis.ph, range)
    if (!signal) continue
    const diagnosed = new Date(diagnosis.diagnosedAt)
    const dateLabel = `${diagnosed.getFullYear()}/${diagnosed.getMonth() + 1}/${diagnosed.getDate()}`
    const key = `${crop.farmId}|${signal}`
    const group = soilByFarm.get(key) ?? {
      farmName: crop.farm.name,
      ph: diagnosis.ph,
      dateLabel,
      kind: signal,
      crops: [],
    }
    group.crops.push({
      id: crop.id,
      name: crop.name,
      variety: crop.variety,
      rangeName: range.name,
      min: range.min,
      max: range.max,
      highCaution: range.highCaution,
    })
    soilByFarm.set(key, group)
  }

  const soilCards: ScoredProposal[] = []
  for (const [key, group] of soilByFarm) {
    const farmId = key.split('|')[0]
    const hasSweetPotato = crops.some((crop) => {
      if (crop.farmId !== farmId) return false
      const range = matchedSoilPh(crop.name, crop.variety)
      return range != null && !range.adviseLow
    })
    const rangeNames = [...new Set(group.crops.map((crop) => crop.rangeName))]
    const subject =
      rangeNames.length === 1
        ? `${rangeNames[0]}${group.crops.length}作付け`
        : `${group.crops.length}作付け`
    const general = rangeNames
      .map((name) => {
        const sample = group.crops.find((crop) => crop.rangeName === name)!
        return `${name}の目安は ${formatSoilPhRange(sample.min, sample.max)}`
      })
      .join('。')
    const caution = group.crops.find((crop) => crop.highCaution)?.highCaution
    const conclusion =
      group.kind === 'high-caution' && caution
        ? caution
        : hasSweetPotato
          ? '次の作付け前に、対象の品目はpHの矯正を検討しましょう。さつまいもには石灰を入れないでください。'
          : '次の作付け前に、pHの矯正を検討しましょう'
    const title =
      group.kind === 'high-caution'
        ? `${group.farmName}：土壌のpHが高めです`
        : `${group.farmName}：土壌のpHが目安から外れています`
    soilCards.push({
      id: `soil-ph-${key}`,
      urgency: 'thisWeek',
      score: 48,
      trigger: 'soil-ph',
      title,
      farmId,
      farmName: group.farmName,
      conclusion,
      action: {
        kind: 'work',
        taskType: '土づくり',
        title: group.kind === 'high-caution' ? `${group.farmName}の石灰を入れない` : `${group.farmName}の土壌pHの矯正を検討`,
      },
      lines: group.crops.map((crop) => ({
        cropId: crop.id,
        cropName: crop.name,
        variety: crop.variety,
        farmId,
        farmName: group.farmName,
        currentGDD: null,
        targetGDD: 0,
      })),
      layers: mergeLayers({
        personal: `${group.farmName}の土壌 pH は ${group.ph}（${group.dateLabel} 診断）。この農場の${subject}が対象です`,
        general,
        conclusion,
      }),
    })
  }

  for (const [farmId, diagnosis] of latestByFarm) {
    const trigger = `soil-nutrient:${farmId}`
    if (isProposalDismissed(dismissed, trigger)) continue
    const hits = soilNutrientHits(diagnosis)
    if (hits.length === 0) continue
    const diagnosed = new Date(diagnosis.diagnosedAt)
    const dateLabel = `${diagnosed.getFullYear()}/${diagnosed.getMonth() + 1}/${diagnosed.getDate()}`
    const farmName = diagnosis.farm.name
    const conclusion = '次の作付けの元肥を、診断の値に合わせて見直す目安です。'
    soilCards.push({
      id: trigger,
      urgency: 'thisWeek',
      score: 46,
      trigger,
      title: `${farmName}：土の養分が、次の元肥を見直す目安を超えています`,
      farmId,
      farmName,
      conclusion,
      action: {
        kind: 'work',
        taskType: '土づくり',
        title: `${farmName}の元肥を診断に合わせて見直す`,
      },
      layers: mergeLayers({
        personal: `${farmName}の${dateLabel}の診断です。`,
        general: hits.map((hit) => hit.sentence).join(''),
        conclusion,
      }),
    })
  }

  const otherCards = cards.filter((card) => card.trigger !== 'soil-ph')
  return [...groupSameSignal(otherCards), ...groupMilestoneCards(milestoneCards), ...groupFrostCards(frostCards), ...soilCards].sort(
    (a, b) => b.score - a.score || urgencyRank(b.urgency) - urgencyRank(a.urgency)
  )
}
