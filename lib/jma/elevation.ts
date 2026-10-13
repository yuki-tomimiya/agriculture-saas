const cache = new Map<string, number | null>()

/** 農場の標高。Open-Meteo の標高だけを見る。気象庁には取りに行かない。 */
export async function farmElevationM(lat: number, lon: number): Promise<number | null> {
  const key = `${lat.toFixed(4)}|${lon.toFixed(4)}`
  if (cache.has(key)) return cache.get(key) ?? null
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
    const res = await fetch(url)
    if (!res.ok) {
      cache.set(key, null)
      return null
    }
    const json = (await res.json()) as { elevation?: number[] }
    const value = json.elevation?.[0]
    const elevation = value == null || Number.isNaN(value) ? null : value
    cache.set(key, elevation)
    return elevation
  } catch {
    cache.set(key, null)
    return null
  }
}
