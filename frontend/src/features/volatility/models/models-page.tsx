import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type ModelParams } from '@/lib/api'
import { DensityChart, SmilesChart } from './model-charts'
import { ModelPanel } from './model-panel'
import { DEFAULT_MODEL_PARAMS, EXPIRIES, type ModelId } from './params'

const SPOT = 100

export default function ModelsPage() {
  const [model, setModel] = useState<ModelId>('heston')
  const [params, setParams] = useState<Record<ModelId, ModelParams>>(DEFAULT_MODEL_PARAMS)
  const settled = useDebouncedValue(params[model], 120)
  const request = useMemo(
    () => ({ params: settled, spot: SPOT, rate: 0.03, dividend_yield: 0, expiries: EXPIRIES }),
    [settled],
  )
  const query = useQuery({
    queryKey: ['volatility', 'model-smile', request],
    queryFn: ({ signal }) => api.modelSmile(request, signal),
    placeholderData: keepPreviousData,
  })
  const stale = query.isPlaceholderData

  return (
    <>
      <PageHeader title="Volatility models">
        Black–Scholes assumes one volatility; markets disagree. Move each model’s parameters and
        watch the smile and the distribution of future prices change.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <ModelPanel
            model={model}
            params={params[model]}
            onModelChange={setModel}
            onParamsChange={(next) => setParams({ ...params, [model]: next })}
          />
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Pricing failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <SmilesChart data={query.data} stale={stale} spot={SPOT} />
          <DensityChart data={query.data} stale={stale} spot={SPOT} />
        </div>
      </div>
    </>
  )
}
