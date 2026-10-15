import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api } from '@/lib/api'
import { ExoticMethods } from './exotic-methods'
import { ExoticSummary } from './exotic-summary'
import { DEFAULT_EXOTIC, type ExoticParams, toRequest } from './params'
import { PathsChart } from './paths-chart'
import { ProductPanel } from './product-panel'
import { ProfileChart } from './profile-chart'

function productTitle(p: ExoticParams): string {
  switch (p.product) {
    case 'digital':
      return `${p.payout}-or-nothing ${p.kind}`
    case 'barrier':
      return `${p.direction}-and-${p.knock} ${p.kind}`
    case 'asian':
      return `${p.averaging} Asian ${p.kind}, ${p.strikeType} strike`
    case 'lookback':
      return `${p.strikeType}-strike lookback ${p.kind}`
  }
}

export default function ExoticPricerPage() {
  const [params, setParams] = useState(DEFAULT_EXOTIC)
  const settled = useDebouncedValue(params, 250)
  const request = useMemo(() => toRequest(settled), [settled])
  const price = useQuery({
    queryKey: ['exotics', 'price', request],
    queryFn: ({ signal }) => api.exoticPrice(request, signal),
    placeholderData: keepPreviousData,
  })
  const profile = useQuery({
    queryKey: ['exotics', 'profile', request],
    queryFn: ({ signal }) => api.exoticProfile(request, signal),
    placeholderData: keepPreviousData,
  })
  const paths = useQuery({
    queryKey: ['exotics', 'paths', request],
    queryFn: ({ signal }) => api.exoticPaths(request, signal),
    placeholderData: keepPreviousData,
  })
  const error = price.error ?? profile.error ?? paths.error

  return (
    <>
      <PageHeader title="Exotic options">
        Options whose payoff depends on the path, not just the final price. Compare each with its
        plain vanilla counterpart, see which methods can price it, and watch the payoff rule act on
        simulated paths.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <ProductPanel params={params} onChange={setParams} />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Pricing failed</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <ExoticSummary
            data={price.data}
            stale={price.isPlaceholderData}
            title={productTitle(settled)}
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <ProfileChart data={profile.data} stale={profile.isPlaceholderData} params={settled} />
            <PathsChart data={paths.data} stale={paths.isPlaceholderData} params={settled} />
          </div>
          <ExoticMethods data={price.data} stale={price.isPlaceholderData} />
        </div>
      </div>
    </>
  )
}
