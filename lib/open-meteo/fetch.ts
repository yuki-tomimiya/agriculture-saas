import { openMeteoUrl } from './url'

/** ⚙ 運用の値（根拠台帳I14）。応答本文の受信も含む。 */
const TIMEOUT_MS = 10_000

export function fetchOpenMeteo(kind: Parameters<typeof openMeteoUrl>[0], params: URLSearchParams, options?: RequestInit) {
  return fetch(openMeteoUrl(kind, params), { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) })
}
