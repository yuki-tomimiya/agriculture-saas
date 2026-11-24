import { renderWithRouter, withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { testSession } from './helpers/session'

Object.assign(globalThis, { React })

test('画面がURLの条件を受け取る', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const savedPrisma = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = savedPrisma })

  const { default: CalendarHistoryPage } = await import('../app/calendar/history/page')
  const { default: FertilizersPage } = await import('../app/fertilizers/page')
  const { default: HarvestsPage } = await import('../app/harvests/page')
  const { default: PesticidesPage } = await import('../app/pesticides/page')
  const { default: SalesPage } = await import('../app/sales/page')
  const { default: WorkRecordsPage } = await import('../app/work-records/page')
  const { default: NewPesticidePage } = await import('../app/pesticides/new/page')
  const { default: NewSalesPage } = await import('../app/sales/new/page')
  const { default: NewTaskPage } = await import('../app/tasks/new/page')
  const { default: NewWorkRecordPage } = await import('../app/work-records/new/page')

  const userId = 'user'
  await db.user.create({ data: { id: userId, email: 'user@example.invalid', password: 'unused' } })
  const date = new Date('2026-09-01T12:00:00Z')
  for (const key of ['a', 'b']) {
    const farmId = `farm-${key}`
    const cropId = `crop-${key}`
    await db.farm.create({ data: { id: farmId, userId, name: farmId } })
    await db.crop.create({ data: { id: cropId, farmId, name: cropId } })
    await db.fertilizerRecord.create({ data: {
      id: key, userId, farmId, cropId, appliedAt: date, productName: '肥料', amount: 1,
    } })
    await db.harvest.create({ data: { id: key, cropId, date, quantity: 1 } })
    await db.pesticideRecord.create({ data: {
      id: key, userId, farmId, cropId, appliedAt: date, productName: '農薬',
    } })
    await db.sale.create({ data: {
      userId, farmId, cropId, date, quantity: 1, unitPrice: 100, amount: 100, customerName: `売上-${key}`,
    } })
    await db.workRecord.create({ data: { id: key, farmId, cropId, date, taskType: '除草' } })
  }

  const cookies = await testSession(db, userId)
  const render = (page: () => Promise<React.ReactElement>) =>
    withRequestCookies(cookies, async () => renderWithRouter(await page()))

  for (const { route, page, byFarm, record } of [
    { route: 'fertilizers', page: FertilizersPage, byFarm: true, record: 'href="/fertilizers/' },
    { route: 'harvests', page: HarvestsPage, byFarm: false, record: 'href="/harvests/' },
    { route: 'pesticides', page: PesticidesPage, byFarm: true, record: 'href="/pesticides/' },
    { route: 'sales', page: SalesPage, byFarm: false, record: '売上-' },
    { route: 'work-records', page: WorkRecordsPage, byFarm: true, record: 'href="/work-records/' },
  ]) {
    await t.test(`/${route} の絞り込み`, async () => {
      const recordA = new RegExp(`${record}a`)
      const recordB = new RegExp(`${record}b`)
      const all = await render(() => page({}))
      assert.match(all, recordA)
      assert.match(all, recordB)
      const byCrop = await render(() => page({ searchParams: Promise.resolve({ cropId: 'crop-a' }) }))
      assert.match(byCrop, recordA)
      assert.doesNotMatch(byCrop, recordB)
      if (byFarm) {
        const byFarmB = await render(() => page({ searchParams: Promise.resolve({ farmId: 'farm-b' }) }))
        assert.doesNotMatch(byFarmB, recordA)
        assert.match(byFarmB, recordB)
      }
    })
  }

  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 16, 12) })
  await t.test('/calendar/history がカレンダーへ渡す開始月', async () => {
    type CalendarContainer = React.ReactElement<{ children: React.ReactElement }>
    type Main = React.ReactElement<{ children: [React.ReactNode, React.ReactNode, CalendarContainer] }>
    const calendarProps = (element: React.ReactElement) => {
      const [, main] = (element.props as { children: [React.ReactNode, Main] }).children
      const [, , calendarContainer] = main.props.children
      return calendarContainer.props.children.props
    }
    const defaults = await withRequestCookies(cookies, () => CalendarHistoryPage({}))
    assert.deepEqual(calendarProps(defaults), {
      months: 3, userId, variant: 'history', startYear: 2026, startMonth: 8,
    })
    const december = await withRequestCookies(cookies, () => CalendarHistoryPage({
      searchParams: Promise.resolve({ year: '2025', month: '12' }),
    }))
    assert.deepEqual(calendarProps(december), {
      months: 3, userId, variant: 'history', startYear: 2025, startMonth: 12,
    })
  })

  const formQuery = { cropId: 'crop-b', farmId: 'farm-b', date: '2026-09-01' }
  for (const [route, page] of [
    ['pesticides/new', NewPesticidePage],
    ['sales/new', NewSalesPage],
    ['tasks/new', NewTaskPage],
    ['work-records/new', NewWorkRecordPage],
  ] as const) {
    await t.test(`/${route} の初期値`, async () => {
      const searchParams = Promise.resolve({
        ...formQuery, dueDate: formQuery.date, title: '作業の予定', taskType: '除草', description: '作業の記録',
      })
      const defaults = await render(() => page({}))
      const filled = await render(() => page({ searchParams }))
      for (const field of ['crop-b', 'farm-b']) {
        const selected = new RegExp(`value="${field}" selected`)
        assert.doesNotMatch(defaults, selected)
        assert.match(filled, selected)
      }
      assert.doesNotMatch(defaults, /value="2026-09-01"/)
      assert.match(filled, /value="2026-09-01"/)
      if (route === 'tasks/new') assert.match(filled, /value="作業の予定"/)
      if (route === 'work-records/new') {
        assert.match(filled, /value="作業の記録"/)
        assert.match(filled, /value="除草" selected/)
      }
    })
  }
})
