import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PageFallback } from '@/components/page-fallback'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import { loadCorrelation, loadQuanto } from './pages'

const TABS = [
  { to: '/multi-asset', label: 'Correlation lab', preload: loadCorrelation, end: true },
  { to: '/multi-asset/quanto', label: 'Quanto', preload: loadQuanto, end: false },
]

const tabClassName = segmentedControlItemVariants({ state: 'current' })

export function MultiAssetLayout() {
  return (
    <>
      <nav
        aria-label="Multi-asset"
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
