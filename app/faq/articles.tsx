import Link from 'next/link'
import { GDD_FAQ_ROWS, GDD_NONE_CROPS } from '@/lib/benchmarks/gdd-methods'
import { formatSoilPhRange, SOIL_PH_RANGES, SOIL_PH_SOURCE_CHIBA, SOIL_PH_SOURCE_MAFF } from '@/lib/benchmarks/soil-ph'
import { SOIL_NUTRIENT_SOURCE_MAFF, SOIL_PH_SOURCE_MIYAZAKI } from '@/lib/benchmarks/soil-nutrients'
import { FROST_SOURCE_FUKUOKA, FROST_SOURCE_JMA } from '@/lib/proposals/frost'
import { MILESTONE_SOURCE_CHIBA, MILESTONE_SOURCE_LINKS, milestoneFaqRows } from '@/lib/proposals/milestones'
import type { FaqSlug } from '@/lib/faq-index'
import PestForecastLinks from '@/components/PestForecastLinks'

export default function FaqAnswer({
  slug,
  prefectureCodes = [],
}: {
  slug: FaqSlug
  prefectureCodes?: string[]
}) {
  if (slug === 'gdd') {
    return (
      <>
        <p className="faq-section-text">
          積算温度は、毎日の平均気温を足したものです。品目によって、日平均気温をそのまま足すもの（単純）と、決まった温度を引いてから足すもの（有効）があります。引く温度は品目の資料に固定していて、作付けごとに変えることはできません。
        </p>
        <p className="faq-section-text">
          数え方が無い品目は、積算温度で収穫の目安を出しません。節目の見た目で判断します。
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
          基準温度は、有効積算温度で「その日の平均気温から引く温度」です。平均気温がそれ以下の日は、足す量は 0 です。
        </p>
        <p className="faq-section-text">
          いま画面に出しているさつまいもとダイコンは、資料が日平均気温をそのまま足しているので、基準温度は引きません。トマトも、第1花房の開花からそのまま足します（開花の日を聞くまでは、見込みは出しません）。基準温度を作付けごとに変える欄はありません。去年と今年を同じ数え方で比べるためです。
        </p>
        <p className="faq-section-text">
          品目ごとの数え方は<Link href="/faq/gdd-reference" className="faq-link">収穫の目安の表</Link>にまとめています。
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
        <p className="faq-section-text">
          数え方は品目の資料に合わせています。自分の収穫の記録があるときは、その積算温度を先に使います。
        </p>
        <div className="overflow-x-auto">
          <table className="gdd-reference-table">
            <thead>
              <tr>
                <th>品目</th>
                <th>起点</th>
                <th>数え方</th>
                <th>値</th>
                <th>判定</th>
                <th>出典</th>
              </tr>
            </thead>
            <tbody>
              {GDD_FAQ_ROWS.map((row) => (
                <tr key={row.crop}>
                  <td>{row.crop}</td>
                  <td>{row.start}</td>
                  <td>{row.how}</td>
                  <td>{row.value}</td>
                  <td>{row.scope}</td>
                  <td>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="faq-section-text">
          積算温度の目安を出さない品目：{GDD_NONE_CROPS.join('、')}。記録だけの品目も同じです。見た目の節目で判断します。
        </p>
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
          さつまいもだけは、{SOIL_PH_SOURCE_CHIBA.publisher}「{SOIL_PH_SOURCE_CHIBA.name}」（{SOIL_PH_SOURCE_CHIBA.year}）と、
          {SOIL_PH_SOURCE_MIYAZAKI.publisher}「{SOIL_PH_SOURCE_MIYAZAKI.name}」（{SOIL_PH_SOURCE_MIYAZAKI.year}）{SOIL_PH_SOURCE_MIYAZAKI.detail}です。
          どちらも暖かい地域の資料なので、全国の一般とは呼びません。
          {' '}
          <a href={SOIL_PH_SOURCE_CHIBA.url} className="text-green-700 hover:underline">
            {SOIL_PH_SOURCE_CHIBA.url}
          </a>
          {' '}
          <a href={SOIL_PH_SOURCE_MIYAZAKI.url} className="text-green-700 hover:underline">
            {SOIL_PH_SOURCE_MIYAZAKI.url}
          </a>
        </p>
        <p className="faq-section-note">
          地域・土壌型により変わります。都道府県の施肥基準がある場合はそちらを優先してください。
          さつまいもは生育できるpHが広く、pHが高いと立枯病が出やすいため、pH5.5以上では石灰を入れません。
        </p>
        <p className="faq-section-note">
          EC・硝酸態窒素・有効態リン酸は、作付け前に測った値の目安で、超えたときだけ知らせます。超えていなくても「適正」とは言いません。
          作付け前の EC が 0.3 mS/cm（土：水＝1：5）を超えたら、肥料が残っている目安です。砂地（砂丘未熟土など）では 0.1 が目安です。
          硝酸態窒素が 10 mg/100g を超えたら、そのぶん次の元肥の窒素を減らせます。有効態リン酸が 100 mg/100g 以上なら、リン酸の肥料は施さなくてよい目安です。
          減らす量までは言いません。交換性カリは、保肥力（CEC）が分からないと判定できないので、言いません。
        </p>
        <p className="faq-section-note">
          出典は、{SOIL_NUTRIENT_SOURCE_MAFF.publisher}「{SOIL_NUTRIENT_SOURCE_MAFF.name}」（{SOIL_NUTRIENT_SOURCE_MAFF.detail}）、
          秋田県「施肥低減マニュアル」（令和5年3月）、岩手県大船渡「きゅうり技術情報」（令和8年2月）、
          宮崎県「主要作物の土壌診断基準」（平成9年3月）、高知県施肥基準、和歌山県「土壌肥料対策指針」野菜・花き編、
          東京都「土壌診断基準」（平成31年3月）です。
          {' '}
          <a href={SOIL_NUTRIENT_SOURCE_MAFF.url} className="text-green-700 hover:underline">
            {SOIL_NUTRIENT_SOURCE_MAFF.url}
          </a>
        </p>
        <p className="faq-section-note">
          県ごとの減肥の例です。秋田県のマニュアルでは、作付け前の硝酸態窒素が 36 mg/100g 以上なら元肥の窒素は入れません。
          岩手県大船渡のきゅうり技術情報では、21 mg/100g 以上なら元肥の窒素は入れません。
          東京都の土壌診断基準では、EC が 1.5 mS/cm 以上になると肥やけの原因になることがあります。
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
                    {row.source === 'chiba'
                      ? `千葉県・宮崎県の資料では ${formatSoilPhRange(row.min, row.max)}`
                      : formatSoilPhRange(row.min, row.max)}
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
          上の「いつ聞くか」は、一般・県名つき・出典のない暫定の窓に書き分けています。この日数で「今がその作業の時期です」とは言いません。トマトの誘引は植付0〜14日（秋田県の「植え付け後直ちに」から決めた運用の値）で、断定には使いません。
          日数は、尋ねるかどうかの窓にだけ使います。記録があれば断定し、窓の中で記録がなければ「〜していれば」と条件つきで書きます。窓を過ぎても記録がなければ、時期外れの助言になるので何も書きません。試し掘りは収穫まで続くので、収穫の目安の85%を超えたら、収穫を記録するまで条件つきで書きます。
        </p>
      </>
    )
  }

  if (slug === 'pest-timing') {
    return (
      <>
        <p className="faq-section-text">
          防除の間隔は、病害と農薬によって違います。Tillto は防除の日数を示しません。
        </p>
        <p className="faq-section-text">
          国の総合防除の考え方と、千葉県の病害虫防除指針が示しているのは、次の順番です。
        </p>
        <ol className="faq-section-text list-decimal pl-5">
          <li>
            県の病害虫防除所が出す発生予察情報（注意報・警報）を確認します。
            <PestForecastLinks prefectureCodes={prefectureCodes} />
          </li>
          <li>見回りで、発生の初期に見つけたら防除します。</li>
          <li>農薬は、ラベルの使用時期（収穫◯日前まで）と総使用回数を守り、使用記録をつけます。</li>
          <li>同じ系統の薬剤を続けて使わず、ローテーションします。</li>
        </ol>
        <p className="faq-section-note">
          出典は、農林水産省「総合防除実践ガイドライン」、
          「農薬を使用する者が遵守すべき基準を定める省令」、
          農林水産省「農薬使用者の皆さんへ」、
          千葉県「病害虫防除指針」（令和8年）です。
          {' '}
          <a href="https://www.maff.go.jp/j/syouan/syokubo/gaicyu/g_ipm/attach/pdf/index-34.pdf" className="text-green-700 hover:underline">
            https://www.maff.go.jp/j/syouan/syokubo/gaicyu/g_ipm/attach/pdf/index-34.pdf
          </a>
          {' '}
          <a href="https://www.maff.go.jp/j/nouyaku/n_kaisei/h141211/h141211f.html" className="text-green-700 hover:underline">
            https://www.maff.go.jp/j/nouyaku/n_kaisei/h141211/h141211f.html
          </a>
          {' '}
          <a href="https://www.maff.go.jp/j/nouyaku/n_tekisei/attach/pdf/info-6.pdf" className="text-green-700 hover:underline">
            https://www.maff.go.jp/j/nouyaku/n_tekisei/attach/pdf/info-6.pdf
          </a>
          {' '}
          <a href="https://www.pref.chiba.lg.jp/annou/shokubo/documents/r8shishin010301.pdf" className="text-green-700 hover:underline">
            https://www.pref.chiba.lg.jp/annou/shokubo/documents/r8shishin010301.pdf
          </a>
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
        見逃すと作物を失いうるので、Tillto は4℃以下を霜のおそれとしています。
        14日先までのカードは、数値予報モデルの計算結果です。海沿いでは、計算の夜の気温が高めに出て、霜が実際より遅く見えることがあります。
      </p>
      <p className="faq-section-text">
        例年の時期は、農場にいちばん近い、気温を測っている気象庁の観測所の、過去10年の日別の最低気温から出しています。
        年ごとに、8月15日から12月31日までに初めて最低気温が4℃以下になった日を取り、その平均と、最も早い年を示します。
        これは過去の記録であり、今年の予想ではありません。気象庁が観測した初霜ではありません。
        この期間に4℃以下まで下がらない年は、平均に入れません。
      </p>
      <p className="faq-section-text">
        春の霜の終わりも、同じ観測所の過去10年の記録です。
        年ごとに、1月1日から6月30日までに最低気温が最後に4℃以下になった日を取り、その平均と、いちばん遅い年を示します。
        これは過去の記録であり、今年の予想ではありません。
        品目ごとの植える条件（地温など）は、本人の地温計で確かめてください。
      </p>
      <p className="faq-section-text">
        観測所は、今も気温を測っている地点のうち、農場からいちばん近いものを使います。
        近い観測所の記録が使えないときは、これまでどおり推計の気温から出します。
        館山では、推計の平均が12月25日なのに対し、観測所の記録では11月29日でした。
      </p>
      <p className="faq-section-text">
        観測所と畑では冷え込みが違うことがあります。窪地や内陸の畑は、これより早く霜がおりることがあります。
      </p>
      <p className="faq-section-note">
        出典：気象庁ホームページ『過去の気象データ検索』（
        <a href="https://www.data.jma.go.jp/stats/etrn/index.php" className="text-green-700 hover:underline">
          https://www.data.jma.go.jp/stats/etrn/index.php
        </a>
        ）の日別値を加工して作成。
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
