import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

export const proposalCheckScenarios = ['1', '2', '3'] as const
export type ProposalCheckScenario = typeof proposalCheckScenarios[number]

const marker = 'tilltol:proposal-check:v1'
const tateyama = { latitude: 34.995, longitude: 139.877, prefectureCode: '12', municipalityCode: '122050' }
const utsunomiya = { latitude: 36.55, longitude: 139.88, prefectureCode: '09', municipalityCode: '092010' }

function daysAgo(now: Date, days: number) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
}

/** 同じ利用者・形には同じIDを使い、名前だけで削除対象を選ばない。 */
export function proposalCheckData(scenario: ProposalCheckScenario, userId: string, now: Date) {
  const owner = createHash('sha256').update(userId).digest('hex')
  const prefix = `proposal-check-${owner}-${scenario}`
  const id = (key: string) => `${prefix}-${key}`
  const name = (label: string) => `確認用 ${label}`
  const description = `${marker}:${scenario}`
  const farm = (key: string, label: string, location?: typeof tateyama): Prisma.FarmCreateManyInput =>
    ({ id: id(key), userId, name: name(label), description, ...location })
  const crop = (key: string, farmId: string, label: string, cropKind: string, age: number): Prisma.CropCreateManyInput =>
    ({
      id: id(key), farmId, name: name(label), cropKind, growingSite: 'open', covers: 'none',
      plantingMethod: 'transplant', plantCount: 10, plantingDate: daysAgo(now, age),
      variety: cropKind === 'sweet-potato' ? '紅はるか' : null,
    })
  const farms = scenario === '3' ? [farm('farm', '位置未登録の農場')] : [farm('farm', '館山農場', tateyama)]
  const crops: Prisma.CropCreateManyInput[] = []
  const harvests: Prisma.HarvestCreateManyInput[] = []
  const tasks: Prisma.TaskCreateManyInput[] = []
  const works: Prisma.WorkRecordCreateManyInput[] = []

  if (scenario === '1') {
    const prior = crop('previous', id('farm'), '前年のさつまいも', 'sweet-potato', 365 + 145)
    crops.push(crop('sweet-potato', id('farm'), 'さつまいも', 'sweet-potato', 130), { ...prior, status: 'harvested' })
    harvests.push({ id: id('harvest'), cropId: prior.id!, quantity: 12, date: daysAgo(now, 365 + 5), notes: description })
  } else if (scenario === '2') {
    farms.push(farm('inland', '宇都宮農場', utsunomiya))
    crops.push(
      crop('sweet-potato', id('farm'), 'さつまいも', 'sweet-potato', 125),
      crop('inland-sweet-potato', id('inland'), 'さつまいも 内陸', 'sweet-potato', 128),
      crop('tomato', id('inland'), 'トマト', 'tomato', 12),
      crop('tateyama-tomato', id('farm'), 'トマト 館山', 'tomato', 11),
    )
  } else {
    crops.push(crop('tomato', id('farm'), 'トマト', 'tomato', 12))
    tasks.push({ id: id('due'), farmId: id('farm'), cropId: id('tomato'), title: name('誘引の締切'),
      dueDate: daysAgo(now, 0), description })
    const previousWorkDay = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    works.push({ id: id('work'), farmId: id('farm'), date: previousWorkDay, taskType: '誘引', notes: description })
  }
  return { farms, crops, harvests, tasks, works }
}

export async function addProposalCheckData(db: Prisma.TransactionClient, data: ReturnType<typeof proposalCheckData>) {
  await db.farm.createMany({ data: data.farms })
  await db.crop.createMany({ data: data.crops })
  if (data.harvests.length) await db.harvest.createMany({ data: data.harvests })
  if (data.tasks.length) await db.task.createMany({ data: data.tasks })
  if (data.works.length) await db.workRecord.createMany({ data: data.works })
}
