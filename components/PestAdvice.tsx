import Link from 'next/link'
import { harvestDateLabel, PESTICIDE_COUNT_NOTE } from '@/lib/pesticide-safety'
import { pesticideSearchUrl } from '@/lib/pests/catalog'
import { prefectureByCode } from '@/lib/places/catalog'
import type { loadPestAdvice } from '@/lib/pests/service'

export type PestAdviceData = NonNullable<Awaited<ReturnType<typeof loadPestAdvice>>>

export default function PestAdvice({ advice }: { advice: PestAdviceData }) {
  return (
    <div className="space-y-3 text-sm">
      <section>
        <h4 className="font-semibold">農薬を使わない対策</h4>
        {advice.measures.length ? <ul className="list-disc pl-5">
          {advice.measures.map(item => (
            <li key={item.sources[0].url}>
              {item.scope === 'prefecture'
                ? `${prefectureByCode(item.code)?.name}の資料では、${item.text}としています。`
                : item.text}{' '}
              {item.sources.map((source, index) => (
                <a key={source.url} className="underline mr-2" href={source.url} title={source.title}>
                  出典{item.sources.length > 1 ? index + 1 : ''}
                </a>
              ))}
            </li>
          ))}
        </ul> : <p>{advice.emptyMessage}</p>}
      </section>
      <section>
        <h4 className="font-semibold">登録のある農薬の探し方</h4>
        <a className="underline" href={pesticideSearchUrl}>農林水産省の農薬登録情報を検索</a>
        <p>作物：{advice.searchCrop}／病害虫：{advice.searchPest}を選びます。</p>
        <p>使う前にラベルで、作物・病害虫・使用時期・回数を確かめてください。</p>
        {advice.guide && <a className="underline" href={advice.guide.url}>{advice.guide.title}</a>}
      </section>
      {advice.forecast && <p><a className="underline" href={advice.forecast.url}>{advice.forecast.prefectureName}の病害虫発生予察</a></p>}
      {advice.usages.length > 0 && <section>
        <h4 className="font-semibold">この作付けの農薬の記録</h4>
        {advice.harvestFrom && <p>記録上、収穫できるのは{harvestDateLabel(advice.harvestFrom)}からです。</p>}
        <ul>{advice.usages.map(usage => (
          <li key={usage.id}>{harvestDateLabel(usage.day)}の散布：{usage.count}回目{usage.limit != null && `／上限${usage.limit}回`}
            {usage.state === 'at' && '・上限に達しています'}
            {usage.state === 'over' && '・上限を超えています'}
          </li>
        ))}</ul>
        <p>{PESTICIDE_COUNT_NOTE}</p>
      </section>}
      <Link className="ai-proposal-action" href={advice.recordHref}>農薬を記録する</Link>
    </div>
  )
}
