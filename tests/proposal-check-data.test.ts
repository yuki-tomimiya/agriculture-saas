import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { temporarySqlite } from './helpers/temporary-sqlite'

const run = promisify(execFile)

test('確認用データの命令は指定利用者に追加し、この命令で入れた記録だけを削除する', async t => {
  const { db, file } = await temporarySqlite(t)
  const email = 'owner@example.test'
  const otherEmail = 'other@example.test'
  await db.user.createMany({ data: [
    { id: 'owner', email, password: 'unused' },
    { id: 'other', email: otherEmail, password: 'unused' },
  ] })
  await db.farm.createMany({ data: [
    { id: 'ordinary', name: '普段使いの農場', userId: 'owner' },
    { id: 'manual-check', name: '確認用 手入力の農場', userId: 'owner' },
  ] })
  const command = (...args: string[]) => run(process.execPath, [
    '--import', 'tsx', 'scripts/proposal-check-data.ts', ...args, '--db', file,
  ], { encoding: 'utf8' })

  await assert.rejects(command('add', '1', 'missing@example.test'), /利用者が見つかりません/)
  await command('add', '1', otherEmail)
  const firstDay = new Date().toDateString()
  for (const scenario of ['1', '2', '3']) {
    const { stdout } = await command('add', scenario, email)
    assert.match(stdout, new RegExp(`形 ${scenario} の確認用データを追加しました`))
  }
  const lastDay = new Date().toDateString()
  await assert.rejects(command('add', '1', email), /すでにあります/)

  const ownerCheckFarms = await db.farm.findMany({ where: { userId: 'owner', description: { not: null } } })
  assert.equal(ownerCheckFarms.length, 4)
  assert.equal(await db.crop.count({ where: { farm: { userId: 'owner' } } }), 7)
  const locationless = ownerCheckFarms.find(farm => farm.latitude === null)
  assert.ok(locationless)
  const task = await db.task.findFirstOrThrow({ where: { farmId: locationless.id } })
  assert.ok(task.dueDate && [firstDay, lastDay].includes(task.dueDate.toDateString()))
  assert.equal(await db.workRecord.count({ where: { farmId: locationless.id } }), 1)
  const prior = await db.harvest.findFirstOrThrow({ where: { crop: { farm: { userId: 'owner' } } } })
  const addedHarvest = await db.harvest.create({ data: { cropId: prior.cropId, quantity: 1, date: new Date() } })

  await assert.rejects(command('remove', email), /削除を中止します/)
  assert.equal(await db.farm.count({ where: { userId: 'owner' } }), 6)
  assert.ok(await db.harvest.findUnique({ where: { id: addedHarvest.id } }))
  await db.harvest.delete({ where: { id: addedHarvest.id } })

  const { stdout } = await command('remove', email)
  assert.match(stdout, /削除予定: 農場4件・作付け7件・タスク1件・作業記録1件・収穫1件/)
  assert.match(stdout, /削除が完了しました/)
  const remainingFarms = await db.farm.findMany({ where: { userId: 'owner' }, orderBy: { id: 'asc' } })
  assert.deepEqual(remainingFarms.map(farm => farm.id), ['manual-check', 'ordinary'])
  assert.equal(await db.crop.count({ where: { farm: { userId: 'other' } } }), 2)
  assert.equal(await db.harvest.count(), 1)
  assert.equal(await db.task.count(), 0)
  assert.equal(await db.workRecord.count(), 0)
  assert.match((await command('remove', email)).stdout, /農場0件・作付け0件・タスク0件・作業記録0件・収穫0件/)
})
