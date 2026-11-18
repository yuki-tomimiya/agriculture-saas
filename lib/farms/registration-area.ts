export type FarmArea = { prefectureCode: string; municipalityCode: string }

export function initialFarmArea(saveArea: FarmArea, mapArea: FarmArea, stationPrefecture: string): FarmArea {
  if (saveArea.municipalityCode) return saveArea
  if (mapArea.municipalityCode) return mapArea
  return { prefectureCode: stationPrefecture, municipalityCode: '' }
}
