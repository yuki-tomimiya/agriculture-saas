import { MAFF_PEST_LIST_URL, forecastOffice } from '@/lib/pest-forecast'
import { prefectureByCode } from '@/lib/places/catalog'

/** 県の防除所へのリンク。開けないと確かめた県は、農林水産省の一覧だけ出す。 */
export default function PestForecastLinks({
  prefectureCodes,
}: {
  prefectureCodes: Array<string | null | undefined>
}) {
  const codes = [...new Set(prefectureCodes.filter((code): code is string => Boolean(code)))]
  if (codes.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        <a href={MAFF_PEST_LIST_URL} className="text-green-700 hover:underline" target="_blank" rel="noopener noreferrer">
          農林水産省の都道府県病害虫防除所の一覧
        </a>
      </p>
    )
  }

  const verified = codes
    .map((code) => ({ code, office: forecastOffice(code) }))
    .filter((row) => row.office?.officePageVerified)
  const unverified = codes.filter((code) => !forecastOffice(code)?.officePageVerified)

  return (
    <div className="text-sm text-gray-600">
      {verified.map(({ code, office }) => (
        <p key={code}>
          <a href={office!.url} className="text-green-700 hover:underline" target="_blank" rel="noopener noreferrer">
            {office!.officeName}の発生予察情報
          </a>
        </p>
      ))}
      {unverified.map((code) => (
        <p key={code}>
          {prefectureByCode(code)?.name ?? 'この県'}の防除所ページは、いま開けて確かめていません。{' '}
          <a href={MAFF_PEST_LIST_URL} className="text-green-700 hover:underline" target="_blank" rel="noopener noreferrer">
            農林水産省の一覧
          </a>
        </p>
      ))}
      {verified.length > 0 && (
        <p>
          県のページが開けないときは、{' '}
          <a href={MAFF_PEST_LIST_URL} className="text-green-700 hover:underline" target="_blank" rel="noopener noreferrer">
            農林水産省の一覧
          </a>
        </p>
      )}
    </div>
  )
}
