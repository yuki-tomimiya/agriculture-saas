import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="space-y-16">
          {/* 上：キャッチコピー・説明・CTA */}
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-4 leading-tight">
              農場と作物、作業、<br />お金の流れまで。<br />
              ぜんぶ、ひとつの画面で。
            </h1>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed max-w-3xl mx-auto">
              中小規模の農家さんと新規就農者のための、<br />
              「圃場管理 × 作業記録 × 気象データ × 収支管理」をまとめて扱えるクラウドSaaSです。
            </p>
            <div className="flex gap-3 justify-center mb-3">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition text-sm font-semibold shadow-md"
              >
                無料ではじめる（新規登録）
              </Link>
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center bg-white text-green-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition text-sm font-semibold border border-green-200"
              >
                すでにアカウントをお持ちの方
              </Link>
            </div>
          </div>

          {/* 下：機能カード（人事労務freee風サイドメニュー） */}
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-semibold text-gray-500 mb-4 text-center">このサービスでできること</p>
            <div className="grid grid-cols-2 gap-4">
              <button className="text-left px-4 py-4 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 transition flex flex-col gap-2">
                <span className="text-base font-semibold text-green-800">🏡 農場管理</span>
                <span className="text-sm text-gray-600">
                  農場・圃場ごとの面積、土壌、設備、作付状況を一元管理。
                </span>
              </button>
              <button className="text-left px-4 py-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition flex flex-col gap-2">
                <span className="text-base font-semibold text-gray-900">🌾 作物・作業管理</span>
                <span className="text-sm text-gray-600">
                  作付計画から日々の作業記録、収穫までをスケジュールで把握。
                </span>
              </button>
              <button className="text-left px-4 py-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition flex flex-col gap-2">
                <span className="text-base font-semibold text-gray-900">📊 データ分析・収支</span>
                <span className="text-sm text-gray-600">
                  収量・売上・資材コスト・労務を集計し、作物別の収支を見える化。
                </span>
              </button>
              <button className="text-left px-4 py-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition flex flex-col gap-2">
                <span className="text-base font-semibold text-gray-900">🌤 気象データ連携</span>
                <span className="text-sm text-gray-600">
                  1週間先までの気象予報から、作業スケジュールを自動で提案。
                </span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-6 text-center">
              ※ 実際のアプリでは、これらのカードがサイドメニューとなり、<br />
              クリックすると農場管理・作物管理・分析画面などに切り替わるイメージです。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
