/**
 * 品目ごとの植える条件。出典は根拠台帳 D10。記録だけの品目とハウスには使わない。
 * 平均気温18℃は出さない（資料で値が一致しない）。
 */

export type PlantingCondition = {
  kindKey: string
  text: string
  /** 画面の【一般】か、県名 */
  scopeLabel: string
}

const CONDITIONS: PlantingCondition[] = [
  {
    kindKey: 'sweet-potato',
    text: '晩霜のおそれがなくなってから植えます。地温15℃（深さ10〜15cm）を確かめて植えてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'eggplant',
    text: 'マルチの下20cmの地温15℃以上を確かめて植えてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'sweet-corn',
    text: '直まきは、地温12〜13℃以上を確かめてからにしてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'pepper',
    text: '最低気温12℃以上の日が多くなるころに植えてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'potato',
    text: '芽が出たころに霜のおそれがあれば、軽く土寄せをしてください。',
    scopeLabel: '一般',
  },
  {
    kindKey: 'tomato',
    text: '地温15℃（深さ10〜15cm）を確かめて植えてください。秋田県のハウス（雨よけ）の例です。',
    scopeLabel: '秋田県',
  },
  {
    kindKey: 'cucumber',
    text: '霜の心配がなくなってから植えてください（福島県）。',
    scopeLabel: '福島県',
  },
  {
    kindKey: 'edamame',
    text: '霜に弱いので、早まきはトンネルなどで保温してください（秋田県）。',
    scopeLabel: '秋田県',
  },
]

export const LATE_FROST_COVER =
  '定植後は、フィルム被覆やべたがけ資材の利用等により被害の回避に努める。'

export const LATE_FROST_POTATO = '芽が出ていれば、軽く土寄せをしましょう。'

export const LATE_FROST_SOURCE =
  '農林水産省「農業技術の基本指針（令和6年7月）」'

export function plantingConditionForKind(kindKey: string | null | undefined): PlantingCondition | null {
  if (!kindKey) return null
  return CONDITIONS.find((row) => row.kindKey === kindKey) ?? null
}

/** 今年の1月〜6月に植えたか。遅霜のカードの対象 */
export function plantedThisSpring(plantingDate: Date, today: Date): boolean {
  return plantingDate.getFullYear() === today.getFullYear() && plantingDate.getMonth() < 6
}
