import { CREDIT } from './credit'
import { EXOTICS } from './exotics'
import { MULTI_ASSET } from './multi-asset'
import { RATES } from './rates'
import { STRUCTURED } from './structured'
import { type PageGuide, type RegionGuide, regionMatches } from './types'
import { VANILLA } from './vanilla'
import { VOLATILITY } from './volatility'

export type { PageGuide, RegionGuide }
export { regionMatches }

export const PAGE_GUIDES: PageGuide[] = [
  ...VANILLA,
  ...VOLATILITY,
  ...EXOTICS,
  ...MULTI_ASSET,
  ...RATES,
  ...STRUCTURED,
  ...CREDIT,
]

export function guideForPath(path: string): PageGuide | undefined {
  const clean = path.replace(/\/+$/, '') || '/'
  return PAGE_GUIDES.find((g) => g.path === clean)
}

export function guideById(id: string): PageGuide | undefined {
  return PAGE_GUIDES.find((g) => g.id === id)
}

/** The guide for a chart on the current page, matched by its heading. */
export function regionGuide(path: string, heading: string): RegionGuide | undefined {
  return guideForPath(path)?.regions.find((r) => regionMatches(r, heading))
}

/** Learn chapter for each area (guide ids start with the area name). */
const CHAPTER_BY_AREA: Record<string, string> = {
  vanilla: '01-vanilla-options',
  volatility: '02-volatility',
  exotics: '03-exotics',
  'multi-asset': '04-multi-asset',
  rates: '05-rates',
  structured: '06-structured',
  credit: '07-credit',
}

export function chapterForGuide(id: string): string | undefined {
  const area = Object.keys(CHAPTER_BY_AREA).find((a) => id.startsWith(`${a}-`))
  return area ? CHAPTER_BY_AREA[area] : undefined
}

export function guidesForChapter(chapterId: string): PageGuide[] {
  return PAGE_GUIDES.filter((g) => chapterForGuide(g.id) === chapterId)
}
