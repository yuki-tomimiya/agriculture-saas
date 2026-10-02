import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { getPastCropsArchive } from '@/lib/insights/crop-season-compare'
import { formatDateShort } from '@/lib/utils'

function statusLabel(status: string): string {
  if (status === 'harvested') return '収穫済み'
  return '完了'
}

export default async function GddPastPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const pastCrops = await getPastCropsArchive(user.id)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page gdd-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              <Link href="/gdd" className="gdd-breadcrumb-link">
                生育ナビ
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              <span>過去の作付け</span>
            </p>
            <h1 className="farms-title">過去の作付け（生育データ）</h1>
            <p className="farms-subtitle">
              収穫済み・完了した作付けの積算温度・雨量・日射を確認できます。栽培中の進捗は生育ナビ本体で追ってください。
            </p>
          </div>
          <div className="insights-header-actions">
            <Link href="/dashboard/ai-proposal" className="btn btn-outline farms-add-button">
              今日の提案
            </Link>
            <Link href="/insights" className="btn btn-outline farms-add-button">
              分析・振り返り
            </Link>
            <Link href="/gdd" className="btn btn-primary farms-add-button">
              栽培中へ戻る
            </Link>
          </div>
        </div>

        <div className="calendar-page-content">
          {pastCrops.length === 0 ? (
            <div className="card farms-empty-card">
              <div className="farms-empty-icon">🌡️</div>
              <h3 className="farms-empty-title">過去の作付けはまだありません</h3>
              <p className="farms-empty-text">
                作付けを「収穫済み」などにすると、ここにまとまって表示されます
              </p>
              <Link href="/gdd" className="btn btn-outline farms-add-button">
                生育ナビへ
              </Link>
            </div>
          ) : (
            <section className="card gdd-crop-list">
              <h2 className="gdd-section-title">収穫済み・完了（{pastCrops.length}）</h2>
              <p className="gdd-crop-list-desc">
                「生育データを見る」で、その作付け期間の積算温度・雨量・日射グラフを表示します。
              </p>
              <ul className="insights-past-list">
                {pastCrops.map((crop) => (
                  <li key={crop.id} className="card insights-past-item gdd-crop-card--past">
                    <div className="insights-past-item-main">
                      <Link href={`/crops/${crop.id}`} className="gdd-crop-card-name">
                        {crop.label}
                      </Link>
                      <p className="gdd-crop-card-meta">
                        {crop.farmName ?? '農場未設定'}
                        {' ・ 植付 '}
                        {formatDateShort(crop.plantingDate)}
                        {crop.harvestDate
                          ? ` ・ 収穫 ${formatDateShort(crop.harvestDate)}`
                          : ''}
                      </p>
                    </div>
                    <div className="insights-past-item-actions">
                      <span className="insights-past-status">{statusLabel(crop.status)}</span>
                      <Link
                        href={`/crops/${crop.id}/retrospective`}
                        className="btn btn-outline"
                        style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                      >
                        振り返り
                      </Link>
                      <Link
                        href={`/crops/${crop.id}`}
                        className="btn btn-outline"
                        style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                      >
                        作物詳細
                      </Link>
                      <Link
                        href={`/gdd?cropId=${crop.id}`}
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                      >
                        生育データを見る
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="gdd-crop-past-link" style={{ borderTop: 'none', paddingTop: 0 }}>
                <Link href="/insights" className="gdd-crop-past-link-a">
                  収量・売上の比較は分析・振り返りへ →
                </Link>
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
