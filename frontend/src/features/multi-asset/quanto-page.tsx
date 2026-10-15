import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type OptionKind } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CorrelationChart } from './correlation-chart'

interface Params {
  kind: OptionKind
  strike: number
  expiry: number
  spot: number
  domesticPct: number
  foreignPct: number
  dividendPct: number
  assetVolPct: number
  fxVolPct: number
  correlation: number
}

const DEFAULTS: Params = {
  kind: 'call',
  strike: 100,
  expiry: 1,
  spot: 100,
  domesticPct: 5,
  foreignPct: 2,
  dividendPct: 1,
  assetVolPct: 25,
  fxVolPct: 12,
  correlation: 0.4,
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card p-3.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold text-lg tracking-tight">{value}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  )
}

export default function QuantoPage() {
  const [params, setParams] = useState(DEFAULTS)
  const settled = useDebouncedValue(params, 200)
  const request = useMemo(
    () => ({
      kind: settled.kind,
      strike: settled.strike,
      expiry: settled.expiry,
      spot: settled.spot,
      domestic_rate: settled.domesticPct / 100,
      foreign_rate: settled.foreignPct / 100,
      dividend_yield: settled.dividendPct / 100,
      asset_volatility: settled.assetVolPct / 100,
      fx_volatility: settled.fxVolPct / 100,
      correlation: settled.correlation,
      fixed_fx: 1,
      mc_paths: 100_000,
    }),
    [settled],
  )
  const query = useQuery({
    queryKey: ['multi-asset', 'quanto', request],
    queryFn: ({ signal }) => api.quanto(request, signal),
    placeholderData: keepPreviousData,
  })
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })
  const data = query.data
  const stale = query.isPlaceholderData

  return (
    <>
      <PageHeader title="Quanto options">
        An option on a foreign stock, paid in your own currency at a fixed exchange rate. You don’t
        take the currency risk, but the dealer who hedges it does, and the correlation between the
        stock and the currency shows up in the price.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Contract"
              hint="Payoff in domestic currency: 1 × max(S_T − K, 0), with S in foreign currency."
            >
              <Segmented<OptionKind>
                label="Option type"
                value={params.kind}
                onChange={set('kind')}
                options={[
                  { value: 'call', label: 'Call' },
                  { value: 'put', label: 'Put' },
                ]}
                className="w-full"
              />
              <ParamControl
                label="Strike"
                value={params.strike}
                onChange={set('strike')}
                min={50}
                max={150}
                step={1}
              />
              <ParamControl
                label="Time to expiry"
                value={params.expiry}
                onChange={set('expiry')}
                min={0.1}
                max={5}
                step={0.05}
                unit="yrs"
                digits={2}
              />
            </PanelSection>
            <Separator />
            <PanelSection title="Foreign asset">
              <ParamControl
                label="Spot (foreign ccy)"
                value={params.spot}
                onChange={set('spot')}
                min={50}
                max={150}
                step={1}
              />
              <ParamControl
                label="Volatility"
                value={params.assetVolPct}
                onChange={set('assetVolPct')}
                min={5}
                max={80}
                step={1}
                unit="%"
              />
              <ParamControl
                label="Dividend yield"
                value={params.dividendPct}
                onChange={set('dividendPct')}
                min={0}
                max={10}
                step={0.25}
                unit="%"
                digits={2}
              />
            </PanelSection>
            <Separator />
            <PanelSection
              title="Currencies"
              hint="FX rate quoted as domestic per unit of foreign currency."
            >
              <ParamControl
                label="Domestic rate"
                value={params.domesticPct}
                onChange={set('domesticPct')}
                min={-1}
                max={15}
                step={0.25}
                unit="%"
                digits={2}
              />
              <ParamControl
                label="Foreign rate"
                value={params.foreignPct}
                onChange={set('foreignPct')}
                min={-1}
                max={15}
                step={0.25}
                unit="%"
                digits={2}
              />
              <ParamControl
                label="FX volatility"
                value={params.fxVolPct}
                onChange={set('fxVolPct')}
                min={0}
                max={40}
                step={0.5}
                unit="%"
                digits={1}
              />
              <ParamControl
                label="Asset–FX correlation"
                value={params.correlation}
                onChange={set('correlation')}
                min={-0.95}
                max={0.95}
                step={0.05}
                digits={2}
              />
            </PanelSection>
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Pricing failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
              <div>
                <p className="text-muted-foreground text-sm">Quanto {settled.kind} value</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight">
                  {data ? fixed(data.value, 4) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  Closed form · domestic currency per unit
                </p>
              </div>
              <div className="grid grid-cols-1 gap-px self-start overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
                <Stat
                  label="Drift adjustment"
                  value={data ? `${signed(data.drift_adjustment * 100, 2)}%/yr` : '—'}
                  hint="−ρ σ_S σ_FX on the asset’s growth"
                />
                <Stat
                  label="With zero correlation"
                  value={data ? fixed(data.uncorrelated_value, 4) : '—'}
                  hint="Same contract, no adjustment"
                />
                <Stat
                  label="Monte Carlo check"
                  value={data ? `${fixed(data.mc_value, 4)}` : '—'}
                  hint={
                    data
                      ? `± ${fixed(1.96 * data.mc_stderr, 4)} · asset and FX simulated jointly`
                      : ''
                  }
                />
              </div>
            </div>
          </Card>
          <CorrelationChart
            grid={data?.correlation_grid}
            values={data?.correlation_values}
            current={settled.correlation}
            stale={stale}
            description="Under the domestic pricing measure, the foreign stock’s growth shifts by −ρ σ_S σ_FX. With positive correlation the stock tends to rise when its currency strengthens, value you don’t receive at a fixed rate, so a quanto call is worth less."
          />
        </div>
      </div>
    </>
  )
}
