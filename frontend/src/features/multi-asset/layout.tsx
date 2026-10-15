import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { type AreaTab, AreaNav } from '@/components/area-nav'
import { PageFallback } from '@/components/page-fallback'
import { loadCorrelation, loadQuanto } from './pages'

const TABS: AreaTab[] = [
  { to: '/multi-asset', label: 'Correlation lab', preload: loadCorrelation, end: true },
  { to: '/multi-asset/quanto', label: 'Quanto', preload: loadQuanto, end: false },
]

export function MultiAssetLayout() {
  return (
    <>
      <AreaNav label="Multi-asset" tabs={TABS} chapter="04-multi-asset" />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}
