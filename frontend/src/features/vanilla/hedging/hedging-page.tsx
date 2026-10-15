import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api } from '@/lib/api'
import { FrequencyChart, PnlHistogram, SamplePaths } from './hedging-charts'
import { HedgingPanel } from './hedging-panel'
import { HedgingSummary } from './hedging-summary'
import { DEFAULT_HEDGE, toRequest } from './params'

export default function HedgingPage() {
  const [params, setParams] = useState(DEFAULT_HEDGE)
  const settled = useDebouncedValue(params, 300)
  const request = useMemo(() => toRequest(settled), [settled])
  const query = useQuery({
    queryKey: ['hedging', 'delta', request],
    queryFn: ({ signal }) => api.deltaHedge(request, signal),
    placeholderData: keepPreviousData,
  })
  const stale = query.isPlaceholderData

  return (
    <>
      <PageHeader title="Delta hedging">
        Sell an option, then trade the underlying to cancel its delta. Black–Scholes says continuous
        hedging removes all risk; here you can see what discrete trading, transaction costs and the
        wrong volatility do to that promise.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <HedgingPanel params={params} onChange={setParams} />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Simulation failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <HedgingSummary data={query.data} stale={stale} />
          <div className="grid gap-6 xl:grid-cols-2">
            <PnlHistogram data={query.data} stale={stale} />
            <FrequencyChart data={query.data} stale={stale} />
          </div>
          <SamplePaths data={query.data} stale={stale} />
        </div>
      </div>
    </>
  )
}
