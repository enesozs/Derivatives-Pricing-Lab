import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useChartColors } from '@/components/charts/theme'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Stat, StatGrid } from '@/components/stat-grid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type CliquetRequest } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { HistogramChart, LinesChart } from '@/components/charts/simple-charts'
import { DEFAULT_MARKET, MarketSection, type MarketParams, toMarket } from './market-section'

interface Params {
  maturity: number
  perYear: number
  localCapPct: number
  localFloorPct: number
  globalFloor: boolean
  globalFloorPct: number
  volPct: number
  xi: number
  rho: number
  kappa: number
}

const DEFAULTS: Params = {
  maturity: 3,
  perYear: 4,
  localCapPct: 2,
  localFloorPct: 0,
  globalFloor: true,
  globalFloorPct: 2,
  volPct: 20,
  xi: 0.6,
  rho: -0.7,
  kappa: 1.5,
}

const pct = (v: number, digits = 2) => `${fixed(v * 100, digits)}%`

export default function CliquetPage() {
  const c = useChartColors()
  const [params, setParams] = useState(DEFAULTS)
  const [market, setMarket] = useState<MarketParams>(DEFAULT_MARKET)
  // One stable object per change, so the debounce settles instead of re-rendering forever.
  const inputs = useMemo(() => ({ params, market }), [params, market])
  const settled = useDebouncedValue(inputs, 200)
  const request = useMemo<CliquetRequest>(() => {
    const p = settled.params
    return {
      ...toMarket(settled.market),
      maturity: p.maturity,
      periods: p.maturity * p.perYear,
      local_floor: p.localFloorPct / 100,
      local_cap: p.localCapPct / 100,
      global_floor: p.globalFloor ? p.globalFloorPct / 100 : null,
      global_cap: null,
      volatility: p.volPct / 100,
      kappa: p.kappa,
      xi: p.xi,
      rho: p.rho,
      paths: 40_000,
    }
  }, [settled])
  const query = useQuery({
    queryKey: ['structured', 'cliquet', request],
    queryFn: ({ signal }) => api.cliquet(request, signal),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isPlaceholderData
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })
  const curves = data?.value_vs_local_cap
  const capSeries = curves
    ? (
        [
          ['Black–Scholes', c.series1, curves.black_scholes],
          ['Heston', c.series2, curves.heston],
        ] as const
      ).flatMap(([name, color, curve]) =>
        curve
          ? [
              {
                name,
                color,
                markers: true,
                points: curve.x.map((x, i) => [x * 100, curve.y[i] * 100] as [number, number]),
              },
            ]
          : [],
      )
    : []

  return (
    <>
      <PageHeader title="Cliquets and forward-start options">
        A cliquet pays the sum of the stock’s periodic returns, each capped and floored, often with
        a guaranteed minimum overall. Every period is an option whose strike is set when the period
        starts, so the price depends on future volatility, where models that agree on today’s prices
        can disagree badly.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Contract"
              hint="Payoff = max(global floor, Σ min(cap, max(floor, return))), paid at maturity."
            >
              <ParamControl
                label="Maturity"
                value={params.maturity}
                onChange={set('maturity')}
                min={1}
                max={5}
                step={1}
                unit="yrs"
              />
              <Segmented<string>
                label="Reset frequency"
                value={String(params.perYear)}
                onChange={(v) => set('perYear')(Number(v))}
                options={[
                  { value: '12', label: 'Monthly' },
                  { value: '4', label: 'Quarterly' },
                  { value: '1', label: 'Annual' },
                ]}
                className="w-full"
              />
              <ParamControl
                label="Local cap"
                value={params.localCapPct}
                onChange={set('localCapPct')}
                min={0.5}
                max={10}
                step={0.5}
                unit="%"
                digits={1}
              />
              <ParamControl
                label="Local floor"
                value={params.localFloorPct}
                onChange={set('localFloorPct')}
                min={-10}
                max={0}
                step={0.5}
                unit="%"
                digits={1}
              />
              <Segmented<string>
                label="Global floor"
                value={params.globalFloor ? 'on' : 'off'}
                onChange={(v) => set('globalFloor')(v === 'on')}
                options={[
                  { value: 'off', label: 'No guarantee' },
                  { value: 'on', label: 'Guaranteed minimum' },
                ]}
                className="w-full"
              />
              {params.globalFloor && (
                <ParamControl
                  label="Minimum total return"
                  value={params.globalFloorPct}
                  onChange={set('globalFloorPct')}
                  min={0}
                  max={15}
                  step={0.5}
                  unit="%"
                  digits={1}
                />
              )}
            </PanelSection>
            <Separator />
            <PanelSection
              title="Models"
              hint="Both start from the same volatility level. Heston adds random volatility; Black–Scholes keeps it constant."
            >
              <ParamControl
                label="Volatility level"
                value={params.volPct}
                onChange={set('volPct')}
                min={5}
                max={50}
                step={1}
                unit="%"
              />
              <ParamControl
                label="Vol of variance ξ"
                value={params.xi}
                onChange={set('xi')}
                min={0.05}
                max={1.5}
                step={0.05}
                digits={2}
              />
              <ParamControl
                label="Correlation ρ"
                value={params.rho}
                onChange={set('rho')}
                min={-0.95}
                max={0.95}
                step={0.05}
                digits={2}
              />
              <ParamControl
                label="Mean reversion κ"
                value={params.kappa}
                onChange={set('kappa')}
                min={0.2}
                max={8}
                step={0.1}
                digits={1}
              />
            </PanelSection>
            <Separator />
            <MarketSection market={market} onChange={setMarket} />
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
            <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
              <div>
                <p className="text-muted-foreground text-sm">Black–Scholes value</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {data ? pct(data.black_scholes.value) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {data?.closed_form != null
                    ? `Closed form ${pct(data.closed_form, 3)}`
                    : 'Global floor binds: no closed form'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Heston value</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {data ? pct(data.heston.value) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {data ? `± ${pct(1.96 * data.heston.stderr, 3)} · 40,000 paths` : ' '}
                </p>
              </div>
              <StatGrid className="self-start sm:col-span-2 lg:col-span-1">
                <Stat
                  label="Model gap"
                  value={
                    data
                      ? `${signed((data.heston.value - data.black_scholes.value) * 100, 2)} pts`
                      : '—'
                  }
                  hint="Same volatility level, different forward smile"
                />
              </StatGrid>
            </div>
          </Card>
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <CardHeader>
              <CardTitle className="text-base" render={<h2 />}>
                The building block: a forward-start option
              </CardTitle>
              <CardDescription>
                An at-the-money call whose strike is set in one year and which expires a year after
                that. Under Black–Scholes it is a scaled vanilla; under Heston its value depends on
                the volatility and skew the model expects in a year’s time.
              </CardDescription>
            </CardHeader>
            <CardPanel className="pt-0">
              <StatGrid className="grid-cols-1 sm:grid-cols-3">
                <Stat
                  label="Black–Scholes, closed form"
                  value={data ? fixed(data.forward_start_closed_form, 3) : '—'}
                  hint="S₀ e^(−q t₁) × BS(1, 1, 1y)"
                />
                <Stat
                  label="Black–Scholes, Monte Carlo"
                  value={data ? fixed(data.forward_start.black_scholes.value, 3) : '—'}
                  hint={
                    data
                      ? `± ${fixed(1.96 * data.forward_start.black_scholes.stderr, 3)}`
                      : undefined
                  }
                />
                <Stat
                  label="Heston, Monte Carlo"
                  value={data ? fixed(data.forward_start.heston.value, 3) : '—'}
                  hint={data ? `± ${fixed(1.96 * data.forward_start.heston.stderr, 3)}` : undefined}
                />
              </StatGrid>
            </CardPanel>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <LinesChart
              title="Value against the local cap"
              description="Raising the cap gives the holder more of each period’s upside. Heston’s fatter tails and negative skew change how much each extra point is worth."
              series={capSeries}
              xName="Local cap (%)"
              yName="Value (% of notional)"
              xFormat={(x) => fixed(x, 0)}
              yFormat={(y) => fixed(y, 1)}
              current={params.localCapPct}
              stale={stale}
              ariaLabel="Cliquet value against the local cap under both models"
            />
            <HistogramChart
              title="Total payoff across paths"
              description="Sum of the clipped returns. The spike on the left is the guaranteed minimum; the right edge is every period hitting the cap."
              histograms={
                data
                  ? [
                      { name: 'Black–Scholes', color: c.series1, data: data.payoffs_black_scholes },
                      { name: 'Heston', color: c.series2, data: data.payoffs_heston },
                    ]
                  : []
              }
              xName="Total payoff (% of notional)"
              xFormat={(x) => fixed(x * 100, 1)}
              stale={stale}
              ariaLabel="Distribution of the cliquet payoff under both models"
            />
          </div>
        </div>
      </div>
    </>
  )
}
