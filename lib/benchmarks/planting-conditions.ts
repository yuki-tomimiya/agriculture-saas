/**
 * 品目ごとの植える条件。出典は根拠台帳 D10。記録だけの品目とハウスには使わない。
 * 平均気温18℃は出さない（資料で値が一致しない）。
 */

export type PlantingCondition = {
  kindKey: string
  /** 未指定なら両方。作付けの植え方が空なら従来どおり表示する。 */
  plantingMethod?: 'direct' | 'transplant'
  /** 登録画面の霜の注意と遅霜カードの対象（台帳 D11）。 */
  lateFrostAdvice?: boolean
  text: string
  /** 画面の【一般】か、県名 */
  scopeLabel: string
}

const CONDITIONS: PlantingCondition[] = [
  {
    kindKey: 'cabbage', plantingMethod: 'transplant',
    text: '育った苗が寒さにあうと、とう立ちすることがあります。秋田県・宮城県の資料では、セル苗は本葉3枚前後で根鉢ができたら植えます。', scopeLabel: '一般',
  },
  {
    kindKey: 'lettuce-head', plantingMethod: 'transplant',
    text: '発芽の適温は15〜20℃です。高温・長日ではとう立ちしやすくなります。秋田県の資料では、通常の定植は本葉3〜4枚が目安です。', scopeLabel: '一般',
  },
  {
    kindKey: 'spinach', plantingMethod: 'direct',
    text: '25℃以上では発芽率が下がります。秋田県・宮城県の資料では、春まきはとう立ちしやすいとされています。', scopeLabel: '一般',
  },
  {
    kindKey: 'negi-long', plantingMethod: 'transplant',
    text: 'チェーンポット・ペーパーポットの苗は、太さ2〜3mm・葉数2〜3枚が目安です。', scopeLabel: '一般',
  },
  {
    kindKey: 'komatsuna', plantingMethod: 'direct',
    text: '生育の適温は20〜25℃です。', scopeLabel: '一般',
  },
  {
    kindKey: 'sweet-potato',
    lateFrostAdvice: true,
    text: '晩霜のおそれがなくなってから植えます。地温15℃（深さ10〜15cm）を確かめて植えてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'eggplant',
    lateFrostAdvice: true,
    text: 'マルチの下20cmの地温15℃以上を確かめて植えてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'sweet-corn',
    lateFrostAdvice: true,
    plantingMethod: 'direct',
    text: '直まきは、地温12〜13℃以上を確かめてからにしてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'pepper',
    lateFrostAdvice: true,
    text: '最低気温12℃以上の日が多くなるころに植えてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'potato',
    lateFrostAdvice: true,
    text: '芽が出たころに霜のおそれがあれば、軽く土寄せをしてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'tomato',
    lateFrostAdvice: true,
    text: '地温15℃（深さ10〜15cm）を確かめて植えてください。ハウス・雨よけやマルチの例です。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'cucumber',
    lateFrostAdvice: true,
    text: '霜の心配がなくなってから植えてください。それより早く植えるなら、トンネルで保温してください。',
    scopeLabel: '福島県・宮城県',
  },
  {
    kindKey: 'edamame',
    lateFrostAdvice: true,
    text: '早まきはトンネル・マルチで地温を上げ、保温してください。秋田県・新潟県の資料では、霜に弱いので保温が必要とされています。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'broccoli',
    lateFrostAdvice: true,
    plantingMethod: 'transplant',
    text: '本葉3枚ほどの若い苗のうちに植えてください。暑い時期に植えるときは植え傷みに気をつけ、乾いていれば水をやってください。',
    scopeLabel: '一般',
  },
]

export const LATE_FROST_COVER =
  '定植後は、フィルム被覆やべたがけ資材の利用等により被害の回避に努める。'

export const LATE_FROST_POTATO = '芽が出ていれば、軽く土寄せをしましょう。'

export const LATE_FROST_SOURCE =
  '農林水産省「農業技術の基本指針（令和6年7月）」'

export function plantingConditionForKind(
  kindKey: string | null | undefined,
  plantingMethod?: string | null
): PlantingCondition | null {
  if (!kindKey) return null
  const condition = CONDITIONS.find((row) => row.kindKey === kindKey)
  if (!condition) return null
  if (plantingMethod && condition.plantingMethod && plantingMethod !== condition.plantingMethod) return null
  return condition
}

/** 今年の1月〜6月に植えたか。遅霜のカードの対象 */
export function plantedThisSpring(plantingDate: Date, today: Date): boolean {
  return plantingDate.getFullYear() === today.getFullYear() && plantingDate.getMonth() < 6
}
