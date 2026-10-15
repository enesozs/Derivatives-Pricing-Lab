import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PageFallback } from '@/components/page-fallback'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import { loadCalibration, loadModels, loadSurface } from './pages'
import { VolSourceProvider } from './source-context'

const TABS = [
  { to: '/volatility', label: 'Surface', preload: loadSurface, end: true },
  { to: '/volatility/models', label: 'Models', preload: loadModels, end: false },
  { to: '/volatility/calibration', label: 'Calibration', preload: loadCalibration, end: false },
]

const tabClassName = segmentedControlItemVariants({ state: 'current' })

export function VolatilityLayout() {
  return (
    <VolSourceProvider>
      <nav
        aria-label="Volatility"
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
    </VolSourceProvider>
  )
}
