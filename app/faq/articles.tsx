import Link from 'next/link'
import { CROP_BASE_TEMPERATURES } from '@/lib/benchmarks/base-temperature'
import { formatSoilPhRange, SOIL_PH_RANGES, SOIL_PH_SOURCE_CHIBA, SOIL_PH_SOURCE_MAFF } from '@/lib/benchmarks/soil-ph'
import { FROST_SOURCE_FUKUOKA, FROST_SOURCE_JMA } from '@/lib/proposals/frost'
import { MILESTONE_SOURCE_CHIBA, MILESTONE_SOURCE_LINKS, milestoneFaqRows } from '@/lib/proposals/milestones'
import type { FaqSlug } from '@/lib/faq-index'

export default function FaqAnswer({ slug }: { slug: FaqSlug }) {
  if (slug === 'gdd') {
    return (
      <>
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
      </>
    )
  }

  if (slug === 'base-temp') {
    return (
      <>
        <p className="faq-section-text">
          基準温度は、その作物がほとんど生長しない気温の下限です。
          その日の平均気温から基準温度を引いた分だけを、積算温度に足します。
          平均気温が基準温度以下の日は、足す量は 0 です。
        </p>
        <p className="faq-section-text">
          さつまいもなど多くの露地野菜は 10℃ を使っています。作物カードの「基準温度」は、この計算に使う値です。
        </p>
      </>
    )
  }

  if (slug === 'normals') {
    return (
      <>
        <p className="faq-section-text">
          画面の「10年平均」は、その農場の座標で、過去10年の同じ月日を平均した値です。
          出どころは Open-Meteo です。中身は ERA5 などの再解析で、観測所・衛星・レーダーを数値モデルで統合した推計です。実測そのものではありません。
          先の天気も同じ出どころで、表示しているのは気象庁の予報ではなく、海外の数値予報モデル（Open-Meteo）の計算結果です。大きくずれることがあります。
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
      </>
    )
  }

  if (slug === 'harvest-window') {
    return (
      <>
        <p className="faq-section-text">
          収穫の見込みは、1つの日付では言い切りません。今日までの積算温度に、過去10年それぞれの気温を足して、目安に届く日を年ごとに出します。いちばん早い年と遅い年を1つずつ除いた範囲を、「9月26日〜9月30日」のように出します。10年すべて届くときは「10年中8年がこの間」です。
        </p>
        <p className="faq-section-text">
          先の日付ほど幅は広く、収穫が近づくほど狭くなります。年ごとの気温の振れを、そのまま幅にしています。
        </p>
        <p className="faq-section-text">
          明日から14日先までは、その年の過去の気温ではなく、いまの数値予報モデルの計算の平均気温を足します。15日目以降は、その年の同じ月日の気温です。年内に届かない年は、幅に入れません。1年も届かないときは「今季は、収穫の目安に届かない見込みです」と出します。
        </p>
        <p className="faq-section-text">
          目安が暫定のときは、この幅より大きくずれることがあります。そのときは「目安が暫定のため、これより大きくずれることがあります」と添えます。
        </p>
        <p className="faq-section-text">
          気温は推計です。くわしくは<Link href="/faq/normals" className="faq-link">10年平均（推計）とは？</Link>
        </p>
      </>
    )
  }

  if (slug === 'radiation') {
    return (
      <>
        <p className="faq-section-text">
          MJ/㎡ は、1平方メートルあたりに届いた日射エネルギーの量です。
          日照時間（何時間晴れたか）とは別の単位で、曇りの日でも値はあります。
        </p>
        <p className="faq-section-text">
          生育ナビの日射グラフは、植え付け日からこの値を足し合わせ、同じ地点の10年平均（推計）と比べます。
        </p>
      </>
    )
  }

  if (slug === 'gdd-reference') {
    return (
      <>
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
      </>
    )
  }

  if (slug === 'soil-ph') {
    return (
      <>
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
      </>
    )
  }

  if (slug === 'stages') {
    return (
      <>
        <p className="faq-section-text">
          Tillto は、植えてからの日数で段階を決めません。教科書の作業判断は日数ではなく、
          花が何段目まで咲いたか、試し掘りでどうだったか、で書かれているためです。作型や地域でも日数は変わります。
        </p>
        <p className="faq-section-text">
          畑を見られないので、節目は本人に聞いて確かめます。聞くのは、答えで助言が変わるときだけです。
          収穫を始めたかどうかのように、記録を見れば分かることは聞きません。
        </p>
        <p className="faq-section-text">
          南北の2県以上で一致したものだけを一般として出し、1県だけのものは県名を付けています。
          最終花房の上には、葉を2〜3枚残して摘心します。宮城県・熊本県野菜振興協会の資料は2枚、秋田県の資料は3枚です。
        </p>
        <p className="faq-section-text">
          ピーマンは、1番花が咲く直前（つぼみが白くなったころ）が定植の適期です（秋田県・鳥取県の資料）。作付けを登録したあとでは遅いので、ここでは聞きません。
          1番花を摘むのは秋田県の資料と、鳥取県の資料の「5月定植の場合」だけなので、問いかけにはしていません。
        </p>
        <p className="faq-section-note">
          出典は次のとおりです。
          {MILESTONE_SOURCE_LINKS.map((source) => (
            <span key={source.url}>
              {' '}
              <a href={source.url} className="text-green-700 hover:underline">
                {source.label}
              </a>
            </span>
          ))}
        </p>
        <div className="overflow-x-auto">
          <table className="gdd-reference-table">
            <thead>
              <tr>
                <th>作物</th>
                <th>聞くこと</th>
                <th>出典</th>
                <th>いつ聞くか</th>
              </tr>
            </thead>
            <tbody>
              {milestoneFaqRows().map((row) => (
                <tr key={`${row.crop}-${row.term}`}>
                  <td>{row.crop}</td>
                  <td>
                    {row.question}
                    <span className="block text-gray-500">（{row.term}）</span>
                  </td>
                  <td>{row.source}</td>
                  <td>{row.windowNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faq-section-note">
          上の「いつ聞くか」の日数は暫定で、出典がありません。この日数で「今がその作業の時期です」とは言いません。
          日数は、尋ねるかどうかの窓にだけ使います。記録があれば断定し、窓の中で記録がなければ「〜していれば」と条件つきで書きます。窓を過ぎても記録がなければ、時期外れの助言になるので何も書きません。試し掘りは収穫まで続くので、収穫の目安の85%を超えたら、収穫を記録するまで条件つきで書きます。
        </p>
      </>
    )
  }

  return (
    <>
      <p className="faq-section-text">
        さつまいもは寒さに弱いので、収穫は霜がおりる前に終わらせます。積算温度の目安より、霜が先に来ることがあります。
        Tillto は最低気温4℃以下を「霜のおそれ」とします。初版の対象はさつまいもだけです。
      </p>
      <p className="faq-section-text">
        気象台は、晴れて風が弱いと気温が3〜4℃まで下がると霜がおりやすく、地上1.5mの気温が4℃くらいでも地面付近は0℃以下になる、と説明しています。
        気象庁の霜注意報の基準は市町村ごとに違い、おおよそ2〜4℃です。
        Tillto が使う気温は推計で、冬は実測より高く出ることがあります。谷や盆地の冷え込みも拾えません。
        見逃すと作物を失いうるので、安全側の4℃にしています。
      </p>
      <p className="faq-section-text">
        例年の初霜は、その地点の過去10年の推計から出しています。年ごとに、8月15日から12月31日までに初めて最低気温4℃以下になった日を取り、その平均と早い年を示します。
        気象庁が観測した初霜ではありません。この期間に4℃以下まで下がらない地点では、霜の締切は出しません。
      </p>
      <p className="faq-section-text">
        谷・盆地・くぼ地は、表示より早く霜がおりることがあります。気象庁が観測した初霜と比べると、内陸では約10日早い地点がありました。
      </p>
      <p className="faq-section-note">
        出典は、{FROST_SOURCE_FUKUOKA.publisher}「{FROST_SOURCE_FUKUOKA.name}」{FROST_SOURCE_FUKUOKA.detail}
        {' '}
        <a href={FROST_SOURCE_FUKUOKA.url} className="text-green-700 hover:underline">
          {FROST_SOURCE_FUKUOKA.url}
        </a>
        、{FROST_SOURCE_JMA.publisher}「{FROST_SOURCE_JMA.name}」
        {' '}
        <a href={FROST_SOURCE_JMA.url} className="text-green-700 hover:underline">
          {FROST_SOURCE_JMA.url}
        </a>
        、{MILESTONE_SOURCE_CHIBA.publisher}「{MILESTONE_SOURCE_CHIBA.name}」（{MILESTONE_SOURCE_CHIBA.year}）p.28
        {' '}
        <a href={MILESTONE_SOURCE_CHIBA.url} className="text-green-700 hover:underline">
          {MILESTONE_SOURCE_CHIBA.url}
        </a>
        です。
      </p>
    </>
  )
}
