import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { type AreaTab, AreaNav } from '@/components/area-nav'
import { PageFallback } from '@/components/page-fallback'
import { loadHedging, loadImpliedVol, loadMethods, loadPricer, loadStrategies } from './pages'

const TABS: AreaTab[] = [
  { to: '/vanilla', label: 'Pricer', preload: loadPricer, end: true },
  { to: '/vanilla/implied-vol', label: 'Implied volatility', preload: loadImpliedVol, end: false },
  { to: '/vanilla/methods', label: 'Trees & grids', preload: loadMethods, end: false },
  { to: '/vanilla/strategies', label: 'Strategies', preload: loadStrategies, end: false },
  { to: '/vanilla/hedging', label: 'Hedging', preload: loadHedging, end: false },
]

export function VanillaLayout() {
  return (
    <>
      <AreaNav label="Vanilla options" tabs={TABS} chapter="01-vanilla-options" />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}
