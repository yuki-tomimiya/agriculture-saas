import Link from 'next/link'
import TilltoLogo from '@/components/TilltoLogo'

export default function Home() {
  return (
    <div className="home-page-root">
      <div className="home-inner">
        {/* 上：キャッチコピー・説明・CTA */}
        <div className="home-section home-text-center">
          <div className="home-brand-row">
            <TilltoLogo size={44} />
            <p className="home-brand">Tillto</p>
          </div>
          <p className="home-tagline">
            見て、聞いて、
            <br />
            一緒に育てる。
          </p>
          <div className="home-cta-wrap">
            <Link href="/auth/signup" className="home-cta-primary">
              無料ではじめる（新規登録）
            </Link>
            <Link href="/auth/signin" className="home-cta-secondary">
              すでにアカウントをお持ちの方
            </Link>
          </div>
        </div>

        {/* 下：機能カード（2x2グリッド・中央配置） */}
        <div className="home-section home-cards-wrap">
          <p className="home-cards-title">このサービスでできること</p>
          <div className="home-cards-grid">
            <div className="home-card-first">
              <span className="home-card-title">🏡 農場管理</span>
              <span className="home-card-desc">
                農場・圃場ごとの面積、土壌、設備、作付状況を一元管理。
              </span>
            </div>
            <div className="home-card">
              <span className="home-card-title">🌾 作物・作業管理</span>
              <span className="home-card-desc">
                作付計画から日々の作業記録、収穫までをスケジュールで把握。
              </span>
            </div>
            <div className="home-card">
              <span className="home-card-title">📊 データ分析・収支</span>
              <span className="home-card-desc">
                収量・売上・資材コスト・労務を集計し、作物別の収支を見える化。
              </span>
            </div>
            <div className="home-card">
              <span className="home-card-title">🌤 気象データ連携</span>
              <span className="home-card-desc">
                1週間先までの気象予報から、作業スケジュールを自動で提案。
              </span>
            </div>
          </div>
          <p className="home-note">
            ※ ログイン後は、これらのカードがサイドメニューとなり、<br />
            クリックすると農場管理・作物管理・分析画面などに切り替わります。
          </p>
        </div>
      </div>
    </div>
  )
}
