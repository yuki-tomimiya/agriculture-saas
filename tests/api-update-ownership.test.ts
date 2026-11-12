import './helpers/next-runtime'
import assert from 'node:assert/strict'
import type { AsyncLocalStorage } from 'node:async_hooks'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test, type TestContext } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (file: string) => { exec(sql: string): void; close(): void }
}
const { requestAsyncStorage } = require('next/dist/client/components/request-async-storage.external') as {
  requestAsyncStorage: AsyncLocalStorage<{ cookies: NextRequest['cookies'] }>
}

async function testDatabase(t: TestContext) {
  const prefix = 'tilltol-api-ownership-'
  const directory = await mkdtemp(path.join(tmpdir(), prefix))
  const file = path.join(directory, 'test.db')
  const db = new PrismaClient({ datasources: { db: { url: `file:${file.replace(/\\/g, '/')}` } } })
  t.after(async () => {
    await db.$disconnect()
    const resolved = path.resolve(directory)
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()))
    assert.ok(path.basename(resolved).startsWith(prefix))
    await rm(resolved, { recursive: true, force: true })
  })

  const schema = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff',
    '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
  const sqlite = new DatabaseSync(file)
  try {
    sqlite.exec(schema)
  } finally {
    sqlite.close()
  }
  return db
}

type Update = (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>

function update(handler: Update, method: 'PATCH' | 'PUT', id: string, body: object) {
  const request = new NextRequest(`http://localhost/api/test/${id}`, {
    method,
    headers: { cookie: 'userId=owner', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return requestAsyncStorage.run({ cookies: request.cookies }, () => handler(request, { params: Promise.resolve({ id }) }))
}

test('更新APIは変更先の農場・作付けの持ち主を確かめる', async t => {
  const db = await testDatabase(t)
  const runtime = globalThis as typeof globalThis & { prisma?: PrismaClient }
  const original = runtime.prisma
  runtime.prisma = db
  const { PATCH: patchCrop } = await import('../app/api/crops/[id]/route')
  const { PUT: putFertilizer } = await import('../app/api/fertilizers/[id]/route')
  const { prisma } = await import('../lib/prisma')
  runtime.prisma = original
  assert.equal(prisma, db)

  await db.user.createMany({ data: [
    { id: 'owner', email: 'owner@example.invalid', password: 'unused' },
    { id: 'other', email: 'other@example.invalid', password: 'unused' },
  ] })
  await db.farm.createMany({ data: [
    { id: 'farm-a', userId: 'owner', name: '元の農場' },
    { id: 'farm-b', userId: 'owner', name: '変更先の農場' },
    { id: 'other-farm', userId: 'other', name: '別の利用者の農場' },
  ] })
  await db.field.createMany({ data: [
    { id: 'field-a', farmId: 'farm-a', name: '元の圃場' },
    { id: 'field-b', farmId: 'farm-b', name: '変更先の圃場' },
  ] })
  await db.crop.createMany({ data: [
    { id: 'crop-a', farmId: 'farm-a', fieldId: 'field-a', name: '作付けA' },
    { id: 'crop-b', farmId: 'farm-b', name: '作付けB' },
    { id: 'direct-crop', userId: 'owner', name: '農場未設定の作付け' },
    { id: 'other-crop', farmId: 'other-farm', name: '別の利用者の作付け' },
  ] })
  const fertilizer = await db.fertilizerRecord.create({ data: {
    userId: 'owner', farmId: 'farm-a', cropId: 'crop-a', productName: '肥料', amount: 1,
    appliedAt: new Date('2026-11-12T00:00:00Z'),
  } })
  const cropPatch = (body: object) => update(patchCrop, 'PATCH', 'crop-a', body)
  const fertilizerPut = (body: object) => update(putFertilizer, 'PUT', fertilizer.id, body)
  const cropLinks = () => db.crop.findUniqueOrThrow({
    where: { id: 'crop-a' }, select: { farmId: true, fieldId: true, userId: true, fieldUndivided: true },
  })
  const fertilizerLinks = () => db.fertilizerRecord.findUniqueOrThrow({
    where: { id: fertilizer.id }, select: { cropId: true, farmId: true },
  })

  await t.test('品目を送らなくても別の利用者の農場に移せない', async () => {
    const originalLinks = await cropLinks()
    const response = await cropPatch({ farmId: 'other-farm' })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: '指定した農場が見つかりません' })
    assert.deepEqual(await cropLinks(), originalLinks)
  })

  await t.test('同じ農場の圃場は残し、本人の別の農場に移すと旧圃場を外す', async () => {
    assert.equal((await cropPatch({ farmId: 'farm-a' })).status, 200)
    assert.equal((await cropLinks()).fieldId, 'field-a')
    assert.equal((await cropPatch({ farmId: 'farm-b' })).status, 200)
    assert.deepEqual(await cropLinks(), { farmId: 'farm-b', fieldId: null, userId: null, fieldUndivided: false })
  })

  await t.test('育て方も編集するときは選んだ新しい農場の圃場を保存できる', async () => {
    const body = { farmId: 'farm-a', cropKind: 'tomato', growingSite: 'open',
      coverNone: true, plantingMethod: 'transplant', plantCount: 1 }
    const originalLinks = await cropLinks()
    assert.equal((await cropPatch({ ...body, fieldId: 'field-b' })).status, 400)
    assert.deepEqual(await cropLinks(), originalLinks)
    assert.equal((await cropPatch({ ...body, fieldId: 'field-a' })).status, 200)
    assert.deepEqual(await cropLinks(), { farmId: 'farm-a', fieldId: 'field-a', userId: null, fieldUndivided: false })
  })

  await t.test('農場を外す部分更新では旧圃場も外れ、本人の作付けのままになる', async () => {
    assert.equal((await cropPatch({ farmId: null })).status, 200)
    assert.deepEqual(await cropLinks(), { farmId: null, fieldId: null, userId: 'owner', fieldUndivided: false })
  })

  await t.test('別の利用者の作付けや農場を肥料記録に設定できない', async () => {
    const originalLinks = await fertilizerLinks()
    for (const [body, error] of [
      [{ cropId: 'other-crop' }, '指定した作物が見つかりません'],
      [{ farmId: 'other-farm' }, '指定した農場が見つかりません'],
    ] as const) {
      const response = await fertilizerPut(body)
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error })
      assert.deepEqual(await fertilizerLinks(), originalLinks)
    }
  })

  await t.test('本人の農場・作付けへの付け替えと紐づけ解除は今までどおり通る', async () => {
    assert.equal((await fertilizerPut({ cropId: 'crop-b', farmId: 'farm-b' })).status, 200)
    assert.deepEqual(await fertilizerLinks(), { cropId: 'crop-b', farmId: 'farm-b' })
    assert.equal((await fertilizerPut({ cropId: 'direct-crop', farmId: '' })).status, 200)
    assert.deepEqual(await fertilizerLinks(), { cropId: 'direct-crop', farmId: null })
    assert.equal((await fertilizerPut({ cropId: '' })).status, 200)
    assert.deepEqual(await fertilizerLinks(), { cropId: null, farmId: null })
  })
})
