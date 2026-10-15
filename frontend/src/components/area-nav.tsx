import { BookOpenIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'

export interface AreaTab {
  to: string
  label: string
  /** Starts loading the page's code on hover/focus, so the click feels instant. */
  preload: () => Promise<unknown>
  /** Match the path exactly (the area's index page). */
  end: boolean
}

const tabClassName = segmentedControlItemVariants({ state: 'current' })

/** An area's page tabs, with a link to the matching Learn chapter. */
export function AreaNav({
  label,
  tabs,
  chapter,
}: {
  label: string
  tabs: AreaTab[]
  chapter: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label={label}
        className={`${segmentedControlRootClassName} max-w-full overflow-x-auto`}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={tabClassName}
            onMouseEnter={() => void tab.preload()}
            onFocus={() => void tab.preload()}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Link
        to={`/learn/${chapter}`}
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <BookOpenIcon className="size-4" aria-hidden="true" />
        Learn this area
      </Link>
    </div>
  )
}
