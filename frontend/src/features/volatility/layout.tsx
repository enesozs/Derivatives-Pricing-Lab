import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { type AreaTab, AreaNav } from '@/components/area-nav'
import { PageFallback } from '@/components/page-fallback'
import { loadCalibration, loadModels, loadSurface } from './pages'
import { VolSourceProvider } from './source-context'

const TABS: AreaTab[] = [
  { to: '/volatility', label: 'Surface', preload: loadSurface, end: true },
  { to: '/volatility/models', label: 'Models', preload: loadModels, end: false },
  { to: '/volatility/calibration', label: 'Calibration', preload: loadCalibration, end: false },
]

export function VolatilityLayout() {
  return (
    <VolSourceProvider>
      <AreaNav label="Volatility" tabs={TABS} chapter="02-volatility" />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </VolSourceProvider>
  )
}
