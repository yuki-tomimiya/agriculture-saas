/** 気象庁の季節の区分。春3〜5月、夏6〜8月、秋9〜11月、冬12〜2月。 */
export function seasonName(month: number): '春' | '夏' | '秋' | '冬' {
  if (month >= 3 && month <= 5) return '春'
  if (month >= 6 && month <= 8) return '夏'
  if (month >= 9 && month <= 11) return '秋'
  return '冬'
}
