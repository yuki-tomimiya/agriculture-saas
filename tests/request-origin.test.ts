import { createCookieJar } from './helpers/next-runtime'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { proxy, config } from '../proxy'
import { allowedOrigin } from '../lib/request-origin'

const origin = 'http://127.0.0.1:3000'
function request(url: string, method = 'POST', body: unknown = {}, jar = createCookieJar(), from: string | null = origin) {
  const headers = new Headers({ 'content-type': 'application/json', cookie: jar.cookies.toString() })
  if (from !== null) headers.set('origin', from)
  return new NextRequest(origin + url, { method, headers, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) })
}

test('Originはすべての変更APIで完全一致を要求し、旧Cookieを消す', () => {
  assert.equal(allowedOrigin({ NODE_ENV: 'production' }), undefined)
  assert.equal(allowedOrigin({ NODE_ENV: 'production', TILLTOL_ORIGIN: 'https://app.example.invalid' }), 'https://app.example.invalid')
  for (const value of ['null', 'https://app.example.invalid/', 'https://user:pass@app.example.invalid', '*']) {
    assert.equal(allowedOrigin({ TILLTOL_ORIGIN: value }), undefined)
  }
  const routes = readdirSync('app/api', { recursive: true }).filter(file => String(file).endsWith('route.ts'))
  let checked = 0
  for (const file of routes) {
    const source = readFileSync(path.join('app/api', String(file)), 'utf8')
    const url = '/api/' + String(file).replaceAll('\\', '/').replace(/\/route\.ts$/, '').replaceAll('[id]', 'other')
    for (const [, method] of source.matchAll(/export async function (POST|PATCH|PUT|DELETE)\(/g)) {
      assert.equal(unstable_doesMiddlewareMatch({ config, url: origin + url }), true, `${method} ${url}`)
      for (const from of [null, 'null', 'https://evil.example.invalid', origin + '.evil.invalid', origin + '/', 'http://127.0.0.1:3001']) {
        assert.equal(proxy(request(url, method, {}, undefined, from)).status, 403, `${method} ${url}: ${from}`)
      }
      assert.equal(proxy(request(url, method)).headers.get('x-middleware-next'), '1')
      checked++
    }
  }
  assert.ok(checked >= 30)
  const response = proxy(request('/dashboard', 'GET', {}, createCookieJar('userId=other')))
  assert.match(response.headers.get('set-cookie') ?? '', /userId=;.*Expires=Thu, 01 Jan 1970/)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
})
