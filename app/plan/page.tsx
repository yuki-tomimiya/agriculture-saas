import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { getNextYearPlans } from '@/lib/insights/next-year-plan'
import { formatPlantingLabel } from '@/lib/insights/crop-season-compare'
import { formatDateShort } from '@/lib/utils'

function formatYearMonthDay(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatYen(amount: number): string {
  return `${amount.toLocaleString('ja-JP')}円`
}

export default async function NextYearPlanPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const plans = await getNextYearPlans(user.id)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">来年の計画</h1>
            <p className="farms-subtitle">
              終わった作付けごとに、来年も同じ日に植えたとき、平年の気温ではいつ頃収穫できるかを出します
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/crops/archive" className="btn btn-outline farms-add-button">
              過去の作付け
            </Link>
            <Link href="/insights" className="btn btn-outline farms-add-button">
              分析・振り返り
            </Link>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="card farms-empty-card">
            <h3 className="farms-empty-title">作付けが終わると、来年の計画が作れます</h3>
            <p className="farms-empty-text">
              栽培中の作物を収穫済みにすると、今年の実績と、来年の植付日・収穫の見込みがここに出ます。
            </p>
            <Link href="/crops" className="btn btn-primary farms-add-button">
              栽培中の作物へ
            </Link>
          </div>
        ) : (
          <div>
            {plans.map((plan) => {
              const title = formatPlantingLabel(plan.name, plan.variety, plan.plantingDate)
              const you = [
                plan.plantingDate ? `植付 ${formatDateShort(plan.plantingDate)}` : '植付日は記録なし',
                plan.harvestDate
                  ? `収穫 ${formatDateShort(plan.harvestDate)}${plan.seasonDays !== null ? `（${plan.seasonDays}日間）` : ''}`
                  : '収穫日は記録なし',
                plan.accumulatedGdd !== null ? `積算温度 ${plan.accumulatedGdd}℃日` : '積算温度は取れませんでした',
                plan.harvestRecorded
                  ? `収量 ${plan.harvestQty}${plan.harvestUnit}`
                  : '収量は記録なし',
                plan.salesRecorded ? `売上 ${formatYen(plan.salesAmount ?? 0)}` : '売上は記録なし',
              ].join('。')
              const conclusion =
                plan.forecastKind === 'season-days' && plan.nextPlantingDate && plan.normalHarvestDate && plan.normalDays !== null
                  ? `来年も${formatYearMonthDay(plan.nextPlantingDate)}に植えると、平年の気温では同じ積算温度に季節内では届きません。これまでの栽培日数（平均${plan.normalDays}日）で見ると、${formatYearMonthDay(plan.normalHarvestDate)}ごろです。`
                  : plan.nextPlantingDate && plan.normalHarvestDate && plan.normalDays !== null
                    ? `来年も${formatYearMonthDay(plan.nextPlantingDate)}に植えると、${
                        plan.forecastKind === 'provisional'
                          ? '一般の目安（暫定）までなら'
                          : plan.forecastKind === 'adjusted'
                            ? '平年に引き直した積算温度までなら'
                            : '過去の収穫と同じ積算温度までなら'
                      }、平年では${formatYearMonthDay(plan.normalHarvestDate)}ごろです（植付から${plan.normalDays}日）。${
                        plan.seasonDays !== null ? `この作付けは植付から${plan.seasonDays}日で収穫しています。` : ''
                      }`
                    : plan.normalNote
              return (
                <article key={plan.cropId} id={`plan-${plan.cropId}`} className="card insights-section">
                  <h2 className="insights-section-title">
                    {title}
                    {plan.farmName ? <span className="insights-card-meta"> {plan.farmName}</span> : null}
                  </h2>
                  <p className="insights-regional-text">
                    <span className="insights-layer-tag">あなた</span>
                    {you}。
                  </p>
                  <p className="insights-regional-text">
                    <span className="insights-layer-tag">地域</span>
                    {plan.forecastKind === 'season-days' || plan.normalStatus === 'unreachable'
                      ? `平年の気温は取れています。基準温度は${plan.baseTemp}℃です。`
                      : plan.normalStatus === 'reached'
                        ? `この農場の過去10年の日平均気温を、植付日から足しています。基準温度は${plan.baseTemp}℃です。`
                        : '平年の気温は取れていません。'}
                  </p>
                  <p className="insights-regional-text">
                    <span className="insights-layer-tag">
                      {plan.basis.source === 'provisional' ? '一般' : 'あなた'}
                    </span>
                    {plan.basis.summary}。
                    {plan.basis.detail ? ` ${plan.basis.detail}。` : ''}
                    {plan.basis.spreadNote ? ` ${plan.basis.spreadNote}` : ''}
                    {plan.adjustNote ? ` ${plan.adjustNote}。` : ''}
                    {plan.basis.source === 'provisional' && (
                      <Link href="/faq#gdd-reference" className="faq-link">
                        {' '}
                        目安の説明
                      </Link>
                    )}
                  </p>
                  {conclusion && (
                    <p className="insights-regional-text">
                      <span className="insights-layer-tag insights-layer-tag--conclusion">来年</span>
                      {conclusion}
                    </p>
                  )}
                  {plan.workHints.length > 0 && (
                    <ul className="insights-hint-list">
                      {plan.workHints.map((work) => (
                        <li key={work.taskType}>
                          植付+{work.day}日に {work.taskType}
                          {work.count > 1 ? `（${work.count}回）` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {plan.workCount < 3 && (
                    <p className="insights-regional-meta">
                      この作付けの作業記録が{plan.workCount}件なので、来年は作業の日を残すと、この一覧の精度が上がります。
                    </p>
                  )}
                  <p className="insights-card-links">
                    <Link href={`/crops/${plan.cropId}/retrospective`} className="text-green-700 hover:underline text-sm">
                      振り返り →
                    </Link>
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
