import { AsyncLocalStorage } from 'node:async_hooks'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Next.jsが起動時に用意するAPIを、サーバーを起動しない部品テストにも用意する。
Object.assign(globalThis, { AsyncLocalStorage })

// Next.js 16への更新時はwork-unit-async-storageと新しいリクエストの形に差し替える。
type TestCookies = { get(name: string): { value: string } | undefined }
const { requestAsyncStorage } = require('next/dist/client/components/request-async-storage.external') as {
  requestAsyncStorage: AsyncLocalStorage<{ cookies: TestCookies }>
}
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime') as typeof import(
  'next/dist/shared/lib/app-router-context.shared-runtime'
)
const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }

export function withRequestCookies<T>(cookies: TestCookies, callback: () => T): T {
  return requestAsyncStorage.run({ cookies }, callback)
}

export function renderWithRouter(element: ReactElement): string {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, element))
}
