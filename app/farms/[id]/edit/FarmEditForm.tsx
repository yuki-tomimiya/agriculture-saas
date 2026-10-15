'use client'

import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import FarmForm from '@/components/FarmForm'

type Initial = {
  name: string
  description: string
  latitude: string
  longitude: string
  prefectureCode: string
  municipalityCode: string
}

export default function FarmEditForm({
  farmId,
  initial,
}: {
  farmId: string
  initial: Initial
}) {
  return (
    <div className="dashboard-page min-h-screen flex">
      <Sidebar />
      <main className="dashboard-main farms-page">
        <div className="farms-header">
          <div className="farms-header-text">
            <Link href={`/farms/${farmId}`} className="farm-new-back">
              ← 農場の詳細
            </Link>
            <h1 className="farms-title">農場を編集</h1>
            <p className="farms-subtitle">都道府県と市区町村は、保存する前に確かめてください。</p>
          </div>
        </div>
        <div className="card farm-new-card">
          <FarmForm mode="edit" farmId={farmId} initial={initial} />
        </div>
      </main>
    </div>
  )
}
