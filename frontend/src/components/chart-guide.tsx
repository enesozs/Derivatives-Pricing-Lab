import { ChevronDownIcon, LightbulbIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { chapterForGuide, guideForPath, regionGuide } from '@/content/guides'
import { cn } from '@/lib/utils'

/** "How to read this chart" (or table): the page guide's explanation for a card, on demand. */
export function ChartGuide({
  heading,
  noun = 'chart',
}: {
  heading: string
  noun?: 'chart' | 'table' | 'card'
}) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const id = useId()
  const region = regionGuide(pathname, heading)
  if (!region) return null
  const page = guideForPath(pathname)
  const chapter = page && chapterForGuide(page.id)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 self-start rounded text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LightbulbIcon className="size-3.5" aria-hidden="true" />
        How to read this {noun}
        <ChevronDownIcon
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <p>{region.what}</p>
          <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
            {region.read.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {region.try && (
            <p>
              <span className="font-medium">Try: </span>
              <span className="text-muted-foreground">{region.try}</span>
            </p>
          )}
          {page && chapter && (
            <Link
              to={`/learn/${chapter}#${page.id}`}
              className="self-start text-xs underline underline-offset-4 hover:text-foreground"
            >
              Tour of this page
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
