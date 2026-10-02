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
              <li><a href="#base-temp">基準温度とは？</a></li>
              <li><a href="#normals">平年とは？</a></li>
              <li><a href="#radiation">日射量（MJ/㎡）とは？</a></li>
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
              同じ地点の平年との比較や「あとどれくらいで収穫目安か」を確認できます。
            </p>
            <p className="faq-section-text">
              <Link href="/gdd" className="faq-link">生育ナビページへ →</Link>
            </p>
          </section>

          <section id="base-temp" className="faq-section">
            <h2 className="faq-section-title">基準温度とは？</h2>
            <p className="faq-section-text">
              基準温度は、その作物がほとんど生長しない気温の下限です。
              その日の平均気温から基準温度を引いた分だけを、積算温度に足します。
              平均気温が基準温度以下の日は、足す量は 0 です。
            </p>
            <p className="faq-section-text">
              さつまいもなど多くの露地野菜は 10℃ を使っています。作物カードの「基準温度」は、この計算に使う値です。
            </p>
          </section>

          <section id="normals" className="faq-section">
            <h2 className="faq-section-title">平年とは？</h2>
            <p className="faq-section-text">
              平年は、その農場の座標で、過去10年の同じ月日を平均した値です。
              気温・降水量・日射量を Open-Meteo の過去データから取り、2月29日は除いています。
            </p>
            <p className="faq-section-text">
              生育ナビの折れ線は、植え付け日からの平年の積算です。
              今日の提案の地域の文は、今月の降水量を、同じ日数の平年と比べます。昨年の値は、参考として添えます。
            </p>
          </section>

          <section id="radiation" className="faq-section">
            <h2 className="faq-section-title">日射量（MJ/㎡）とは？</h2>
            <p className="faq-section-text">
              MJ/㎡ は、1平方メートルあたりに届いた日射エネルギーの量です。
              日照時間（何時間晴れたか）とは別の単位で、曇りの日でも値はあります。
            </p>
            <p className="faq-section-text">
              生育ナビの日射グラフは、植え付け日からこの値を足し合わせ、同じ地点の平年の積算と比べます。
            </p>
          </section>

          <section id="gdd-reference" className="faq-section">
            <h2 className="faq-section-title">主な作物の収穫までに必要な積算温度の目安</h2>
            <p className="faq-section-note">
              ※ 品種・地域・栽培方法により前後します。あくまで目安としてご利用ください。
              さつまいもの初期値 1700℃日、紅はるか 1550℃日、ふくむらさき 1900℃日は、在圃日数からの暫定換算です。出典が固まり次第、見直します。
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
