import { AsyncLocalStorage } from 'node:async_hooks'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Next.jsが起動時に用意するAPIを、サーバーを起動しない部品テストにも用意する。
Object.assign(globalThis, { AsyncLocalStorage })

// cookies() が読むリクエストの情報だけをテストに用意する。
type TestCookies = { get(name: string): { value: string } | undefined }
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external') as {
  workAsyncStorage: AsyncLocalStorage<{ route: string }>
}
const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external') as {
  workUnitAsyncStorage: AsyncLocalStorage<{ type: 'request'; phase: 'render'; cookies: TestCookies }>
}
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime') as typeof import(
  'next/dist/shared/lib/app-router-context.shared-runtime'
)
const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {}, bfcacheId: 'test' }

export function withRequestCookies<T>(cookies: TestCookies, callback: () => T): T {
  return workAsyncStorage.run({ route: '/test' }, () =>
    workUnitAsyncStorage.run({ type: 'request', phase: 'render', cookies }, callback)
  )
}

export function renderWithRouter(element: ReactElement): string {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, element))
}
