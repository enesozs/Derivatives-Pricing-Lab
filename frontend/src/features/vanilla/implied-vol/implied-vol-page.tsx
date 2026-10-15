import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api } from '@/lib/api'
import { HowItWorks } from './how-it-works'
import { ImpliedVolPanel } from './implied-vol-panel'
import { ImpliedVolSummary } from './implied-vol-summary'
import { DEFAULT_IV_PARAMS, toRequest } from './params'
import { PriceVolChart } from './price-vol-chart'

export default function ImpliedVolPage() {
  const [params, setParams] = useState(DEFAULT_IV_PARAMS)
  const settled = useDebouncedValue(params, 150)
  const request = useMemo(() => toRequest(settled), [settled])
  const query = useQuery({
    queryKey: ['vanilla', 'implied-vol', request],
    queryFn: ({ signal }) => api.impliedVol(request, signal),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader title="Implied volatility">
        Enter the price an option trades at and recover the volatility the market is implying.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <ImpliedVolPanel params={params} onChange={setParams} />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Request failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <ImpliedVolSummary
            price={settled.price}
            data={query.data}
            stale={query.isPlaceholderData}
          />
          <PriceVolChart price={settled.price} data={query.data} stale={query.isPlaceholderData} />
          <HowItWorks />
        </div>
      </div>
    </>
  )
}
