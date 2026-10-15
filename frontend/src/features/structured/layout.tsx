import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { type AreaTab, AreaNav } from '@/components/area-nav'
import { PageFallback } from '@/components/page-fallback'
import {
  loadAutocallable,
  loadCliquet,
  loadReverseConvertible,
  loadRisk,
  loadVariance,
} from './pages'

const TABS: AreaTab[] = [
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

export function StructuredLayout() {
  return (
    <>
      <AreaNav label="Structured products" tabs={TABS} chapter="06-structured" />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </>
  )
}
