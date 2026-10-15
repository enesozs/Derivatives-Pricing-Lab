import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { api, type SourceKind } from '@/lib/api'
import { useVolSource } from './source-context'

const SOURCE_HINTS: Record<SourceKind, string> = {
  snapshot: 'A real SPY option chain saved with the app: reproducible and works offline.',
  synthetic:
    'Generated from a known Heston model, so calibration can be checked against the truth.',
  live: 'Downloaded now from Yahoo Finance (delayed). Outside US market hours only last trades exist.',
}

/** Where the option data comes from, plus the discount rate used when cleaning it. */
export function SourcePanel({ children }: { children?: React.ReactNode }) {
  const { source, setSource } = useVolSource()
  const [ticker, setTicker] = useState(source.ticker)
  const sources = useQuery({
    queryKey: ['volatility', 'sources'],
    queryFn: ({ signal }) => api.volSources(signal),
  })
  const liveAvailable = sources.data?.live_available ?? true

  return (
    <Card className="overflow-hidden">
      <PanelSection title="Market data" hint={SOURCE_HINTS[source.source]}>
        <Segmented<SourceKind>
          label="Data source"
          value={source.source}
          onChange={(value) => setSource({ ...source, source: value })}
          options={[
            { value: 'snapshot', label: 'SPY snapshot' },
            { value: 'synthetic', label: 'Synthetic' },
            { value: 'live', label: 'Live', disabled: !liveAvailable },
          ]}
          className="w-full"
        />
        {source.source === 'live' && (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setSource({ ...source, ticker: ticker.trim().toUpperCase() || 'SPY' })
            }}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="ticker" className="font-normal text-muted-foreground text-xs">
                Ticker with listed options
              </Label>
              <Input
                id="ticker"
                value={ticker}
                maxLength={10}
                onChange={(event) => setTicker(event.target.value)}
                placeholder="SPY"
                size="sm"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              <RefreshCwIcon /> Load
            </Button>
          </form>
        )}
      </PanelSection>
      <Separator />
      <PanelSection
        title="Discounting"
        hint="Forwards come from put–call parity; this rate only discounts."
      >
        <ParamControl
          label="Risk-free rate"
          value={Math.round(source.rate * 10000) / 100}
          onChange={(value) => setSource({ ...source, rate: value / 100 })}
          min={0}
          max={10}
          step={0.25}
          unit="%"
          digits={2}
        />
      </PanelSection>
      {children && (
        <>
          <Separator />
          {children}
        </>
      )}
    </Card>
  )
}
