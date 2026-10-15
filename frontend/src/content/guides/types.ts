/** Page guides: how to use and read each page of the lab. Shared by the Learn tours (with
 * annotated screenshots) and the "How to read this chart" toggle on every chart. */

export interface RegionGuide {
  /** Region on the page: "panel" (inputs), "hero" (headline result) or a card's heading. */
  key: string
  /** How `key` matches a heading: exactly (default), or as its start or end (dynamic headings). */
  match?: 'exact' | 'prefix' | 'suffix'
  /** Other headings the same card can show (e.g. a Greek selector renames the chart). */
  aliases?: string[]
  /** Short name used in the tour. */
  label: string
  /** What the region shows: axes, colours, units. */
  what: string
  /** How to read it: what to look at first, what a typical picture means. */
  read: string[]
  /** One thing to try on the page. */
  try?: string
}

export interface PageGuide {
  /** Screenshot id (frontend/public/learn/<id>.jpg; regions in features/learn/screens.json). */
  id: string
  path: string
  title: string
  /** What the page is for, in one or two sentences. */
  purpose: string
  /** A typical way to use it, step by step. */
  workflow: string[]
  regions: RegionGuide[]
}

export function regionMatches(region: RegionGuide, heading: string): boolean {
  if (region.aliases?.includes(heading)) return true
  if (region.match === 'prefix') return heading.startsWith(region.key)
  if (region.match === 'suffix') return heading.endsWith(region.key)
  return heading === region.key
}
