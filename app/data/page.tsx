import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function DataIoPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">外部連携</h1>
            <p className="farms-subtitle">
              データのインポートとエクスポートを、この画面でまとめて管理します。
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">データエクスポート</h2>
                <p className="text-sm text-gray-600">
                  登録済みのデータをCSV形式でダウンロードできます。スプレッドシートや会計ソフトへの連携などに利用できます。
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-3">
                <div>
                  <p className="font-medium text-gray-900">販売記録（CSV）</p>
                  <p className="text-sm text-gray-600">
                    作物別・販売先別の販売実績をまとめて出力します。ダウンロードしたCSVはスプレッドシート等で自由に集計できます。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/sales" className="text-sm text-blue-600 hover:underline">
                    販売一覧を開く
                  </Link>
                  <Link href="/api/export/sales" className="btn btn-outline">
                    CSVをダウンロード
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">データインポート（準備中）</h2>
                <p className="text-sm text-gray-600">
                  他システムやスプレッドシートからのデータ取り込み機能を、今後こちらに追加していきます。
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              例：販売記録の一括取り込み、過去のタスク履歴の取り込み、作物リストの一括登録 など
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}

