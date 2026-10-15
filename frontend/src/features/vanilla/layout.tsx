import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PageFallback } from '@/components/page-fallback'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import { loadHedging, loadImpliedVol, loadMethods, loadPricer, loadStrategies } from './pages'

const TABS = [
  { to: '/vanilla', label: 'Pricer', preload: loadPricer, end: true },
  { to: '/vanilla/implied-vol', label: 'Implied volatility', preload: loadImpliedVol, end: false },
  { to: '/vanilla/methods', label: 'Trees & grids', preload: loadMethods, end: false },
  { to: '/vanilla/strategies', label: 'Strategies', preload: loadStrategies, end: false },
  { to: '/vanilla/hedging', label: 'Hedging', preload: loadHedging, end: false },
]

const tabClassName = segmentedControlItemVariants({ state: 'current' })

export function VanillaLayout() {
  return (
    <>
      <nav
        aria-label="Vanilla options"
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
