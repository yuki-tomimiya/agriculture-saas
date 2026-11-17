import { openMeteoUrl } from './url'

/** ⚙ 運用の値（根拠台帳I14）。応答本文の受信も含む。 */
export const OPEN_METEO_TIMEOUT_MS = 10_000

export function fetchOpenMeteo(
  kind: Parameters<typeof openMeteoUrl>[0], params: URLSearchParams, options?: RequestInit,
  timeoutMs = OPEN_METEO_TIMEOUT_MS,
) {
  return fetch(openMeteoUrl(kind, params), { ...options, signal: AbortSignal.timeout(timeoutMs) })
}
