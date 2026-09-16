type TilltoLogoProps = {
  /** 表示サイズ（正方形の辺の長さ px） */
  size?: number
  className?: string
  /** アクセシビリティ用ラベル（未指定なら装飾として隠す） */
  title?: string
}

/**
 * Tillto ブランドマーク（耕起のライン＋双葉）
 * テキストロゴと併用することを想定。
 */
export default function TilltoLogo({ size = 32, className = '', title }: TilltoLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {/* 土の帯 */}
      <path
        d="M0 25.5Q20 21 40 25.5V40H0V25.5Z"
        fill="#ecfccb"
      />
      <path
        d="M3 27.5Q20 24 37 27.5"
        stroke="#84cc16"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M3 30.8Q20 27.3 37 30.8"
        stroke="#65a30d"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
      />
      {/* 茎 */}
      <path
        d="M20 26V13.5"
        stroke="#15803d"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* 双葉 */}
      <path
        d="M20 14.5c-5.5-1-9 3.5-7 7.5 2 1.5 5 1 7-1.5"
        fill="#22c55e"
      />
      <path
        d="M20 14.5c5.5-1 9 3.5 7 7.5-2 1.5-5 1-7-1.5"
        fill="#16a34a"
      />
    </svg>
  )
}
