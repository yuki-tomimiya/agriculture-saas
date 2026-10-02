'use client'

import { useEffect } from 'react'

export default function ScrollToGddDetail({ cropId }: { cropId?: string }) {
  useEffect(() => {
    if (!cropId) return
    document.getElementById('gdd-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [cropId])
  return null
}
