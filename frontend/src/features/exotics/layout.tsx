import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { type AreaTab, AreaNav } from '@/components/area-nav'
import { PageFallback } from '@/components/page-fallback'
import { loadAmerican, loadExoticPricer } from './pages'

const TABS: AreaTab[] = [
  { to: '/exotics', label: 'Exotic pricer', preload: loadExoticPricer, end: true },
  { to: '/exotics/american', label: 'American by simulation', preload: loadAmerican, end: false },
]

export function ExoticsLayout() {
  return (
    <>
      <AreaNav label="Exotics" tabs={TABS} chapter="03-exotics" />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}
