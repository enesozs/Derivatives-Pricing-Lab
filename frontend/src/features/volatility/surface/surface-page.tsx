import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api } from '@/lib/api'
import { DataBanner } from '../data-banner'
import { useVolSource } from '../source-context'
import { SourcePanel } from '../source-panel'
import { QualityTable } from './quality-table'
import { SmileChart } from './smile-chart'
import { Surface3D } from './surface-3d'
import { TermStructureChart } from './term-structure-chart'

export default function SurfacePage() {
  const { source } = useVolSource()
  const settled = useDebouncedValue(source, 250)
  const [expiry, setExpiry] = useState(3)
  const query = useQuery({
    queryKey: ['volatility', 'surface', settled],
    queryFn: ({ signal }) => api.volSurface(settled, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
  const stale = query.isPlaceholderData || query.isFetching

  return (
    <>
      <PageHeader title="Implied volatility surface">
        Real option prices imply a different volatility for every strike and expiry. Clean the
        quotes, fit a smile to each expiry, and assemble the surface the rest of the lab prices
        against.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <SourcePanel />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Could not build the surface</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <DataBanner meta={query.data?.meta} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SmileChart
              slices={query.data?.slices}
              selected={expiry}
              onSelect={setExpiry}
              stale={stale}
            />
            <TermStructureChart slices={query.data?.slices} stale={stale} />
          </div>
          <Surface3D grid={query.data?.grid} stale={stale} />
          <QualityTable data={query.data} stale={stale} />
        </div>
      </div>
    </>
  )
}
