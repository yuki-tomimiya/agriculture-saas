/** キーはURLを使う側で表示・ログ出力しない。archiveの契約先は専用ホスト。 */
export function openMeteoUrl(kind: 'archive' | 'forecast' | 'elevation', params: URLSearchParams): string {
  const query = new URLSearchParams(params)
  const key = process.env.OPEN_METEO_API_KEY?.trim()
  const host = kind === 'archive' ? 'archive-api.open-meteo.com' : 'api.open-meteo.com'
  if (key) query.set('apikey', key)
  return `https://${key ? 'customer-' : ''}${host}/v1/${kind}?${query}`
}
