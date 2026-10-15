import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type CalibrationModel } from '@/lib/api'
import { DataBanner } from '../data-banner'
import { useVolSource } from '../source-context'
import { SourcePanel } from '../source-panel'
import { CalibrationSummary } from './calibration-summary'
import { FitGrid } from './fit-grid'

export default function CalibrationPage() {
  const { source } = useVolSource()
  const [model, setModel] = useState<CalibrationModel>('heston')
  const [beta, setBeta] = useState(1)
  const settledBeta = useDebouncedValue(beta, 250)
  const settledSource = useDebouncedValue(source, 250)
  const request = useMemo(
    () => ({ ...settledSource, model, beta: settledBeta }),
    [settledSource, model, settledBeta],
  )
  const query = useQuery({
    queryKey: ['volatility', 'calibrate', request],
    queryFn: ({ signal }) => api.calibrate(request, signal),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
  // The data banner reuses the (cached) surface request for the same source.
  const surface = useQuery({
    queryKey: ['volatility', 'surface', settledSource],
    queryFn: ({ signal }) => api.volSurface(settledSource, signal),
    staleTime: 5 * 60_000,
  })
  const stale = query.isPlaceholderData || query.isFetching

  return (
    <>
      <PageHeader title="Model calibration">
        Find the model parameters that best reproduce the market’s implied volatilities. This is how
        a model is made consistent with prices before it is trusted with exotics.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <SourcePanel>
            <PanelSection
              title="Model to calibrate"
              hint={
                model === 'heston'
                  ? 'Five parameters for the whole surface, fitted by least squares on vega-scaled price errors.'
                  : 'Three parameters per expiry with β fixed; fitted directly to implied volatilities.'
              }
            >
              <Segmented<CalibrationModel>
                label="Model"
                value={model}
                onChange={setModel}
                options={[
                  { value: 'heston', label: 'Heston' },
                  { value: 'sabr', label: 'SABR' },
                ]}
                className="w-full"
              />
              {model === 'sabr' && (
                <ParamControl
                  label="Backbone β (fixed)"
                  value={beta}
                  onChange={setBeta}
                  min={0}
                  max={1}
                  step={0.05}
                  digits={2}
                />
              )}
            </PanelSection>
          </SourcePanel>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Calibration failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <DataBanner meta={surface.data?.meta} />
          <CalibrationSummary data={query.data} stale={stale} />
          <FitGrid data={query.data} stale={stale} />
        </div>
      </div>
    </>
  )
}
