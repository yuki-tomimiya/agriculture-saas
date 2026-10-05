import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { CROP_BASE_TEMPERATURES } from '@/lib/benchmarks/base-temperature'
import { formatSoilPhRange, SOIL_PH_RANGES, SOIL_PH_SOURCE_CHIBA, SOIL_PH_SOURCE_MAFF } from '@/lib/benchmarks/soil-ph'
import { CROP_STAGE_CATALOG, formatStageCondition } from '@/lib/proposals/stages'

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
              <li><a href="#normals">10年平均（推計）とは？</a></li>
              <li><a href="#radiation">日射量（MJ/㎡）とは？</a></li>
              <li><a href="#gdd-reference">主な作物の積算温度の目安</a></li>
              <li><a href="#soil-ph">適正pHとは？</a></li>
              <li><a href="#stages">生育ステージとは？</a></li>
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
              同じ地点の10年平均（推計）との比較や「あとどれくらいで収穫目安か」を確認できます。
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
            <h2 className="faq-section-title">10年平均（推計）とは？</h2>
            <p className="faq-section-text">
              画面の「10年平均」は、その農場の座標で、過去10年の同じ月日を平均した値です。
              出どころは Open-Meteo です。中身は ERA5 などの再解析で、観測所・衛星・レーダーを数値モデルで統合した推計です。実測そのものではありません。
            </p>
            <p className="faq-section-text">
              格子の大きさはおおよそ 9〜25km です。近い農場同士では、同じ値になることがあります。
              館山のアメダスと照らしたところ、気温はだいたい ±1.5℃以内でした。降水量は 0.7〜2.1 倍までばらつき、方向も一定ではありません。そのため雨は、ミリメートルより 10年平均との割合を主に見せています。
            </p>
            <p className="faq-section-text">
              気象庁の平年値は、1991〜2020年の30年・実測の平均です。Tillto の10年平均（推計）とは別物です。
            </p>
            <p className="faq-section-text">
              生育ナビの折れ線は、植え付け日からの10年平均の積算です。
              今日の提案の地域の文は、今月の降水量を、同じ日数の10年平均と比べます。昨年の値は、参考として添えます。
            </p>
          </section>

          <section id="radiation" className="faq-section">
            <h2 className="faq-section-title">日射量（MJ/㎡）とは？</h2>
            <p className="faq-section-text">
              MJ/㎡ は、1平方メートルあたりに届いた日射エネルギーの量です。
              日照時間（何時間晴れたか）とは別の単位で、曇りの日でも値はあります。
            </p>
            <p className="faq-section-text">
              生育ナビの日射グラフは、植え付け日からこの値を足し合わせ、同じ地点の10年平均（推計）と比べます。
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
                  {CROP_BASE_TEMPERATURES.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.baseTemp}℃</td>
                      <td>{row.gddLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="soil-ph" className="faq-section">
            <h2 className="faq-section-title">適正pHとは？</h2>
            <p className="faq-section-text">
              適正pHは、その品目が育ちやすい土壌の酸性・アルカリ性の範囲です。
              今日の提案では、農場の最新の診断がこの範囲から外れているときだけ知らせます。
              さつまいもは、pHが低いことを理由に石灰を勧めません。
            </p>
            <p className="faq-section-note">
              出典は、{SOIL_PH_SOURCE_MAFF.publisher}「{SOIL_PH_SOURCE_MAFF.name}」{SOIL_PH_SOURCE_MAFF.detail}です。
              {' '}
              <a href={SOIL_PH_SOURCE_MAFF.url} className="text-green-700 hover:underline">
                {SOIL_PH_SOURCE_MAFF.url}
              </a>
              さつまいもだけは、{SOIL_PH_SOURCE_CHIBA.publisher}「{SOIL_PH_SOURCE_CHIBA.name}」（{SOIL_PH_SOURCE_CHIBA.year}）です。
              {' '}
              <a href={SOIL_PH_SOURCE_CHIBA.url} className="text-green-700 hover:underline">
                {SOIL_PH_SOURCE_CHIBA.url}
              </a>
            </p>
            <p className="faq-section-note">
              地域・土壌型により変わります。都道府県の施肥基準がある場合はそちらを優先してください。
              さつまいもは生育できるpHが広く、pHが高いと立枯病が出やすいため、pH5.5以上では石灰を入れません。
              EC・窒素・リン酸・カリの良し悪しは判定しません。
            </p>
            <div className="overflow-x-auto">
              <table className="gdd-reference-table">
                <thead>
                  <tr>
                    <th>作物</th>
                    <th>適正pHの目安</th>
                  </tr>
                </thead>
                <tbody>
                  {SOIL_PH_RANGES.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>
                        {formatSoilPhRange(row.min, row.max)}
                        {row.source === 'chiba' ? '（千葉県）' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="stages" className="faq-section">
            <h2 className="faq-section-title">生育ステージとは？</h2>
            <p className="faq-section-text">
              生育ステージは、植えてからの日数や積算温度で、今どの作業の時期かを見る目安です。
              今日の提案の【一般】は、当てはまる段階があるときその文になります。ない品目は、月ごとのヒントのままです。
            </p>
            <p className="faq-section-note">
              一般的な目安です。品種・地域・作型で変わります。
            </p>
            <div className="overflow-x-auto">
              <table className="gdd-reference-table">
                <thead>
                  <tr>
                    <th>作物</th>
                    <th>段階</th>
                    <th>いつ</th>
                  </tr>
                </thead>
                <tbody>
                  {CROP_STAGE_CATALOG.flatMap((crop) =>
                    crop.stages.map((stage) => (
                      <tr key={`${crop.name}-${stage.key}`}>
                        <td>{crop.name}</td>
                        <td>{stage.label}</td>
                        <td>{formatStageCondition(stage)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
