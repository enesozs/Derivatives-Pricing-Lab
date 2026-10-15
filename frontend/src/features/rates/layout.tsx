import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { type AreaTab, AreaNav } from '@/components/area-nav'
import { PageFallback } from '@/components/page-fallback'
import { CurveProvider } from './curve-context'
import { loadCurves, loadLinear, loadModels, loadOptions } from './pages'

const TABS: AreaTab[] = [
  { to: '/rates', label: 'Curves', preload: loadCurves, end: true },
  { to: '/rates/linear', label: 'Swaps & bonds', preload: loadLinear, end: false },
  { to: '/rates/options', label: 'Caps & swaptions', preload: loadOptions, end: false },
  { to: '/rates/models', label: 'Short-rate models', preload: loadModels, end: false },
]

export function RatesLayout() {
  return (
    <CurveProvider>
      <AreaNav label="Rates" tabs={TABS} chapter="05-rates" />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </CurveProvider>
  )
}
