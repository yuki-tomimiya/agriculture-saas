import { adviceNames } from '@/lib/crops/conditions'
import { pests } from '@/lib/pests/catalog'
import { milestoneFormItems, type MilestoneRecord } from '@/lib/proposals/milestones'

const observationLabels: Record<string, string> = {
  'onion-lodging': '葉が倒れてきた',
  'cabbage-heading': '中の葉が内側に巻いて、球ができ始めた',
  'cabbage-firm': '球を軽く押すと、しまってきた',
  'lettuce-outer-leaves': '外の葉が外へ開いて、反ってきた',
  'spinach-height': '草丈が25cmくらいになった',
  'komatsuna-height': '草丈が25cmくらいになった',
  'negi-final-hilling': '最後の土寄せをした',
  'edamame-flower': '半分くらいの株で花が咲き始めた',
  'broccoli-bud': '半分くらいの株で、真ん中のつぼみが直径2cmくらいに見えてきた',
  'flower-1st': 'いちばん下の花のかたまり（第1花房）が咲いた',
  'flower-3rd': '下から3段目の花のかたまりが咲いた（いちばん下の実がピンポン玉くらいのころ）',
  silk: '実の先からひげ（絹糸）が出てきた',
  rooting: '苗が根付いて、葉が立ってきた',
  'test-dig': '試し掘りをして、イモの太りを見た',
  'first-fruit': '最初の実（1番果）がふくらみ始めた',
  'main-stem': '主枝が支柱の高さまで伸びた',
  'side-shoot': 'わき芽が伸び始めた（1番果がつくころ）',
  'pepper-feed': '収穫が始まった',
  sprout: '芽が出そろった（芽が10cmくらい）',
  bud: 'つぼみが見えてきた',
  yellowing: '茎や葉が黄色く枯れてきた',
}

export function fieldObservationOptions(crop: {
  cropKind: string | null
  name: string
  variety: string | null
  milestones: MilestoneRecord[]
}) {
  const subject = adviceNames(crop)
  if (subject.recordOnly) return { milestones: [], pests: [] }
  return {
    milestones: milestoneFormItems(subject.name, subject.variety, crop.milestones)
      .filter(item => item.sourceLabel && item.ifYes)
      .map(item => ({ ...item, label: observationLabels[item.key] ?? item.term })),
    pests: pests.filter(pest => pest.cropKind === crop.cropKind).map(pest => ({
      key: pest.key, name: pest.name, marker: pest.marker, appearanceUrl: pest.appearance?.url,
    })),
  }
}
