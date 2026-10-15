import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PageFallback } from '@/components/page-fallback'
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from '@/lib/segmented-control'
import { loadCds, loadXva } from './pages'

const TABS = [
  { to: '/credit', label: 'CDS & default curves', preload: loadCds, end: true },
  { to: '/credit/xva', label: 'Counterparty risk (xVA)', preload: loadXva, end: false },
]

const tabClassName = segmentedControlItemVariants({ state: 'current' })

export function CreditLayout() {
  return (
    <>
      <nav
        aria-label="Credit"
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
