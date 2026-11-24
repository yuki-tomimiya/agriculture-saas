import { createCookieJar, renderWithRouter, withMutableRequestCookies, withRequestCookies } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import React from 'react'
import { NextRequest } from 'next/server'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { proxy } from '../proxy'

Object.assign(globalThis, { React })
const origin = 'http://127.0.0.1:3000'
type Jar = ReturnType<typeof createCookieJar>

function request(url: string, method = 'POST', body: unknown = {}, jar = createCookieJar(), from: string | null = origin) {
  const headers = new Headers({ 'content-type': 'application/json', cookie: jar.cookies.toString() })
  if (from !== null) headers.set('origin', from)
  return new NextRequest(origin + url, { method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) })
}

function dispatch(req: NextRequest, jar: Jar, handler: () => Promise<Response>) {
  const result = proxy(req)
  return result.status === 403 ? Promise.resolve(result) : withMutableRequestCookies(jar, handler)
}

test('セッションで本人を確かめ、期限・他人の記録・入力・ログアウトを一時DBで検証する', async t => {
  const { db } = await temporarySqlite(t)
  const runtime = globalThis as typeof globalThis & { prisma?: typeof db }
  const previous = runtime.prisma
  runtime.prisma = db
  t.after(() => { runtime.prisma = previous })
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T00:00:00Z') })
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('外部へ接続しない') })
  const { hashPassword, getCurrentUser } = await import('../lib/auth')
  const { SESSION_COOKIE, SESSION_DURATION_MS, findSessionUser, sessionTokenHash } = await import('../lib/auth-session')
  const { readUserIdCookie } = await import('../lib/user-id-cookie')
  const { POST: signin } = await import('../app/api/auth/signin/route')
  const { POST: signup } = await import('../app/api/auth/signup/route')
  const { POST: logout } = await import('../app/api/auth/logout/route')
  const { PATCH: patchFarm, DELETE: deleteFarm } = await import('../app/api/farms/[id]/route')
  const { PATCH: patchCrop, DELETE: deleteCrop } = await import('../app/api/crops/[id]/route')
  const { PUT: updateRecord } = await import('../app/api/fertilizers/[id]/route')
  const { POST: dismiss } = await import('../app/api/proposals/dismiss/route')
  const { GET: csv } = await import('../app/api/export/sales/route')
  const { default: FarmDetail } = await import('../app/farms/[id]/page')
  const { default: CropDetail } = await import('../app/crops/[id]/page')
  const { default: ProposalsPage } = await import('../app/dashboard/ai-proposal/page')
  const a = await db.user.create({ data: { id: 'A', email: 'a@example.invalid', password: await hashPassword('old') } })
  await db.user.create({ data: { id: 'B', email: 'b@example.invalid', password: await hashPassword('other') } })
  for (const id of ['A', 'B']) {
    await db.farm.create({ data: { id: `farm-${id}`, userId: id, name: `${id}の農場` } })
    await db.field.create({ data: { id: `field-${id}`, farmId: `farm-${id}`, name: `${id}の圃場` } })
    await db.crop.create({ data: { id: `crop-${id}`, farmId: `farm-${id}`, name: `${id}の作付け` } })
    await db.crop.create({ data: { id: `direct-${id}`, userId: id, name: `${id}の直接の作付け` } })
    await db.sale.create({ data: { userId: id, farmId: `farm-${id}`, cropId: `crop-${id}`,
      date: new Date(), quantity: 1, unitPrice: 100, amount: 100, customerName: `${id}だけの販売先` } })
  }
  const fertilizer = await db.fertilizerRecord.create({ data: { userId: 'A', farmId: 'farm-A', cropId: 'crop-A',
    productName: '肥料', amount: 1, appliedAt: new Date() } })
  const jar = createCookieJar('userId=B')
  const authPost = async (handler: (req: NextRequest) => Promise<Response>, url: string, body: unknown, cookieJar = jar, from: string | null = origin) => {
    const req = request(url, 'POST', body, cookieJar, from)
    return dispatch(req, cookieJar, () => handler(req))
  }
  const context = (id: string) => ({ params: Promise.resolve({ id }) })
  const render = (page: (args: { params: Promise<{ id: string }> }) => Promise<React.ReactElement>, id: string) =>
    withRequestCookies(jar.cookies, async () => renderWithRouter(await page(context(id))))

  await t.test('短い既存のパスワードで入り、32バイトの印とSHA-256だけを保存する', async () => {
    const response = await authPost(signin, '/api/auth/signin', { email: a.email, password: 'old' })
    assert.equal(response.status, 200)
    const token = jar.cookies.get(SESSION_COOKIE)?.value
    assert.match(token ?? '', /^[0-9a-f]{64}$/)
    const saved = await db.session.findFirstOrThrow({ where: { userId: a.id } })
    assert.equal(saved.tokenHash, createHash('sha256').update(token!).digest('hex'))
    assert.notEqual(saved.tokenHash, token)
    assert.equal(saved.expiresAt.getTime(), Date.now() + SESSION_DURATION_MS)
    const cookie = jar.cookies.get(SESSION_COOKIE)!
    assert.equal(cookie.httpOnly, true)
    assert.equal(cookie.sameSite, 'lax')
    assert.equal(cookie.path, '/')
    assert.equal(cookie.expires ? new Date(cookie.expires).getTime() : undefined, saved.expiresAt.getTime())
    assert.match(jar.headers.get('set-cookie') ?? '', /userId=;.*Expires=Thu, 01 Jan 1970/)
    assert.equal((await withRequestCookies(jar.cookies, getCurrentUser))?.id, 'A')
    assert.equal(await withRequestCookies(jar.cookies, readUserIdCookie), 'A')
  })

  await t.test('本人のGETは読め、他人のGET・PATCH・DELETEと変更先の差し替えを拒否する', async () => {
    assert.match(await render(FarmDetail, 'farm-A'), /Aの農場/)
    assert.match(await render(CropDetail, 'crop-A'), /Aの作付け/)
    assert.match(await render(CropDetail, 'direct-A'), /Aの直接の作付け/)
    for (const [page, id] of [[FarmDetail, 'farm-B'], [CropDetail, 'crop-B'], [CropDetail, 'direct-B']] as const) {
      await assert.rejects(() => render(page, id), /NEXT_HTTP_ERROR_FALLBACK;404/)
    }
    const before = { farms: await db.farm.findMany(), crops: await db.crop.findMany(), records: await db.fertilizerRecord.findMany() }
    for (const [handler, method, id, body] of [
      [patchFarm, 'PATCH', 'farm-B', { name: '書き換え' }],
      [deleteFarm, 'DELETE', 'farm-B', {}],
      [patchCrop, 'PATCH', 'crop-B', { name: '書き換え' }],
      [deleteCrop, 'DELETE', 'crop-B', {}],
      [patchCrop, 'PATCH', 'direct-B', { name: '書き換え' }],
      [deleteCrop, 'DELETE', 'direct-B', {}],
      [patchCrop, 'PATCH', 'crop-A', { farmId: 'farm-B' }],
      [patchCrop, 'PATCH', 'crop-A', { farmId: 'farm-A', fieldId: 'field-B', cropKind: 'tomato',
        growingSite: 'open', coverNone: true, plantingMethod: 'transplant', plantCount: 1 }],
      [updateRecord, 'PUT', fertilizer.id, { cropId: 'crop-B' }],
      [updateRecord, 'PUT', fertilizer.id, { cropId: 'direct-B' }],
    ] as const) {
      const req = request(`/api/test/${id}`, method, body, jar)
      const response = await dispatch(req, jar, () => handler(req, context(id)))
      assert.ok([400, 404].includes(response.status), `${method} ${id}: ${response.status}`)
    }
    assert.deepEqual({ farms: await db.farm.findMany(), crops: await db.crop.findMany(), records: await db.fertilizerRecord.findMany() }, before)
  })

  await t.test('CSV・今日の提案にも他人の記録が混じらず、他人の提案を閉じられない', async () => {
    for (const query of ['', '?cropId=crop-B']) {
      const req = request('/api/export/sales' + query, 'GET', {}, jar)
      const response = await dispatch(req, jar, () => csv(req))
      assert.equal(response.status, 200)
      const text = await response.text()
      assert.doesNotMatch(text, /Bだけの販売先|Bの農場/)
      if (!query) assert.match(text, /Aだけの販売先/)
    }
    const html = await withRequestCookies(jar.cookies, async () => renderWithRouter(await ProposalsPage()))
    assert.doesNotMatch(html, /Bの農場|Bの作付け|Bの直接の作付け/)
    assert.equal((await authPost(dismiss, '/api/proposals/dismiss', { trigger: 'neglected-crop', cropId: 'crop-B' })).status, 400)
    assert.equal(await db.proposalDismissal.count(), 0)
    assert.equal((await authPost(dismiss, '/api/proposals/dismiss', { trigger: 'neglected-crop', cropId: 'crop-A' })).status, 200)
    assert.equal(await db.proposalDismissal.count({ where: { userId: 'A', cropId: 'crop-A' } }), 1)
  })

  await t.test('Cookieの欠落・旧ID・改ざん・期限ちょうど・削除済みの印は未ログイン', async () => {
    const token = jar.cookies.get(SESSION_COOKIE)!.value
    const forged = (token[0] === 'a' ? 'b' : 'a') + token.slice(1)
    for (const header of ['', 'userId=A', `userId=B; ${SESSION_COOKIE}=${forged}`]) {
      const invalid = createCookieJar(header)
      assert.equal(await withRequestCookies(invalid.cookies, readUserIdCookie), undefined)
      assert.equal(await withRequestCookies(invalid.cookies, getCurrentUser), null)
    }
    const hash = sessionTokenHash(token)
    const saved = await db.session.findUniqueOrThrow({ where: { tokenHash: hash } })
    assert.equal((await findSessionUser(token, new Date(saved.expiresAt.getTime() - 1)))?.id, 'A')
    assert.equal(await findSessionUser(token, saved.expiresAt), null)
    await db.session.update({ where: { tokenHash: hash }, data: { expiresAt: new Date(Date.now() - 1) } })
    assert.equal(await withRequestCookies(jar.cookies, getCurrentUser), null)
    await db.session.delete({ where: { tokenHash: hash } })
    assert.equal(await withRequestCookies(jar.cookies, getCurrentUser), null)
    const deleted = await db.user.create({ data: { email: 'deleted@example.invalid', password: 'unused' } })
    const deletedToken = 'f'.repeat(64)
    await db.session.create({ data: { userId: deleted.id, tokenHash: sessionTokenHash(deletedToken), expiresAt: new Date(Date.now() + 1000) } })
    await db.user.delete({ where: { id: deleted.id } })
    assert.equal(await findSessionUser(deletedToken), null)
    assert.equal(await db.session.count({ where: { userId: deleted.id } }), 0)
    assert.equal((await authPost(signin, '/api/auth/signin', { email: a.email, password: 'old' })).status, 200)
  })

  await t.test('14文字・73バイト・日本語25文字・文字列以外を拒否し、境界の値を受け付ける', async () => {
    const cases: [unknown, number][] = [['a'.repeat(14), 400], ['a'.repeat(15), 200], ['a'.repeat(72), 200],
      ['a'.repeat(73), 400], ['あ'.repeat(24), 200], ['あ'.repeat(25), 400], [123456789012345, 400], [null, 400], [['long-password-here'], 400]]
    for (const [index, [password, status]] of cases.entries()) {
      const signupJar = createCookieJar()
      const email = `new-${index}@example.invalid`
      assert.equal((await authPost(signup, '/api/auth/signup', { email, password }, signupJar)).status, status)
      const user = await db.user.findUnique({ where: { email } })
      assert.equal(!!user, status === 200)
      if (status === 200) assert.equal((await withRequestCookies(signupJar.cookies, getCurrentUser))?.id, user!.id)
    }
    for (const email of [null, 42, [], 'x'.repeat(255), 'bad-email']) {
      assert.equal((await authPost(signup, '/api/auth/signup', { email, password: 'a'.repeat(15) }, createCookieJar())).status, 400)
    }
  })

  await t.test('メールが無いときとパスワードが違うときの応答をそろえる', async () => {
    const missing = await authPost(signin, '/api/auth/signin', { email: 'missing@example.invalid', password: 'wrong' })
    const wrong = await authPost(signin, '/api/auth/signin', { email: a.email, password: 'wrong' })
    assert.equal(missing.status, 401)
    assert.equal(wrong.status, 401)
    assert.deepEqual(await missing.json(), await wrong.json())
  })

  await t.test('認証APIと更新APIもOriginを拒否し、DBとCookieを変えない', async () => {
    const before = { sessions: await db.session.count(), users: await db.user.count(), name: (await db.farm.findUniqueOrThrow({ where: { id: 'farm-A' } })).name }
    for (const from of [null, 'null', 'https://evil.example.invalid']) {
      assert.equal((await authPost(signin, '/api/auth/signin', { email: a.email, password: 'old' }, jar, from)).status, 403)
      assert.equal((await authPost(signup, '/api/auth/signup', { email: 'denied@example.invalid', password: 'long-password-here' }, jar, from)).status, 403)
      const req = request('/api/auth/logout', 'POST', {}, jar, from)
      assert.equal((await dispatch(req, jar, logout)).status, 403)
      const patch = request('/api/farms/farm-A', 'PATCH', { name: '拒否' }, jar, from)
      assert.equal((await dispatch(patch, jar, () => patchFarm(patch, context('farm-A')))).status, 403)
    }
    assert.deepEqual({ sessions: await db.session.count(), users: await db.user.count(), name: (await db.farm.findUniqueOrThrow({ where: { id: 'farm-A' } })).name }, before)
    const req = request('/api/farms/farm-A', 'PATCH', { name: '本人の更新' }, jar)
    assert.equal((await dispatch(req, jar, () => patchFarm(req, context('farm-A')))).status, 200)
  })

  await t.test('ログアウトは写したCookieも失効し、二重送信も安全に終わる', async () => {
    const copied = createCookieJar(`${SESSION_COOKIE}=${jar.cookies.get(SESSION_COOKIE)!.value}`)
    assert.equal((await withRequestCookies(copied.cookies, getCurrentUser))?.id, 'A')
    assert.equal((await dispatch(request('/api/auth/logout', 'POST', {}, jar), jar, logout)).status, 200)
    assert.equal(await withRequestCookies(copied.cookies, getCurrentUser), null)
    assert.equal(await withRequestCookies(jar.cookies, readUserIdCookie), undefined)
    const req = request('/api/export/sales', 'GET', {}, copied)
    assert.equal((await dispatch(req, copied, () => csv(req))).status, 401)
    await assert.rejects(() => render(FarmDetail, 'farm-A'), /NEXT_REDIRECT/)
    assert.equal((await dispatch(request('/api/auth/logout', 'POST', {}, jar), jar, logout)).status, 200)
  })
})
