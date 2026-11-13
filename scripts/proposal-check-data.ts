import { realpath, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient, type Prisma } from '@prisma/client'
import { addProposalCheckData, proposalCheckData, proposalCheckScenarios } from './proposal-check-scenarios'

const help = `今日の提案の確認用データ（メイン担当用）
npm run check-data -- add <1|2|3> <メールアドレス>
npm run check-data -- remove <メールアドレス>
1: 館山のさつまいもと前回の収穫
2: 館山・宇都宮のさつまいもとトマト
3: 位置未登録の農場と今日が期限のタスク
対象は prisma/dev.db の指定利用者。remove はこの命令で入れた3つの形を対象にします。
一時DBで試す場合は末尾に --db <一時ディレクトリ内のSQLiteファイル> を付けます。`

async function databaseUrl(temporaryFile?: string) {
  const filename = await realpath(temporaryFile ?? 'prisma/dev.db')
  const root = await realpath(temporaryFile ? tmpdir() : 'prisma')
  const relative = path.relative(root, filename)
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) ||
      (!temporaryFile && relative !== 'dev.db') || !(await stat(filename)).isFile()) {
    throw new Error('開発用DBまたは一時ディレクトリ内の既存のSQLiteファイルを指定してください。')
  }
  return `file:${filename.replace(/\\/g, '/')}`
}

async function removeCheckData(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const plans = proposalCheckScenarios.map(scenario => proposalCheckData(scenario, userId, now))
  const farms = plans.flatMap(plan => plan.farms)
  const crops = plans.flatMap(plan => plan.crops)
  const tasks = plans.flatMap(plan => plan.tasks)
  const works = plans.flatMap(plan => plan.works)
  const harvests = plans.flatMap(plan => plan.harvests)

  const farmFilter: Prisma.FarmWhereInput = {
    userId, name: { startsWith: '確認用 ' },
    OR: farms.map(({ id, description }) => ({ id, description })),
  }
  const cropFilter: Prisma.CropWhereInput = {
    farm: farmFilter, name: { startsWith: '確認用 ' },
    OR: crops.map(({ id, farmId }) => ({ id, farmId })),
  }
  const taskFilter: Prisma.TaskWhereInput = {
    farm: farmFilter, title: { startsWith: '確認用 ' },
    OR: tasks.map(({ id, description, farmId, cropId }) => ({ id, description, farmId, cropId })),
  }
  const workFilter: Prisma.WorkRecordWhereInput = {
    farm: farmFilter, cropId: null, taskId: null,
    OR: works.map(({ id, notes, farmId }) => ({ id, notes, farmId })),
  }
  const harvestFilter: Prisma.HarvestWhereInput = {
    crop: cropFilter,
    OR: harvests.map(({ id, notes, cropId }) => ({ id, notes, cropId })),
  }
  const [farmCount, cropCount, taskCount, workCount, harvestCount] = await Promise.all([
    tx.farm.count({ where: farmFilter }),
    tx.crop.count({ where: cropFilter }),
    tx.task.count({ where: taskFilter }),
    tx.workRecord.count({ where: workFilter }),
    tx.harvest.count({ where: harvestFilter }),
  ])

  // 別の記録が紐づいた場合は、連鎖削除も関連の解除も行わない。
  const [blockedFarm, blockedCrop, linkedCrops, linkedTasks, linkedWorks, linkedHarvests] = await Promise.all([
    tx.farm.findFirst({ where: { AND: [farmFilter, { OR: [
      { fields: { some: {} } }, { soil: { isNot: null } }, { soilDiagnoses: { some: {} } },
      { pesticideRecords: { some: {} } }, { fertilizerRecords: { some: {} } }, { sales: { some: {} } },
    ] }] }, select: { id: true } }),
    tx.crop.findFirst({ where: { AND: [cropFilter, { OR: [
      { pesticideRecords: { some: {} } }, { fertilizerRecords: { some: {} } }, { sales: { some: {} } },
      { proposalDismissals: { some: {} } }, { milestones: { some: {} } }, { pestChecks: { some: {} } },
      { outcome: { isNot: null } },
    ] }] }, select: { id: true } }),
    tx.crop.count({ where: { farm: farmFilter } }),
    tx.task.count({ where: { OR: [{ farm: farmFilter }, { crop: cropFilter }] } }),
    tx.workRecord.count({ where: { OR: [{ farm: farmFilter }, { crop: cropFilter }, { task: taskFilter }] } }),
    tx.harvest.count({ where: { crop: cropFilter } }),
  ])
  if (blockedFarm || blockedCrop || linkedCrops !== cropCount || linkedTasks !== taskCount ||
      linkedWorks !== workCount || linkedHarvests !== harvestCount) {
    throw new Error('確認用データにこの命令が作成していない記録が紐づいているため、削除を中止します。')
  }

  console.log(`削除予定: 農場${farmCount}件・作付け${cropCount}件・タスク${taskCount}件・作業記録${workCount}件・収穫${harvestCount}件`)
  await tx.harvest.deleteMany({ where: harvestFilter })
  await tx.workRecord.deleteMany({ where: workFilter })
  await tx.task.deleteMany({ where: taskFilter })
  await tx.crop.deleteMany({ where: cropFilter })
  await tx.farm.deleteMany({ where: farmFilter })
}

async function main(rawArgs: string[]) {
  if (rawArgs.length === 0 || (rawArgs.length === 1 && rawArgs[0] === '--help')) {
    console.log(help)
    return
  }
  const dbFlag = rawArgs.indexOf('--db')
  const temporaryFile = dbFlag === -1 ? undefined : rawArgs[dbFlag + 1]
  if (dbFlag !== -1 && (dbFlag !== rawArgs.length - 2 || !temporaryFile?.trim())) throw new Error(help)
  const args = dbFlag === -1 ? rawArgs : rawArgs.slice(0, dbFlag)
  const action = args[0]
  const scenario = proposalCheckScenarios.find(value => value === args[1])
  const email = (action === 'add' ? args[2] : args[1])?.trim()
  if (!email || (action === 'add' ? args.length !== 3 || !scenario : action !== 'remove' || args.length !== 2)) {
    throw new Error(help)
  }

  const db = new PrismaClient({ datasources: { db: { url: await databaseUrl(temporaryFile) } } })
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) throw new Error('指定のメールアドレスの利用者が見つかりません。')
    const now = new Date()
    if (action === 'add' && scenario) {
      const data = proposalCheckData(scenario, user.id, now)
      await db.$transaction(async tx => {
        const existing = await tx.farm.findFirst({ where: { id: { in: data.farms.map(row => row.id!) } }, select: { id: true } })
        if (existing) throw new Error('この形の農場はすでにあります。入れ直す場合は remove を実行してください。')
        await addProposalCheckData(tx, data)
      })
      console.log(`形 ${scenario} の確認用データを追加しました。`)
    } else {
      await db.$transaction(tx => removeCheckData(tx, user.id, now))
      console.log('削除が完了しました。')
    }
  } finally {
    await db.$disconnect()
  }
}

main(process.argv.slice(2)).catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
