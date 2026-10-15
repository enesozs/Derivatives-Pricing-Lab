import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PageFallback } from '@/components/page-fallback'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import {
  loadAutocallable,
  loadCliquet,
  loadReverseConvertible,
  loadRisk,
  loadVariance,
} from './pages'

const TABS = [
  { to: '/structured', label: 'Autocallables', preload: loadAutocallable, end: true },
  {
    to: '/structured/reverse-convertible',
    label: 'Reverse convertibles',
    preload: loadReverseConvertible,
    end: false,
  },
  { to: '/structured/cliquet', label: 'Cliquets', preload: loadCliquet, end: false },
  { to: '/structured/variance', label: 'Variance swaps', preload: loadVariance, end: false },
  { to: '/structured/risk', label: 'Portfolio risk', preload: loadRisk, end: false },
]

const tabClassName = segmentedControlItemVariants({ state: 'current' })

export function StructuredLayout() {
  return (
    <>
      <nav
        aria-label="Structured products"
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
