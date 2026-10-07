'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isFaqSlug } from '@/lib/faq-index'

/** 古い /faq#slug はサーバーに届かないので、開いたあと該当のページへ送る */
export default function FaqHashRedirect() {
  const router = useRouter()
  useEffect(() => {
    const slug = window.location.hash.replace(/^#/, '')
    if (isFaqSlug(slug)) router.replace(`/faq/${slug}`)
  }, [router])
  return null
}
