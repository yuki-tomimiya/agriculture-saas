import { AsyncLocalStorage } from 'node:async_hooks'
// Next.jsが起動時に用意するAPIを、サーバーを起動しない部品テストにも用意する。
Object.assign(globalThis, { AsyncLocalStorage })
