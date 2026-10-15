import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api } from '@/lib/api'
import { LegsTable } from './legs-table'
import { DEFAULT_STRATEGY, toRequest } from './params'
import { PnlChart } from './pnl-chart'
import { ScenarioHeatmap } from './scenario-heatmap'
import { StrategyPanel } from './strategy-panel'
import { StrategySummary } from './strategy-summary'

export default function StrategiesPage() {
  const [params, setParams] = useState(DEFAULT_STRATEGY)
  const settled = useDebouncedValue(params, 200)
  const request = useMemo(() => toRequest(settled), [settled])
  const empty = request.legs.length === 0 && request.underlying_quantity === 0
  const query = useQuery({
    queryKey: ['strategies', request],
    queryFn: ({ signal }) => api.strategy(request, signal),
    placeholderData: keepPreviousData,
    enabled: !empty,
  })

  return (
    <>
      <PageHeader title="Option strategies">
        Combine calls, puts and the underlying into one position. See what it costs, where it makes
        or loses money, and how its Greeks add up.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside>
          <StrategyPanel params={params} onChange={setParams} />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {empty ? (
            <Alert variant="info">
              <AlertTitle>Add a leg to get started</AlertTitle>
              <AlertDescription>Pick a preset or add legs one by one.</AlertDescription>
            </Alert>
          ) : query.error ? (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Pricing failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <StrategySummary data={empty ? undefined : query.data} stale={query.isPlaceholderData} />
          <PnlChart
            spot={settled.spot}
            data={empty ? undefined : query.data}
            stale={query.isPlaceholderData}
          />
          <ScenarioHeatmap
            request={request}
            horizon={query.data?.horizon ?? 0}
            enabled={!empty && query.isSuccess}
          />
          <LegsTable
            params={settled}
            data={empty ? undefined : query.data}
            stale={query.isPlaceholderData}
          />
        </div>
      </div>
    </>
  )
}
