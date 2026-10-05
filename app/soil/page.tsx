import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { formatDateShort } from '@/lib/utils'
import SoilDiagnosisActions from './SoilDiagnosisActions'

function measure(label: string, value: number | null, unit: string): string | null {
  if (value == null) return null
  return `${label} ${value}${unit}`
}

export default async function SoilDiagnosisPage({
  searchParams,
}: {
  searchParams?: Promise<{ farmId?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  const params = await searchParams
  const farmId = params?.farmId
  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
  })
  const records = await prisma.soilDiagnosis.findMany({
    where: { userId: user.id, ...(farmId ? { farmId } : {}) },
    include: { farm: true, field: true },
    orderBy: { diagnosedAt: 'desc' },
  })
  const selectedFarm = farms.find((farm) => farm.id === farmId)

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <p className="gdd-breadcrumb">
              <Link href="/farms" className="gdd-breadcrumb-link">
                農場管理
              </Link>
              <span className="gdd-breadcrumb-sep">/</span>
              土壌診断
            </p>
            <h1 className="farms-title">土壌診断</h1>
            <p className="farms-subtitle">
              農場ごとの診断です。養分は mg/100g です。pH 以外の良し悪しは判定しません。
            </p>
          </div>
          <Link
            href={farmId ? `/soil/new?farmId=${farmId}` : '/soil/new'}
            className="btn btn-primary farms-add-button"
          >
            診断を追加
          </Link>
        </div>

        {farms.length > 0 && (
          <div className="farms-filter-bar">
            <Link href="/soil" className={!farmId ? 'farms-filter-active' : 'farms-filter-link'}>
              すべて
            </Link>
            {farms.map((farm) => (
              <Link
                key={farm.id}
                href={`/soil?farmId=${farm.id}`}
                className={farmId === farm.id ? 'farms-filter-active' : 'farms-filter-link'}
              >
                {farm.name}
              </Link>
            ))}
          </div>
        )}

        {records.length === 0 ? (
          <div className="card farms-empty-card">
            <h3 className="farms-empty-title">
              {selectedFarm ? `${selectedFarm.name}の土壌診断はまだありません` : '土壌診断はまだありません'}
            </h3>
            <p className="farms-empty-text">
              土壌診断は、畑の pH や養分を調べる分析です。JA や土壌分析の会社に土を出すと、分析表が届きます。
            </p>
            <p className="farms-empty-text">分析表が手元にあれば入力できます。</p>
            <Link href={farmId ? `/soil/new?farmId=${farmId}` : '/soil/new'} className="btn btn-primary farms-add-button">
              診断を追加
            </Link>
          </div>
        ) : (
          <div>
            {[...new Map(records.map((record) => [record.farmId, record.farm.name])).entries()].map(
              ([groupFarmId, farmName]) => {
                const group = records.filter((record) => record.farmId === groupFarmId)
                const latest = group[0]
                const older = group.slice(1)
                const lines = [
                  measure('pH', latest.ph, ''),
                  measure('EC', latest.ec, ' mS/cm'),
                  measure('硝酸態窒素', latest.nitrogen, ' mg/100g'),
                  measure('有効態リン酸', latest.phosphorus, ' mg/100g'),
                  measure('交換性カリ', latest.potassium, ' mg/100g'),
                ].filter((line): line is string => line != null)
                return (
                  <article key={groupFarmId} className="card insights-section">
                    <h2 className="insights-section-title">
                      {farmName}
                      <span className="insights-card-meta"> 最新 {formatDateShort(latest.diagnosedAt)}</span>
                    </h2>
                    {lines.length > 0 && <p className="insights-regional-text">{lines.join('。')}。</p>}
                    {latest.field && <p className="insights-regional-text">圃場 {latest.field.name}</p>}
                    {latest.notes && <p className="insights-regional-text">{latest.notes}</p>}
                    {latest.photoPath && (
                      <p className="insights-regional-text">
                        <a href={`/api/soil-diagnoses/${latest.id}`} className="gdd-breadcrumb-link" target="_blank" rel="noreferrer">
                          分析表の写真
                        </a>
                      </p>
                    )}
                    <SoilDiagnosisActions id={latest.id} />
                    {older.length > 0 && (
                      <ul className="insights-hint-list">
                        {older.map((record) => (
                          <li key={record.id}>
                            {formatDateShort(record.diagnosedAt)}
                            {record.ph != null ? ` pH ${record.ph}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                )
              }
            )}
          </div>
        )}
      </main>
    </div>
  )
}
