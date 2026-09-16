import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'

export default async function FAQPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/signin')

  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page faq-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <h1 className="farms-title">よくある質問（Q&amp;A）</h1>
            <p className="farms-subtitle">
              農業管理や機能の使い方について、よくいただく質問をまとめています
            </p>
          </div>
        </div>

        <div className="faq-content card">
          <nav className="faq-nav" aria-label="Q&A 目次">
            <p className="faq-nav-title">目次</p>
            <ul className="faq-nav-list">
              <li><a href="#gdd">積算温度（GDD）とは？</a></li>
              <li><a href="#gdd-reference">主な作物の積算温度の目安</a></li>
            </ul>
          </nav>

          <section id="gdd" className="faq-section">
            <h2 className="faq-section-title">積算温度（GDD）とは？</h2>
            <p className="faq-section-text">
              積算温度は「その日の平均気温から基準温度を引いた値」を、植え付け日から足し合わせたものです。
              作物の生長スピードは気温に左右されるため、<strong>「○日後」より「○℃日（積算温度）で収穫」</strong>と考えると、
              年ごとの気温差に左右されず、収穫時期の目安を立てやすくなります。
            </p>
            <p className="faq-section-text">
              生育ナビでは、登録した作物の植え付け日と日々の気温から積算温度を計算し、
              標準年との比較や「あとどれくらいで収穫目安か」を確認できます。
            </p>
            <p className="faq-section-text">
              <Link href="/gdd" className="faq-link">生育ナビページへ →</Link>
            </p>
          </section>

          <section id="gdd-reference" className="faq-section">
            <h2 className="faq-section-title">主な作物の収穫までに必要な積算温度の目安</h2>
            <p className="faq-section-note">
              ※ 品種・地域・栽培方法により前後します。あくまで目安としてご利用ください。
            </p>
            <div className="overflow-x-auto">
              <table className="gdd-reference-table">
                <thead>
                  <tr>
                    <th>作物</th>
                    <th>基準温度</th>
                    <th>定植〜初収穫の目安（℃日）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>トマト</td><td>10℃</td><td>約 800〜1,000</td></tr>
                  <tr><td>ナス</td><td>10℃</td><td>約 900〜1,100</td></tr>
                  <tr><td>ピーマン</td><td>10℃</td><td>約 850〜1,050</td></tr>
                  <tr><td>キュウリ</td><td>10℃</td><td>約 650〜850</td></tr>
                  <tr><td>スイートコーン</td><td>10℃</td><td>約 1,300〜1,500</td></tr>
                  <tr><td>イチゴ</td><td>5℃</td><td>約 600〜800（開花〜収穫）</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
