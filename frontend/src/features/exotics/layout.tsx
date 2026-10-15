import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PageFallback } from '@/components/page-fallback'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import { loadAmerican, loadExoticPricer } from './pages'

const TABS = [
  { to: '/exotics', label: 'Exotic pricer', preload: loadExoticPricer, end: true },
  { to: '/exotics/american', label: 'American by simulation', preload: loadAmerican, end: false },
]

const tabClassName = segmentedControlItemVariants({ state: 'current' })

export function ExoticsLayout() {
  return (
    <>
      <nav
        aria-label="Exotics"
        className={`${segmentedControlRootClassName} mb-6 max-w-full overflow-x-auto`}
      >
        {TABS.map((tab) => (
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
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}
