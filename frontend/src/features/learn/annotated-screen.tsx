import { type RegionGuide, regionMatches } from '@/content/guides'
import { cn } from '@/lib/utils'
import screens from './screens.json'

interface Screen {
  path: string
  width: number
  height: number
  regions: { key: string; box: number[] }[]
}

const SCREENS = screens as Record<string, Screen>

/** Where a guide region sits on the screenshot, as % of the image. */
export function regionBox(screenId: string, region: RegionGuide) {
  const screen = SCREENS[screenId]
  const found = screen?.regions.find((r) =>
    region.key === 'panel' || region.key === 'hero'
      ? r.key === region.key
      : regionMatches(region, r.key),
  )
  if (!screen || !found) return null
  const [x, y, w, h] = found.box
  return {
    left: `${(x / screen.width) * 100}%`,
    top: `${(y / screen.height) * 100}%`,
    width: `${(w / screen.width) * 100}%`,
    height: `${(h / screen.height) * 100}%`,
  }
}

/** A page screenshot with numbered outlines over the regions a guide explains. */
export function AnnotatedScreen({
  screenId,
  regions,
  active,
  onActive,
  alt,
}: {
  screenId: string
  regions: RegionGuide[]
  active: number | null
  onActive: (i: number | null) => void
  alt: string
}) {
  const screen = SCREENS[screenId]
  if (!screen) return null
  return (
    <figure className="relative overflow-hidden rounded-xl border bg-white shadow-sm">
      <img
        src={`/learn/${screenId}.jpg`}
        alt={alt}
        width={screen.width}
        height={screen.height}
        loading="lazy"
        className="block h-auto w-full"
      />
      {regions.map((region, i) => {
        const box = regionBox(screenId, region)
        if (!box) return null
        const on = active === i
        return (
          <button
            key={region.key + i}
            type="button"
            aria-label={`${i + 1}. ${region.label}`}
            onMouseEnter={() => onActive(i)}
            onMouseLeave={() => onActive(null)}
            onFocus={() => onActive(i)}
            onBlur={() => onActive(null)}
            onClick={() =>
              document
                .getElementById(`${screenId}-${i}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            style={box}
            className={cn(
              'absolute rounded-lg border-2 transition-colors',
              on ? 'border-[#eb6834] bg-[#eb6834]/10' : 'border-[#2a78d6]/70 hover:bg-[#2a78d6]/5',
            )}
          >
            <span
              className={cn(
                'absolute -top-2.5 -left-2.5 flex size-6 items-center justify-center rounded-full font-semibold text-[11px] text-white shadow',
                on ? 'bg-[#eb6834]' : 'bg-[#2a78d6]',
              )}
            >
              {i + 1}
            </span>
          </button>
        )
      })}
    </figure>
  )
}
