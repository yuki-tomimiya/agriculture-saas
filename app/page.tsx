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
              <span className="home-card-title">今日の提案</span>
              <span className="home-card-desc">
                あなたの記録、この地域の気象、一般の目安を重ねて、今日の一手を出します。記録すると提案が変わります。
              </span>
            </div>
            <div className="home-card">
              <span className="home-card-title">生育と気象</span>
              <span className="home-card-desc">
                積算温度・雨・日射を、その地点の10年平均（推計）と比べます。カレンダーでは昨年の同じ日も見られます。
              </span>
            </div>
            <div className="home-card">
              <span className="home-card-title">記録</span>
              <span className="home-card-desc">
                作業、農薬、収穫、販売と、農場ごとの土壌診断を残します。pHが目安から外れると提案に出ます。
              </span>
            </div>
            <div className="home-card">
              <span className="home-card-title">振り返りと計画</span>
              <span className="home-card-desc">
                前回の作付けと比べ、来年の植付日と収穫見込みを出します。
              </span>
            </div>
          </div>
          <p className="home-note">
            ログイン後は、左のメニューから今日の提案、記録、生育ナビ、振り返りと計画へ進めます。
          </p>
        </div>
      </div>
    </div>
  )
}
