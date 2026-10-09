import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import WeatherNav from '@/components/WeatherNav'
import WeatherForecast from '@/components/WeatherForecast'
import WeatherFarmSelector from '@/components/WeatherFarmSelector'

export default async function WeatherPage({
  searchParams,
}: {
  searchParams?: Promise<{ farmId?: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const farms = await prisma.farm.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, latitude: true, longitude: true },
  })
  const sp = searchParams ? await searchParams : undefined
  const selectedFarmId = sp?.farmId
  const selectedFarm =
    (selectedFarmId ? farms.find((f) => f.id === selectedFarmId) : null) ??
    farms[0] ??
    null

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">気象ナビ</h1>
            <p className="farms-subtitle">
              今週と今後2週間の計算結果を確認します。表示している先の天気は、気象庁の予報ではなく、海外の数値予報モデル（Open-Meteo）の計算結果です。大きくずれることがあります。
            </p>
          </div>
        </div>
        {farms.length > 0 ? (
          <div style={{ marginBottom: '1rem' }}>
            <WeatherFarmSelector
              farms={farms.map((f) => ({ id: f.id, name: f.name }))}
              selectedFarmId={selectedFarm?.id}
            />
          </div>
        ) : null}

        <div className="dashboard-bottom" style={{ maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <WeatherNav
            emptyState={farms.length === 0 ? 'no-farms' : undefined}
            farmName={selectedFarm?.name}
            latitude={selectedFarm?.latitude}
            longitude={selectedFarm?.longitude}
            farmId={selectedFarm?.id}
          />
          <WeatherForecast
            emptyState={farms.length === 0 ? 'no-farms' : undefined}
            farmName={selectedFarm?.name}
            latitude={selectedFarm?.latitude}
            longitude={selectedFarm?.longitude}
            farmId={selectedFarm?.id}
          />
        </div>
      </main>
    </div>
  )
}
