import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import type { ComponentProps } from 'react'
import { withRequestCookies, renderWithRouter } from './helpers/next-runtime'
import { NextRequest } from 'next/server'
import { testSession } from './helpers/session'
import { temporarySqlite } from './helpers/temporary-sqlite'
import { japanDateKey } from '@/lib/pesticide-safety'
import { forecastOffice } from '@/lib/pest-forecast'

test('異変を本人だけが記録し、病害虫の候補・相談先と写真を扱える', async t => {
  const { db, file } = await temporarySqlite(t)
  const photoDirectory = path.join(path.dirname(file), 'photos')
  const previousPhotoDirectory = process.env.FIELD_CONCERN_PHOTO_DIR
  process.env.FIELD_CONCERN_PHOTO_DIR = photoDirectory
  t.after(() => {
    if (previousPhotoDirectory === undefined) delete process.env.FIELD_CONCERN_PHOTO_DIR
    else process.env.FIELD_CONCERN_PHOTO_DIR = previousPhotoDirectory
  })
  ;(globalThis as unknown as { prisma: PrismaClient }).prisma = db

  const { POST } = await import('@/app/api/crops/[id]/field-concerns/route')
  const { PATCH, DELETE } = await import('@/app/api/crops/[id]/field-concerns/[concernId]/route')
  const { GET } = await import('@/app/api/crops/[id]/field-concerns/[concernId]/photo/route')
  const { DELETE: deleteCrop } = await import('@/app/api/crops/[id]/route')
  const { FieldConcernResult } = await import('@/app/records/field/FieldConcernForm')
  const { default: FieldObservationPage } = await import('@/app/records/field/page')
  const { default: CropDetailPage } = await import('@/app/crops/[id]/page')

  await db.user.createMany({ data: ['owner', 'other-user'].map(id => ({ id, email: id + '@example.test', password: 'unused' })) })
  const owner = await testSession(db, 'owner')
  const stranger = await testSession(db, 'other-user')
  const farms = [
    { id: 'chiba', name: '館山', prefectureCode: '12' },
    { id: 'tochigi', name: '宇都宮', prefectureCode: '09' },
    { id: 'tokyo', name: '東京', prefectureCode: '13' },
  ]
  await db.farm.createMany({ data: farms.map(farm => ({ ...farm, userId: 'owner' })) })
  await db.crop.createMany({ data: [
    ...farms.map(farm => ({ id: farm.id + '-crop', name: 'キャベツ', cropKind: 'cabbage', farmId: farm.id })),
    { id: 'record-only', name: 'その他', cropKind: 'other', userId: 'owner' },
  ] })

  const now = new Date()
  const today = japanDateKey(now)
  const yesterday = japanDateKey(new Date(+now - 86_400_000))
  const tomorrow = japanDateKey(new Date(+now + 86_400_000))
  const cropId = 'chiba-crop'
  const context = { params: Promise.resolve({ id: cropId }) }
  const cropPath = 'http://localhost/api/crops/'
  const simpleForm = (day = today, location = 'leaf') => {
    const form = new FormData()
    form.set('observedDay', day)
    if (location) form.set('locations', location)
    return form
  }
  const post = (form: FormData, id = cropId, session = owner) => withRequestCookies(session, () =>
    POST(new NextRequest(cropPath + id + '/field-concerns', { method: 'POST', body: form }),
      { params: Promise.resolve({ id }) }))
  const jpeg = new Uint8Array(1024 * 1024)
  jpeg.set([0xff, 0xd8, 0xff])
  const photoForm = (data: Uint8Array<ArrayBuffer>, type: string) => {
    const form = simpleForm()
    form.set('photo', new File([data], 'photo', { type }))
    return form
  }

  assert.equal((await post(simpleForm(today, ''))).status, 400)
  assert.equal((await post(simpleForm(tomorrow))).status, 400)
  assert.equal((await post(simpleForm(today, 'constructor'))).status, 400)
  assert.equal((await post(photoForm(new Uint8Array(5 * 1024 * 1024), 'image/jpeg'))).status, 400)
  assert.equal((await post(photoForm(new Uint8Array([0x47, 0x49, 0x46]), 'image/gif'))).status, 400)
  assert.equal((await post(photoForm(jpeg, 'image/jpeg'), cropId, stranger)).status, 404)
  assert.equal(await db.fieldConcern.count(), 0)
  await assert.rejects(readdir(photoDirectory), { code: 'ENOENT' })

  const plainResponse = await post(simpleForm())
  assert.equal(plainResponse.status, 201)
  const plain = await plainResponse.json()
  assert.equal((await db.fieldConcern.findUniqueOrThrow({ where: { id: plain.id } })).locations, 'leaf')
  const form = photoForm(jpeg, 'image/jpeg')
  form.set('observedDay', yesterday)
  form.append('locations', 'stem')
  form.set('symptoms', 'spots')
  form.set('extent', 'several')
  form.set('notes', '雨のあとに確認')
  const created = await post(form)
  assert.equal(created.status, 201)
  const result = await created.json()
  const concern = await db.fieldConcern.findUniqueOrThrow({ where: { id: result.id } })
  assert.equal(concern.locations, 'leaf,stem')
  assert.equal(concern.symptoms, 'spots')
  assert.equal(concern.extent, 'several')
  assert.equal(concern.notes, '雨のあとに確認')
  assert.equal(japanDateKey(concern.observedAt), yesterday)
  assert.equal(concern.followUpResult, null)
  assert.equal(concern.followedUpAt, null)
  assert.ok(concern.photoName)

  const itemContext = { params: Promise.resolve({ id: cropId, concernId: concern.id }) }
  const itemUrl = cropPath + cropId + '/field-concerns/' + concern.id
  const photo = (session: typeof owner) => withRequestCookies(session, () =>
    GET(new NextRequest(itemUrl + '/photo'), itemContext))
  assert.equal((await photo(stranger)).status, 404)
  const ownerPhoto = await photo(owner)
  assert.equal(ownerPhoto.headers.get('Content-Type'), 'image/jpeg')
  assert.equal(ownerPhoto.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(new Uint8Array(await ownerPhoto.arrayBuffer()), jpeg)

  type ResultProps = ComponentProps<typeof FieldConcernResult>
  function renderResult(data: ResultProps['result'], chosenKey: string | null = null, advice: ResultProps['advice'] = null) {
    return renderWithRouter(<FieldConcernResult result={data} chosenKey={chosenKey} advice={advice}
      pending={false} error="" choose={() => {}} />)
  }
  assert.deepEqual(result.candidates.map((item: { name: string }) => item.name), ['アオムシ', 'コナガ'])
  const initialResult = renderResult(result)
  assert.match(initialResult, /この中に近いものがあれば選んでください/)
  for (const candidate of result.candidates) {
    assert.ok(candidate.marker)
    assert.ok(initialResult.includes(candidate.marker))
  }
  assert.doesNotMatch(initialResult, /と診断|が原因|病気です|農薬を使わない対策/)
  assert.match(initialResult, /近くの普及指導センターや JA の営農指導員/)
  assert.match(initialResult, /数日あとにもう一度見て/)
  const chiba = forecastOffice('12')
  assert.ok(chiba && result.forecast.url === chiba.url && initialResult.includes(chiba.officeName))

  for (const farm of farms.slice(1)) {
    const local = await (await post(simpleForm(), farm.id + '-crop')).json()
    const expected = forecastOffice(farm.prefectureCode)
    assert.ok(expected && local.forecast.url === expected.url && renderResult(local).includes(expected.officeName))
  }
  const recordOnly = await (await post(simpleForm(), 'record-only')).json()
  assert.deepEqual(recordOnly.candidates, [])
  assert.equal(recordOnly.forecast, null)
  const onlyResult = renderResult(recordOnly)
  assert.match(onlyResult, /相談先/)
  assert.match(onlyResult, /普及指導センターや JA/)
  assert.doesNotMatch(onlyResult, /https?:|この中に近いものがあれば/)
  const formMarkup = renderWithRouter(await withRequestCookies(owner, () => FieldObservationPage({
    searchParams: Promise.resolve({ cropId: 'record-only', observation: 'concern' }),
  })))
  assert.match(formMarkup, /名前が分からない・気になること/)
  assert.match(formMarkup, /場所（複数可）/)
  assert.match(formMarkup, /様子（複数可）/)

  const diamondback = 'cabbage:diamondback'
  const choose = (key: string, session = owner) => withRequestCookies(session, () =>
    PATCH(new NextRequest(itemUrl, { method: 'PATCH', body: JSON.stringify({ key }) }), itemContext))
  assert.equal((await choose(diamondback, stranger)).status, 404)
  assert.equal((await choose('invalid')).status, 400)
  assert.equal(await db.pestCheck.count(), 0)
  const chosen = await choose(diamondback)
  assert.equal(chosen.status, 200)
  assert.equal((await choose(diamondback)).status, 200)
  assert.equal((await choose('cabbage:cabbageworm')).status, 409)
  assert.equal(await db.pestCheck.count(), 1)
  const check = await db.pestCheck.findFirstOrThrow()
  assert.equal(check.cropId, cropId)
  assert.equal(check.pestKey, diamondback)
  assert.equal(check.present, true)
  assert.equal(+check.observedAt, +concern.observedAt)
  assert.equal((await db.fieldConcern.findUniqueOrThrow({ where: { id: concern.id } })).selectedPestKey, diamondback)
  const advice = renderResult(result, diamondback, (await chosen.json()).advice)
  assert.match(advice, /農薬を使わない対策/)
  assert.match(advice, /農林水産省の農薬登録情報を検索/)
  assert.match(advice, /千葉県の病害虫発生予察/)

  const details = renderWithRouter(await withRequestCookies(owner, () => CropDetailPage(context)))
  assert.match(details, /畑で見たこと/)
  assert.match(details, /近いものとして選んだ病害虫.*コナガ/)
  assert.ok(details.includes('/field-concerns/' + concern.id + '/photo'))
  assert.ok(details.indexOf('dateTime="' + today) < details.indexOf('dateTime="' + yesterday))
  const remove = (session: typeof owner) => withRequestCookies(session, () =>
    DELETE(new NextRequest(itemUrl, { method: 'DELETE' }), itemContext))
  assert.equal((await remove(stranger)).status, 404)
  assert.equal((await remove(owner)).status, 200)
  assert.equal((await photo(owner)).status, 404)
  assert.deepEqual(await readdir(photoDirectory), [])
  assert.equal(await db.fieldConcern.findUnique({ where: { id: concern.id } }), null)

  assert.equal((await post(photoForm(jpeg, 'image/jpeg'))).status, 201)
  assert.equal((await readdir(photoDirectory)).length, 1)
  assert.equal((await withRequestCookies(owner, () =>
    deleteCrop(new NextRequest(cropPath + cropId, { method: 'DELETE' }), context))).status, 200)
  assert.equal(await db.fieldConcern.count({ where: { cropId } }), 0)
  assert.deepEqual(await readdir(photoDirectory), [])
})
