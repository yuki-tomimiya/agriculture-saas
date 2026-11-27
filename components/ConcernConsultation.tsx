import type { PestForecastOffice } from '@/lib/pest-forecast'

export default function ConcernConsultation({ forecast }: { forecast: PestForecastOffice | null }) {
  return <section className="min-w-0 space-y-1 [overflow-wrap:anywhere]" aria-label="相談先">
    <p className="font-semibold">相談先</p>
    {forecast && <p><a className="underline" href={forecast.url}>{forecast.officeName}</a></p>}
    <p>近くの普及指導センターや JA の営農指導員に、この記録（日付・場所・様子・写真）を見せて相談できます。</p>
  </section>
}
