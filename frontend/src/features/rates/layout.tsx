import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PageFallback } from '@/components/page-fallback'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import { CurveProvider } from './curve-context'
import { loadCurves, loadLinear, loadModels, loadOptions } from './pages'

const TABS = [
  { to: '/rates', label: 'Curves', preload: loadCurves, end: true },
  { to: '/rates/linear', label: 'Swaps & bonds', preload: loadLinear, end: false },
  { to: '/rates/options', label: 'Caps & swaptions', preload: loadOptions, end: false },
  { to: '/rates/models', label: 'Short-rate models', preload: loadModels, end: false },
]

const tabClassName = segmentedControlItemVariants({ state: 'current' })

export function RatesLayout() {
  return (
    <CurveProvider>
      <nav
        aria-label="Rates"
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
    </CurveProvider>
  )
}
