import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { type AreaTab, AreaNav } from '@/components/area-nav'
import { PageFallback } from '@/components/page-fallback'
import { loadCds, loadXva } from './pages'

const TABS: AreaTab[] = [
  { to: '/credit', label: 'CDS & default curves', preload: loadCds, end: true },
  { to: '/credit/xva', label: 'Counterparty risk (xVA)', preload: loadXva, end: false },
]

export function CreditLayout() {
  return (
    <>
      <AreaNav label="Credit" tabs={TABS} chapter="07-credit" />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}
