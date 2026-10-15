'use client'

import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import FarmForm from '@/components/FarmForm'

export default function NewFarmPage() {
  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <Link href="/farms" className="farm-new-back">
              ← 農場一覧
            </Link>
            <h1 className="farms-title">新規農場を追加</h1>
            <p className="farms-subtitle">
              農場の名前と、都道府県・市区町村を入れてください。緯度・経度があると、県の候補を出します。
            </p>
          </div>
        </div>
        <div className="card farm-new-card">
          <FarmForm mode="create" />
        </div>
      </main>
    </div>
  )
}
